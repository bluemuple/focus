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
      "You split English sentences into syntactic chunks (meaning units)",
      "for visual highlighting in a language-learning app. JSON only.",
      "",
      "GOAL: every chunk is a complete syntactic phrase the reader",
      "processes as ONE meaning unit. Korean learners read English by",
      "phrase, not by word, so good chunking = comprehension.",
      "",
      "HARD LIMITS (NEVER violate):",
      "  • Each chunk is 6 words or fewer. NO exceptions — split longer",
      "    phrases at a syntactic sub-boundary (see SPLITTING below).",
      "  • Hyphenated tokens (\"quarter-century\", \"twenty-one\") = 1 word.",
      "  • Every word ∈ exactly one chunk; chunks in sentence order.",
      "",
      "SYNTACTIC CATEGORIES — chunk by these phrase types:",
      "  NP (Noun Phrase)         — det + adj* + N (+ PP/relative)",
      "    \"the tall man\", \"a strange new feeling\", \"his administration\"",
      "  VP (Verb Phrase)         — aux + V (+ object/complement)",
      "    \"has been waiting\", \"will not give up\", \"can speak French\"",
      "  PP (Prepositional)       — prep + NP",
      "    \"in the morning\", \"to the bank\", \"on Monday\"",
      "  AdvP (Adverbial)         — single or grouped adverbs",
      "    \"yesterday\", \"very quickly\", \"more than ever\"",
      "  Inf/Ger phrase           — to-infinitive or -ing phrase",
      "    \"to see my uncle\", \"freeing their ships\", \"running fast\"",
      "  RelClause / Appositive   — reduced or full",
      "    \"who came late\", \"called Project Freedom\"",
      "  Subject + short verb     — keep tight subjects with their verb",
      "    \"Mr. Trump said\", \"she asked\", \"the man left\"",
      "",
      "SPLITTING (when a phrase exceeds 6 words):",
      "  1. Split BEFORE a preposition: \"more than a quarter-century\" + \"ago\"",
      "     → keep them together if ≤6 words; split if longer.",
      "  2. Split BEFORE a relative pronoun (who / which / that / whose):",
      "     \"the man\" + \"who came late\".",
      "  3. Split BETWEEN coordinated phrases joined by AND/OR/BUT:",
      "     \"the cat and the dog\" → if ≤6 words OK; else split at the",
      "     conjunction.",
      "  4. Split AFTER a complete VP, BEFORE a separate adverbial:",
      "     \"would begin on Monday morning\" → \"would begin\" + \"on Monday morning\".",
      "  5. Split BEFORE a long Infinitive/Gerund phrase:",
      "     \"the country agreed to send help\" → \"the country agreed\"",
      "     + \"to send help\".",
      "  6. Split BEFORE a sentence-adverbial \"ever since / more than /",
      "     even though\" when it leads a long modifier.",
      "",
      "FUNCTION-WORD RULE: a single function word",
      "  (the / a / an / to / of / and / or / but / their / his / her /",
      "   help / with / for / on / in / at / from / by)",
      "  must NEVER be its own chunk — absorb it into an adjacent meaningful",
      "  chunk. The ONLY one-word chunks allowed:",
      "  • short conjunction joining clauses (and, but, so, after, because,",
      "    while, when, although, though)",
      "  • sentence-final adverb (yesterday, outside, today, now, here)",
      "",
      "QUOTES: a quoted phrase stays ONE chunk, including the quote marks.",
      "Punctuation tokens (commas, periods, quotes) are NOT separate chunks;",
      "they belong to the preceding chunk's text but don't count in `indices`.",
      "",
      "OUTPUT:",
      "{ chunks: [{ text, indices: [start, end] }] }",
      "  - indices = 0-based positions in the sentence's whitespace-split",
      "    words, IGNORING punctuation tokens. INCLUSIVE on both ends —",
      "    words 0-4 (5 words) → indices [0, 4].",
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
      "(\"more than a quarter-century ago\" = 5 words, OK; if it had been",
      " longer we'd split before \"ago\" or before \"more\".)",
      "",
      "Input:  \"The new policy that the government announced yesterday",
      "         will affect millions of people across the country.\"",
      "Output: [{text:\"The new policy\",indices:[0,2]},",
      "         {text:\"that the government announced\",indices:[3,6]},",
      "         {text:\"yesterday\",indices:[7,7]},",
      "         {text:\"will affect millions\",indices:[8,10]},",
      "         {text:\"of people\",indices:[11,12]},",
      "         {text:\"across the country\",indices:[13,15]}]",
      "(NP \"The new policy\" + relative clause \"that the government announced\"",
      " split for the 6-word limit; PP \"of people\" and \"across the country\"",
      " kept separate.)",
      "",
      "Input:  \"She has been working on her novel every night for the",
      "         past three months.\"",
      "Output: [{text:\"She has been working\",indices:[0,3]},",
      "         {text:\"on her novel\",indices:[4,6]},",
      "         {text:\"every night\",indices:[7,8]},",
      "         {text:\"for the past three months\",indices:[9,13]}]",
      "(VP \"has been working\" with subject \"She\"; PP \"on her novel\";",
      " AdvP \"every night\"; PP \"for the past three months\".)",
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
