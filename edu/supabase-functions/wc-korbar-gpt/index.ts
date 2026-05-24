// =============================================================
//   Supabase Edge Function: wc-korbar-gpt   (WordCatch only)
//
//   Generates the "Kor Bar" (Korean sidebar) content for a Korean
//   child (age 7-9) learning English. Two request kinds:
//
//     { kind: "word", word, sentence }
//       → { lemma, pronunciation, easy_en, ko, word_family[], similar[],
//           opposite[] }
//
//     { kind: "chunks", sentence }
//       → { chunks: [ { text, ko, easy_en } ] }
//
//   `easy_en` is a VERY simple English gloss (beginner level);
//   `ko` is the natural Korean meaning fitting the sentence sense.
//
//   ⚠️  DEPLOY NAME MUST BE "wc-korbar-gpt" — the `wc-` prefix
//       scopes it to WordCatch in the shared Supabase project.
//
//   Cloud cache: `wc_korbar_cache`, keyed by kind + word + sense.
//   The teacher dashboard's 🇰🇷 prewarm button fans out to this fn.
//
//   Deploy:
//     1. Edge Functions → New function → name "wc-korbar-gpt"
//     2. Paste this whole file
//     3. Secret OPENAI_API_KEY (shared with the other GPT functions)
//     4. SQL once — run edu/supabase-add-korbar-cache.sql
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function readCache(key: string): Promise<unknown | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/wc_korbar_cache?cache_key=eq.${encodeURIComponent(key)}&select=data`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` } });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0]?.data || null;
  } catch { return null; }
}
async function writeCache(key: string, data: unknown): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wc_korbar_cache`, {
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
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

const WORD_SYS = [
  "You help a Korean child (age 7-9) learning English understand ONE",
  "English word as it is used in a sentence. Reply with JSON only.",
  "Keys:",
  "- lemma (string): the dictionary base form of the word.",
  "- pronunciation (string): UFLI Foundations notation, NOT IPA.",
  "  Slashes around the whole thing; hyphens between syllables for",
  "  multi-syllable words. Use ONLY the UFLI symbol palette below.",
  "  SHORT VOWELS  /ă/ cat  /ĕ/ bed  /ĭ/ sit  /ŏ/ hot  /ŭ/ cup",
  "  LONG VOWELS   /ā/ cake /ē/ bee /ī/ bike /ō/ go /ū/ blue(oo) /yū/ cute",
  "  DIPHTHONGS    /aw/ saw  /ow/ cow  /oi/ boy  /ə/ schwa (about)",
  "  R-CONTROLLED  /ar/ car  /er/ her  /or/ for  /air/ care  /ear/ ear",
  "  CONSONANTS    /b/ /p/ /d/ /t/ /g/ /k/ /m/ /n/ /f/ /v/ /s/ /z/ /h/",
  "                /l/ /r/ /w/ /y/ /j/ (jet, gem, judge)",
  "  DIGRAPHS      /ng/ /nk/ /sh/ /zh/ vision /th/ (thin & this) /ch/",
  "  Concatenate symbols inside ONE pair of slashes; hyphenate syllables.",
  "  Examples: kiwi → /kē-wē/  children → /chĭl-drən/  nation → /nā-shən/",
  "  teacher → /tē-chər/  bird → /bĕrd/  cute → /kyūt/  school → /skūl/",
  "  Do NOT use IPA symbols (ˈ kiː ə ʃ ɔː etc.) — UFLI symbols ONLY.",
  "- easy_en (string): the meaning in VERY simple English — beginner",
  "  level, 8 words or fewer, only words a young learner knows. It must",
  "  match how the word is used in the GIVEN sentence.",
  "- ko (string): this word's Korean meaning — one short word or phrase,",
  "  dictionary style. Use the sentence only to choose the right sense.",
  "  Do NOT translate the whole sentence.",
  "  ✓ 'wants' in \"He wants some lunch.\" → \"원해요\" NOT \"그는 점심을 원해요\"",
  "  ✓ 'buy' in \"Don't buy a dead one.\" → \"사다\"",
  "- word_family (array of 2-5 lowercase strings): related forms,",
  "  including the lemma. e.g. scared → [\"scare\",\"scared\",\"scary\"].",
  "- similar (array of 0-3 lowercase strings): simple synonyms.",
  "- opposite (array of 0-2 lowercase strings): simple antonyms.",
].join("\n");

const CHUNKS_SYS = [
  "You help a Korean child (age 7-9) learning English. Split the given",
  "English sentence into meaning chunks (phrases of 6 words or fewer)",
  "the way a reader naturally groups them. Reply with JSON only:",
  "{ \"chunks\": [ { \"text\": string, \"ko\": string, \"easy_en\": string } ] }",
  "- text: the chunk exactly as it appears in the sentence, in order.",
  "- ko: the chunk's natural Korean meaning (short).",
  "- easy_en: the chunk's meaning in very simple English (<= 8 words).",
].join("\n");

const TRANSLATE_SYS = [
  "Translate the given English sentence into natural, simple Korean a",
  "child (age 7-9) would understand. Reply with JSON only:",
  "{ \"ko\": string }  — one short, natural Korean sentence.",
].join("\n");

const COMP_SYS = [
  "You read a short English passage and write reading-comprehension",
  "questions for a Korean child (age 7-9) learning English. Write 3",
  "questions. BOTH the questions AND every answer choice must be in",
  "KOREAN. Each question checks whether the child understood the",
  "passage's content. Reply with JSON only:",
  "{ \"questions\": [ { \"prompt\": string, \"choices\": [4 strings],",
  "  \"correctIndex\": number } ] }",
  "- prompt: the question, in Korean.",
  "- choices: exactly 4 answer options, in Korean; exactly one correct.",
  "- correctIndex: 0-3, the index of the correct choice.",
  "Keep the language simple; every question must be answerable from",
  "the passage alone.",
].join("\n");

const CHUNK_SYS = [
  "You help a Korean child (age 7-9) learning English understand ONE",
  "chunk (a short phrase) of an English sentence. You are GIVEN the",
  "WHOLE sentence — you MUST use it. Reply with JSON only. Keys:",
  "- ko (string): translate ONLY the words inside this chunk. Do NOT",
  "  add words from outside the chunk. Use the sentence to understand",
  "  meaning and add the right Korean particle (을/를 이/가 에서 에게 로 등).",
  "  ✓ \"don't buy\" (from \"don't buy a dead one\") → \"사지 마세요\"",
  "    NOT \"죽은 걸 사지 마세요\" — that imports context from outside.",
  "  ✓ \"She gave him\" → \"그녀는 그에게 주었다\" (translate ALL 3 words)",
  "    NOT \"그에게\" — that omits She and gave.",
  "  ✓ \"cat biscuits\" (direct object) → \"고양이 비스킷을\" (add particle)",
  "  ✓ \"some broccoli\" → \"브로콜리 조금을\" (natural Korean for some)",
  "  ✓ \"plan it\" → \"그것을 계획하는 것을\" (grammatical role preserved)",
  "- parts (array of {en, ko}): split the chunk into 2-3 meaning",
  "  pieces a beginner can map word-for-word, each translated in the",
  "  same sentence-context grammatical role used in `ko`. The pieces",
  "  must together cover the whole chunk in order, NOT overlap, and",
  "  each `en` must appear verbatim in the chunk text.",
  "  Examples:",
  "    chunk \"I'll make a card\" → parts: [",
  "      {\"en\":\"I'll make\",\"ko\":\"만들 거예요\"},",
  "      {\"en\":\"a card\",\"ko\":\"카드를\"} ]",
  "    chunk \"plan it\" → parts: [",
  "      {\"en\":\"plan\",\"ko\":\"계획하는 것을\"},",
  "      {\"en\":\"it\",\"ko\":\"그것을\"} ]   (reorder ko allowed)",
  "    chunk \"go to school\" → parts: [",
  "      {\"en\":\"go\",\"ko\":\"가요\"},",
  "      {\"en\":\"to school\",\"ko\":\"학교에\"} ]",
  "- easy_en (string): the chunk's meaning in very simple English,",
  "  8 words or fewer, beginner level — also fitting the sentence.",
  "- situation (object or null): IF this chunk is a useful spoken",
  "  expression a beginner could SAY in real life, return",
  "  { emoji, ko, say } where `ko` is the situation described in",
  "  Korean (e.g. '누가 앞을 막고 있을 때'), `say` is the short English",
  "  to actually say (e.g. 'Excuse me!'), and `emoji` is one relevant",
  "  emoji. If the chunk is NOT a usable real-life expression, set",
  "  situation to null.",
].join("\n");

async function callOpenAI(apiKey: string, sys: string, user: string, maxTokens: number) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user",   content: user },
      ],
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error("OpenAI " + r.status + " :: " + t.slice(0, 300));
  }
  const j = await r.json();
  const raw = j?.choices?.[0]?.message?.content || "";
  try { return JSON.parse(raw); }
  catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
  }
  throw new Error("bad GPT output");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const kind = String(body?.kind || "word");
    const sentence = String(body?.sentence || "").trim();

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (kind === "chunks") {
      if (!sentence) return json({ error: "sentence required" }, 400);
      const ck = "korbar:v1:chunks:" + await senseHash(sentence);
      const cached = await readCache(ck);
      if (cached) return json({ ...(cached as object), cached: true });
      if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

      const parsed = await callOpenAI(apiKey, CHUNKS_SYS,
        `Sentence: ${JSON.stringify(sentence)}`, 500);
      const chunks = Array.isArray(parsed?.chunks) ? parsed.chunks : [];
      const out = {
        chunks: chunks.slice(0, 12).map((c: Record<string, unknown>) => ({
          text:    String(c?.text || ""),
          ko:      String(c?.ko || ""),
          easy_en: String(c?.easy_en || ""),
        })).filter((c: { text: string }) => c.text),
      };
      writeCache(ck, out);
      return json(out);
    }

    if (kind === "translate") {
      // Full-sentence Korean translation — used by the Korean quiz
      // (cloze "한글 해석" reveal + unscramble prompt).
      if (!sentence) return json({ error: "sentence required" }, 400);
      const ck = "korbar:v1:translate:" + await senseHash(sentence);
      const cached = await readCache(ck);
      if (cached) return json({ ...(cached as object), cached: true });
      if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);
      const parsed = await callOpenAI(apiKey, TRANSLATE_SYS,
        `Sentence: ${JSON.stringify(sentence)}`, 300);
      const out = { ko: String(parsed?.ko || "") };
      writeCache(ck, out);
      return json(out);
    }

    if (kind === "comprehension") {
      // A batch of Korean reading-comprehension questions about the
      // passage — used by the 5th Korean-quiz type.
      const passage = String(body?.passage || "").trim();
      if (!passage) return json({ error: "passage required" }, 400);
      const ck = "korbar:v1:comp:" + await senseHash(passage);
      const cached = await readCache(ck);
      if (cached) return json({ ...(cached as object), cached: true });
      if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

      const parsed = await callOpenAI(apiKey, COMP_SYS,
        `Passage: ${JSON.stringify(passage)}`, 850);
      const qs = Array.isArray(parsed?.questions) ? parsed.questions : [];
      const out = {
        questions: qs.slice(0, 4).map((q: Record<string, unknown>) => ({
          prompt:  String(q?.prompt || ""),
          choices: Array.isArray(q?.choices) ? q.choices.slice(0, 4).map(String) : [],
          correctIndex: Number.isInteger(q?.correctIndex) ? (q.correctIndex as number) : 0,
        })).filter((q: { prompt: string; choices: string[] }) =>
          q.prompt && q.choices.length === 4),
      };
      writeCache(ck, out);
      return json(out);
    }

    if (kind === "chunk") {
      // One specific chunk, translated in the sentence's context.
      const text = String(body?.text || "").trim();
      if (!text) return json({ error: "text required" }, 400);
      const ck = "korbar:v4:chunk:" + await senseHash(text + "|" + sentence);
      const cached = await readCache(ck);
      if (cached) return json({ ...(cached as object), cached: true });
      if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

      const parsed = await callOpenAI(apiKey, CHUNK_SYS,
        `Chunk: ${JSON.stringify(text)}\nSentence: ${JSON.stringify(sentence)}`, 380);
      const sit = (parsed?.situation && typeof parsed.situation === "object")
        ? parsed.situation as Record<string, unknown> : null;
      // Normalise parts[] — drop anything missing en/ko, cap at 4.
      const partsRaw = Array.isArray(parsed?.parts) ? parsed.parts : [];
      const parts = partsRaw.slice(0, 4)
        .map((p: Record<string, unknown>) => ({
          en: String(p?.en || "").trim(),
          ko: String(p?.ko || "").trim(),
        }))
        .filter((p: { en: string; ko: string }) => p.en && p.ko);
      const out = {
        ko:      String(parsed?.ko || ""),
        parts,
        easy_en: String(parsed?.easy_en || ""),
        situation: (sit && (sit.say || sit.ko))
          ? { emoji: String(sit.emoji || ""), ko: String(sit.ko || ""), say: String(sit.say || "") }
          : null,
      };
      writeCache(ck, out);
      return json(out);
    }

    // kind === "word"
    const word = String(body?.word || "").trim();
    if (!word) return json({ error: "word required" }, 400);
    const ck = "korbar:v3:word:" + word.toLowerCase() + ":"
             + (sentence ? await senseHash(sentence) : "_");
    const cached = await readCache(ck);
    if (cached) return json({ ...(cached as object), cached: true });
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const user = sentence
      ? `Word: ${JSON.stringify(word)}\nSentence: ${JSON.stringify(sentence)}`
      : `Word: ${JSON.stringify(word)}`;
    const parsed = await callOpenAI(apiKey, WORD_SYS, user, 360);
    const out = {
      lemma:         String(parsed?.lemma || word),
      pronunciation: String(parsed?.pronunciation || parsed?.ipa || ""),
      easy_en:       String(parsed?.easy_en || ""),
      ko:          String(parsed?.ko || ""),
      word_family: Array.isArray(parsed?.word_family) ? parsed.word_family.slice(0, 5).map(String) : [],
      similar:     Array.isArray(parsed?.similar)     ? parsed.similar.slice(0, 3).map(String)     : [],
      opposite:    Array.isArray(parsed?.opposite)    ? parsed.opposite.slice(0, 2).map(String)    : [],
    };
    if (!out.easy_en && !out.ko) return json({ error: "bad GPT output" }, 502);
    writeCache(ck, out);
    return json(out);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
