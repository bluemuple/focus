// =============================================================
//   Supabase Edge Function: story-gpt
//
//   Generates a tiny English mini-lesson ("단어 스토리") that uses
//   3 mastered words from the learner's vocabulary. Returns a
//   short title and 1–3 sentence body the home page can display.
//
//   Deploy steps (Supabase dashboard):
//     1. Edge Functions → New function → name: "story-gpt"
//     2. Paste this whole file as the body
//     3. Save secret  OPENAI_API_KEY = sk-…
//     4. (Optional) Disable "Verify JWT with legacy secret" if your
//        publishable key isn't a JWT — same as for translate-gpt.
//
//   Request:
//     { words: ["sincere","ambition","glance"], level?: "easy"|"medium" }
//   Response:
//     { title: "…", body: "…", words: [...] }
//   On error: { error: "…" } with a non-2xx status.
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
    const { words, level } = await req.json();

    if (!Array.isArray(words) || words.length < 1) {
      return json({ error: "words[] required" }, 400);
    }
    // De-dup + normalise + cap to 5 (we only use 3, but be lenient).
    const clean = Array.from(new Set(
      words.map((w: unknown) => String(w || "").trim()).filter(Boolean)
    )).slice(0, 5);
    if (clean.length < 1) return json({ error: "no usable words" }, 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const lvl = (level === "medium") ? "intermediate" : "easy";
    const sys = [
      "You write tiny English mini-lessons for Korean learners of English.",
      "Output exactly valid JSON with two keys: \"title\" and \"body\".",
      "title: a short noun phrase (max 6 words) capturing the topic.",
      "body: 1 to 3 short, natural English sentences (under 50 words total)",
      `that use ALL of the given words verbatim, at a ${lvl} reading level.`,
      "Do not translate to Korean. Do not add commentary. JSON only.",
    ].join(" ");

    const user = `Words to use: ${clean.map(w => `"${w}"`).join(", ")}`;

    // Call OpenAI Chat Completions with JSON-only output.
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.8,
        max_tokens: 220,
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

    let parsed: { title?: string; body?: string } = {};
    try { parsed = JSON.parse(raw); } catch {
      // Fallback: try to extract a JSON block by braces if the model
      // accidentally wraps the response in prose.
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    const title = String(parsed.title || "").trim();
    const body  = String(parsed.body  || "").trim();

    if (!title || !body) {
      return json({ error: "Bad GPT output", raw: raw.slice(0, 400) }, 502);
    }

    return json({ title, body, words: clean });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
