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

// Stable hash of the input sentence — same approach as chunk-gpt.
// We don't aggressively normalize (no lowercase / whitespace collapse)
// because Japanese is whitespace-free and the EXACT character sequence
// matters: "今日" vs "今日 " (trailing space) might genuinely render
// differently depending on how the author included punctuation.
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

// Unicode kanji ranges — same as the client's _isKanjiChar regex so
// validation here matches what the renderer will look for.
const KANJI_RE = /[一-鿿㐀-䶿豈-﫿]/;
const ALL_KANJI_RE = /^[一-鿿㐀-䶿豈-﫿]+$/;
const ALL_HIRAGANA_RE = /^[ぁ-ゖ]+$/;

// Validate that `ruby` segments concatenate to the input sentence and
// that each segment is either ALL kanji (with reading) or NO kanji
// (without reading). Returns true if valid, false if malformed.
function validateRuby(ruby: any[], sentence: string): boolean {
  if (!Array.isArray(ruby) || ruby.length === 0) return false;
  let recon = "";
  for (const seg of ruby) {
    const t = String(seg?.t ?? "");
    const r = String(seg?.r ?? "");
    if (!t) return false;
    const hasKanji = KANJI_RE.test(t);
    if (hasKanji) {
      // Kanji segment: every char must be kanji, reading must be hiragana.
      if (!ALL_KANJI_RE.test(t)) return false;
      if (!r || !ALL_HIRAGANA_RE.test(r)) return false;
    } else {
      // Non-kanji segment: must be empty reading. Reading != "" is
      // either GPT padding or schema misuse.
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

    // Cloud cache check.
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
      "RULES:",
      "1. Each segment is EITHER all-kanji OR no-kanji. Never mix.",
      "2. For kanji segments, `r` is the contextually-correct hiragana",
      "   reading (NOT katakana, NOT romaji, NOT spaces).",
      "3. For non-kanji segments (kana, punctuation, ASCII), `r` is \"\".",
      "4. Concatenating all `t` values must reproduce the input EXACTLY",
      "   character-for-character — every kana, punctuation, space",
      "   preserved.",
      "5. Adjacent kanji chars usually belong in ONE segment when they",
      "   form a compound word (今日 → きょう, 学校 → がっこう). Split",
      "   only when they're separate words.",
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
      "EXAMPLE 3",
      "Input:  食べることが好きだ。",
      'Output: {"ruby":[{"t":"食","r":"た"},{"t":"べることが","r":""},{"t":"好","r":"す"},{"t":"きだ。","r":""}]}',
    ].join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        // 0 → identical splits for the same sentence every time.
        temperature: 0,
        // ~3 tokens per output segment + sentence text. 800 covers
        // long news-style sentences with plenty of headroom.
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
    // Fire-and-forget cache write.
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
