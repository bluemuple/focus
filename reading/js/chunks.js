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

  // Hard 6-word ceiling enforced CLIENT-SIDE — ported from 또박또박's
  // translate.js. The chunk-gpt prompt asks for ≤ 6-word chunks but
  // gpt-4o-mini occasionally returns longer ones (news-style sentences
  // with multi-PP modifiers). Rather than fight the model, we slab
  // anything longer than 6 words into 6-word pieces at whitespace
  // boundaries, with indices recomputed so the body's applyChunk
  // highlight still aligns.
  function clampChunks(rawChunks) {
    if (!Array.isArray(rawChunks)) return rawChunks;
    const out = [];
    for (const c of rawChunks) {
      if (!c || !c.text) continue;
      const words = String(c.text).split(/\s+/).filter(Boolean);
      const baseStart = (Array.isArray(c.indices) && Number.isFinite(c.indices[0]))
        ? (c.indices[0] | 0) : 0;
      if (words.length <= 6) {
        const end = (Array.isArray(c.indices) && Number.isFinite(c.indices[1]))
          ? (c.indices[1] | 0) : (baseStart + words.length - 1);
        out.push({ text: c.text, indices: [baseStart, end] });
        continue;
      }
      // Too long — slab into ≤ 6-word pieces.
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
      // Apply the 6-word clamp before caching so every consumer sees
      // already-clamped output. Matches 또박또박's clampChunks step.
      const chunks = clampChunks(Array.isArray(j.chunks) ? j.chunks : []);
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
