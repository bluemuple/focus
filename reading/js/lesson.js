// =============================================================
//  WordCatch — lesson page controller
//
//  Two reading modes:
//    1. 단어 뜻 하나씩 (always on): any word in the body is
//       clickable → opens the word popup with dictionary +
//       pronunciation + colour-level advance.
//    2. 1문장씩 (toggle): dims every sentence except the current
//       one and shows ◀ / ▶ to step through. TTS reads just the
//       current sentence.
//
//  Word colour level: 0 (unseen) → 1..5 (familiar). Clicking
//  always advances by 1 up to 5; the "Mark as 무시" button in
//  the popup sets it to -1. Level changes persist via
//  wc_word_states.upsert. Phase 5 hooks into the same click to
//  bump the encounter counter (throttled).
//
//  Tokenisation is regex-based:
//    sentence split:   /([.!?]+["')\]]*)\s+/      (keeps the trailing punctuation)
//    word match:       /[A-Za-z][A-Za-z'’\-]*/    (no leading punctuation)
//  Apostrophes inside words ("don't", "kiwi's") stay attached;
//  hyphenated compounds ("ice-cream") are tokenised as one word
//  to match how a Year 4 reader looks them up in vocabulary.com.
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);
  const me = window.WCAuth.requireStudent('./index.html');
  if (!me) return;

  const lessonId = new URLSearchParams(location.search).get('id');
  if (!lessonId) {
    $('lessonBody').innerHTML = '<p>No lesson selected.</p>';
    return;
  }

  // ---------- state ----------
  let lesson      = null;   // wc_lessons row
  let sentences   = [];     // [{ text, words: [{ token, lower, index }], range:{start,end} }]
  let wordLevels  = new Map(); // lower → level (number)
  let singleMode  = false;
  let singleIdx   = 0;       // active sentence index when singleMode
  // Subscribers (sidebar) that want to react to word-level changes.
  const levelChangeListeners = [];
  function notifyLevelChange(detail) {
    levelChangeListeners.forEach(fn => { try { fn(detail); } catch {} });
  }

  // Per-class feature flags (loaded with the lesson). Hidden by default
  // (empty object) so a brand-new class behaves like everything's on.
  let classFlags = {};

  // Expose state to sidebar.js etc. — read-only contract.
  window.WCLesson = {
    me,
    get lesson() { return lesson; },
    get wordLevels() { return wordLevels; },
    get classFlags() { return classFlags; },
    onWordLevelChange(cb) { if (typeof cb === 'function') levelChangeListeners.push(cb); },
  };

  // ---------- chrome ----------
  $('userName').textContent  = me.real_name;
  $('userMoney').textContent = me.money || 0;
  $('logoutBtn').addEventListener('click', e => {
    e.preventDefault();
    window.WCAuth.logout();
    location.href = './index.html';
  });

  // ---------- main load ----------
  (async function init() {
    // Refresh the cached session row from the server so encounter_level /
    // money are current — they can have changed in another tab.
    try {
      const fresh = await window.WCDB.users.byLoginCode(me.login_code);
      if (fresh) Object.assign(me, fresh);
    } catch {}

    try {
      lesson = await window.WCDB.lessons.byId(lessonId);
    } catch (e) { console.error(e); }
    if (!lesson) {
      $('lessonBody').innerHTML = '<p>Lesson not found.</p>';
      return;
    }
    $('lessonTitle').textContent = lesson.title;

    // Pull the class's hide_features so sidebar/encounter/popup
    // modules can opt out of disabled features. Failing to fetch is
    // non-fatal — we just behave like nothing's hidden.
    if (me.class_id) {
      try {
        const cls = await window.WCDB.classes.byId(me.class_id);
        if (cls && cls.hide_features && typeof cls.hide_features === 'object') {
          classFlags = cls.hide_features;
        }
      } catch {}
    }

    // load word levels for this user (whole-user set — fine for MVP class size)
    try {
      const rows = await window.WCDB.wordStates.forUser(me.id);
      rows.forEach(r => wordLevels.set(r.word, r.level));
    } catch (e) { console.warn('wordStates load:', e); }

    sentences = tokeniseBody(lesson.body);
    renderBody();
    wireToolbar();
  })();

  // ---------- tokenisation ----------
  function tokeniseBody(body) {
    // Split on sentence-final punctuation followed by whitespace, but
    // KEEP the punctuation as part of the sentence. The regex captures
    // (sentence text + trailing punct) and the separating whitespace.
    const parts = [];
    const re = /[^.!?]+[.!?]+["'’)\]]*/g;
    let m;
    let lastEnd = 0;
    while ((m = re.exec(body)) !== null) {
      // any whitespace between this and the previous match: stays as separator
      if (m.index > lastEnd) {
        parts.push({ kind: 'gap', text: body.slice(lastEnd, m.index) });
      }
      parts.push({ kind: 'sent', text: m[0] });
      lastEnd = m.index + m[0].length;
    }
    if (lastEnd < body.length) {
      // tail (no terminal punctuation) — treat as one final sentence
      const tail = body.slice(lastEnd);
      if (tail.trim()) parts.push({ kind: 'sent', text: tail });
      else if (tail) parts.push({ kind: 'gap', text: tail });
    }

    // Now build sentence-level structures with word tokens inside each.
    const out = [];
    parts.forEach(p => {
      if (p.kind === 'gap') {
        out.push({ kind: 'gap', text: p.text });
        return;
      }
      out.push({ kind: 'sent', text: p.text, words: extractWordTokens(p.text) });
    });
    return out;
  }

  function extractWordTokens(sentenceText) {
    const wre = /[A-Za-z][A-Za-z'’\-]*[A-Za-z]|[A-Za-z]/g;
    const tokens = [];
    let last = 0;
    let m;
    while ((m = wre.exec(sentenceText)) !== null) {
      if (m.index > last) tokens.push({ kind: 'glue', text: sentenceText.slice(last, m.index) });
      tokens.push({ kind: 'word', text: m[0], lower: m[0].toLowerCase().replace(/[’]/g, "'") });
      last = m.index + m[0].length;
    }
    if (last < sentenceText.length) tokens.push({ kind: 'glue', text: sentenceText.slice(last) });
    return tokens;
  }

  // ---------- render ----------
  function renderBody() {
    const root = $('lessonBody');
    root.innerHTML = '';
    let sentIdx = 0;
    sentences.forEach(p => {
      if (p.kind === 'gap') {
        root.appendChild(document.createTextNode(p.text));
        return;
      }
      const wrap = document.createElement('span');
      wrap.className = 'wc-sentence';
      wrap.dataset.idx = String(sentIdx);
      p.words.forEach(tok => {
        if (tok.kind === 'glue') {
          wrap.appendChild(document.createTextNode(tok.text));
          return;
        }
        const sp = document.createElement('span');
        sp.className = 'wc-word';
        sp.dataset.word = tok.lower;
        sp.textContent  = tok.text;
        applyLevelClass(sp, wordLevels.get(tok.lower) || 0);
        sp.addEventListener('click', () => onWordClick(sp, tok.lower, tok.text));
        wrap.appendChild(sp);
      });
      // a click on whitespace inside a sentence focuses that sentence in single mode
      wrap.addEventListener('click', e => {
        if (singleMode && e.target === wrap) goSingle(parseInt(wrap.dataset.idx, 10));
      });
      root.appendChild(wrap);
      sentIdx++;
    });
    refreshSingleMode();
  }

  function applyLevelClass(el, level) {
    el.classList.remove('lvl--1','lvl-0','lvl-1','lvl-2','lvl-3','lvl-4','lvl-5');
    el.classList.add('lvl-' + level);
  }

  // ---------- word click ----------
  async function onWordClick(el, lower, original) {
    const current = wordLevels.get(lower) || 0;
    // Open the popup; the popup is the source of truth for level changes
    // (it offers Got it / Mark as 무시 / Hear it / Look it up actions).
    window.WCWordPopup.open({
      word: original,
      lower,
      level: current,
      onLevelChange: async (next) => {
        const prev = wordLevels.get(lower) || 0;
        wordLevels.set(lower, next);
        applyLevelClass(el, next);
        try {
          await window.WCDB.wordStates.upsert(me.id, lower, next);
        } catch (e) { console.warn('upsert wordState', e); }
        // Phase 5 hook: encounter counter bumps on UPWARD changes only,
        // and (in Phase 5) is throttled by time. For now we just emit
        // an event other scripts can listen to.
        if (next > prev && next !== -1) {
          window.dispatchEvent(new CustomEvent('wc:level-up', {
            detail: { word: lower, prev, next, lessonId },
          }));
        }
        notifyLevelChange({ word: lower, prev, next });
      },
    });
  }

  // ---------- toolbar ----------
  function wireToolbar() {
    $('btnPlay').addEventListener('click', async () => {
      const text = singleMode ? currentSentenceText() : flatText();
      try { await window.WCTTS.speak(text); }
      catch (e) { console.warn('TTS error', e); }
    });
    $('btnStop').addEventListener('click', () => window.WCTTS.stop());

    $('btnSingle').addEventListener('click', () => {
      singleMode = !singleMode;
      $('btnSingle').classList.toggle('active', singleMode);
      $('btnSingle').textContent = singleMode ? 'One sentence: ON' : 'One sentence: OFF';
      $('btnPrev').classList.toggle('wc-hidden', !singleMode);
      $('btnNext').classList.toggle('wc-hidden', !singleMode);
      if (singleMode && singleIdx == null) singleIdx = 0;
      refreshSingleMode();
    });
    $('btnPrev').addEventListener('click', () => goSingle(singleIdx - 1));
    $('btnNext').addEventListener('click', () => goSingle(singleIdx + 1));
  }

  function refreshSingleMode() {
    const wraps = document.querySelectorAll('.wc-sentence');
    if (!singleMode) {
      wraps.forEach(w => w.classList.remove('wc-dim', 'wc-active'));
      return;
    }
    wraps.forEach(w => {
      const i = parseInt(w.dataset.idx, 10);
      w.classList.toggle('wc-active', i === singleIdx);
      w.classList.toggle('wc-dim',    i !== singleIdx);
    });
    // scroll the active one into view
    const active = document.querySelector('.wc-sentence.wc-active');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function goSingle(next) {
    const sentWraps = document.querySelectorAll('.wc-sentence');
    if (!sentWraps.length) return;
    singleIdx = Math.max(0, Math.min(sentWraps.length - 1, next));
    refreshSingleMode();
  }

  // ---------- helpers ----------
  function currentSentenceText() {
    const sentenceObjs = sentences.filter(p => p.kind === 'sent');
    return (sentenceObjs[singleIdx] && sentenceObjs[singleIdx].text) || '';
  }
  function flatText() {
    return sentences.map(p => p.text).join('');
  }
})();
