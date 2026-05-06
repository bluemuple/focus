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
    return (engineName || ENGINE) + ':' + text.trim().toLowerCase() + ':' + hashCtx(ctx);
  }

  // ---------- known-tricky common words: hard-coded overrides ----------
  const STATIC = {
    'i':'나는','me':'나를','my':'나의','mine':'나의 것','myself':'나 자신',
    'we':'우리','us':'우리를','our':'우리의','ours':'우리의 것',
    'you':'당신','your':'당신의','yours':'당신의 것','yourself':'당신 자신',
    'he':'그','him':'그를','his':'그의',
    'she':'그녀','her':'그녀의','hers':'그녀의 것',
    'it':'그것','its':'그것의',
    'they':'그들','them':'그들을','their':'그들의','theirs':'그들의 것',
    'this':'이것','that':'저것 / ~라는 것','these':'이것들','those':'저것들',
    'a':'하나의','an':'하나의','the':'그',
    'and':'그리고','or':'또는','but':'하지만','so':'그래서','if':'만약',
    'is':'~이다','am':'~이다','are':'~이다','was':'~였다','were':'~였다','be':'~이다',
    'not':'아니다','no':'아니오','yes':'예',
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

  // ---------- DeepL (single, with optional context) ----------
  async function viaDeepL(text, context) {
    const { url, headers } = supabaseUrl('/functions/v1/translate');
    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ text, source: 'EN', target: 'KO', context: context || undefined }),
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
    const { url, headers } = supabaseUrl('/functions/v1/translate');
    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ texts, source: 'EN', target: 'KO', context: context || undefined }),
    });
    if (!r.ok) throw new Error('DeepL proxy ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error('DeepL: ' + j.error);
    const arr = (j && (j.translations || (j.translation ? [j.translation] : []))) || [];
    return arr.map(s => String(s || '').trim());
  }

  // ---------- GPT (single, with context) ----------
  async function viaGPT(text, context) {
    const { url, headers } = supabaseUrl('/functions/v1/translate-gpt');
    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ text, context: context || '', target: 'KO' }),
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
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q='
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
    const url = 'https://api.mymemory.translated.net/get?q=' +
                encodeURIComponent(text) + '&langpair=en|ko';
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

    // Cache lookup — namespaced by engine + context hash.
    const engineName = USE_GPT ? 'gpt' : ENGINE;
    const ck = cacheKey(text, context, engineName);
    if (memCache[ck]) return memCache[ck];

    let out = '';
    let lastErr = null;

    if (USE_GPT) {
      try { out = await viaGPT(text, context); }
      catch (e) {
        lastErr = e;
        // GPT failed (no key, network, etc.) — fall back to DeepL with context.
        try { out = await viaDeepL(text, context); }
        catch (e2) { lastErr = e2; }
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
          if (r) { out = r; break; }
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
    const key = word.toLowerCase();
    if (senseCache[key]) return senseCache[key];
    try {
      const url = 'https://translate.googleapis.com/translate_a/single' +
                  '?client=gtx&sl=en&tl=ko&dt=bd&q=' + encodeURIComponent(word);
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

  window.Translate = {
    translate, translateBatch, clearCache,
    setEngine, getEngine, lookupSenses,
    setUseGPT, getUseGPT,
  };
})();
