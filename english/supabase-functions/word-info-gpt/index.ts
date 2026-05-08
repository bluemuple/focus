// =============================================================
//   Supabase Edge Function: word-info-gpt
//
//   One call returns the dictionary-style info a learner needs for a
//   single word: lemma, IPA, level, POS, frequency-sorted senses,
//   collocations, and example sentences. Sentence-dependent fields
//   (the contextual Korean meaning, syntactic phrase chunk) were
//   REMOVED — they're now handled by `Translate.translate(word, sent)`
//   (DeepL) and `chunk-gpt` respectively, so this function's output is
//   purely word-level and can be aggressively cached across all
//   sessions, devices, and users.
//
//   Cost-saving design:
//     1. Cloud-side shared cache in Supabase table `word_info_gpt_cache`
//        keyed by word (lowercased). Same word seen by ANY user/device
//        in the past = zero GPT call. The client's localStorage cache
//        is now the L1; this is L2.
//     2. Output schema trimmed (no `ko`, no `phraseChunk`, no
//        `mnemonic`). max_tokens dropped 450 → 350.
//     3. Cache key is word-only — same word across different sentences
//        = one stored row, NOT N rows.
//
//   Deploy:
//     1. Edge Functions → New function → name "word-info-gpt"
//     2. Paste this whole file as the body
//     3. Secret OPENAI_API_KEY = sk-…   (shared with translate-gpt etc.)
//     4. (Optional) Disable "Verify JWT with legacy secret" if your
//        publishable key isn't a JWT.
//     5. Run the SQL in supabase-cache-schema.sql to create the cache
//        table (one-time setup; idempotent IF NOT EXISTS).
//
//   Request:  { word: "customers" }
//   Response: { lemma, ipa, level, pos, senses, collocations, examples }
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// PostgREST helpers — direct REST calls so we don't pull in the
// supabase-js client (smaller bundle, faster cold-start).
async function readCache(key: string): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/word_info_gpt_cache`
              + `?cache_key=eq.${encodeURIComponent(key)}&select=data`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0]?.data || null;
  } catch { return null; }
}

async function writeCache(key: string, data: any): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/word_info_gpt_cache`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        // resolution=merge-duplicates → upsert behaviour on the cache_key PK.
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ cache_key: key, data }),
    });
  } catch {}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const word = String(body?.word || "").trim();
    // `sentence` is intentionally IGNORED — kept in the type only so old
    // clients that still send it don't trigger a 400. The output is
    // sentence-independent now.
    if (!word) return json({ error: "word required" }, 400);

    const cacheKey = word.toLowerCase();

    // L2 cache check — any device/user seen this word? Skip GPT.
    const cached = await readCache(cacheKey);
    if (cached) return json(cached);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    // Compact word-only prompt — sentence-dependent fields were dropped.
    const sys = [
      "Bilingual English→Korean dictionary for Korean learners. JSON only.",
      "PLAIN TEXT — never use markdown (no **bold**, no *italic*, no `code`).",
      "",
      "Keys:",
      "- lemma (string), ipa (slashes included), level (A1-C2), pos.",
      "- senses: 3-5 frequency-sorted [{pos, ko, example}].",
      "- collocations: 4 frequent [{phrase, ko}]. STRICT RULES for `phrase`:",
      "    • ALWAYS use the LEMMA form, never inflected (-ed / -ing / -s /",
      "      -es / -ied). Even if the input word is inflected (\"stretched\",",
      "      \"running\"), every collocation `phrase` must use the bare lemma.",
      "    • Examples — input \"stretched\" → phrases like \"stretch out\",",
      "      \"stretch thin\", \"stretch one's legs\" (NEVER \"stretched out\").",
      "    • Input \"running\" → \"run for office\", \"run a business\"",
      "      (NEVER \"running for office\").",
      "    • Input \"applies\" → \"apply for\", \"apply to\" (NEVER \"applies for\").",
      "- examples: 2 fresh [{en, ko}].",
    ].join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        // 350 caps the response just above what the trimmed schema needs
        // (no ko, no phraseChunk, no mnemonic).
        max_tokens: 350,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user",   content: `Word: ${JSON.stringify(word)}` },
        ],
      }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return json({ error: "OpenAI " + r.status, detail: txt.slice(0, 400) }, 502);
    }
    const j = await r.json();
    const raw = j?.choices?.[0]?.message?.content || "";
    let parsed: any = null;
    try { parsed = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed) return json({ error: "Bad GPT output", raw: raw.slice(0, 400) }, 502);

    // Fire-and-forget cache write — don't block response on the cache
    // INSERT. If it fails (network blip, DB hiccup) the next caller
    // just pays for one more GPT call. No correctness impact.
    writeCache(cacheKey, parsed);

    return json(parsed);
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
