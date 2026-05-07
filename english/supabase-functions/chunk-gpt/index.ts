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
      "You split English sentences into syntactic chunks for visual",
      "highlighting in a language-learning app. JSON only.",
      "",
      "GOAL: produce groupings of 2-5 adjacent words that read as one",
      "meaningful unit. Each clause / phrase / adverbial = one chunk.",
      "",
      "RULES:",
      "1. HARD LIMIT: each chunk MUST be 7 words or fewer. If a clause is",
      "   longer than 7 words, split it at the most natural sub-boundary",
      "   (after a preposition, before a relative clause, between a verb",
      "   phrase and its modifier). Hyphenated tokens (e.g. \"quarter-",
      "   century\") count as ONE word.",
      "2. NEVER make a single function word (the / a / to / of / and /",
      "   their / his / help / with / for / on / in / at) its own chunk —",
      "   absorb it into the adjacent meaningful chunk. The only one-word",
      "   chunks allowed are short conjunctions (and, but, so, after,",
      "   because, while, when) used to JOIN clauses, OR a sentence-final",
      "   adverb (yesterday, outside, today).",
      "3. Group:",
      "   - Subject + small verb     → \"Mr. Trump said\", \"she asked\"",
      "   - Noun phrase w/ modifiers → \"the initiative\", \"his administration\"",
      "   - Reduced relative / appositive → \"called Project Freedom\"",
      "   - Prepositional phrase     → \"on Monday morning\", \"to the bank\"",
      "   - Verb + object            → \"heard from nations\", \"seeking help\"",
      "   - Gerund / infinitive phrase → \"freeing their ships\", \"to see my uncle\"",
      "4. QUOTED phrases stay together as ONE chunk, INCLUDING the quote",
      "   marks. NEVER split inside quotes.",
      "5. Punctuation tokens (commas, periods, quotes) are NOT separate",
      "   chunks; they belong to the preceding chunk's text but don't",
      "   count toward `indices`.",
      "6. Aim for 5-12 chunks for 15+ word sentences. Don't fragment.",
      "",
      "OUTPUT:",
      "{ chunks: [{ text, indices: [start, end] }] }",
      "  - indices = 0-based positions in the sentence's whitespace-split",
      "    words, IGNORING punctuation tokens. INCLUSIVE on both ends —",
      "    a chunk that spans words 0 through 4 has indices [0, 4] (5 words).",
      "  - Every word ∈ exactly one chunk; chunks in sentence order.",
      "",
      "EXAMPLES:",
      "",
      "Input:  \"I went to China to see my uncle yesterday.\"",
      "Output: [{text:\"I went to China\",indices:[0,3]},",
      "         {text:\"to see my uncle\",indices:[4,7]},",
      "         {text:\"yesterday\",indices:[8,8]}]",
      "",
      "Input:  \"I want to go out and take some pictures outside.\"",
      "Output: [{text:\"I want to go out\",indices:[0,4]},",
      "         {text:\"and\",indices:[5,5]},",
      "         {text:\"take some pictures outside\",indices:[6,9]}]",
      "",
      "Input:  \"Ever since coming to power more than a quarter-century ago,",
      "         Russian President Vladimir Putin has shaped the country.\"",
      "Output: [{text:\"Ever since coming to power\",indices:[0,4]},",
      "         {text:\"more than a quarter-century ago\",indices:[5,9]},",
      "         {text:\"Russian President Vladimir Putin\",indices:[10,13]},",
      "         {text:\"has shaped the country\",indices:[14,17]}]",
      "(Note: the 10-word adverbial \"Ever since coming to power more than a",
      " quarter-century ago\" is split into 5+5 to honor the 7-word limit.)",
      "",
      "Input:  \"Mr. Trump said the initiative, called Project Freedom, would",
      "         begin on Monday morning \\\"Middle East time,\\\" after his",
      "         administration heard from nations seeking help freeing their ships.\"",
      "Output: [{text:\"Mr. Trump said\",indices:[0,2]},",
      "         {text:\"the initiative\",indices:[3,4]},",
      "         {text:\"called Project Freedom\",indices:[5,7]},",
      "         {text:\"would begin\",indices:[8,9]},",
      "         {text:\"on Monday morning\",indices:[10,12]},",
      "         {text:\"\\\"Middle East time,\\\"\",indices:[13,15]},",
      "         {text:\"after his administration\",indices:[16,18]},",
      "         {text:\"heard from nations\",indices:[19,21]},",
      "         {text:\"seeking help\",indices:[22,23]},",
      "         {text:\"freeing their ships\",indices:[24,26]}]",
    ].join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        // Very low — we want IDENTICAL splits every time so the same
        // sentence always highlights the same chunks. Even at 0.2 we
        // saw drift; 0.0 locks the output.
        temperature: 0.0,
        // Bumped from 350 → 500 — long news-style sentences (20+ words)
        // were occasionally truncated.
        max_tokens: 500,
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
