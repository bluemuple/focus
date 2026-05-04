// Translation: English → Korean, free, no API key.
// Primary:  MyMemory (https://mymemory.translated.net) — JSON, CORS, 5k chars/day per IP.
// Fallback: Google "single" gtx endpoint (informal but commonly used by libraries).
//
// Cached in memory + localStorage so we don't re-translate the same word twice.

(() => {
  const CACHE_KEY = 'eng.v1.tx';
  const memCache = {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) Object.assign(memCache, JSON.parse(raw));
  } catch(e) {}

  function persist() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(memCache)); } catch(e){}
  }

  function key(text) { return text.trim().toLowerCase(); }

  async function viaMyMemory(text) {
    const url = 'https://api.mymemory.translated.net/get?q=' +
                encodeURIComponent(text) + '&langpair=en|ko';
    const r = await fetch(url);
    if (!r.ok) throw new Error('MyMemory ' + r.status);
    const j = await r.json();
    const best = j && j.responseData && j.responseData.translatedText;
    if (!best) throw new Error('MyMemory empty');
    return best;
  }

  async function viaGoogleGTX(text) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=' +
                encodeURIComponent(text);
    const r = await fetch(url);
    if (!r.ok) throw new Error('GTX ' + r.status);
    const j = await r.json();
    const parts = (j && j[0]) || [];
    return parts.map(p => p[0]).join('');
  }

  async function translate(text) {
    text = (text || '').trim();
    if (!text) return '';
    const k = key(text);
    if (memCache[k]) return memCache[k];

    let out = '';
    try { out = await viaMyMemory(text); }
    catch(e1) {
      try { out = await viaGoogleGTX(text); }
      catch(e2) { console.warn('translate failed', e1, e2); throw e2; }
    }
    out = (out || '').trim();
    if (out) { memCache[k] = out; persist(); }
    return out;
  }

  window.Translate = { translate };
})();
