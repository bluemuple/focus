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
    // Phase 3c: clients pass `lang` ('en' | 'ja') so the prompt can
    // adapt its dictionary style and the cache stays separated. Old
    // clients that don't send `lang` default to 'en' for back-compat.
    const lang = String(body?.lang || "en").toLowerCase();
    if (!word) return json({ error: "word required" }, 400);

    // Cache key includes language so EN ↔ JA entries don't collide.
    // English keeps the legacy un-prefixed key for back-compat (every
    // existing cached row was English).
    const cacheKey = lang === "en" ? word.toLowerCase() : (lang + ":" + word.toLowerCase());

    // L2 cache check — any device/user seen this word? Skip GPT.
    const cached = await readCache(cacheKey);
    if (cached) return json(cached);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    // Per-language prompt. EN: classic English dictionary entry.
    // JA: Japanese dictionary entry — lemma is the basic_form, reading
    // is hiragana, level uses JLPT (N5..N1), pos uses Japanese grammar
    // labels (動詞/名詞/形容詞/副詞/...). Collocation `phrase` uses the
    // bare lemma (verbs in 辞書形, no 〜ます / 〜た inflection).
    const sysEn = [
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

    const sysJa = [
      "Bilingual Japanese→Korean dictionary for Korean learners. JSON only.",
      "PLAIN TEXT — never use markdown (no **bold**, no *italic*, no `code`).",
      "",
      "Keys:",
      "- lemma (string): the dictionary form (辞書形 / basic_form). For",
      "  verbs use the る/う ending; for adjectives the い/な form.",
      "  Example: input 食べた → lemma 食べる. Input 行きました → lemma 行く.",
      "- ipa (string): the LEMMA's hiragana reading (NOT katakana, NOT IPA).",
      "  Example: lemma 食べる → ipa \"たべる\". Lemma 学校 → \"がっこう\".",
      "- level: JLPT band as a string \"N5\" / \"N4\" / \"N3\" / \"N2\" / \"N1\".",
      "- pos: Japanese POS — 動詞 / 名詞 / 形容詞 / 形容動詞 / 副詞 /",
      "  助詞 / 助動詞 / 接続詞 / 感動詞 / 接頭辞 / 接尾辞.",
      "- senses: 3-5 frequency-sorted [{pos, ko, example}]. The `example`",
      "  is a short Japanese sentence using the lemma; `ko` is its",
      "  Korean meaning of THAT specific sense.",
      "- collocations: 4 frequent [{phrase, ko}]. STRICT RULES for `phrase`:",
      "    • ALWAYS use the LEMMA form (辞書形), never an inflected form.",
      "      Even if the input is 食べた / 食べました, every `phrase` uses",
      "      the bare lemma 食べる.",
      "    • Examples — input 食べた → phrases like \"食べ過ぎる\",",
      "      \"食べ放題\", \"ご飯を食べる\" (NEVER \"食べた放題\").",
      "    • Input 行きました → \"〜に行く\", \"行ってきます\"",
      "      (NEVER \"行きました\").",
      "    • Particle patterns are fine (〜を, 〜に, 〜と) when typical.",
      "- examples: 2 fresh [{en, ko}] — `en` field holds the Japanese",
      "  example sentence (the field name is kept as `en` for client",
      "  compatibility; semantically it's the source-language sentence).",
      "  Each sentence uses the lemma in a common context, paired with",
      "  its Korean translation.",
    ].join("\n");

    const sys = lang === "ja" ? sysJa : sysEn;

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
