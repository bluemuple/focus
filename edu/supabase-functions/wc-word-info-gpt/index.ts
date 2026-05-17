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

    // Cache key: lowercased word + sentence hash + SCHEMA VERSION.
    // `v3:` invalidates v2 entries that lacked say_it / word_family /
    // similar / opposite / use_it fields — the new sidebar layout
    // needs all of them present, so we want a fresh GPT call once per
    // (word, sentence) tuple even if the v2 cache had a hit.
    const ck = "v3:" + word.toLowerCase() + ":" + (sentence ? await senseHash(sentence) : "_");
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
      "",
      "- pronunciation (string): UFLI Foundations notation, NOT IPA.",
      "  Slashes around the whole thing; hyphens between syllables for",
      "  multi-syllable words. The student will read this aloud to",
      "  themselves — pick symbols a Year-3 phonics learner already knows.",
      "",
      "  UFLI symbol palette — use ONLY these between the slashes:",
      "",
      "  SHORT VOWELS",
      "    /ă/ short a — cat, apple",
      "    /ĕ/ short e — bed, echo",
      "    /ĭ/ short i — sit, fix",
      "    /ŏ/ short o — hot, chop",
      "    /ŭ/ short u — cup, slug, son, love",
      "  LONG VOWELS",
      "    /ā/ long a — cake, nation, ai/ay/ea/eigh",
      "    /ē/ long e — bee, feature, ea/ee/y/ie",
      "    /ī/ long i — bike, vision, ie/igh",
      "    /ō/ long o — go, though, oa/ow/oe/ough",
      "    /ū/ long u (oo) — blue, school, ew/ui/ue/ou",
      "    /yū/ long u with y — cute, music, ew/eu/ue",
      "  DIPHTHONGS / SPECIAL",
      "    /aw/ — bought, saw, augh, au, aw, ough",
      "    /ow/ — cow, brown, ou",
      "    /oi/ — boy, coin, oi, oy",
      "    /ə/ schwa — about, station, sion, weak syllable",
      "  R-CONTROLLED",
      "    /ar/ — car, arch, far",
      "    /er/ — her, picture, sailor, ir/ur/or/ar weak",
      "    /or/ — for, chord, or",
      "    /air/ — air, care, bear, are, ear (= /air/)",
      "    /ear/ — ear, hear, near, deer, here",
      "  CONSONANTS (single)",
      "    /b/ /p/ /d/ /t/ /g/ /k/ /m/ /n/ /f/ /v/ /s/ /z/ /h/ /l/ /r/",
      "    /w/ /y/ /j/ (jet, gem, judge)",
      "  CONSONANT DIGRAPHS / CLUSTERS",
      "    /ng/ sing, ring",
      "    /nk/ think, sink",
      "    /sh/ ship, chef, tion, sion",
      "    /zh/ vision, measure",
      "    /th/ thin, this (both voiced & voiceless use /th/)",
      "    /ch/ chip, watch, picture",
      "",
      "  Concatenate symbols inside ONE pair of slashes. Hyphenate",
      "  syllables for ≥ 2-syllable words. Examples (NZ English):",
      "    kiwi      → /kē-wē/",
      "    optimise  → /ŏp-tə-mīz/",
      "    children  → /chĭl-drən/",
      "    pressure  → /prĕsh-ər/",
      "    nation    → /nā-shən/",
      "    bear      → /bair/",
      "    daughter  → /daw-tər/",
      "    school    → /skūl/",
      "    cute      → /kyūt/",
      "    measure   → /mĕzh-ər/",
      "    teacher   → /tē-chər/",
      "    bird      → /bĕrd/",
      "    sky       → /skī/",
      "",
      "  Use NEW ZEALAND English. NZ is non-rhotic-ish in colloquial",
      "  speech but for phonics teaching we still write the /r/ in",
      "  R-controlled vowels (car → /kar/, bird → /bĕrd/) — that's",
      "  how the symbol is taught regardless of accent strength.",
      "  Use NZ short-a /ă/ where US would: dance → /dăns/, last → /lăst/.",
      "  Do NOT use IPA symbols (ˈ kiː ə ʃ ɔː etc.) — UFLI ONLY.",
      "",
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
      "ADDITIONAL FIELDS for the new sidebar (always include):",
      "",
      "- say_it (array of EXACTLY 3 strings): progressively richer ways",
      "  to use the word so the student can practice aloud.",
      "  [0] just the word in the form most natural to say (often the lemma),",
      "  [1] a 2-4 word phrase including the word,",
      "  [2] a full short sentence using the word.",
      "  Example for `scared`:",
      "  [\"scared\", \"scared of\", \"I am scared of spiders.\"]",
      "  Example for `consult`:",
      "  [\"consult\", \"consult a map\", \"I consult my notes before a test.\"]",
      "",
      "- word_family (array of 2-5 strings): closely-related forms a",
      "  Year-3 student would recognise (the verb, the past, the -ing,",
      "  the noun, the adjective). Lowercase. Include the lemma itself.",
      "  Example for `scared` → [\"scare\", \"scared\", \"scary\"]",
      "  Example for `consult` → [\"consult\", \"consulted\", \"consulting\"]",
      "  If no meaningful family exists, return JUST [lemma].",
      "",
      "- similar (array of 1-3 strings): plain single-word synonyms a",
      "  Year-3 reader would already know. Lowercase. Empty array if",
      "  there's no kid-friendly synonym.",
      "  Example for `scared` → [\"afraid\", \"frightened\"]",
      "",
      "- opposite (array of 0-2 strings): single-word antonyms.",
      "  Lowercase. Empty array if no clean antonym exists.",
      "  Example for `scared` → [\"brave\"]",
      "  Example for `consult` → []   (no good antonym for Year-3)",
      "",
      "- use_it (string): one sentence frame the student can fill in",
      "  to USE the word about themselves. Always end the blank with",
      "  the literal text `____` (four underscores). 6-10 words total.",
      "  Example for `scared` → \"I feel scared when ____.\"",
      "  Example for `consult` → \"I consult ____ when I need help.\"",
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
    parsed.lemma         = String(parsed.lemma || word);
    parsed.pronunciation = String(parsed.pronunciation || parsed.ipa || "");
    parsed.definition    = String(parsed.definition || "");
    parsed.collocations  = Array.isArray(parsed.collocations) ? parsed.collocations.slice(0, 4) : [];
    parsed.examples      = Array.isArray(parsed.examples)     ? parsed.examples.slice(0, 3)     : [];
    parsed.say_it        = Array.isArray(parsed.say_it)       ? parsed.say_it.slice(0, 3).map(String)      : [];
    parsed.word_family   = Array.isArray(parsed.word_family)  ? parsed.word_family.slice(0, 5).map(String) : [];
    parsed.similar       = Array.isArray(parsed.similar)      ? parsed.similar.slice(0, 3).map(String)     : [];
    parsed.opposite      = Array.isArray(parsed.opposite)     ? parsed.opposite.slice(0, 2).map(String)    : [];
    parsed.use_it        = String(parsed.use_it || "");
    delete parsed.ipa;   // legacy key, replaced by `pronunciation`

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
