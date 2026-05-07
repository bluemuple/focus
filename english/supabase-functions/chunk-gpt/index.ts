// =============================================================
//   Supabase Edge Function: chunk-gpt
//
//   Splits an English sentence into syntactic chunks for use as the
//   "wider glow" outline on mobile single-mode (when the user taps a
//   word, the entire chunk it belongs to also gets a soft glow). Run
//   ONCE per sentence and cache — every word in the same sentence
//   shares the result.
//
//   Deploy:
//     1. Edge Functions → New function → name "chunk-gpt"
//     2. Paste this whole file as the body
//     3. Secret OPENAI_API_KEY (shared with word-info-gpt etc.)
//     4. (Optional) Disable "Verify JWT with legacy secret" if your
//        publishable key isn't a JWT.
//
//   Request:  { sentence: "I went to China to see my uncle yesterday." }
//   Response: { chunks: [
//     { text: "I went to China",  indices: [0, 3] },
//     { text: "to see my uncle",  indices: [4, 7] },
//     { text: "yesterday",        indices: [8, 8] }
//   ]}
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
    const sentence = String(body?.sentence || "").trim();
    if (!sentence) return json({ error: "sentence required" }, 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const sys = [
      "Split the English sentence into syntactic chunks. JSON only.",
      "",
      "Group words by clausal/phrase role:",
      "  subject NP, verb phrase, prepositional phrase, infinitive",
      "  phrase, adverbial, conjunction, complement, etc.",
      "Each clause = one chunk. Aim for 4-8 chunks for a 10-word sentence.",
      "Don't split too small (single function words) or too large (full clauses",
      "that should split). Conjunctions like \"and\", \"but\" are their own chunks.",
      "",
      "Output: { chunks: [{ text, indices: [start, end] }] }",
      "  - indices are 0-based positions in the sentence's whitespace-split",
      "    words, IGNORING punctuation tokens.",
      "  - Every word MUST belong to exactly one chunk; chunks must be in",
      "    sentence order; ranges must not overlap.",
      "  - text is the joined chunk words (single spaces).",
      "",
      "Examples:",
      "  \"I went to China to see my uncle yesterday.\"",
      "  → [{text:\"I went to China\",indices:[0,3]},",
      "     {text:\"to see my uncle\",indices:[4,7]},",
      "     {text:\"yesterday\",indices:[8,8]}]",
      "  \"I want to go out and take some pictures outside.\"",
      "  → [{text:\"I want to\",indices:[0,2]},",
      "     {text:\"go out\",indices:[3,4]},",
      "     {text:\"and\",indices:[5,5]},",
      "     {text:\"take some pictures\",indices:[6,8]},",
      "     {text:\"outside\",indices:[9,9]}]",
    ].join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,                   // low — we want consistent splits
        max_tokens: 350,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user",   content: `Sentence: ${JSON.stringify(sentence)}` },
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
    if (!parsed || !Array.isArray(parsed.chunks)) {
      return json({ error: "Bad GPT output", raw: raw.slice(0, 400) }, 502);
    }
    return json({ chunks: parsed.chunks });
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
