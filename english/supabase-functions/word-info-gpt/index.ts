// =============================================================
//   Supabase Edge Function: word-info-gpt
//
//   One call returns everything the sidebar / bottom-sheet needs for
//   a clicked word: contextual meaning, popular senses, collocations,
//   examples, a Korean mnemonic, AND the syntactic phrase chunk that
//   the target word belongs to in the surrounding sentence.
//
//   Deploy:
//     1. Edge Functions → New function → name "word-info-gpt"
//     2. Paste this whole file as the body
//     3. Secret OPENAI_API_KEY = sk-…   (shared with translate-gpt etc.)
//     4. (Optional) Disable "Verify JWT with legacy secret" if your
//        publishable key isn't a JWT.
//
//   Request:  { word: "customers", sentence: "The shop has many loyal customers." }
//   Response: { lemma, ipa, level, pos, ko, senses, collocations,
//               examples, mnemonic, phraseChunk }
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const word = String(body?.word || "").trim();
    const sentence = String(body?.sentence || "").trim();
    if (!word) return json({ error: "word required" }, 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const sys = [
      "You are a bilingual English-to-Korean dictionary for Korean learners.",
      "Return ONLY valid JSON. No prose, no markdown.",
      "",
      "Required keys:",
      "- lemma: base form of the word (string).",
      "- ipa: IPA pronunciation, slashes included (string).",
      "- level: CEFR — A1|A2|B1|B2|C1|C2 (string).",
      "- pos: primary part of speech, e.g. \"noun\", \"verb\" (string).",
      "- ko: contextual Korean translation that fits the given sentence (string).",
      "- senses: 3-6 most common meanings, sorted by frequency.",
      "    Each: { pos, ko, example } where example is a short natural English sentence.",
      "- collocations: 4-6 most frequent pairings.",
      "    Each: { phrase: phrase containing the lemma, ko: Korean translation }.",
      "- examples: 2-3 fresh natural example sentences (different from senses' examples).",
      "    Each: { en: string, ko: string }.",
      "- mnemonic: { text, highlights }",
      "    text: a Korean memory tip under 60 chars. Pick the BEST strategy for THIS word —",
      "      etymology breakdown, sound association with Korean, visual imagery,",
      "      related-word family, or mnemonic story. Vary across calls.",
      "    highlights: array of substrings inside text that should be visually emphasised",
      "      (typically the etymology fragments, English roots, or sound-mapped Korean).",
      "      Don't list Korean particles or filler words.",
      "",
      "If a sentence is provided, ALSO return:",
      "- phraseChunk: the syntactic group containing the target word in the sentence.",
      "    Group words by clausal/phrase role: subject NP, verb phrase, prepositional phrase,",
      "    infinitive phrase, adverbial. Each clause is one chunk.",
      "    Example: \"I went to China to see my uncle yesterday\" splits into",
      "      [\"I went to China\", \"to see my uncle\", \"yesterday\"].",
      "    Format: { text: chunk text, indices: [start, end] }.",
      "    indices are 0-based positions in the sentence's whitespace-split words,",
      "    IGNORING punctuation. The target word's index falls within [start, end].",
    ].join("\n");

    const user = sentence
      ? `Word: ${JSON.stringify(word)}\nSentence: ${JSON.stringify(sentence)}`
      : `Word: ${JSON.stringify(word)}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 900,
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
