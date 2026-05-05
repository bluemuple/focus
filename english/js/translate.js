// Translation: English → Korean.
//
// Engines (in order of quality, first available wins):
//   • DeepL  — via Supabase Edge Function `translate` (key in Secrets).
//              Highest quality; default. Requires SUPABASE_CONFIG + DEEPL_KEY.
//   • Google — public gtx endpoint. No key, decent quality.
//   • MyMemory — crowd-sourced. Last-resort fallback only.
//
// The user can switch the *primary* engine via Translate.setEngine('deepl' |
// 'google' | 'mymemory'). When the chosen engine fails, the others are tried
// in order before giving up.
//
// Static dictionary on top: common pronouns / function words have universally
// correct translations hard-coded so we never see "your" → "내" etc.
//
// Cached in localStorage. Cache keys are namespaced by engine so switching
// engines doesn't serve stale results from a different translator.

(() => {
  // v3 — bumped because we now key cache entries by engine.
  const CACHE_KEY = 'eng.v3.tx';
  const ENGINE_KEY = 'eng.v3.engine';

  const memCache = {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) Object.assign(memCache, JSON.parse(raw));
    // Drop stale older caches.
    localStorage.removeItem('eng.v1.tx');
    localStorage.removeItem('eng.v2.tx');
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

  function cacheKey(text) {
    return ENGINE + ':' + text.trim().toLowerCase();
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

  // ---------- DeepL (via Supabase Edge Function) ----------
  async function viaDeepL(text) {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.anon) throw new Error('Supabase not configured');
    const url = cfg.url.replace(/\/+$/, '') + '/functions/v1/translate';
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + cfg.anon,
        'apikey':        cfg.anon,
      },
      body: JSON.stringify({ text, source: 'EN', target: 'KO' }),
    });
    if (!r.ok) throw new Error('DeepL proxy ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error('DeepL: ' + j.error);
    const out = j && j.translation && String(j.translation).trim();
    if (!out) throw new Error('DeepL empty');
    return out;
  }

  // ---------- Google Translate (gtx, public) ----------
  async function viaGoogle(text) {
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

  const ENGINES = { deepl: viaDeepL, google: viaGoogle, mymemory: viaMyMemory };

  async function translate(text) {
    text = (text || '').trim();
    if (!text) return '';

    // Engine-namespaced cache.
    const ck = cacheKey(text);
    if (memCache[ck]) return memCache[ck];

    // Static dictionary takes precedence for known-tricky single words.
    const lower = text.toLowerCase();
    if (STATIC[lower]) {
      memCache[ck] = STATIC[lower]; persist();
      return STATIC[lower];
    }

    // Try the user's chosen engine first, then the others as fallbacks.
    const tried = new Set();
    const order = [ENGINE, 'deepl', 'google', 'mymemory'].filter(e => {
      if (tried.has(e)) return false;
      tried.add(e); return true;
    });

    let lastErr = null;
    for (const name of order) {
      const fn = ENGINES[name];
      if (!fn) continue;
      try {
        const out = await fn(text);
        if (out) {
          memCache[ck] = out; persist();
          return out;
        }
      } catch (e) {
        lastErr = e;
        console.warn('[translate] ' + name + ' failed:', e && e.message || e);
      }
    }
    throw lastErr || new Error('all translation engines failed');
  }

  function clearCache() {
    for (const k of Object.keys(memCache)) delete memCache[k];
    persist();
  }

  // Bilingual-dictionary lookup via Google's gtx endpoint with dt=bd. Returns
  // multiple senses grouped by part-of-speech (noun / verb / adj / etc.) for
  // a single word — exactly what the user wants to display when a word has
  // several meanings. Returns an empty array if there's only one sense.
  // Cached per-word in localStorage.
  const SENSE_KEY = 'eng.v1.senses';
  const senseCache = {};
  try {
    const raw = localStorage.getItem(SENSE_KEY);
    if (raw) Object.assign(senseCache, JSON.parse(raw));
  } catch (e) {}
  function persistSenses() {
    try { localStorage.setItem(SENSE_KEY, JSON.stringify(senseCache)); } catch (e) {}
  }
  async function lookupSenses(word) {
    word = (word || '').trim();
    if (!word) return [];
    // Only single words have meaningful bilingual dictionary entries.
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
      for (const entry of dict) {
        const pos = entry[0] || '';
        const items = entry[1] || [];
        for (const item of items) {
          if (item && item[0]) senses.push({ pos, ko: String(item[0]) });
        }
      }
      senseCache[key] = senses;
      persistSenses();
      return senses;
    } catch (e) { return []; }
  }

  window.Translate = { translate, clearCache, setEngine, getEngine, lookupSenses };
})();
