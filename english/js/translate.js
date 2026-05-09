// Translation: English → Korean.
//
// Engines (in order of how each call is routed):
//   • DeepL  — via Supabase Edge Function `translate`. Default.
//              Now supports a `context` field (the surrounding sentence)
//              so the same word in different sentences gets the right
//              meaning, AND batched calls so a whole page can be
//              pre-translated in one round trip.
//   • GPT    — via Supabase Edge Function `translate-gpt`. Used when the
//              user enables the ✨ toggle. Sends the word + sentence
//              context to gpt-4o-mini for the highest-quality nuance.
//   • Google — public gtx endpoint. Local fallback when DeepL fails.
//   • MyMemory — last-resort fallback only.
//
// Cache key is namespaced by engine AND a short hash of the context, so
// the same word can have different cached translations in different
// sentences without overwriting one another.

(() => {
  // v4 — cache keys now include a context hash. Drop earlier versions.
  const CACHE_KEY  = 'eng.v4.tx';
  const ENGINE_KEY = 'eng.v3.engine';
  const GPT_KEY    = 'eng.v1.useGPT';

  const memCache = {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) Object.assign(memCache, JSON.parse(raw));
    localStorage.removeItem('eng.v1.tx');
    localStorage.removeItem('eng.v2.tx');
    localStorage.removeItem('eng.v3.tx');
  } catch (e) {}

  function persist() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(memCache)); } catch (e) {}
  }

  // ---------- engine state ----------
  let ENGINE = 'deepl';
  try {
    const saved = localStorage.getItem(ENGINE_KEY);
    if (saved === 'deepl' || saved === 'google' || saved === 'mymemory') ENGINE = saved;
  } catch (e) {}
  function setEngine(name) {
    if (!['deepl', 'google', 'mymemory'].includes(name)) return;
    ENGINE = name;
    try { localStorage.setItem(ENGINE_KEY, name); } catch (e) {}
  }
  function getEngine() { return ENGINE; }

  // ✨ toggle — when on, every click goes through GPT instead of DeepL.
  let USE_GPT = false;
  try { USE_GPT = localStorage.getItem(GPT_KEY) === '1'; } catch (e) {}
  function setUseGPT(on) {
    USE_GPT = !!on;
    try { localStorage.setItem(GPT_KEY, USE_GPT ? '1' : '0'); } catch (e) {}
  }
  function getUseGPT() { return USE_GPT; }

  // ---------- short context-aware cache key ----------
  function hashCtx(ctx) {
    if (!ctx) return '';
    let h = 5381;
    for (let i = 0; i < ctx.length; i++) {
      h = ((h << 5) + h + ctx.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }
  function cacheKey(text, ctx, engineName) {
    // Include source language so the same word doesn't share a cache
    // entry across EN ↔ JA modes. English keeps the legacy un-prefixed
    // key shape so existing user caches aren't invalidated.
    const lang = (window.DB && window.DB.getLang && window.DB.getLang()) || 'en';
    const langPrefix = lang === 'en' ? '' : (lang + ':');
    return langPrefix + (engineName || ENGINE) + ':' + text.trim().toLowerCase() + ':' + hashCtx(ctx);
  }

  // ---------- known-tricky common words: hard-coded overrides ----------
  // Short function words and prepositions where the external translators
  // sometimes echo the English back (DeepL on tokens like "over" / "a"
  // without rich context). Returning a Korean entry here bypasses both
  // the network call AND the echo-back failure mode.
  const STATIC = {
    // Pronouns
    'i':'나는','me':'나를','my':'나의','mine':'나의 것','myself':'나 자신',
    'we':'우리','us':'우리를','our':'우리의','ours':'우리의 것',
    'you':'당신','your':'당신의','yours':'당신의 것','yourself':'당신 자신',
    'he':'그','him':'그를','his':'그의',
    'she':'그녀','her':'그녀의','hers':'그녀의 것',
    'it':'그것','its':'그것의',
    'they':'그들','them':'그들을','their':'그들의','theirs':'그들의 것',
    'this':'이것','that':'저것 / ~라는 것','these':'이것들','those':'저것들',
    // Articles & determiners
    'a':'하나의','an':'하나의','the':'그',
    'some':'몇몇의','any':'어떤','every':'모든','each':'각각의',
    'all':'모든','many':'많은','much':'많은','few':'적은','little':'적은',
    'more':'더 많은','most':'대부분','other':'다른','another':'또 다른',
    // Conjunctions
    'and':'그리고','or':'또는','but':'하지만','so':'그래서','if':'만약',
    'because':'~때문에','although':'~비록','while':'~하는 동안','when':'~할 때',
    'as':'~로서 / ~할 때','than':'~보다',
    // Be / aux verbs
    'is':'~이다','am':'~이다','are':'~이다','was':'~였다','were':'~였다','be':'~이다',
    'been':'~이었다','being':'~인 / 존재',
    'do':'~하다','does':'~하다','did':'~했다','done':'~한',
    'have':'~가지다','has':'~가지다','had':'~가졌다','having':'~가지고',
    'will':'~할 것이다','would':'~할 것이다','can':'~할 수 있다','could':'~할 수 있었다',
    'shall':'~할 것이다','should':'~해야 한다','may':'~일지도 모른다','might':'~일지도 모른다',
    'must':'~해야 한다',
    // Negation / yes-no
    'not':'아니다','no':'아니오','yes':'예',
    // Prepositions (the most common echo-back culprits)
    'of':'~의','to':'~에게 / ~로','for':'~을 위해','in':'~안에','on':'~위에',
    'at':'~에서','by':'~에 의해','with':'~와 함께','from':'~로부터','about':'~에 대해',
    'into':'~안으로','onto':'~위로','out':'밖으로','off':'~떨어진',
    'over':'~위에 / 너머 / 끝나다','under':'~아래에','above':'~위에','below':'~아래에',
    'between':'~사이에','among':'~사이에','through':'~을 통해','across':'~을 가로질러',
    'along':'~을 따라','around':'~주위에','toward':'~쪽으로','towards':'~쪽으로',
    'against':'~에 대항하여','during':'~동안','before':'~이전에','after':'~이후에',
    'until':'~까지','since':'~이래로','within':'~안에','without':'~없이',
    'up':'위로','down':'아래로','near':'~가까이',
  };

  // ---------- Edge Function helpers ----------
  function supabaseUrl(path) {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.anon) throw new Error('Supabase not configured');
    return {
      url: cfg.url.replace(/\/+$/, '') + path,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + cfg.anon,
        'apikey':        cfg.anon,
      },
    };
  }

  // Resolve the current target-language so DeepL / GPT / Google
  // requests pick the right `source` code. Defaults to 'en' when DB
  // hasn't loaded yet (script ordering / very early call).
  function _curLang() {
    return (window.DB && window.DB.getLang && window.DB.getLang()) || 'en';
  }
  function _sourceForLang(lang) {
    // DeepL accepts 'EN' / 'JA' (uppercase 2-letter ISO).
    return lang === 'ja' ? 'JA' : 'EN';
  }
  function _googleSlForLang(lang) {
    // Google translate `sl` (source language) lowercase ISO.
    return lang === 'ja' ? 'ja' : 'en';
  }

  // ---------- DeepL (single, with optional context) ----------
  async function viaDeepL(text, context) {
    const source = _sourceForLang(_curLang());
    const { url, headers } = supabaseUrl('/functions/v1/translate');
    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ text, source, target: 'KO', context: context || undefined }),
    });
    if (!r.ok) throw new Error('DeepL proxy ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error('DeepL: ' + j.error);
    const out = j && j.translation && String(j.translation).trim();
    if (!out) throw new Error('DeepL empty');
    return out;
  }

  // ---------- DeepL batched (used by page prefetch) ----------
  async function viaDeepLBatch(texts, context) {
    const source = _sourceForLang(_curLang());
    const { url, headers } = supabaseUrl('/functions/v1/translate');
    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ texts, source, target: 'KO', context: context || undefined }),
    });
    if (!r.ok) throw new Error('DeepL proxy ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error('DeepL: ' + j.error);
    const arr = (j && (j.translations || (j.translation ? [j.translation] : []))) || [];
    return arr.map(s => String(s || '').trim());
  }

  // ---------- GPT (single, with context) ----------
  async function viaGPT(text, context) {
    const source = _sourceForLang(_curLang());
    const { url, headers } = supabaseUrl('/functions/v1/translate-gpt');
    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ text, context: context || '', source, target: 'KO' }),
    });
    if (!r.ok) throw new Error('GPT proxy ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error('GPT: ' + j.error);
    const out = j && j.translation && String(j.translation).trim();
    if (!out) throw new Error('GPT empty');
    return out;
  }

  // ---------- Google (public gtx) ----------
  async function viaGoogle(text /* context unused */) {
    const sl = _googleSlForLang(_curLang());
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sl + '&tl=ko&dt=t&q='
              + encodeURIComponent(text);
    const r = await fetch(url);
    if (!r.ok) throw new Error('Google ' + r.status);
    const j = await r.json();
    const parts = (j && j[0]) || [];
    const out = parts.map(p => p[0]).join('').trim();
    if (!out) throw new Error('Google empty');
    return out;
  }

  // ---------- MyMemory ----------
  async function viaMyMemory(text) {
    const sl = _googleSlForLang(_curLang());        // 'en' or 'ja'
    const url = 'https://api.mymemory.translated.net/get?q=' +
                encodeURIComponent(text) + '&langpair=' + sl + '|ko';
    const r = await fetch(url);
    if (!r.ok) throw new Error('MyMemory ' + r.status);
    const j = await r.json();
    const best = j && j.responseData && j.responseData.translatedText;
    if (!best) throw new Error('MyMemory empty');
    return String(best).trim();
  }

  // ---------- public single-translate ----------
  // translate(text, context?): returns Korean translation.
  //   • If ✨ (USE_GPT) is on, prefer GPT with the given context.
  //   • Otherwise prefer DeepL (with context), falling through Google
  //     and MyMemory on failure.
  async function translate(text, context) {
    text = (text || '').trim();
    if (!text) return '';

    // Static dictionary first for known-tricky single words (no context needed).
    const lower = text.toLowerCase();
    if (STATIC[lower]) return STATIC[lower];

    // Sanity check: a Korean translation MUST contain at least one Hangul
    // character. External translators occasionally echo the English back
    // when the input is a single short token ("Soviet" → "Soviet" / "over"
    // → "over"). We treat those responses as failures and try the next
    // engine. Defined BEFORE the cache lookup so we can also reject
    // previously-cached bad values (e.g. an old session cached "Soviet"
    // before this validation existed — without this gate the bad entry
    // would be returned forever).
    const isUsefulKo = (s) => {
      if (!s) return false;
      const trimmed = String(s).trim();
      if (!trimmed) return false;
      if (!/[가-힣]/.test(trimmed)) return false;
      return true;
    };

    // Cache lookup — namespaced by engine + context hash. Validate the
    // cached value too: stale entries that lack any Hangul (e.g. "Soviet"
    // returned by an engine in a previous session) get evicted and we
    // fall through to a fresh fetch.
    const engineName = USE_GPT ? 'gpt' : ENGINE;
    const ck = cacheKey(text, context, engineName);
    if (memCache[ck]) {
      if (isUsefulKo(memCache[ck])) return memCache[ck];
      // Drop the bad entry so we don't keep paying the lookup cost.
      delete memCache[ck];
      persist();
    }

    let out = '';
    let lastErr = null;

    if (USE_GPT) {
      try {
        const r = await viaGPT(text, context);
        if (isUsefulKo(r)) out = r;
      } catch (e) { lastErr = e; }
      if (!out) {
        // GPT failed (no key, network, echo-back) — fall back to DeepL.
        try {
          const r = await viaDeepL(text, context);
          if (isUsefulKo(r)) out = r;
        } catch (e2) { lastErr = e2; }
      }
    } else {
      // Default order: DeepL → Google → MyMemory.
      const order = [ENGINE, 'deepl', 'google', 'mymemory']
        .filter((v, i, a) => a.indexOf(v) === i);
      for (const name of order) {
        const fn = name === 'deepl'    ? () => viaDeepL(text, context)
                 : name === 'google'   ? () => viaGoogle(text)
                 : name === 'mymemory' ? () => viaMyMemory(text)
                 : null;
        if (!fn) continue;
        try {
          const r = await fn();
          if (isUsefulKo(r)) { out = r; break; }
        } catch (e) {
          lastErr = e;
          console.warn('[translate] ' + name + ' failed:', e && e.message || e);
        }
      }
    }

    if (!out) throw lastErr || new Error('all translation engines failed');
    memCache[ck] = out;
    persist();
    return out;
  }

  // ---------- public batch-translate (for page prefetch) ----------
  // translateBatch(texts, context?): translates an array in ONE round trip
  // when possible. Returns array of translations in the same order.
  // Cache hits are served locally; misses go to DeepL in a single call.
  async function translateBatch(texts, context) {
    texts = (texts || []).map(t => (t || '').trim()).filter(Boolean);
    if (!texts.length) return [];

    const engineName = USE_GPT ? 'gpt' : ENGINE;
    const out = new Array(texts.length);
    const missIdx = [];
    const missTexts = [];
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      const lower = t.toLowerCase();
      if (STATIC[lower]) { out[i] = STATIC[lower]; continue; }
      const ck = cacheKey(t, context, engineName);
      if (memCache[ck]) { out[i] = memCache[ck]; continue; }
      missIdx.push(i);
      missTexts.push(t);
    }
    if (!missTexts.length) return out;

    // Prefetch always uses DeepL batch (GPT batching is more expensive and
    // we'd rather only spend GPT tokens on explicit ✨ clicks).
    let translations = [];
    try {
      translations = await viaDeepLBatch(missTexts, context);
    } catch (e) {
      console.warn('[translateBatch] DeepL failed, falling back per-item:', e && e.message || e);
      // Fallback: serial Google calls (slower but salvages the batch).
      for (const t of missTexts) {
        try { translations.push(await viaGoogle(t)); }
        catch (er) { translations.push(''); }
      }
    }
    // Stuff the misses back into the result array + cache them.
    for (let k = 0; k < missIdx.length; k++) {
      const i = missIdx[k];
      const tr = translations[k] || '';
      out[i] = tr;
      if (tr) {
        const ck = cacheKey(missTexts[k], context, 'deepl');
        memCache[ck] = tr;
      }
    }
    persist();
    return out;
  }

  function clearCache() {
    for (const k of Object.keys(memCache)) delete memCache[k];
    persist();
  }

  // ---------- bilingual-dictionary multi-meaning lookup (unchanged) ----------
  const SENSE_KEY = 'eng.v2.senses';
  const senseCache = {};
  try {
    const raw = localStorage.getItem(SENSE_KEY);
    if (raw) Object.assign(senseCache, JSON.parse(raw));
    localStorage.removeItem('eng.v1.senses');
  } catch (e) {}
  function persistSenses() {
    try { localStorage.setItem(SENSE_KEY, JSON.stringify(senseCache)); } catch (e) {}
  }
  async function lookupSenses(word) {
    word = (word || '').trim();
    if (!word) return [];
    if (/\s/.test(word)) return [];
    // Cache key includes the source language so the same word doesn't
    // clobber across language modes (e.g. JP "live" → ライブ vs EN
    // "live" → 살다).
    const lang = _curLang();
    const key = lang + '|' + word.toLowerCase();
    if (senseCache[key]) return senseCache[key];
    try {
      const sl = _googleSlForLang(lang);
      const url = 'https://translate.googleapis.com/translate_a/single' +
                  '?client=gtx&sl=' + sl + '&tl=ko&dt=bd&q=' + encodeURIComponent(word);
      const r = await fetch(url);
      if (!r.ok) return [];
      const j = await r.json();
      const dict = (j && j[1]) || [];
      const senses = [];
      const seen  = new Set();
      for (const entry of (dict || [])) {
        if (!entry) continue;
        const pos = entry[0] || '';
        const items = entry[1] || [];
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          let ko = '';
          if (typeof item === 'string') ko = item;
          else if (Array.isArray(item) && typeof item[0] === 'string') ko = item[0];
          ko = (ko || '').trim();
          if (!ko) continue;
          if (ko.length === 1 && !/^[가-힣]$/.test(ko)) continue;
          const k = pos + '|' + ko;
          if (seen.has(k)) continue;
          seen.add(k);
          senses.push({ pos, ko });
        }
      }
      senseCache[key] = senses;
      persistSenses();
      return senses;
    } catch (e) { return []; }
  }

  // ---------- rich GPT word-info (senses + collocations + examples) ----------
  // Single GPT call returns the dictionary-style fields the sidebar /
  // mobile word sheet needs. The Edge Function NO LONGER takes a
  // sentence — sentence-dependent fields (contextual `ko`,
  // `phraseChunk`) are handled separately by `Translate.translate
  // (word, sentence)` (DeepL) and `getChunks(sentence)` (chunk-gpt).
  // Result: same word across many sentences shares ONE cache entry,
  // both in localStorage AND in the cloud-shared Supabase cache the
  // Edge Function reads/writes — drastically lower GPT call volume.
  const wiCache = {};                          // L1: in-memory
  // v5 — schema change (no sentence in key, no `ko`/`phraseChunk` in
  // value) invalidates v4 entries.
  const WI_LS = 'eng.v5.wordInfo';
  let wiLs = {};
  try {
    wiLs = JSON.parse(localStorage.getItem(WI_LS) || '{}') || {};
    localStorage.removeItem('eng.v3.wordInfo');
    localStorage.removeItem('eng.v4.wordInfo');     // drop per-sentence keys
  } catch (e) { wiLs = {}; }
  function persistWi() { try { localStorage.setItem(WI_LS, JSON.stringify(wiLs)); } catch (e) {} }
  function _hashStr(s) {
    let h = 0;
    s = s || '';
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h.toString(36);
  }
  async function getWordInfo(word /* sentence ignored */) {
    word = (word || '').trim();
    if (!word) return null;
    // Cache key includes the source language so EN ↔ JP entries
    // don't collide (e.g. an ASCII word that exists in both modes).
    // English keeps the legacy un-prefixed key for back-compat.
    const lang = _curLang();
    const key = lang === 'en' ? word.toLowerCase() : (lang + ':' + word.toLowerCase());
    if (wiCache[key]) return wiCache[key];
    if (wiLs[key])    { wiCache[key] = wiLs[key]; return wiLs[key]; }
    try {
      const { url, headers } = supabaseUrl('/functions/v1/word-info-gpt');
      const r = await fetch(url, {
        method: 'POST', headers,
        // Pass `lang` so the Edge Function picks JP-specific prompt
        // rules in Phase 3c (currently no-op until that deploy).
        body: JSON.stringify({ word, lang }),
      });
      if (!r.ok) {
        let detail = '';
        try { detail = (await r.text()).slice(0, 200); } catch (e) {}
        throw new Error('word-info ' + r.status + (detail ? ' ' + detail : ''));
      }
      const data = await r.json();
      if (!data || data.error) throw new Error('word-info: ' + (data && data.error));
      wiCache[key] = data;
      wiLs[key] = data;
      persistWi();
      return data;
    } catch (e) {
      console.warn('[word-info]', e && e.message || e);
      return null;
    }
  }

  // ---------- syntactic chunks per sentence (chunk-gpt) ----------
  // One small GPT call per sentence; cached by sentence-hash so all words
  // in the same sentence share the result. The lesson page prefetches
  // chunks for every sentence on the current page in the background; by
  // the time the user clicks a word, its chunk highlight is in cache.
  const chunkCache = {};
  // v2 — invalidates pre-6-word chunks cached under v1 (the chunk-gpt
  // prompt's hard limit dropped from 7 → 6 words).
  // v3 — bumped after the prompt was hardened against PP-internal splits
  // (e.g. "stretched for nearly / a mile" mid-PP break). Old v2 cache
  // entries are discarded so the user immediately gets the new chunking
  // without manually clearing localStorage.
  const CHUNK_LS = 'eng.v3.chunks';
  let chunkLs = {};
  try {
    chunkLs = JSON.parse(localStorage.getItem(CHUNK_LS) || '{}') || {};
    localStorage.removeItem('eng.v1.chunks');   // drop stale 7-word chunks
    localStorage.removeItem('eng.v2.chunks');   // drop pre-PP-fix entries
  } catch (e) { chunkLs = {}; }
  function persistChunks() { try { localStorage.setItem(CHUNK_LS, JSON.stringify(chunkLs)); } catch (e) {} }

  // Hard 6-word ceiling enforced CLIENT-SIDE. The chunk-gpt prompt asks
  // for ≤6-word chunks but gpt-4o-mini occasionally returns longer ones
  // (especially on news-style sentences with multi-PP modifiers). Rather
  // than fight the model, we post-process: any chunk longer than 6 words
  // is split into 6-word slabs at whitespace boundaries, with indices
  // recomputed so applyChunkHighlight on the body still aligns.
  // Also re-applies on cache reads so previously-cached oversized chunks
  // get clamped automatically — no second redeploy required.
  function clampChunks(rawChunks) {
    if (!Array.isArray(rawChunks)) return rawChunks;
    const out = [];
    for (const c of rawChunks) {
      if (!c || !c.text) continue;
      const words = String(c.text).split(/\s+/).filter(Boolean);
      const baseStart = (Array.isArray(c.indices) && Number.isFinite(c.indices[0]))
        ? (c.indices[0] | 0) : 0;
      if (words.length <= 6) {
        // Already small enough — keep as-is, with safe indices.
        const end = (Array.isArray(c.indices) && Number.isFinite(c.indices[1]))
          ? (c.indices[1] | 0) : (baseStart + words.length - 1);
        out.push({ text: c.text, indices: [baseStart, end] });
        continue;
      }
      // Too long. Slab into pieces of at most 6 words.
      let cursor = 0;
      while (cursor < words.length) {
        const len = Math.min(6, words.length - cursor);
        const slab = words.slice(cursor, cursor + len).join(' ');
        out.push({
          text: slab,
          indices: [baseStart + cursor, baseStart + cursor + len - 1],
        });
        cursor += len;
      }
    }
    return out;
  }

  async function getChunks(sentence) {
    sentence = (sentence || '').trim();
    if (!sentence || sentence.length < 5) return null;
    // Japanese: chunk via kuromoji (bunsetsu-style content-word +
    // trailing particles). chunk-gpt's English-grammar prompt would
    // produce nonsense, so we use a local morphological grouper
    // instead — zero GPT cost, instant.
    if (_curLang() === 'ja') {
      if (!window.JPT || !window.JPT.chunkSentenceJa) return null;
      try {
        await window.JPT.ready();           // ensure tokenizer built
        return window.JPT.chunkSentenceJa(sentence) || null;
      } catch (e) {
        console.warn('[chunkJa] failed', e);
        return null;
      }
    }
    const key = _hashStr(sentence);
    // Even cached chunks pass through the clamp, so a localStorage entry
    // produced before client-side clamping still gets corrected on read.
    if (chunkCache[key]) return chunkCache[key];
    if (chunkLs[key])    {
      const clamped = clampChunks(chunkLs[key]);
      chunkCache[key] = clamped;
      // Re-persist if the clamp actually changed anything.
      if (clamped.length !== chunkLs[key].length) {
        chunkLs[key] = clamped;
        persistChunks();
      }
      return clamped;
    }
    try {
      const { url, headers } = supabaseUrl('/functions/v1/chunk-gpt');
      const r = await fetch(url, {
        method: 'POST', headers,
        body: JSON.stringify({ sentence }),
      });
      if (!r.ok) {
        let detail = '';
        try { detail = (await r.text()).slice(0, 200); } catch (e) {}
        throw new Error('chunk-gpt ' + r.status + (detail ? ' ' + detail : ''));
      }
      const data = await r.json();
      if (!data || data.error || !Array.isArray(data.chunks)) {
        throw new Error('chunk-gpt: ' + (data && data.error || 'bad shape'));
      }
      const clamped = clampChunks(data.chunks);
      chunkCache[key] = clamped;
      chunkLs[key] = clamped;
      persistChunks();
      return clamped;
    } catch (e) {
      console.warn('[chunk-gpt]', e && e.message || e);
      return null;
    }
  }

  // Per-call engine override — runs translate() while USE_GPT is forced
  // to the requested value, then restores. Used by the lesson page when
  // the user wants BOTH translations side-by-side ("non-AI, AI"): two
  // calls with different engines, both displayed.
  async function translateWith(text, context, useGPT) {
    const prev = USE_GPT;
    USE_GPT = !!useGPT;
    try {
      return await translate(text, context);
    } finally {
      USE_GPT = prev;
    }
  }

  // STRICT GPT — calls viaGPT directly with NO fallback to DeepL. Used
  // for the dual-translation display where the appended half MUST be
  // GPT or nothing; falling back silently to DeepL produced duplicate
  // output that the equality check then suppressed, hiding the append
  // entirely. Errors propagate (caller catches → empty append).
  async function translateGPT(text, context) {
    text = (text || '').trim();
    if (!text) return '';
    const ck = cacheKey(text, context, 'gpt');
    if (memCache[ck]) return memCache[ck];
    const out = await viaGPT(text, context);
    const trimmed = out ? String(out).trim() : '';
    if (trimmed) {
      memCache[ck] = trimmed;
      persist();
    }
    return trimmed;
  }

  window.Translate = {
    translate, translateBatch, translateWith, translateGPT, clearCache,
    setEngine, getEngine, lookupSenses, getWordInfo, getChunks,
    setUseGPT, getUseGPT,
  };
})();
