// =============================================================
//  WordCatch — Kor Bar client
//
//  Thin fetcher for the `wc-korbar-gpt` edge function — the
//  Korean-sidebar content used when a student has "Kor Bar"
//  selected on the lesson page.
//
//  Exposes window.WCKorBar:
//    .fetchWord(word, sentence)  → Promise<{ lemma, ipa, easy_en,
//        ko, word_family[], similar[], opposite[] } | null>
//    .fetchChunks(sentence)      → Promise<{ chunks: [...] } | null>
//
//  Per-page in-memory cache; the cloud cache (wc_korbar_cache)
//  makes the first fetch cheap for everyone after. A failed fetch
//  resolves to null so the sidebar can fall back gracefully.
// =============================================================
(() => {
  const URL  = (window.WC_SUPABASE && window.WC_SUPABASE.url)  || '';
  const ANON = (window.WC_SUPABASE && window.WC_SUPABASE.anon) || '';
  const FN   = URL ? URL.replace(/\/+$/, '') + '/functions/v1/wc-korbar-gpt' : '';

  const mem = new Map();
  const keyOf = (parts) => parts.join('␟').toLowerCase();

  async function post(payload) {
    if (!FN) throw new Error('Supabase not configured');
    const r = await fetch(FN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON,
        Authorization: 'Bearer ' + ANON,
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('wc-korbar-gpt ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error(j.error);
    return j;
  }

  async function fetchWord(word, sentence) {
    const w = String(word || '').trim();
    if (!w) return null;
    const k = keyOf(['word', w, sentence || '']);
    if (mem.has(k)) return mem.get(k);
    try {
      const data = await post({ kind: 'word', word: w, sentence: sentence || '' });
      mem.set(k, data);
      return data;
    } catch (e) {
      console.warn('[WCKorBar] word fetch failed', e && e.message);
      return null;
    }
  }

  async function fetchChunks(sentence) {
    const s = String(sentence || '').trim();
    if (s.length < 3) return null;
    const k = keyOf(['chunks', s]);
    if (mem.has(k)) return mem.get(k);
    try {
      const data = await post({ kind: 'chunks', sentence: s });
      mem.set(k, data);
      return data;
    } catch (e) {
      console.warn('[WCKorBar] chunks fetch failed', e && e.message);
      return null;
    }
  }

  // One specific chunk (the focused / underlined chunk) → its Korean
  // meaning, easy English, and an optional "when to use it" card.
  async function fetchChunk(text, sentence) {
    const t = String(text || '').trim();
    if (!t) return null;
    const k = keyOf(['chunk', t, sentence || '']);
    if (mem.has(k)) return mem.get(k);
    try {
      const data = await post({ kind: 'chunk', text: t, sentence: sentence || '' });
      mem.set(k, data);
      return data;
    } catch (e) {
      console.warn('[WCKorBar] chunk fetch failed', e && e.message);
      return null;
    }
  }

  // Full-sentence Korean translation — used by the Korean quiz.
  async function translate(sentence) {
    const s = String(sentence || '').trim();
    if (!s) return null;
    const k = keyOf(['translate', s]);
    if (mem.has(k)) return mem.get(k);
    try {
      const data = await post({ kind: 'translate', sentence: s });
      mem.set(k, data);
      return data;
    } catch (e) {
      console.warn('[WCKorBar] translate failed', e && e.message);
      return null;
    }
  }

  // A batch of Korean reading-comprehension questions about the
  // passage — used by the Korean quiz's 5th question type.
  async function fetchComprehension(passage) {
    const p = String(passage || '').trim();
    if (p.length < 10) return null;
    const k = keyOf(['comp', p]);
    if (mem.has(k)) return mem.get(k);
    try {
      const data = await post({ kind: 'comprehension', passage: p });
      mem.set(k, data);
      return data;
    } catch (e) {
      console.warn('[WCKorBar] comprehension fetch failed', e && e.message);
      return null;
    }
  }

  window.WCKorBar = { fetchWord, fetchChunks, fetchChunk, translate, fetchComprehension };
})();
