// =============================================================
//   Supabase Edge Function: wc-word-info-gpt   (WordCatch only)
//
//   ⚠️  DEPLOY NAME MUST BE "wc-word-info-gpt" — NOT "word-info-gpt".
//      The parent 또박또박 site already has its own `word-info-gpt`
//      deployed in this same Supabase project; deploying THIS file
//      under that name would overwrite it and break Korean learners.
//      The `wc-` prefix scopes this function to WordCatch.
//
//   Returns a dictionary entry tuned for NZ Year-3 readers
//   (7-8 yr olds). One call per (word, sentence) → cached
//   server-side so every classmate seeing the same word in the
//   same sentence reads instantly without paying for the GPT
//   call again.
//
//   Output:
//     {
//       lemma:         "kiwi",
//       ipa:           "/ˈkiː.wi/",
//       definition:    "A small brown bird from New Zealand.",
//       collocations: [
//         { phrase: "kiwi bird",          gloss: "the bird's full name" },
//         { phrase: "a kiwi fruit",       gloss: "the green fruit" },
//         { phrase: "a Kiwi from Auckland", gloss: "a person from NZ" }
//       ],
//       examples: [
//         { en: "The kiwi only comes out at night.", note: "" }
//       ]
//     }
//
//   Deploy:
//     1. Edge Functions → New function → name "wc-word-info-gpt"
//        (NOT "word-info-gpt" — that name is taken by 또박또박!)
//     2. Paste this file
//     3. Secret OPENAI_API_KEY (shared with other GPT functions)
//     4. SQL once:
//        create table if not exists wc_word_info_cache (
//          cache_key text primary key,
//          data jsonb not null,
//          created_at timestamptz default now()
//        );
//        alter table wc_word_info_cache enable row level security;
//        create policy wc_word_info_cache_dev on wc_word_info_cache for all using (true) with check (true);
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function readCache(key: string): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/wc_word_info_cache?cache_key=eq.${encodeURIComponent(key)}&select=data`;
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0]?.data || null;
  } catch { return null; }
}
async function writeCache(key: string, data: any): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wc_word_info_cache`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ cache_key: key, data }),
    });
  } catch {}
}

async function senseHash(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const word     = String(body?.word     || "").trim();
    const sentence = String(body?.sentence || "").trim();
    if (!word) return json({ error: "word required" }, 400);

    // Cache key: lowercased word + short hash of the sentence context.
    // Different sentences for the same word (e.g. "bear" the animal vs
    // "bear" the verb) cache separately so the sense matches.
    const ck = word.toLowerCase() + ":" + (sentence ? await senseHash(sentence) : "_");
    const cached = await readCache(ck);
    if (cached) return json({ ...cached, cached: true });

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const sys = [
      "You write tiny dictionary entries for a New Zealand Year-3 student",
      "(age 7-8). Use plain NZ English. Short sentences. No grammar terms",
      "like \"noun\" or \"adjective\" — kids haven't met them. JSON only.",
      "",
      "Keys:",
      "- lemma (string): the dictionary form of the word (singular,",
      "  base verb, etc.). Input \"runs\" → lemma \"run\".",
      "- ipa (string): IPA in slashes, e.g. \"/ˈkiː.wi/\". One pronunciation,",
      "  the one most natural for NZ English.",
      "- definition (string): ONE sentence, ≤ 15 words, that a 7-year-old",
      "  could read aloud. The MEANING MUST MATCH HOW THE WORD IS USED IN",
      "  THE GIVEN SENTENCE (sense disambiguation), not the most frequent",
      "  dictionary sense. Examples:",
      "    word=\"bear\", sentence=\"She had to bear the cold wind.\"",
      "    → definition: \"To put up with something difficult.\"",
      "    word=\"bear\", sentence=\"A brown bear walked through the trees.\"",
      "    → definition: \"A big furry wild animal.\"",
      "- collocations: 3 short, FREQUENT pairings. Each entry",
      "  { phrase: string, gloss: string }. `phrase` uses the LEMMA form",
      "  (never inflected). `gloss` is a 3-7 word friendly explanation.",
      "- examples: 2 short, fresh sentences a Year-3 student could read.",
      "  Each entry { en: string, note: string }. `note` may be empty.",
      "",
      "Use NZ spelling: colour, favourite, mum, lolly, rubbish bin, etc.",
    ].join("\n");

    const userContent = sentence
      ? `Word: ${JSON.stringify(word)}\nSentence: ${JSON.stringify(sentence)}`
      : `Word: ${JSON.stringify(word)}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 380,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user",   content: userContent },
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
    if (!parsed || !parsed.definition) {
      return json({ error: "Bad GPT output", raw: raw.slice(0, 400) }, 502);
    }

    // Defensive defaults so the client renderer never blows up.
    parsed.lemma        = String(parsed.lemma || word);
    parsed.ipa          = String(parsed.ipa || "");
    parsed.definition   = String(parsed.definition || "");
    parsed.collocations = Array.isArray(parsed.collocations) ? parsed.collocations.slice(0, 4) : [];
    parsed.examples     = Array.isArray(parsed.examples)     ? parsed.examples.slice(0, 3)     : [];

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
