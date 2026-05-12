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
  // Pagination — body split into "pages" the bottom arrows step through.
  // For Phase-current scope we paginate by paragraph: each <p> = one page,
  // which matches 또박또박's per-paragraph rhythm well enough without a
  // viewport-fitting algorithm. Future: dynamic auto-fit pagination.
  let pages       = [];      // [[sentence,…], …]  groups of parts
  let pageIdx     = 0;
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
    // Mutators sidebar.js calls when the ice-cream picker fires.
    setWordLevel: async function (lower, next, originalWord) {
      const prev = wordLevels.has(lower) ? wordLevels.get(lower) : null;
      if (next === prev) return;
      wordLevels.set(lower, next);
      // Recolour every visible occurrence of this word. Iterate all .w
      // spans and match by dataset.word — avoids needing a CSS escape
      // pass for apostrophes / hyphens / Unicode in the selector.
      document.querySelectorAll('.w').forEach(el => {
        if (el.dataset.word === lower) applyLevelClass(el, next);
      });
      try { await window.WCDB.wordStates.upsert(me.id, lower, next); } catch (e) {}
      if (next > (prev ?? -2) && next !== -1) {
        window.dispatchEvent(new CustomEvent('wc:level-up', {
          detail: { word: lower, prev, next, lessonId },
        }));
      }
      notifyLevelChange({ word: lower, prev, next });
    },
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
    pages     = paginate(sentences, lesson.body);
    pageIdx   = 0;
    renderBody();
    wireToolbar();
    refreshPageCounter();
    refreshNavBoundary();
  })();

  // ---------- pagination ----------
  // Group sentence/gap parts into pages, breaking on paragraph boundaries
  // (a "gap" containing \n\n is the natural paragraph break).
  function paginate(parts, rawBody) {
    if (!parts.length) return [];
    const out  = [];
    let curr   = [];
    parts.forEach(p => {
      curr.push(p);
      if (p.kind === 'gap' && /\n\s*\n/.test(p.text)) {
        out.push(curr);
        curr = [];
      }
    });
    if (curr.length) out.push(curr);
    // If the body had no blank-line paragraph breaks at all, fall back
    // to a single page rather than 1-sentence pages.
    return out.length ? out : [parts];
  }

  function refreshPageCounter() {
    const el = document.getElementById('thumbPages');
    if (!el) return;
    el.textContent = `${pageIdx + 1} / ${Math.max(1, pages.length)}`;
    const prev = document.getElementById('btnPagePrev');
    const next = document.getElementById('btnPageNext');
    if (prev) prev.disabled = pageIdx <= 0;
    if (next) next.disabled = pageIdx >= pages.length - 1;
  }

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
  // Two rendering modes:
  //   - page mode (singleMode=false): render the current page's parts,
  //     paragraph by paragraph. Arrow buttons step pages.
  //   - single mode (singleMode=true): render exactly ONE sentence at
  //     2× the body font (CSS-driven). Arrow buttons step sentences,
  //     ignoring page boundaries (a 1문장씩 reader doesn't care which
  //     "page" they're on; they care about the next thought).
  function renderBody() {
    const root = $('lessonBody');
    root.innerHTML = '';

    if (singleMode) {
      const flat = sentenceList();
      if (!flat.length) return;
      const i = clamp(singleIdx, 0, flat.length - 1);
      const p = flat[i];
      const wrap = makeSentenceWrap(p, i);
      wrap.classList.add('wc-active', 'wc-single');
      root.appendChild(wrap);
      if (window.WCChunks) window.WCChunks.prefetchSentences([p.text]);
      return;
    }

    // page mode — dataset.idx stamps the GLOBAL sentence index so
    // toggling 1문장씩 from a clicked word can jump to the right
    // sentence (across pages) without remapping.
    const parts = pages[pageIdx] || sentences;
    let globalStart = 0;
    for (let i = 0; i < pageIdx; i++) {
      globalStart += (pages[i] || []).filter(p => p.kind === 'sent').length;
    }
    let pageSentIdx = 0;
    const visibleSentences = [];
    parts.forEach(p => {
      if (p.kind === 'gap') {
        root.appendChild(document.createTextNode(p.text));
        return;
      }
      root.appendChild(makeSentenceWrap(p, globalStart + pageSentIdx));
      visibleSentences.push(p.text);
      pageSentIdx++;
    });
    // Prefetch chunks for everything just rendered — fire-and-forget.
    if (window.WCChunks) window.WCChunks.prefetchSentences(visibleSentences);
  }

  function makeSentenceWrap(p, idx) {
    const wrap = document.createElement('span');
    wrap.className = 'wc-sentence';
    wrap.dataset.idx = String(idx);
    wrap.dataset.text = p.text;   // used to fetch chunks by sentence text
    let wIdx = 0;
    p.words.forEach(tok => {
      if (tok.kind === 'glue') {
        // Glue spans (whitespace + punctuation between words) carry no
        // word index but DO get a wrapping span so the chunk underline
        // can flow continuously across spaces — matches 또박또박 behaviour.
        const g = document.createElement('span');
        g.className = 'w punct';
        g.textContent = tok.text;
        wrap.appendChild(g);
        return;
      }
      const sp = document.createElement('span');
      sp.className = 'w';
      sp.dataset.word = tok.lower;
      sp.dataset.wIdx = String(wIdx);   // 0-based, ignores glue — aligns with chunk-gpt indices
      sp.textContent  = tok.text;
      const startLevel = wordLevels.has(tok.lower) ? wordLevels.get(tok.lower) : null;
      applyLevelClass(sp, startLevel);
      sp.addEventListener('click', () => onWordClick(sp, tok.lower, tok.text));
      wrap.appendChild(sp);
      wIdx++;
    });
    return wrap;
  }

  // Flat list of all sentences across the lesson (page-blind).
  function sentenceList() {
    return sentences.filter(p => p.kind === 'sent');
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function applyLevelClass(el, level) {
    // 또박또박 visual states (sidebar-picker spec):
    //   null  → sky blue overlay by default — student hasn't picked
    //           a level yet but the word is "fresh" and inviting.
    //   1-4   → s1..s4 (dark→pale green, "learning")
    //   5     → s5 (transparent — known)
    //   -1    → sx (transparent — ignored)
    // Note: state 0 isn't picker-selectable, but the visual class .w
    //       (no sub-class) already paints sky-blue via CSS, so null
    //       and 0 look identical.
    el.classList.remove('unseen','s0','s1','s2','s3','s4','s5','sx');
    if (level === null || level === undefined) return;     // bare .w = sky blue
    if (level === -1) { el.classList.add('sx'); return; }
    if (level === 0)  { el.classList.add('s0'); return; }
    el.classList.add('s' + level);
  }

  // ============================================================
  //  WORD FOCUS  (또박또박 visual: amber glow + chunk underline)
  //
  //  One word is "focused" at a time (sentence + word indices).
  //  Click OR keyboard arrow changes the focus; we re-paint the
  //  .focused / .focused-chunk classes and fire wc:word-selected
  //  so the sidebar's word card updates.
  // ============================================================
  let focusedSentIdx = null;
  let focusedWordIdx = null;
  let lastSelectedSentenceIdx = 0;

  async function onWordClick(el, lower, original) {
    const sentEl = el.closest('.wc-sentence');
    if (!sentEl) return;
    const sIdx = parseInt(sentEl.dataset.idx, 10);
    const wIdx = parseInt(el.dataset.wIdx, 10);
    if (!isNaN(sIdx) && !isNaN(wIdx)) {
      lastSelectedSentenceIdx = sIdx;
      focusWord(sIdx, wIdx);
    }
  }

  function focusWord(sIdx, wIdx) {
    focusedSentIdx = sIdx;
    focusedWordIdx = wIdx;
    applyFocus();
  }

  function applyFocus() {
    // Clear previous focus markers across the whole body.
    document.querySelectorAll('.w.focused, .w.focused-chunk')
      .forEach(el => el.classList.remove('focused', 'focused-chunk'));

    if (focusedSentIdx == null) return;
    const sentEl = document.querySelector(`.wc-sentence[data-idx="${focusedSentIdx}"]`);
    if (!sentEl) return;
    const wordEl = sentEl.querySelector(`.w[data-w-idx="${focusedWordIdx}"]`);
    if (!wordEl) return;

    wordEl.classList.add('focused');

    // Fire word-selected event → sidebar fetches info + renders.
    const lower    = wordEl.dataset.word;
    const original = wordEl.textContent;
    const sentText = sentEl.dataset.text || '';
    window.dispatchEvent(new CustomEvent('wc:word-selected', {
      detail: { word: original, lower, sentence: sentText },
    }));

    // Chunk highlight — fetch async then paint, but bail if focus moved.
    const seenSent = focusedSentIdx, seenWord = focusedWordIdx;
    window.WCChunks.fetch(sentText).then(chunks => {
      if (focusedSentIdx !== seenSent || focusedWordIdx !== seenWord) return;
      const chunk = window.WCChunks.findChunkAt(chunks, focusedWordIdx);
      if (!chunk) return;
      paintChunkUnderline(sentEl, chunk.indices[0], chunk.indices[1]);
    }).catch(()=>{});
  }

  // Walk children in order and tag every .w span (word OR glue) whose
  // word-index falls inside [from..to] — gives a continuous underline
  // across spaces/punctuation, the 또박또박 visual.
  function paintChunkUnderline(sentEl, from, to) {
    let inChunk = false;
    [...sentEl.children].forEach(child => {
      if (!child.classList || !child.classList.contains('w')) return;
      const isWord = !child.classList.contains('punct');
      if (isWord) {
        const i = parseInt(child.dataset.wIdx, 10);
        if (i === from) inChunk = true;
        if (inChunk) child.classList.add('focused-chunk');
        if (i === to) inChunk = false;   // tagged THIS word; close after we paint it
      } else if (inChunk) {
        // glue/punct between chunk words → include in underline
        child.classList.add('focused-chunk');
      }
    });
  }

  // ============================================================
  //  KEYBOARD NAV  — ←/→ word, ↑/↓ chunk
  // ============================================================
  document.addEventListener('keydown', onKeyDown);
  function onKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); navWord(-1);  break;
      case 'ArrowRight': e.preventDefault(); navWord(+1);  break;
      case 'ArrowUp':    e.preventDefault(); navChunk(-1); break;
      case 'ArrowDown':  e.preventDefault(); navChunk(+1); break;
    }
  }

  function navWord(dir) {
    // Nothing focused yet → start at the first word of the current page.
    if (focusedSentIdx == null) {
      const first = document.querySelector('.wc-sentence .w[data-w-idx="0"]');
      if (first) {
        const sentEl = first.closest('.wc-sentence');
        focusWord(parseInt(sentEl.dataset.idx, 10), 0);
      }
      return;
    }
    const sentEl = document.querySelector(`.wc-sentence[data-idx="${focusedSentIdx}"]`);
    if (sentEl) {
      const target = sentEl.querySelector(`.w[data-w-idx="${focusedWordIdx + dir}"]`);
      if (target) { focusWord(focusedSentIdx, focusedWordIdx + dir); return; }
    }
    // Sentence boundary — jump to neighbouring sentence.
    const adjIdx = focusedSentIdx + dir;
    const adjEl = document.querySelector(`.wc-sentence[data-idx="${adjIdx}"]`);
    if (adjEl) {
      const words = adjEl.querySelectorAll('.w:not(.punct)');
      if (!words.length) return;
      focusWord(adjIdx, dir > 0 ? 0 : words.length - 1);
      return;
    }
    // Page boundary — flip page first, then focus first/last word.
    if (dir > 0 && pageIdx < pages.length - 1) {
      goPage(pageIdx + 1);
      setTimeout(() => focusWord(globalStartOfPage(pageIdx), 0), 220);
    } else if (dir < 0 && pageIdx > 0) {
      goPage(pageIdx - 1);
      setTimeout(() => {
        const newSents = document.querySelectorAll('.wc-sentence');
        const last = newSents[newSents.length - 1];
        if (!last) return;
        const words = last.querySelectorAll('.w:not(.punct)');
        focusWord(parseInt(last.dataset.idx, 10), words.length - 1);
      }, 220);
    }
  }

  async function navChunk(dir) {
    if (focusedSentIdx == null) { navWord(dir); return; }
    const sentEl = document.querySelector(`.wc-sentence[data-idx="${focusedSentIdx}"]`);
    if (!sentEl) { navWord(dir); return; }
    const chunks = await window.WCChunks.fetch(sentEl.dataset.text);
    if (!chunks || !chunks.length) { navWord(dir); return; }
    const cur = window.WCChunks.findChunkAt(chunks, focusedWordIdx);
    const curIdx = cur ? chunks.indexOf(cur) : -1;
    const nextIdx = curIdx + dir;
    if (nextIdx >= 0 && nextIdx < chunks.length) {
      focusWord(focusedSentIdx, chunks[nextIdx].indices[0]);
      return;
    }
    // Off either end of the sentence's chunks → jump sentence.
    const adjIdx = focusedSentIdx + dir;
    const adjEl = document.querySelector(`.wc-sentence[data-idx="${adjIdx}"]`);
    if (adjEl) focusWord(adjIdx, 0);
  }

  // First global sentence-idx of the given page (used after page-flip).
  function globalStartOfPage(pi) {
    let start = 0;
    for (let i = 0; i < pi; i++) {
      start += (pages[i] || []).filter(p => p.kind === 'sent').length;
    }
    return start;
  }

  // ---------- toolbar / bottom-bar wiring ----------
  function wireToolbar() {
    // ▶ Play / pause TTS — icon flips between ▶ and ⏸ to mirror state,
    // and `.playing` toggles the green-filled style.
    let isPlaying = false;
    const playBtn = $('btnPlay');
    const setPlayUi = (playing) => {
      playBtn.textContent = playing ? '⏸' : '▶';
      playBtn.classList.toggle('playing', playing);
      playBtn.setAttribute('aria-label', playing ? '일시정지' : '재생');
    };
    setPlayUi(false);
    playBtn.addEventListener('click', async () => {
      if (isPlaying) {
        window.WCTTS.stop();
        isPlaying = false;
        setPlayUi(false);
        return;
      }
      isPlaying = true;
      setPlayUi(true);
      const text = singleMode ? currentSentenceText() : currentPageText();
      try { await window.WCTTS.speak(text); }
      catch (e) { console.warn('TTS error', e); }
      isPlaying = false;
      setPlayUi(false);
    });

    // 1문장씩 chip in the header → enter focused-reading. When the
    // user had just clicked a word, start from THAT sentence; otherwise
    // start from the first sentence on the current page.
    $('btnSingle').addEventListener('click', () => {
      singleMode = !singleMode;
      $('btnSingle').classList.toggle('active', singleMode);
      $('btnSingle').setAttribute('aria-pressed', singleMode ? 'true' : 'false');
      document.body.classList.toggle('wc-single-mode', singleMode);
      if (singleMode) {
        // If the user picked a word recently, start from its sentence.
        singleIdx = lastSelectedSentenceIdx || 0;
      }
      refreshSingleMode();
    });

    // Bottom-bar arrows: when 1문장씩 ON they step sentences; otherwise
    // they step PAGES (same role as 또박또박's lb-arrow buttons).
    $('btnPrev').addEventListener('click', () => {
      if (singleMode) goSingle(singleIdx - 1);
      else            goPage(pageIdx - 1);
    });
    $('btnNext').addEventListener('click', () => {
      if (singleMode) goSingle(singleIdx + 1);
      else            goPage(pageIdx + 1);
    });

    // Thumbnail page buttons (top-right) — explicit page navigation.
    const ppPrev = document.getElementById('btnPagePrev');
    const ppNext = document.getElementById('btnPageNext');
    if (ppPrev) ppPrev.addEventListener('click', () => goPage(pageIdx - 1));
    if (ppNext) ppNext.addEventListener('click', () => goPage(pageIdx + 1));
  }

  function goPage(next) {
    if (!pages.length) return;
    const prev = pageIdx;
    pageIdx = Math.max(0, Math.min(pages.length - 1, next));
    if (pageIdx === prev) return;
    singleIdx = 0;
    slideRender(pageIdx > prev ? 'forward' : 'back');
  }

  // Slide animation wrapper. Direction:
  //   'forward' → outgoing slides out to the LEFT, incoming enters
  //                from the RIGHT  (next page / next sentence)
  //   'back'    → outgoing → RIGHT, incoming ← LEFT
  function slideRender(direction) {
    const el = $('lessonBody');
    const outCls = direction === 'forward' ? 'wc-slide-out-left' : 'wc-slide-out-right';
    const inCls  = direction === 'forward' ? 'wc-slide-in-right' : 'wc-slide-in-left';
    el.classList.add(outCls);
    setTimeout(() => {
      renderBody();
      refreshPageCounter();
      refreshNavBoundary();
      applyFocus();   // re-apply amber glow + chunk underline on the new DOM
      el.classList.remove(outCls);
      el.classList.add(inCls);
      setTimeout(() => el.classList.remove(inCls), 280);
    }, 180);
  }

  function refreshNavBoundary() {
    const prev = $('btnPrev'), next = $('btnNext');
    if (!prev || !next) return;
    if (singleMode) {
      const last = sentenceList().length - 1;
      prev.disabled = singleIdx <= 0;
      next.disabled = singleIdx >= last;
    } else {
      prev.disabled = pageIdx <= 0;
      next.disabled = pageIdx >= pages.length - 1;
    }
  }

  function currentPageText() {
    const parts = pages[pageIdx] || [];
    return parts.map(p => p.text).join('');
  }

  function refreshSingleMode() {
    // Re-render — the renderer branches on singleMode internally.
    renderBody();
    refreshPageCounter();
    refreshNavBoundary();
  }

  function goSingle(next) {
    const flat = sentenceList();
    if (!flat.length) return;
    const prev = singleIdx;
    singleIdx = clamp(next, 0, flat.length - 1);
    if (singleIdx === prev) return;
    slideRender(singleIdx > prev ? 'forward' : 'back');
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
