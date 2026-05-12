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

  // ?preview=1 → opened from the teacher dashboard's Preview link.
  // The lesson renders read-only: no auth check, no per-student data,
  // no DB writes anywhere in the page. Word levels live only in
  // memory for the duration of the preview tab.
  const params    = new URLSearchParams(location.search);
  const isPreview = params.get('preview') === '1';

  const me = isPreview
    ? {
        // Synthetic "preview" user. Not a real wc_users row — this
        // object never reaches the DB. The id starts with `__` so
        // any accidental query that does hit Postgres returns no
        // rows instead of touching a real student.
        id:              '__preview__',
        real_name:       'Preview',
        role:            'preview',
        money:           0,
        encounter_level: 1,
        class_id:        null,
        login_code:      null,
      }
    : window.WCAuth.requireStudent('./index.html');
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
    isPreview,
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
      // spans and match by dataset.word.
      document.querySelectorAll('.w').forEach(el => {
        if (el.dataset.word === lower) applyLevelClass(el, next);
      });
      // Persist only when we have a real user — preview mode keeps
      // word states purely in memory for the tab's lifetime.
      if (!isPreview) {
        try { await window.WCDB.wordStates.upsert(me.id, lower, next); } catch (e) {}
      }
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
    // Skip in preview mode (the synthetic user has no DB row to refresh).
    if (!isPreview) {
      try {
        const fresh = await window.WCDB.users.byLoginCode(me.login_code);
        if (fresh) Object.assign(me, fresh);
      } catch {}
    }

    try {
      lesson = await window.WCDB.lessons.byId(lessonId);
    } catch (e) { console.error(e); }
    if (!lesson) {
      $('lessonBody').innerHTML = '<p>Lesson not found.</p>';
      return;
    }
    $('lessonTitle').textContent = lesson.title;

    // Preview banner — yellow strip at the very top of the page so
    // the teacher knows nothing they do here is being saved.
    if (isPreview && !document.getElementById('wcPreviewBanner')) {
      const banner = document.createElement('div');
      banner.id = 'wcPreviewBanner';
      banner.innerHTML = `
        <span>👁 <strong>Preview mode</strong> — no progress is saved. Close the tab when done.</span>
      `;
      Object.assign(banner.style, {
        position: 'fixed', top: '0', left: '0', right: '0', zIndex: '9999',
        background: '#fff4c2', borderBottom: '1px solid #e6c84b',
        color: '#5a4a1a', fontSize: '14px',
        padding: '8px 14px', textAlign: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        fontFamily: 'inherit',
      });
      document.body.appendChild(banner);
      const h = banner.offsetHeight;
      document.body.style.paddingTop =
        (parseFloat(getComputedStyle(document.body).paddingTop) || 0) + h + 'px';
    }

    // Preview-only Edit button — sits in the top-right of the lesson
    // card so a teacher reviewing their own lesson can jump straight
    // to fixing typos / formatting. Students never reach the preview
    // path so they never see this button.
    if (isPreview) {
      const card = document.querySelector('.wc-lesson-main');
      if (card && !document.getElementById('wcPreviewEdit')) {
        const editLink = document.createElement('a');
        editLink.id = 'wcPreviewEdit';
        editLink.className = 'wc-preview-edit';
        editLink.href = './teacher.html?edit=' + encodeURIComponent(lessonId);
        editLink.textContent = '✏️ Edit';
        editLink.title = 'Open in teacher dashboard for editing';
        card.appendChild(editLink);
      }
    }

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

    // Load word levels for this user (whole-user set — fine for MVP
    // class size). Skip in preview mode — there's no real user to load
    // from, and we want the preview to start with a clean slate.
    if (!isPreview) {
      try {
        const rows = await window.WCDB.wordStates.forUser(me.id);
        rows.forEach(r => wordLevels.set(r.word, r.level));
      } catch (e) { console.warn('wordStates load:', e); }
    }

    sentences = tokeniseBody(lesson.body);
    pages     = paginate(sentences, lesson.body);
    pageIdx   = 0;
    renderBody();
    wireToolbar();
    refreshPageCounter();
    refreshNavBoundary();
  })();

  // ---------- pagination ----------
  // Group sentence/gap parts into pages. Two break triggers:
  //   1. paragraph break — a "gap" part whose text contains \n\n
  //      (the natural reading-comprehension break)
  //   2. sentence cap — once a page has reached MAX_SENTENCES_PER_PAGE
  //      sentences we soft-break, even mid-paragraph. Without this
  //      cap a body with no double-newlines (typical when teachers
  //      paste from a Word doc that uses single-line wrapping) all
  //      collapses into a single page — defeating pagination entirely.
  //
  // 6 sentences per page = roughly one Year-3 attention span, and
  // matches the visual density 또박또박 gets from its viewport-fit
  // pagination without doing the full layout-measurement dance.
  function paginate(parts /*, rawBody */) {
    if (!parts.length) return [];
    // HTML body — every part is one page. The teacher's <hr> markers
    // already decided where the page breaks are.
    if (parts.every(p => p.kind === 'html')) return parts.map(p => [p]);

    const MAX_SENTENCES_PER_PAGE = 6;
    const out  = [];
    let curr   = [];
    let sentCount = 0;
    parts.forEach(p => {
      curr.push(p);
      if (p.kind === 'sent') sentCount++;
      const hardBreak = (p.kind === 'gap' && /\n\s*\n/.test(p.text));
      const softBreak = (p.kind === 'sent' && sentCount >= MAX_SENTENCES_PER_PAGE);
      if (hardBreak || softBreak) {
        out.push(curr);
        curr = [];
        sentCount = 0;
      }
    });
    if (curr.length) out.push(curr);
    return out.length ? out : [parts];
  }

  function refreshPageCounter() {
    const thumb = document.getElementById('thumbPages');
    const bar   = document.getElementById('lbPageCount');
    const pageText = `${pageIdx + 1} / ${Math.max(1, pages.length)}`;
    let barText = pageText;
    if (counterMode === 'sentence') {
      const flat = sentenceList();
      // "Current sentence" = the sentence the focused word lives in,
      // falling back to single-mode index, falling back to the first
      // sentence of the current page so the counter always has a
      // sensible value.
      let curIdx = 0;
      if (focusedSentIdx != null) curIdx = focusedSentIdx;
      else if (singleMode)        curIdx = singleIdx;
      else                        curIdx = globalStartOfPage(pageIdx);
      barText = `${curIdx + 1} / ${Math.max(1, flat.length)}`;
    }
    if (thumb) thumb.textContent = pageText;
    if (bar)   bar.textContent   = barText;
    // ‹‹ / ›› in the bottom bar greys out at boundaries.
    const prevPage = document.getElementById('btnPagePrev');
    const nextPage = document.getElementById('btnPageNext');
    if (prevPage) prevPage.disabled = pageIdx <= 0;
    if (nextPage) nextPage.disabled = pageIdx >= pages.length - 1;
  }

  // Briefly brighten + glow the counter to signal a mode switch.
  function flashCounter() {
    const bar = document.getElementById('lbPageCount');
    if (!bar) return;
    bar.classList.remove('wc-counter-glow');
    // Force reflow so the animation restarts cleanly even on rapid toggles.
    void bar.offsetWidth;
    bar.classList.add('wc-counter-glow');
    setTimeout(() => bar.classList.remove('wc-counter-glow'), 450);
  }

  // Centralised counter-mode switch. Called from BOTH bottom-bar
  // arrow clicks AND ,/. keyboard shortcuts so text + glow always
  // happen instantly together. Was previously a closure inside
  // wireToolbar(), which made the keyboard path skip the immediate
  // text refresh — the number only updated on the next slide render.
  function setCounterMode(mode) {
    if (counterMode === mode) return;
    counterMode = mode;
    refreshPageCounter();
    flashCounter();
  }

  // ---------- tokenisation ----------
  // Strip [[IMG:N]] markers BEFORE sentence tokenisation so they
  // don't get tangled in word/sentence boundaries. We remember each
  // marker's position so the renderer can re-inject the image at
  // the right point during render.
  function extractImageMarkers(body) {
    const re = /\[\[IMG:(\d+)\]\]/g;
    const parts = [];
    let last = 0; let m;
    while ((m = re.exec(body)) !== null) {
      if (m.index > last) parts.push({ kind: 'text', text: body.slice(last, m.index) });
      parts.push({ kind: 'img',  idx: parseInt(m[1], 10) });
      last = m.index + m[0].length;
    }
    if (last < body.length) parts.push({ kind: 'text', text: body.slice(last) });
    return parts;
  }

  // Body can be either plain text (legacy + simple lessons) or an HTML
  // string (lessons authored with the rich-text toolbar — H1/H2/H3/B/U/
  // colour). HTML bodies preserve block + inline formatting; we walk
  // their text nodes at render time to tokenise words/sentences while
  // keeping the surrounding markup.
  function isHtmlBody(body) {
    return /<(p|h[1-6]|div|br|hr|span|b|i|u|em|strong|font|a\s)/i.test(body || '');
  }

  // HTML auto-pagination — when the teacher hasn't placed any
  // <hr class="wc-page-break"> markers, walk the body's top-level
  // children and accumulate them into segments until the running
  // sentence count crosses `maxSentences`. Each segment becomes one
  // page in the lesson renderer.
  function autoSplitHtmlByCount(html, maxSentences) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const segs = [];
    let curHtml = '';
    let sentCount = 0;
    Array.from(tmp.childNodes).forEach(node => {
      let nodeHtml = '';
      let nodeText = '';
      if (node.nodeType === Node.ELEMENT_NODE) {
        nodeHtml = node.outerHTML;
        nodeText = node.textContent || '';
      } else if (node.nodeType === Node.TEXT_NODE) {
        // Wrap free-floating text in a span so re-rendering keeps it.
        const t = node.textContent || '';
        if (!t.trim()) return;
        nodeHtml = t;
        nodeText = t;
      } else {
        return;
      }
      const nodeSentCount = (nodeText.match(/[.!?]+/g) || []).length || 1;
      curHtml += nodeHtml;
      sentCount += nodeSentCount;
      if (sentCount >= maxSentences) {
        segs.push(curHtml);
        curHtml = '';
        sentCount = 0;
      }
    });
    if (curHtml) segs.push(curHtml);
    return segs.length ? segs : [html];
  }

  function tokeniseBody(body) {
    if (isHtmlBody(body)) {
      // HTML path. Two splitting strategies:
      //   1. If the teacher inserted <hr class="wc-page-break"> markers,
      //      use those — each segment becomes one page.
      //   2. Otherwise auto-split by sentence count so a long-paragraph
      //      lesson doesn't collapse into a single buried page.
      const PAGE_BREAK_RE = /<hr\b[^>]*class=["'][^"']*wc-page-break[^"']*["'][^>]*\/?>/gi;
      const segments = PAGE_BREAK_RE.test(body)
        ? body.split(PAGE_BREAK_RE)
        : autoSplitHtmlByCount(body, 6);
      return segments.map(segHtml => {
        const tmp = document.createElement('div');
        tmp.innerHTML = segHtml;
        const flat = [];
        const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, null, false);
        let n;
        while ((n = walker.nextNode())) {
          const text = n.textContent;
          if (!text || !text.trim()) continue;
          const re = /[^.!?]+[.!?]+["'’)\]]*/g;
          let m, lastEnd = 0;
          while ((m = re.exec(text)) !== null) {
            flat.push({ kind: 'sent', text: m[0], words: extractWordTokens(m[0]) });
            lastEnd = m.index + m[0].length;
          }
          if (lastEnd < text.length) {
            const tail = text.slice(lastEnd);
            if (tail.trim()) flat.push({ kind: 'sent', text: tail, words: extractWordTokens(tail) });
          }
        }
        return { kind: 'html', html: segHtml, sentences: flat };
      });
    }

    // Plain text path — split out [[IMG:N]] markers first, then split
    // each text segment into sentences + glue gaps.
    const segments = extractImageMarkers(body);
    const out = [];
    segments.forEach(seg => {
      if (seg.kind === 'img') {
        out.push({ kind: 'img', idx: seg.idx });
        return;
      }
      const re = /[^.!?]+[.!?]+["'’)\]]*/g;
      let lastEnd = 0; let m;
      while ((m = re.exec(seg.text)) !== null) {
        if (m.index > lastEnd) {
          out.push({ kind: 'gap', text: seg.text.slice(lastEnd, m.index) });
        }
        out.push({ kind: 'sent', text: m[0], words: extractWordTokens(m[0]) });
        lastEnd = m.index + m[0].length;
      }
      if (lastEnd < seg.text.length) {
        const tail = seg.text.slice(lastEnd);
        if (tail.trim()) out.push({ kind: 'sent', text: tail, words: extractWordTokens(tail) });
        else if (tail)   out.push({ kind: 'gap',  text: tail });
      }
    });
    return out;
  }

  function extractWordTokens(sentenceText) {
    // \p{L} (Unicode letter) instead of [A-Za-z] so macrons used in
    // Māori (ā ē ī ō ū / Ā Ē Ī Ō Ū) AND other accented Latin chars
    // tokenise as part of the word, not as glue. "Kororā", "Mānawa",
    // "Māori", "Pīwakawaka", "Wētā", "Takahē" now stay as one token.
    const wre = /[\p{L}][\p{L}'’\-]*[\p{L}]|[\p{L}]/gu;
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

    // HTML body — render the raw HTML, then walk text nodes and
    // tokenise each in-place. This preserves H1/H2/H3/B/U/colour
    // markup while making every word individually clickable. The
    // offset = sentence count of all previous pages, so the
    // .wc-sentence data-idx values are GLOBAL (the TTS auto-advance
    // and keyboard nav rely on this).
    const parts = pages[pageIdx] || sentences;
    if (parts.length === 1 && parts[0].kind === 'html') {
      root.innerHTML = parts[0].html;
      tokenizeTextNodesInPlace(root, globalStartOfPage(pageIdx));
      return;
    }
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
      if (p.kind === 'img') {
        const img = makeFloatingImage(p.idx);
        if (img) root.appendChild(img);
        return;
      }
      root.appendChild(makeSentenceWrap(p, globalStart + pageSentIdx));
      visibleSentences.push(p.text);
      pageSentIdx++;
    });
    // Prefetch chunks for everything just rendered — fire-and-forget.
    if (window.WCChunks) window.WCChunks.prefetchSentences(visibleSentences);
  }

  // Build a floated <img> for the Nth image attached to this lesson.
  // `corner` decides which side the float sits on (tl/tr/bl/br);
  // `scale` (defaults to 1.0) scales the base 22 %-of-card width by
  // 5 %-step adjustments the teacher made in the chip preview.
  function makeFloatingImage(idx) {
    const list = Array.isArray(lesson?.images) ? lesson.images : [];
    const rec  = list[idx];
    if (!rec || !rec.data_url) return null;
    const img = document.createElement('img');
    img.className = 'wc-lesson-img wc-corner-' + (rec.corner || 'tr');
    img.src = rec.data_url;
    img.alt = '';
    img.draggable = false;
    const scale = Number.isFinite(rec.scale) ? rec.scale : 1.0;
    if (scale !== 1.0) {
      // The base width comes from the CSS rule (22 % / min 120 / max 220).
      // We override BOTH width and max-width together so the size moves
      // proportionally on both narrow and wide viewports.
      img.style.width    = (22 * scale).toFixed(1) + '%';
      img.style.maxWidth = Math.round(220 * scale) + 'px';
      img.style.minWidth = Math.round(120 * scale) + 'px';
    }
    return img;
  }

  // HTML body tokenisation. Walks all text nodes inside `rootEl`,
  // replaces each with a fragment of .wc-sentence spans (containing
  // .w word spans). Image markers `[[IMG:N]]` in the text become
  // floating <img> elements inside the sentence flow. Global sentence
  // index increments across all text nodes so 1문장씩 nav still works.
  function tokenizeTextNodesInPlace(rootEl, startIdx) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    let globalSentIdx = startIdx || 0;
    textNodes.forEach(tn => {
      // Skip text nodes inside img / script / style — defensive, the
      // walker shouldn't surface these anyway.
      const parent = tn.parentNode;
      if (!parent || parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE') return;
      const text = tn.textContent;
      if (!text || !text.trim()) return;
      const frag = buildSentenceFragment(text, globalSentIdx);
      globalSentIdx = frag.nextIdx;
      parent.replaceChild(frag.frag, tn);
    });
  }

  function buildSentenceFragment(text, sentIdxStart) {
    const out = document.createDocumentFragment();
    let sentIdx = sentIdxStart;

    // First split by image markers — each marker becomes a floating <img>.
    const imgRe = /\[\[IMG:(\d+)\]\]/g;
    let lastEnd = 0;
    let m;
    while ((m = imgRe.exec(text)) !== null) {
      if (m.index > lastEnd) {
        const sub = text.slice(lastEnd, m.index);
        const r = appendSentencesFromText(out, sub, sentIdx);
        sentIdx = r;
      }
      const idx = parseInt(m[1], 10);
      const img = makeFloatingImage(idx);
      if (img) out.appendChild(img);
      lastEnd = m.index + m[0].length;
    }
    if (lastEnd < text.length) {
      const sub = text.slice(lastEnd);
      const r = appendSentencesFromText(out, sub, sentIdx);
      sentIdx = r;
    }
    return { frag: out, nextIdx: sentIdx };
  }

  function appendSentencesFromText(frag, text, sentIdxStart) {
    let sentIdx = sentIdxStart;
    const sentRe = /[^.!?]+[.!?]+["'’)\]]*/g;
    let lastEnd = 0;
    let m;
    while ((m = sentRe.exec(text)) !== null) {
      if (m.index > lastEnd) {
        // glue between sentences — preserve as plain text so HTML
        // formatting (italic etc.) renders correctly around it.
        frag.appendChild(document.createTextNode(text.slice(lastEnd, m.index)));
      }
      const sentText = m[0];
      const sentObj = { kind: 'sent', text: sentText, words: extractWordTokens(sentText) };
      frag.appendChild(makeSentenceWrap(sentObj, sentIdx));
      sentIdx++;
      lastEnd = m.index + m[0].length;
    }
    if (lastEnd < text.length) {
      const tail = text.slice(lastEnd);
      if (tail.trim()) {
        const sentObj = { kind: 'sent', text: tail, words: extractWordTokens(tail) };
        frag.appendChild(makeSentenceWrap(sentObj, sentIdx));
        sentIdx++;
      } else {
        frag.appendChild(document.createTextNode(tail));
      }
    }
    return sentIdx;
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
      // Notification dot — small green pip in the top-right of any
      // word the teacher attached an image to. Subtle hint that
      // clicking will surface visual info beyond the dictionary entry.
      if (hasWordImage(tok.lower)) sp.classList.add('has-word-image');
      sp.addEventListener('click', () => onWordClick(sp, tok.lower, tok.text));
      wrap.appendChild(sp);
      wIdx++;
    });
    return wrap;
  }

  function hasWordImage(lower) {
    const list = lesson && lesson.word_images;
    if (!Array.isArray(list) || !list.length) return false;
    const want = String(lower || '').toLowerCase();
    return list.some(wi => (wi.word || '').toLowerCase() === want);
  }

  // Flat list of all sentences across the lesson (page-blind). For
  // HTML bodies with page-break markers, sentences are pre-extracted
  // into each html part — concat them all to get the global list.
  function sentenceList() {
    if (sentences.length && sentences.every(p => p.kind === 'html')) {
      const out = [];
      sentences.forEach(p => { (p.sentences || []).forEach(s => out.push(s)); });
      return out;
    }
    return sentences.filter(p => p.kind === 'sent');
  }

  // Which page contains the Nth global sentence? Returns the page idx,
  // or null if the global idx is out of range. Used by the TTS auto-
  // advance to flip pages when reading crosses a page boundary.
  function pageForGlobalSent(globalIdx) {
    if (!pages.length) return null;
    let acc = 0;
    for (let p = 0; p < pages.length; p++) {
      const partList = pages[p] || [];
      let pageCount = 0;
      partList.forEach(part => {
        if (part.kind === 'sent') pageCount++;
        else if (part.kind === 'html') pageCount += (part.sentences || []).length;
      });
      if (globalIdx < acc + pageCount) return p;
      acc += pageCount;
    }
    return null;
  }

  // Local sentence index within `pageIdx` for the given global idx.
  function localSentInPage(globalIdx, pageNum) {
    let acc = 0;
    for (let p = 0; p < pageNum; p++) {
      const partList = pages[p] || [];
      partList.forEach(part => {
        if (part.kind === 'sent') acc++;
        else if (part.kind === 'html') acc += (part.sentences || []).length;
      });
    }
    return globalIdx - acc;
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
  // Chunk-TTS mute state — true by default (don't auto-play). Toggled
  // by the 🔇/🔊 chip in the header. Only affects chunk-on-tap audio;
  // ▶ Listen, sidebar headword 🔊, etc. always play.
  let chunkMuted = true;
  // Tracks which chunk we last played so moving the focus inside the
  // same chunk doesn't re-fire TTS on every word.
  let lastPlayedChunkKey = null;
  // Counter display mode in the bottom bar.
  //   'page'     → "3 / 17" (current page / total pages)
  //   'sentence' → "12 / 84" (current sentence / total sentences)
  // Toggles based on which arrow the user last used:
  //   ›/‹  (word-step)  → 'sentence'
  //   ››/‹‹ (page-step) → 'page'
  let counterMode = 'page';

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
    // Sentence-mode counter shows the focused word's sentence index;
    // refresh on every focus change so the number moves with the
    // selection (was previously only refreshing on page slides).
    if (counterMode === 'sentence') refreshPageCounter();
  }

  // Drop all visual selection state — focused word ring, chunk
  // underline, and sidebar word card. Triggered by Esc.
  function clearWordFocus() {
    focusedSentIdx = null;
    focusedWordIdx = null;
    document.querySelectorAll('.w.focused, .w.focused-chunk')
      .forEach(el => el.classList.remove('focused', 'focused-chunk'));
    // Tell the sidebar to revert to its empty state.
    window.dispatchEvent(new CustomEvent('wc:word-deselected'));
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
    // Keep the focused word visible — if it scrolled out of the body's
    // viewport (long page, ↓ /→ stepping past the visible window),
    // scroll the nearest scrollable ancestor just enough to bring it
    // back into view. `block: 'nearest'` is a no-op when the word is
    // already visible, so this never jiggles the page unnecessarily.
    try { wordEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}

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
      // Chunk TTS — read the whole chunk once when the focused word
      // moves INTO a chunk that we haven't played yet. Skipped when
      // muted (the default) and in preview mode.
      const chunkKey = `${seenSent}::${chunk.indices[0]}-${chunk.indices[1]}`;
      if (!chunkMuted && !isPreview && chunkKey !== lastPlayedChunkKey) {
        lastPlayedChunkKey = chunkKey;
        if (window.WCTTS && chunk.text) {
          window.WCTTS.speak(chunk.text).catch(() => {});
        }
      }
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
      case 'ArrowLeft':  e.preventDefault(); navWord(-1);  return;
      case 'ArrowRight': e.preventDefault(); navWord(+1);  return;
      case 'ArrowUp':    e.preventDefault(); navChunk(-1); return;
      case 'ArrowDown':  e.preventDefault(); navChunk(+1); return;
      // ','  → previous page,  '.' → next page (또박또박 convention).
      case ',':          e.preventDefault(); setCounterMode('page'); goPage(pageIdx - 1); return;
      case '.':          e.preventDefault(); setCounterMode('page'); goPage(pageIdx + 1); return;
      // Spacebar → play / pause whole-lesson TTS reading. Most
      // natural for a reading app — same as a media player.
      case ' ':          e.preventDefault(); playAllFromCurrent();  return;
      // Esc → clear word selection (focus + chunk underline) AND
      // close the sidebar word card. Cheap escape hatch when the
      // student wants to read without anything highlighted.
      case 'Escape':     e.preventDefault(); clearWordFocus();      return;
    }
    // Level-picker shortcuts — same mapping as 또박또박:
    //   0   → -1 (무시 / skip)
    //   1-4 →  1..4
    //   5, v, V → 5 (I know it!)
    // Only fires when a word is currently focused (i.e. shown in the
    // sidebar) — otherwise we have no target to grade.
    if (focusedSentIdx == null || focusedWordIdx == null) return;
    let st = null;
    if      (e.key === '0' || e.key === '₩')           st = -1;
    else if (e.key === '1')                            st = 1;
    else if (e.key === '2')                            st = 2;
    else if (e.key === '3')                            st = 3;
    else if (e.key === '4')                            st = 4;
    else if (e.key === '5' || e.key === 'v' || e.key === 'V') st = 5;
    if (st === null) return;
    e.preventDefault();
    const sentEl = document.querySelector(`.wc-sentence[data-idx="${focusedSentIdx}"]`);
    if (!sentEl) return;
    const wordEl = sentEl.querySelector(`.w[data-w-idx="${focusedWordIdx}"]`);
    if (!wordEl) return;
    const lower    = wordEl.dataset.word;
    const original = wordEl.textContent;
    window.WCLesson.setWordLevel(lower, st, original);
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

  // First global sentence-idx of the given page (used after page-flip
  // and by the TTS auto-advance to find the right sentence span).
  // Handles both plain-text parts (kind 'sent') AND html parts whose
  // sentences are pre-extracted into part.sentences.
  function globalStartOfPage(pi) {
    let count = 0;
    for (let i = 0; i < pi; i++) {
      (pages[i] || []).forEach(part => {
        if (part.kind === 'sent') count++;
        else if (part.kind === 'html') count += (part.sentences || []).length;
      });
    }
    return count;
  }

  // ============================================================
  //  WHOLE-LESSON TTS PLAYBACK
  //
  //  Reads each sentence with .wc-tts-reading underline, scrolls
  //  the active sentence into view, and flips to the next page
  //  automatically when reading crosses a page boundary. Toggle
  //  on/off with ▶/⏸ or the spacebar.
  // ============================================================
  let ttsPlaying = false;
  let ttsAbort   = false;

  async function playAllFromCurrent() {
    if (ttsPlaying) { stopAllTts(); return; }
    ttsPlaying = true; ttsAbort = false;
    setPlayUiState(true);

    const flat = sentenceList();
    // Start sentence — focused word's sentence > single-mode index > page start.
    let i = (focusedSentIdx != null) ? focusedSentIdx
          : (singleMode ? singleIdx : globalStartOfPage(pageIdx));

    for (; i < flat.length; i++) {
      if (ttsAbort) break;

      // If this sentence lives on a different page (HTML body with
      // page-break markers, or plain-text overflow page), flip first.
      if (!singleMode) {
        const sentPage = pageForGlobalSent(i);
        if (sentPage != null && sentPage !== pageIdx) {
          goPage(sentPage);
          // Wait for the slide animation (~460 ms) so the new DOM is
          // mounted before we try to find the sentence span.
          await new Promise(r => setTimeout(r, 500));
        }
      } else {
        // Single-sentence mode — keep its index in sync.
        singleIdx = i;
        renderBody();
      }

      const span = document.querySelector(`.wc-sentence[data-idx="${i}"]`);
      if (span) {
        span.classList.add('wc-tts-reading');
        try { span.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
      }

      const sent = flat[i];
      try { if (sent && sent.text) await window.WCTTS.speak(sent.text); }
      catch (e) { /* network / TTS hiccup — keep going */ }

      if (span) span.classList.remove('wc-tts-reading');
    }
    ttsPlaying = false;
    setPlayUiState(false);
  }

  function stopAllTts() {
    ttsAbort = true;
    if (window.WCTTS) window.WCTTS.stop();
    document.querySelectorAll('.wc-sentence.wc-tts-reading')
      .forEach(el => el.classList.remove('wc-tts-reading'));
    ttsPlaying = false;
    setPlayUiState(false);
  }

  function setPlayUiState(playing) {
    const btn = $('btnPlay');
    if (!btn) return;
    btn.textContent = playing ? '⏸' : '▶';
    btn.classList.toggle('playing', playing);
    btn.setAttribute('aria-label', playing ? '일시정지' : '재생');
  }

  // ---------- toolbar / bottom-bar wiring ----------
  function wireToolbar() {
    // ▶ Play / pause — toggles the lesson-wide TTS playback (which
    // reads sentence-by-sentence with an active underline, scrolls
    // each into view, and auto-flips to the next page when reading
    // crosses a page boundary).
    setPlayUiState(false);
    $('btnPlay').addEventListener('click', playAllFromCurrent);

    // Single-sentence chip in the header → enter focused-reading. When
    // the user just clicked a word, start from THAT sentence; otherwise
    // start from the first sentence on the current page.
    $('btnSingle').addEventListener('click', () => {
      singleMode = !singleMode;
      $('btnSingle').classList.toggle('active', singleMode);
      $('btnSingle').setAttribute('aria-pressed', singleMode ? 'true' : 'false');
      document.body.classList.toggle('wc-single-mode', singleMode);
      if (singleMode) {
        singleIdx = lastSelectedSentenceIdx || 0;
      }
      refreshSingleMode();
    });

    // Chunk-mute chip — toggles whether tapping a word triggers a
    // one-shot TTS read of its surrounding chunk. Default = muted.
    const muteBtn   = $('btnChunkMute');
    const muteIco   = $('btnChunkMuteIco');
    const muteLabel = $('btnChunkMuteLabel');
    const refreshMuteUi = () => {
      if (!muteBtn) return;
      muteBtn.classList.toggle('active', !chunkMuted);   // active = audio ON
      muteBtn.setAttribute('aria-pressed', chunkMuted ? 'true' : 'false');
      muteIco.textContent   = chunkMuted ? '🔇' : '🔊';
      muteLabel.textContent = chunkMuted ? 'Mute chunk' : 'Play chunk';
    };
    refreshMuteUi();
    if (muteBtn) muteBtn.addEventListener('click', () => {
      chunkMuted = !chunkMuted;
      refreshMuteUi();
      // Clear the "last played" memo so unmuting can re-play the
      // current chunk if the user clicks the same word again.
      lastPlayedChunkKey = null;
    });

    // Bottom-bar arrows — split into WORD-step (‹ ›) and PAGE-step (‹‹ ››).
    // In 1문장씩 mode, ‹ › step sentences; otherwise they step words
    // (crossing page boundaries automatically via navWord). Page-step
    // (‹‹ / ››) always moves a whole page.
    // Word-step arrows — when pressed, the counter flips to sentence
    // mode (and flashes) so the student sees "12 / 84 sentences"
    // instead of the page count. ‹‹ / ›› flip it back. setCounterMode
    // is defined at module-level above so the keyboard handler can
    // reuse it.
    $('btnPrev').addEventListener('click', () => {
      setCounterMode('sentence');
      if (singleMode) goSingle(singleIdx - 1);
      else            navWord(-1);
    });
    $('btnNext').addEventListener('click', () => {
      setCounterMode('sentence');
      if (singleMode) goSingle(singleIdx + 1);
      else            navWord(+1);
    });
    $('btnPagePrev').addEventListener('click', () => {
      setCounterMode('page');
      goPage(pageIdx - 1);
    });
    $('btnPageNext').addEventListener('click', () => {
      setCounterMode('page');
      goPage(pageIdx + 1);
    });
  }

  function goPage(next) {
    if (!pages.length) return;
    const prev = pageIdx;
    pageIdx = Math.max(0, Math.min(pages.length - 1, next));
    if (pageIdx === prev) return;
    singleIdx = 0;
    // Update the counter NOW (don't wait for the 180-ms slide).
    refreshPageCounter();
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
      // In page mode the single-arrows step WORDS and freely cross
      // page boundaries via navWord(), so we never disable them —
      // the page-step buttons (‹‹ / ››) handle the boundary visualisation.
      prev.disabled = false;
      next.disabled = false;
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
    refreshPageCounter();
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
