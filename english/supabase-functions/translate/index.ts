// =============================================================
//   Supabase Edge Function: translate
//
//   DeepL-backed translation proxy. This is the PRIMARY translation
//   engine for both English and Japanese lesson pages — every word
//   click in default mode hits this function (the GPT engine only
//   runs when ✨ is toggled on). It accepts either a single text or
//   a batch and returns Korean.
//
//   Cloud cache: identical (source, target, context, text) tuples
//   are stored in `translate_deepl_cache`. First user pays DeepL,
//   every other device / user thereafter hits the cache for free.
//   This is the biggest cost saver on the EN page since DeepL is
//   the default engine and the same word in the same lesson is
//   re-translated by every visitor.
//
//   Request (single):
//     { text: string, source: 'EN'|'JA', target: 'KO', context?: string }
//   Response (single):
//     { translation: string }
//
//   Request (batch — used by page prefetch):
//     { texts: string[], source, target: 'KO', context? }
//   Response (batch):
//     { translations: string[] }
//
//   Deploy:
//     1. Edge Functions → translate (already exists; replace body)
//     2. Secrets DEEPL_API_KEY (existing) and DEEPL_API_URL (optional;
//        defaults to free endpoint).
//     3. SQL once: ensure `translate_deepl_cache` exists (see
//        supabase-cache-schema.sql).
//
//   ⚠️ This file was reconstructed from the client API contract —
//   double-check it matches the existing deployed function before
//   replacing. The cache logic is the only NEW behaviour; everything
//   else is a clean DeepL proxy.
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// DeepL endpoint — defaults to free tier. Pro accounts can override
// via the DEEPL_API_URL secret (e.g. "https://api.deepl.com/v2/translate").
const DEEPL_API_URL = Deno.env.get("DEEPL_API_URL") || "https://api-free.deepl.com/v2/translate";

// ---------- cache helpers ----------
// Key shape mirrors translate-gpt: SHA-256 prefix of
// "<source>:<target>:<context>:::<text>". Same (text, context) tuple
// translated before by ANY user → cache hit.
async function cacheKey(text: string, context: string, source: string, target: string): Promise<string> {
  const norm = source + ":" + target + ":" + (context || "").normalize("NFKC").trim() + ":::" + text.normalize("NFKC").trim();
  const buf = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function readCacheOne(key: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/translate_deepl_cache`
              + `?cache_key=eq.${encodeURIComponent(key)}&select=translation`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0]?.translation || null;
  } catch { return null; }
}

// Batch read — single PostgREST call with `cache_key=in.(...)` so the
// page prefetch's 30-item batch costs ONE round trip, not 30. Returns
// a Map<key, translation> with the rows that were found; missing keys
// are simply absent (callers must check).
async function readCacheMany(keys: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !keys.length) return map;
  try {
    // PostgREST `in` syntax: cache_key=in.(k1,k2,k3). Quote each key in
    // case it contains commas/parens (cache keys are hex but safer to
    // quote regardless).
    const list = keys.map(k => `"${k.replace(/"/g, '\\"')}"`).join(",");
    const url = `${SUPABASE_URL}/rest/v1/translate_deepl_cache`
              + `?cache_key=in.(${encodeURIComponent(list)})&select=cache_key,translation`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      },
    });
    if (!r.ok) return map;
    const arr = await r.json();
    for (const row of (Array.isArray(arr) ? arr : [])) {
      if (row?.cache_key && row?.translation) map.set(row.cache_key, row.translation);
    }
  } catch {}
  return map;
}

async function writeCacheOne(key: string, translation: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/translate_deepl_cache`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ cache_key: key, translation }),
    });
  } catch {}
}

// Batch write — one POST with an array of rows. PostgREST accepts a
// JSON array body and applies the `Prefer: resolution=merge-duplicates`
// upsert to all of them at once.
async function writeCacheMany(rows: { cache_key: string; translation: string }[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !rows.length) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/translate_deepl_cache`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    });
  } catch {}
}

// ---------- DeepL helpers ----------
// DeepL accepts `text` as a repeated form param. We POST form-urlencoded
// since DeepL's JSON support is Pro-only on some plans — form is the
// universally supported shape.
async function callDeepL(texts: string[], source: string, target: string, context: string): Promise<string[]> {
  const apiKey = Deno.env.get("DEEPL_API_KEY");
  if (!apiKey) throw new Error("DEEPL_API_KEY not set");

  const form = new URLSearchParams();
  for (const t of texts) form.append("text", t);
  form.append("target_lang", target.toUpperCase());
  if (source) form.append("source_lang", source.toUpperCase());
  if (context) form.append("context", context);

  const r = await fetch(DEEPL_API_URL, {
    method: "POST",
    headers: {
      "Authorization": "DeepL-Auth-Key " + apiKey,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error("DeepL " + r.status + ": " + txt.slice(0, 200));
  }
  const j = await r.json();
  const arr = (j?.translations || []) as { text: string }[];
  return arr.map(x => String(x?.text || "").trim());
}

// ---------- request handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const source  = String(body?.source || "EN").toUpperCase();
    const target  = String(body?.target || "KO").toUpperCase();
    const context = String(body?.context || "").trim();

    // ----- batch path -----
    // Client sends `texts: string[]` (page prefetch). Cache lookup is
    // batched in ONE PostgREST call, then any misses go to DeepL in
    // ONE form-encoded POST, then misses are written back in ONE
    // upsert. So a 30-item batch costs at most 3 round trips total
    // even on a cold cache.
    if (Array.isArray(body?.texts)) {
      const texts: string[] = body.texts.map((t: any) => String(t || "").trim());
      const keys: string[] = await Promise.all(
        texts.map(t => t ? cacheKey(t, context, source, target) : Promise.resolve(""))
      );
      const cached = await readCacheMany(keys.filter(k => k));
      const out: string[] = new Array(texts.length).fill("");
      const missIdx: number[] = [];
      const missTexts: string[] = [];
      for (let i = 0; i < texts.length; i++) {
        if (!texts[i]) continue;
        const hit = cached.get(keys[i]);
        if (hit) { out[i] = hit; continue; }
        missIdx.push(i);
        missTexts.push(texts[i]);
      }
      if (missTexts.length) {
        const fresh = await callDeepL(missTexts, source, target, context);
        const rows: { cache_key: string; translation: string }[] = [];
        for (let k = 0; k < missIdx.length; k++) {
          const i = missIdx[k];
          const tr = fresh[k] || "";
          out[i] = tr;
          if (tr) rows.push({ cache_key: keys[i], translation: tr });
        }
        // Fire-and-forget upsert.
        writeCacheMany(rows);
      }
      return json({ translations: out });
    }

    // ----- single path -----
    const text = String(body?.text || "").trim();
    if (!text) return json({ error: "text required" }, 400);

    const ck = await cacheKey(text, context, source, target);
    const cached = await readCacheOne(ck);
    if (cached) return json({ translation: cached });

    const arr = await callDeepL([text], source, target, context);
    const translation = (arr[0] || "").trim();
    if (!translation) return json({ error: "DeepL empty" }, 502);
    writeCacheOne(ck, translation);
    return json({ translation });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
