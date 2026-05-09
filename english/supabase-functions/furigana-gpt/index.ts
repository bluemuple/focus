// =============================================================
//   Supabase Edge Function: furigana-gpt
//
//   Returns context-accurate furigana annotations for a Japanese
//   sentence. The lesson page calls this once per body line on first
//   JP-mode entry; subsequent loads hit the cloud cache and pay zero
//   GPT calls. Rendering on the client uses kuromoji for tokenization
//   (chips, click-to-look-up, lemma, POS) but pulls READINGS from this
//   function so 何ですか reads as なん, 今日 as きょう, 一日 picks the
//   right ついたち / いちにち for the context, etc. — things kuromoji +
//   IPADIC can't do because they store ONE reading per dictionary
//   entry.
//
//   Output format:
//     { "ruby": [
//         { "t": "<text>",    "r": "" },         ← non-kanji segment
//         { "t": "<kanji>",   "r": "<hiragana>" } ← kanji segment
//         ...
//     ] }
//   Concatenating all `t` values reconstructs the input exactly.
//   Each kanji segment is a contiguous run of one or more kanji chars
//   with its in-context hiragana reading. Each non-kanji segment is a
//   contiguous run of NON-kanji characters (kana, punctuation, ASCII)
//   with empty reading.
//
//   Strict server-side validation: any GPT response that violates the
//   schema (mixed kanji+kana segment, reading on a kana segment, or
//   round-trip mismatch) is rejected with 502 and NOT cached, so the
//   next request retries. This protects the client renderer from ever
//   seeing a segment like {t:"見つけたこのみ", r:"みつけたこのみ"} —
//   which would render as one big run-on ruby block.
//
//   Deploy:
//     1. Edge Functions → New function → name "furigana-gpt"
//     2. Paste this whole file as the body
//     3. Secret OPENAI_API_KEY (shared with chunk-gpt etc.)
//     4. (Optional) Disable "Verify JWT with legacy secret" if your
//        publishable key isn't a JWT.
//     5. Run the SQL in supabase-cache-schema.sql to ensure the
//        `furigana_gpt_cache` table exists.
//
//   Request:  { sentence: "お名前は何ですか。" }
//   Response: { ruby: [ {t:"お",r:""}, {t:"名前",r:"なまえ"}, … ] }
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function hashSentence(s: string): Promise<string> {
  const norm = s.normalize("NFKC").trim();
  const buf = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function readCache(hash: string): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/furigana_gpt_cache`
              + `?sentence_hash=eq.${encodeURIComponent(hash)}&select=ruby`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0]?.ruby || null;
  } catch { return null; }
}

async function writeCache(hash: string, ruby: any): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/furigana_gpt_cache`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ sentence_hash: hash, ruby }),
    });
  } catch {}
}

const KANJI_RE        = /[一-鿿㐀-䶿豈-﫿]/;
const ALL_KANJI_RE    = /^[一-鿿㐀-䶿豈-﫿]+$/;
const ALL_HIRAGANA_RE = /^[ぁ-ゖー]+$/;

// Strict schema validation. Each segment must be EITHER:
//   • All-kanji surface with non-empty hiragana reading, OR
//   • No-kanji surface with empty reading.
// AND the concat of all `t` values equals the input. Anything else
// (mixed surfaces, reading-on-kana, partial chars) is rejected — the
// renderer can't safely place ruby over a mixed surface, and we'd
// rather pay one more GPT call next time than serve corrupt data.
function validateRuby(ruby: any[], sentence: string): boolean {
  if (!Array.isArray(ruby) || ruby.length === 0) return false;
  let recon = "";
  for (const seg of ruby) {
    const t = String(seg?.t ?? "");
    const r = String(seg?.r ?? "");
    if (!t) return false;
    const hasKanji = KANJI_RE.test(t);
    if (hasKanji) {
      if (!ALL_KANJI_RE.test(t)) return false;
      if (!r || !ALL_HIRAGANA_RE.test(r)) return false;
    } else {
      if (r) return false;
    }
    recon += t;
  }
  return recon === sentence;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const sentence = String(body?.sentence || "").trim();
    if (!sentence) return json({ error: "sentence required" }, 400);

    const hash = await hashSentence(sentence);
    const cached = await readCache(hash);
    if (cached) return json({ ruby: cached });

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const sys = [
      "You are a Japanese furigana annotator. Given a Japanese sentence,",
      "split it into segments and output JSON describing each segment's",
      "text and (for kanji segments) its in-context hiragana reading.",
      "",
      "OUTPUT SCHEMA — return EXACTLY this shape:",
      '  {"ruby":[{"t":"<chars>","r":"<hiragana or empty>"}, ...]}',
      "",
      "RULES (STRICT — violations cause hard failure on the server):",
      "1. EACH SEGMENT IS EITHER ALL-KANJI OR NO-KANJI. NEVER MIX.",
      "   • Verbs/adjectives like 食べる, 持ってきました, 甘い, 見つけた",
      "     MUST be split: { 食 + べる }, { 持 + ってきました },",
      "     { 甘 + い }, { 見 + つけた }. The kanji segment carries the",
      "     reading; the trailing-kana segment has r=\"\".",
      "2. For kanji segments, `r` is the contextually-correct hiragana",
      "   reading of THAT kanji-only segment (NOT katakana, NOT romaji,",
      "   NOT the reading of the whole word). e.g. for 食べる split as",
      "   食/べる: r for 食 is \"た\", NOT \"たべる\".",
      "3. For non-kanji segments (kana, punctuation, ASCII), r=\"\".",
      "4. Concatenating all `t` values must reproduce the input EXACTLY",
      "   character-for-character — every kana, punctuation, space",
      "   preserved.",
      "5. Adjacent kanji chars usually belong in ONE segment when they",
      "   form a compound word (今日 → きょう, 学校 → がっこう, 木実 →",
      "   このみ). Split only when they're separate words.",
      "6. Common context-dependent readings:",
      "   • 何 + です/だ/の/counter → なん;  何 + bare → なに",
      "   • 今日 → きょう (vs 今 + 日);  今年 → ことし",
      "   • 一日: depends — beginning of month → ついたち, duration → いちにち",
      "   • 上手 → じょうず;  下手 → へた;  生む / 生きる / 生まれる differ.",
      "7. Output JSON ONLY. No prose, no markdown, no leading text.",
      "",
      "EXAMPLE 1",
      "Input:  お名前は何ですか。",
      'Output: {"ruby":[{"t":"お","r":""},{"t":"名前","r":"なまえ"},{"t":"は","r":""},{"t":"何","r":"なん"},{"t":"ですか。","r":""}]}',
      "",
      "EXAMPLE 2",
      "Input:  今日は学校で日本語を勉強しました。",
      'Output: {"ruby":[{"t":"今日","r":"きょう"},{"t":"は","r":""},{"t":"学校","r":"がっこう"},{"t":"で","r":""},{"t":"日本語","r":"にほんご"},{"t":"を","r":""},{"t":"勉強","r":"べんきょう"},{"t":"しました。","r":""}]}',
      "",
      "EXAMPLE 3 (verb + adjective splitting — CRITICAL)",
      "Input:  熊は、甘いはちみつを持ってきました。",
      'Output: {"ruby":[{"t":"熊","r":"くま"},{"t":"は、","r":""},{"t":"甘","r":"あま"},{"t":"いはちみつを","r":""},{"t":"持","r":"も"},{"t":"ってきました。","r":""}]}',
      "",
      "EXAMPLE 4 (multi-kanji compound)",
      "Input:  りすは森で見つけた木実を持ってきました。",
      'Output: {"ruby":[{"t":"りすは","r":""},{"t":"森","r":"もり"},{"t":"で","r":""},{"t":"見","r":"み"},{"t":"つけた","r":""},{"t":"木実","r":"このみ"},{"t":"を","r":""},{"t":"持","r":"も"},{"t":"ってきました。","r":""}]}',
    ].join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 800,
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
    if (!parsed || !Array.isArray(parsed.ruby)) {
      return json({ error: "Bad GPT output", raw: raw.slice(0, 400) }, 502);
    }
    if (!validateRuby(parsed.ruby, sentence)) {
      // Don't cache malformed output — next caller can retry.
      return json({
        error: "Round-trip / schema validation failed",
        ruby: parsed.ruby,
        sentence,
      }, 502);
    }
    writeCache(hash, parsed.ruby);
    return json({ ruby: parsed.ruby });
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
