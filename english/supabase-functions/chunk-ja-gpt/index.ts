// =============================================================
//   Supabase Edge Function: chunk-ja-gpt
//
//   Splits a Japanese sentence into beginner-friendly meaning chunks
//   when the local kuromoji-based chunker can't (typical for all-
//   hiragana stretches where kuromoji's IPADIC analyzer fails to find
//   word boundaries and emits a giant single 名詞 token).
//
//   The lesson page calls this fallback ONLY when kuromoji output
//   looks suspicious (e.g., a chunk > 10 chars, or the sentence is
//   mostly kana). For sentences with kanji, kuromoji works fine and
//   this function is never hit — keeping cost minimal.
//
//   Cache: same `chunk_gpt_cache` table the EN chunker uses; sentence
//   hashes are unique per language so there's no collision. A JP
//   sentence chunked once is reused by every device / user thereafter.
//
//   Request:  { sentence: "なにせひとのすむところのはるかかなたにいたんだから。" }
//   Response: { chunks: [
//     {"text":"なにせ"},
//     {"text":"ひとのすむところの"},
//     {"text":"はるかかなたに"},
//     {"text":"いたんだから。"}
//   ]}
//
//   Note: chunks have NO `indices` field — the client computes those
//   by walking the body's chip elements and matching textContent. This
//   keeps the Edge Function unaware of the client's tokenization.
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Hash includes a "ja:" prefix so JP sentences can never collide with
// EN sentences in the shared chunk_gpt_cache table — different prompts
// produce different chunk semantics.
async function hashSentence(s: string): Promise<string> {
  const norm = "ja:" + s.normalize("NFKC").trim();
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
    const url = `${SUPABASE_URL}/rest/v1/chunk_gpt_cache`
              + `?sentence_hash=eq.${encodeURIComponent(hash)}&select=chunks`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0]?.chunks || null;
  } catch { return null; }
}

async function writeCache(hash: string, chunks: any): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/chunk_gpt_cache`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ sentence_hash: hash, chunks }),
    });
  } catch {}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const sentence = String(body?.sentence || "").trim();
    if (!sentence) return json({ error: "sentence required" }, 400);

    const hash = await hashSentence(sentence);
    const cached = await readCache(hash);
    if (cached) return json({ chunks: cached });

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const sys = [
      "Split a Japanese sentence into BEGINNER-FRIENDLY meaning chunks",
      "(意味단락). Each chunk is a complete phrase a learner reads as one",
      "breath: a subject phrase, an object phrase, an adverbial of",
      "time / place / reason, or a predicate.",
      "",
      "RULES:",
      "1. Topic markers は / も start their own chunks: 「ぼくも / 食べても」.",
      "2. Coordinated lists with と / や / か stay together: 「うさぎと熊とりすが」.",
      "3. Connector clauses ending in から / ので / のに / けど / と form",
      "   their own chunk with the verb included: 「みんなで食べると」.",
      "4. Bound modifiers (ある, この, 連体詞) stay with the noun they",
      "   modify: 「ある朝」, 「ある人」.",
      "5. The verb predicate at the end of a clause is its OWN chunk:",
      "   「ケーキを / 持ってきました」. But subordinate verbs (-て, -で,",
      "   relative clauses) bind back to their phrase: 「材料を混ぜて」.",
      "6. CONCATENATING all chunks (in order, NO spaces between) MUST",
      "   reproduce the input EXACTLY — every kana, every kanji, every",
      "   punctuation mark. Punctuation belongs to whichever chunk it",
      "   sits next to in the source.",
      "",
      "OUTPUT — JSON only, no markdown, no prose:",
      '  {"chunks":[{"text":"<chunk1>"},{"text":"<chunk2>"}, ...]}',
      "",
      "EXAMPLE 1",
      "Input:  ある森に、うさぎと熊とりすが住んでいました。",
      'Output: {"chunks":[{"text":"ある森に、"},{"text":"うさぎと熊とりすが"},{"text":"住んでいました。"}]}',
      "",
      "EXAMPLE 2 (all-hiragana, kuromoji can't tokenize)",
      "Input:  なにせひとのすむところのはるかかなたにいたんだから。",
      'Output: {"chunks":[{"text":"なにせ"},{"text":"ひとのすむところの"},{"text":"はるかかなたに"},{"text":"いたんだから。"}]}',
      "",
      "EXAMPLE 3 (verb te-form subordination)",
      "Input:  みんなで材料を混ぜて、ケーキを焼きました。",
      'Output: {"chunks":[{"text":"みんなで"},{"text":"材料を混ぜて、"},{"text":"ケーキを"},{"text":"焼きました。"}]}',
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
    // Validate: chunks concatenated must reproduce input exactly. If
    // GPT returns slight variations (extra/missing punctuation) we
    // refuse to cache so the next caller can retry.
    const recon = parsed.chunks.map((c: any) => String(c?.text || "")).join("");
    if (recon !== sentence) {
      return json({
        error: "Round-trip mismatch",
        expected: sentence,
        got: recon,
        chunks: parsed.chunks,
      }, 502);
    }
    writeCache(hash, parsed.chunks);
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
