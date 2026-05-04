// Translation: English → Korean. Free, no API key.
//
// PRIMARY:  Google Translate (gtx public endpoint) — better quality for single
//           words and short phrases than MyMemory's crowd-sourced corpus.
// FALLBACK: MyMemory — used only when Google fails or rate-limits.
//
// Static dictionary on top: common pronouns / function words have universally
// correct translations hard-coded so we never get "your" → "내" (a known bug
// from MyMemory's user-submitted data).
//
// Cached in memory + localStorage so we don't re-translate the same input.

(() => {
  // v2 — bumped to invalidate older MyMemory translations like "your" → "내".
  const CACHE_KEY = 'eng.v2.tx';
  const memCache = {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) Object.assign(memCache, JSON.parse(raw));
    // Drop any stale v1 cache from earlier runs.
    localStorage.removeItem('eng.v1.tx');
  } catch (e) {}

  function persist() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(memCache)); } catch (e) {}
  }
  function key(text) { return text.trim().toLowerCase(); }

  // ---------- known-tricky common words: hard-coded overrides ----------
  const STATIC = {
    'i':       '나는',
    'me':      '나를',
    'my':      '나의',
    'mine':    '나의 것',
    'myself':  '나 자신',
    'we':      '우리',
    'us':      '우리를',
    'our':     '우리의',
    'ours':    '우리의 것',
    'you':     '당신',
    'your':    '당신의',
    'yours':   '당신의 것',
    'yourself':'당신 자신',
    'he':      '그',
    'him':     '그를',
    'his':     '그의',
    'she':     '그녀',
    'her':     '그녀의',
    'hers':    '그녀의 것',
    'it':      '그것',
    'its':     '그것의',
    'they':    '그들',
    'them':    '그들을',
    'their':   '그들의',
    'theirs':  '그들의 것',
    'this':    '이것',
    'that':    '저것 / ~라는 것',
    'these':   '이것들',
    'those':   '저것들',
    'a':       '하나의',
    'an':      '하나의',
    'the':     '그',
    'and':     '그리고',
    'or':      '또는',
    'but':     '하지만',
    'so':      '그래서',
    'if':      '만약',
    'is':      '~이다',
    'am':      '~이다',
    'are':     '~이다',
    'was':     '~였다',
    'were':    '~였다',
    'be':      '~이다',
    'not':     '아니다',
    'no':      '아니오',
    'yes':     '예',
  };

  // ---------- Google Translate (gtx, public, no key) ----------
  async function viaGoogle(text) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q='
              + encodeURIComponent(text);
    const r = await fetch(url);
    if (!r.ok) throw new Error('Google ' + r.status);
    const j = await r.json();
    const parts = (j && j[0]) || [];
    return parts.map(p => p[0]).join('').trim();
  }

  // ---------- MyMemory (fallback) ----------
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

  async function translate(text) {
    text = (text || '').trim();
    if (!text) return '';
    const k = key(text);
    if (memCache[k]) return memCache[k];

    // Static dictionary first for known-tricky single words.
    if (STATIC[k]) {
      memCache[k] = STATIC[k]; persist();
      return STATIC[k];
    }

    let out = '';
    let lastErr = null;
    try { out = await viaGoogle(text); }
    catch (e) { lastErr = e; }

    if (!out) {
      try { out = await viaMyMemory(text); }
      catch (e2) { lastErr = e2; }
    }

    if (!out) {
      console.warn('translate failed', lastErr);
      throw lastErr || new Error('translate failed');
    }
    memCache[k] = out; persist();
    return out;
  }

  // Exposed for debugging in the browser console.
  function clearCache() {
    for (const k of Object.keys(memCache)) delete memCache[k];
    persist();
  }

  window.Translate = { translate, clearCache };
})();
