// =============================================================
//   Supabase Edge Function: translate-gpt
//
//   Returns a Korean translation of arbitrary text via GPT-4o-mini,
//   given an OPTIONAL surrounding sentence as context. GPT handles
//   whole-sentence context far better than DeepL on short polysemic
//   words ("holding" → "유지되고 있다" in cease-fire context, vs
//   DeepL's chunk-isolated "개최 중").
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const text    = String(body?.text || "").trim();
    const context = String(body?.context || "").trim();
    const source  = String(body?.source || "EN").toUpperCase();   // 'EN' | 'JA'
    const target  = String(body?.target || "KO").toUpperCase();   // always 'KO' for now
    if (!text) return json({ error: "text required" }, 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const sourceName = source === "JA" ? "Japanese" : "English";
    const sys = [
      `You translate ${sourceName} to Korean for a Korean learner. JSON only.`,
      "PLAIN TEXT — no markdown, no quotes around the value.",
      "",
      "Return: { translation: string }",
      "",
      "Rules:",
      "- The translation must contain at least one Hangul character.",
      "- Pick the meaning that fits the SENTENCE context, not the most",
      "  frequent dictionary sense.",
      "- For short polysemic words, the surrounding sentence is the",
      "  source of truth — never echo the source-language word back.",
      source === "JA"
        ? '- For Japanese: respect inflection (動詞活用形) — translate the form as it appears, not just the dictionary form.'
        : '- For English: respect tense and number — "was holding" ≠ "holds".',
    ].join("\n");

    const user = context
      ? `Sentence: ${JSON.stringify(context)}\nWord/Phrase: ${JSON.stringify(text)}`
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
