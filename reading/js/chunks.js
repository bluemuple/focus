// =============================================================
//  WordCatch — chunk client (reuses parent 또박또박's chunk-gpt
//  edge function and its cloud cache table `chunk_gpt_cache`).
//
//  Chunks are syntactic meaning units the reader processes as a
//  single phrase. We use them for two things:
//    1. an amber underline highlighting the chunk that contains
//       the currently-focused word (또박또박 visual);
//    2. ↑ / ↓ keyboard nav that jumps a whole chunk at a time
//       instead of one word at a time.
//
//  Caching: L1 in-memory (this page session) + L2 cloud (the
//  Supabase wc/또박또박 cache table). First user to land on a
//  given sentence pays the GPT cents; everyone else free.
// =============================================================
(() => {
  const URL  = (window.WC_SUPABASE && window.WC_SUPABASE.url)  || '';
  const ANON = (window.WC_SUPABASE && window.WC_SUPABASE.anon) || '';
  const FN   = URL ? URL.replace(/\/+$/, '') + '/functions/v1/chunk-gpt' : '';

  const mem = new Map();

  function normKey(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  async function fetchChunks(sentence) {
    const s = (sentence || '').trim();
    if (s.length < 3) return null;
    const key = normKey(s);
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
        body: JSON.stringify({ sentence: s }),
      });
      if (!r.ok) throw new Error('chunk-gpt ' + r.status);
      const j = await r.json();
      const chunks = Array.isArray(j.chunks) ? j.chunks : [];
      mem.set(key, chunks);
      return chunks;
    } catch (e) {
      console.warn('[WCChunks] fetch failed', e);
      mem.set(key, []);  // negative-cache so we don't retry every click
      return [];
    }
  }

  // Look up the chunk that contains a given (0-based) word index in
  // the sentence. Returns null if no chunk fits — happens when the
  // GPT response is empty or out-of-date.
  function findChunkAt(chunks, wordIdx) {
    if (!Array.isArray(chunks)) return null;
    for (const c of chunks) {
      const a = c?.indices?.[0], b = c?.indices?.[1];
      if (Number.isFinite(a) && Number.isFinite(b) && wordIdx >= a && wordIdx <= b) return c;
    }
    return null;
  }

  // Prefetch chunks for every sentence in a list. Fire-and-forget so
  // it doesn't block rendering — by the time the kid clicks a word,
  // its chunk is usually already in the cache.
  function prefetchSentences(sentenceTexts) {
    (sentenceTexts || []).forEach(t => { fetchChunks(t).catch(()=>{}); });
  }

  window.WCChunks = { fetch: fetchChunks, findChunkAt, prefetchSentences };
})();
