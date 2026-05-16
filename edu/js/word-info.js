// =============================================================
//  WordCatch — word-info client (calls word-info-gpt edge fn)
//
//  Layered cache:
//    L1 — in-memory (Map) — same word/sentence within one page
//         visit returns instantly, no network at all.
//    L2 — server-side wc_word_info_cache — same word/sentence
//         seen by ANY classmate before returns cached, no GPT.
//
//  Exposes window.WCWordInfo.fetch(word, sentence).
// =============================================================
(() => {
  const URL  = (window.WC_SUPABASE && window.WC_SUPABASE.url)  || '';
  const ANON = (window.WC_SUPABASE && window.WC_SUPABASE.anon) || '';
  // NOTE: endpoint is `wc-word-info-gpt`, NOT `word-info-gpt` —
  // the parent 또박또박 already owns the un-prefixed name in this
  // same Supabase project (returns Korean translations, wrong shape
  // for our Year-3 NZ kids). The `wc-` prefix keeps them separate.
  const FN   = URL ? URL.replace(/\/+$/, '') + '/functions/v1/wc-word-info-gpt' : '';

  const mem = new Map();

  async function fetchInfo(word, sentence) {
    const key = (word || '').toLowerCase() + '::' + (sentence || '').trim();
    if (mem.has(key)) return mem.get(key);
    if (!FN) return null;
    try {
      const r = await fetch(FN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON,
          Authorization: 'Bearer ' + ANON,
        },
        body: JSON.stringify({ word, sentence }),
      });
      if (!r.ok) throw new Error('word-info-gpt ' + r.status);
      const j = await r.json();
      mem.set(key, j);
      return j;
    } catch (e) {
      console.warn('[WCWordInfo] fetch failed', e);
      return null;
    }
  }

  window.WCWordInfo = { fetch: fetchInfo };
})();
