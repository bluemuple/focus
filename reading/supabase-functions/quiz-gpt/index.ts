// =============================================================
//   Supabase Edge Function: quiz-gpt
//
//   Generates animal-catch quiz questions for WordCatch via GPT-
//   4o-mini. Questions are tailored to:
//     - the word that triggered the encounter (in its sentence)
//     - the encounter level (1..10) → number + difficulty of qs
//
//   The prompt enforces NZ English, Year-4 vocabulary, exactly 4
//   MCQ choices each, and JSON-only output so the client can parse
//   without regex acrobatics.
//
//   Cloud cache: same (word, sentence, level, count) → cached
//   questions. First student in the class triggers GPT, every
//   other student catching the same word at the same level gets
//   instant questions for free. Cache table: wc_quiz_cache.
//
//   Deploy:
//     1. Edge Functions → New function → name "quiz-gpt"
//     2. Paste this whole file as the body
//     3. Secret OPENAI_API_KEY (shared with translate-gpt etc.)
//     4. SQL once:
//        create table if not exists wc_quiz_cache (
//          cache_key text primary key,
//          payload jsonb not null,
//          created_at timestamptz default now()
//        );
//        alter table wc_quiz_cache enable row level security;
//        create policy wc_quiz_cache_dev on wc_quiz_cache for all using (true) with check (true);
//
//   Request:  { word, sentence, level (1..10), count (1..10) }
//   Response: { questions: [{ type, prompt, choices: string[], correct_index }] }
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function cacheKey(word: string, sentence: string, level: number, count: number): Promise<string> {
  const norm = `${level}:${count}:${word.toLowerCase().trim()}:::${sentence.normalize("NFKC").trim()}`;
  const buf = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function readCache(key: string): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/wc_quiz_cache?cache_key=eq.${encodeURIComponent(key)}&select=payload`;
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0]?.payload || null;
  } catch { return null; }
}
async function writeCache(key: string, payload: any): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wc_quiz_cache`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ cache_key: key, payload }),
    });
  } catch {}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body     = await req.json();
    const word     = String(body?.word || "").trim();
    const sentence = String(body?.sentence || "").trim();
    const level    = Math.max(1, Math.min(10, parseInt(String(body?.level || "1"), 10) || 1));
    const count    = Math.max(1, Math.min(10, parseInt(String(body?.count || "2"), 10) || 2));

    if (!word) return json({ error: "word required" }, 400);

    const ck = await cacheKey(word, sentence, level, count);
    const cached = await readCache(ck);
    if (cached) return json({ ...cached, cached: true });

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    // Build the difficulty-aware question type mix. Year-4 readers
    // (8-9 years old) need very plain language — even at Lv 10 we
    // stay reading-comprehension, never grammar terminology.
    const TYPE_MIX: Record<number, string[]> = {
      1: ["meaning"],
      2: ["meaning", "context"],
      3: ["meaning", "context"],
      4: ["meaning", "context", "context"],
      5: ["meaning", "context", "context", "usage"],
      6: ["meaning", "context", "usage", "usage"],
      7: ["meaning", "context", "usage", "usage", "synonym"],
      8: ["context", "usage", "synonym", "synonym"],
      9: ["context", "usage", "synonym", "inference"],
      10:["usage", "synonym", "inference", "inference"],
    };
    const wanted = TYPE_MIX[level] || ["meaning"];
    const typesForCount = Array.from({ length: count }, (_, i) => wanted[i % wanted.length]);

    const sys = [
      `You write very short reading-comprehension quiz questions for an 8-9 year old`,
      `student in New Zealand (Year 4). The student just read this sentence and`,
      `tapped on the word "${word}":`,
      ``,
      `  "${sentence}"`,
      ``,
      `Write exactly ${count} questions about that word, IN THE ORDER given by`,
      `these types: ${JSON.stringify(typesForCount)}.`,
      ``,
      `Type guide:`,
      `  - "meaning":   "What does <word> mean here?" — 4 short definitions, 1 right.`,
      `  - "context":   "What is <word> doing in the sentence?" / "Why is <word> mentioned?"`,
      `  - "usage":     "Which sentence uses <word> the SAME way?" — 4 sample sentences.`,
      `  - "synonym":   "Which word means almost the same as <word> here?" — 4 single-word options.`,
      `  - "inference": "From the sentence, what is most likely true about <word>?" — 4 short claims.`,
      ``,
      `Rules:`,
      `- Use NZ English: colour, favourite, mum, sweets, lolly, etc.`,
      `- Vocabulary at Year-4 level. NEVER use grammar terms like "noun"`,
      `  "verb" "adjective" — kids haven't met them formally.`,
      `- Each question has EXACTLY 4 choices.`,
      `- Each choice ≤ 12 words.`,
      `- Exactly one correct answer; \`correct_index\` is 0..3.`,
      `- Choices should be plausibly close — no "obviously wrong" filler.`,
      `- For "meaning" / "synonym": all 4 options are the same part of speech / register.`,
      `- Difficulty rises with the question's index — q[0] easier than q[${count-1}].`,
      ``,
      `Return JSON ONLY (no markdown, no commentary):`,
      `{ "questions": [`,
      `  { "type": "meaning", "prompt": "…", "choices": ["…","…","…","…"], "correct_index": 0 }`,
      `] }`,
    ].join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,   // small variance between students seeing the same word
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user",   content: `Generate the ${count} questions now.` },
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
    if (!parsed || !Array.isArray(parsed.questions)) {
      return json({ error: "Bad GPT output", raw: raw.slice(0, 400) }, 502);
    }
    // Sanitise: enforce 4-choice MCQs, drop malformed entries.
    parsed.questions = parsed.questions.filter((q: any) =>
      q && typeof q.prompt === "string"
        && Array.isArray(q.choices) && q.choices.length === 4
        && q.choices.every((c: any) => typeof c === "string")
        && Number.isInteger(q.correct_index)
        && q.correct_index >= 0 && q.correct_index < 4
    ).slice(0, count);

    if (!parsed.questions.length) {
      return json({ error: "no valid questions", raw: raw.slice(0, 400) }, 502);
    }

    writeCache(ck, parsed);
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
