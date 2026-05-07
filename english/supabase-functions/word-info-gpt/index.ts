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

    // Compact system prompt — same schema, less noise = faster TTFT.
    // Mnemonic field intentionally dropped: chunk-gpt + the chunk-tx
    // panel give the user better context than forced one-liner mnemonics.
    // Removing it shaves ~80 tokens of output and ~60-100 ms TTFT.
    const sys = [
      "Bilingual English→Korean dictionary for Korean learners. JSON only.",
      "PLAIN TEXT — never use markdown (no **bold**, no *italic*, no `code`).",
      "",
      "Keys:",
      "- lemma (string), ipa (slashes included), level (A1-C2), pos.",
      "- ko: contextual Korean meaning matching the sentence.",
      "- senses: 3-5 frequency-sorted [{pos, ko, example}].",
      "- collocations: 4 frequent [{phrase: includes lemma, ko}].",
      "- examples: 2 fresh [{en, ko}].",
      "",
      "If sentence given, also:",
      "- phraseChunk: {text, indices: [start, end]} = syntactic group containing",
      "  the target word. Group by clausal role (subject NP / verb phrase /",
      "  prepositional / infinitive / adverbial). indices are 0-based whitespace",
      "  word positions, ignoring punctuation. Target word index ∈ [start, end].",
      "  Example: \"I went to China to see my uncle yesterday\" →",
      "    \"I went to China\" / \"to see my uncle\" / \"yesterday\".",
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
        // 450 caps the response just above what the trimmed schema needs
        // (no mnemonic) — smaller cap = API stops sooner = faster.
        max_tokens: 450,
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
