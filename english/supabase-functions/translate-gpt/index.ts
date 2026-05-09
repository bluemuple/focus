// =============================================================
//   Supabase Edge Function: translate-gpt
//
//   Returns a Korean translation of arbitrary text via GPT-4o-mini,
//   given an OPTIONAL surrounding sentence as context. GPT handles
//   whole-sentence context far better than DeepL on short polysemic
//   words ("holding" → "유지되고 있다" in cease-fire context, vs
//   DeepL's chunk-isolated "개최 중").
//
//   Cloud cache: identical (text, context, source) tuples cache in
//   `translate_gpt_cache`. First user pays, every other device /
//   user thereafter hits the cache for free. Hash key is short
//   SHA-256 of the canonicalized tuple — no PII stored, just the
//   text that was translated.
//
//   Phase 3 update: accepts a `source` param ('EN' | 'JA') so the
//   same function can serve both English and Japanese learning
//   modes. Prompt adapts accordingly — JP mode also asks GPT to
//   pick the right contextual sense for short polysemic Japanese
//   words ("いる" / "ある" / "なる" etc.).
//
//   Deploy:
//     1. Edge Functions → New function → name "translate-gpt"
//     2. Paste this whole file as the body
//     3. Secret OPENAI_API_KEY (shared with chunk-gpt etc.)
//     4. SQL once: ensure `translate_gpt_cache` table exists
//        (see supabase-cache-schema.sql).
//
//   Request:  { text: "holding", context: "the cease-fire was holding",
//               source: "EN", target: "KO" }
//   Response: { translation: "유지되고 있다" }
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Cache key — SHA-256 of "<source>:<target>:<context>:<text>". Includes
// language pair so EN→KO and JA→KO of the same string never collide,
// and includes context so different sentences of the same word cache
// independently (a polysemic word's translation depends on context).
async function cacheKey(text: string, context: string, source: string, target: string): Promise<string> {
  const norm = source + ":" + target + ":" + (context || "").normalize("NFKC").trim() + ":::" + text.normalize("NFKC").trim();
  const buf = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function readCache(key: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/translate_gpt_cache`
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

async function writeCache(key: string, translation: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/translate_gpt_cache`, {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const text    = String(body?.text || "").trim();
    const context = String(body?.context || "").trim();
    const source  = String(body?.source || "EN").toUpperCase();   // 'EN' | 'JA'
    const target  = String(body?.target || "KO").toUpperCase();   // always 'KO' for now
    if (!text) return json({ error: "text required" }, 400);

    // Cloud cache check — same (text, context, source, target) tuple
    // already translated by ANY device / user → return cached value,
    // no GPT call. Cache key spans languages so EN↔JA can't collide.
    const ck = await cacheKey(text, context, source, target);
    const cached = await readCache(ck);
    if (cached) return json({ translation: cached });

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const sourceName = source === "JA" ? "Japanese" : "English";
    const sys = [
      `You translate a single ${sourceName} WORD or PHRASE into Korean for`,
      `a Korean learner. The "Sentence" field is provided ONLY as context`,
      `for disambiguation — DO NOT translate the whole sentence.`,
      "",
      "Return JSON ONLY (no markdown, no quotes around value):",
      "  { translation: string }",
      "",
      "Rules:",
      "- Translate the Word/Phrase ONLY. The output should be a short",
      "  Korean rendering of the SAME word/phrase as it functions in the",
      "  given sentence — typically 1–6 syllables long. NEVER return a",
      "  translation of the whole Sentence.",
      "- The translation must contain at least one Hangul character.",
      "- Pick the meaning that fits the SENTENCE context, not the most",
      "  frequent dictionary sense.",
      "- For short polysemic words, the surrounding sentence is the",
      "  source of truth — never echo the source-language word back.",
      source === "JA"
        ? '- For Japanese: respect inflection (動詞活用形) — translate the form as it appears, not just the dictionary form. Examples:\n  ・"する" → "하다", "している" → "하고 있다 / 있는", "した" → "했다"\n  ・"見る" → "보다", "見えなかった" → "보이지 않았다"'
        : '- For English: respect tense and number — "was holding" ≠ "holds".',
      "",
      "EXAMPLE",
      'Sentence: "The cease-fire was holding."',
      'Word/Phrase: "holding"',
      'Output: { "translation": "유지되고 있다" }',
      "",
      "EXAMPLE (JP — short word, long sentence)",
      'Sentence: "へとへとにも、はらぺこにも、びくびくしているようにも見えなかった。"',
      'Word/Phrase: "している"',
      'Output: { "translation": "하고 있는" }',
    ].join("\n");

    const user = context
      ? `Sentence: ${JSON.stringify(context)}\nWord/Phrase: ${JSON.stringify(text)}\n\nReturn the Korean translation of the Word/Phrase ONLY (not the sentence).`
      : `Word/Phrase: ${JSON.stringify(text)}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user",   content: user },
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
    const translation = String(parsed.translation || "").trim();
    if (!translation) return json({ error: "empty translation" }, 502);
    // Fire-and-forget cache write.
    writeCache(ck, translation);
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
