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
  // Song lessons render each lyric LINE as one tappable unit — set
  // once the lesson loads, read by splitSentencesSafe.
  let songMode    = false;
  // Pagination — body split into "pages" the bottom arrows step through.
  // For Phase-current scope we paginate by paragraph: each <p> = one page,
  // which matches 또박또박's per-paragraph rhythm well enough without a
  // viewport-fitting algorithm. Future: dynamic auto-fit pagination.
  let pages       = [];      // [[sentence,…], …]  groups of parts
  let pageIdx     = 0;
  // Continuous-scroll reading mode (⬇ toolbar chip). When true the
  // body drops pagination and renders EVERY page stacked into one
  // scrollable column — comic panels flow vertically. Wired in
  // wireToolbar(); declared here so renderBody / repaginateOverflow
  // (module-scope functions) can branch on it.
  let scrollMode  = false;
  // Highest global sentence index the student has reached — by a
  // page turn OR a word tap. The Korean quiz scopes its questions to
  // sentences 0..maxSentReached, so a page-boundary-triggered quiz
  // still has material even when the student tapped no word.
  let maxSentReached  = 0;
  // Highest page index already announced via wc:page-advanced.
  // Dedupes the event so re-reading a page (or jittery scrolling)
  // never double-counts toward the encounter trigger.
  let lastAdvancedPage = 0;
  // Subscribers (sidebar) that want to react to word-level changes.
  const levelChangeListeners = [];
  function notifyLevelChange(detail) {
    levelChangeListeners.forEach(fn => { try { fn(detail); } catch {} });
  }

  // Per-class feature flags (loaded with the lesson). Hidden by default
  // (empty object) so a brand-new class behaves like everything's on.
  let classFlags = {};

  // Lowercased words the CURRENT STUDENT has already sent a "Use it"
  // message to the teacher about, within THIS lesson. Populated at
  // init from wc_visualization_messages; appended live whenever the
  // sidebar fires `wc:word-message-sent` after a successful Send.
  // Drives the blue notification dot in the lesson body — same
  // visual treatment as has-word-image / has-word-note.
  const messagedWords = new Set();

  // Expose state to sidebar.js etc. — read-only contract.
  window.WCLesson = {
    me,
    isPreview,
    lessonId,
    get lesson() { return lesson; },
    get wordLevels() { return wordLevels; },
    get classFlags() { return classFlags; },
    // Sentences from the lesson start up to (and including) the
    // sentence of the last word the student tapped — the scope the
    // Korean quiz draws its questions from.
    //
    // Comic lessons keep ALL their dialogue inside speech bubbles,
    // not in lesson.body, so sentenceList() is empty for them and
    // the quiz had no source material ("퀴즈를 만들 수 없어요"). We
    // fold the bubble sentences (DOM order = reading order) into the
    // scope — up to the focused bubble when one is selected.
    get quizSentences() {
      try {
        const flat = sentenceList().map(s => s.text);
        // Scope = start … furthest point read. "Furthest" is the
        // later of (a) the last word the student tapped and (b) the
        // furthest page they have turned to — so a page-triggered
        // quiz works even with no word selected.
        const reach = Math.max(lastSelectedSentenceIdx || 0, maxSentReached || 0);
        const upto = Math.max(0, Math.min(flat.length - 1, reach));
        let scope = flat.slice(0, upto + 1);
        const bubbleEls = Array.from(
          document.querySelectorAll('#lessonBody .wc-bubble-sent'));
        if (bubbleEls.length) {
          let lastIdx = bubbleEls.length - 1;
          const focusedSent = bubbleFocusEl
            && bubbleFocusEl.closest('.wc-bubble-sent');
          if (focusedSent) {
            const i = bubbleEls.indexOf(focusedSent);
            if (i >= 0) lastIdx = i;
          }
          const bubbleScope = bubbleEls.slice(0, lastIdx + 1)
            .map(el => ((el.dataset && el.dataset.text) || '').trim())
            .filter(Boolean);
          scope = scope.concat(bubbleScope);
        }
        return scope;
      } catch { return []; }
    },
    // encounter.js polls this to decide whether to fire an animal
    // encounter. We expose a getter (not the variable) so external
    // callers see the LIVE value even as the student toggles 🐾.
    encountersHidden: () => hideEncounters,
    // SDT reward fade — 1.0 (full rewards) → 0.25 (sparse) based on
    // the student's cumulative pages read + the class fade preset.
    // encounter.js / quiz.js read this to thin quizzes / coins / the
    // reward wheel as reading becomes a habit.
    get rewardIntensity() {
      try { return window.WCDB.rewardIntensity(me && me.total_pages_read, classFlags); }
      catch { return 1; }
    },
    onWordLevelChange(cb) { if (typeof cb === 'function') levelChangeListeners.push(cb); },
    // --- iPhone-home-screen-style page swipe support (mobile) ---
    // The swipe manager in lesson.html needs to (a) know what page
    // we're on + how many there are + which paged mode we're in,
    // (b) snapshot a neighbor page's rendered HTML to slide it in
    // behind the finger, and (c) commit the page change WITHOUT
    // the existing slideRender CSS animation (the swipe already
    // animated the transition).
    get singleMode()   { return singleMode; },
    get scrollMode()   { return scrollMode; },
    get pageIdx()      { return pageIdx; },
    get pagesLength()  { return pages.length; },
    // Render a target page's HTML without disturbing the current
    // DOM. Implemented as a state-swap snapshot — synchronous JS
    // means no browser paint sneaks in between mutations, so the
    // user never sees the briefly-rendered other page.
    renderPageHtml(pi) {
      if (singleMode || scrollMode) return '';
      if (!Array.isArray(pages) || pi < 0 || pi >= pages.length) return '';
      const root = $('lessonBody');
      if (!root) return '';
      const savedHtml = root.innerHTML;
      const savedPi   = pageIdx;
      try {
        pageIdx = pi;
        renderBody();
        return root.innerHTML;
      } finally {
        pageIdx = savedPi;
        root.innerHTML = savedHtml;
      }
    },
    // Word-coverage stats for a paged-mode lesson page. Used by
    // encounter.js to gate the animal-quiz trigger: the encounter
    // only fires when the student has changed the color of ≥40 %
    // of the unique words on the page they just left. Returns
    //   { total, colored, ratio }
    // — `total`   = unique word count on the page (lowercase tokens,
    //               length > 1, [a-z][a-z'-]+),
    //   `colored` = unique words that have a non-null, non-zero
    //               level in `wordLevels` (level 1-5 OR ignore -1
    //               both count — anything the student touched),
    //   `ratio`   = colored / total (1 when total = 0 so empty
    //               pages don't accidentally block the encounter).
    // In single / scroll modes the concept of "the page they just
    // left" is fluid, so we return a permissive { ratio: 1 } that
    // never blocks.
    pageWordStats(pi) {
      if (singleMode || scrollMode) {
        return { total: 0, colored: 0, ratio: 1 };
      }
      if (!Array.isArray(pages) || pi < 0 || pi >= pages.length) {
        return { total: 0, colored: 0, ratio: 1 };
      }
      const parts = pages[pi] || [];
      const text  = parts.map(p => {
        if (p.kind === 'sent') return p.text || '';
        if (p.kind === 'gap')  return p.text || '';
        if (p.kind === 'html') return String(p.html || '').replace(/<[^>]+>/g, ' ');
        return '';
      }).join(' ');
      const unique = new Set();
      (text.toLowerCase().match(/[a-z][a-z'-]+/g) || []).forEach(w => {
        if (w.length > 1) unique.add(w);
      });
      const total = unique.size;
      if (!total) return { total: 0, colored: 0, ratio: 1 };
      let colored = 0;
      unique.forEach(w => {
        if (wordLevels.has(w)) {
          const lvl = wordLevels.get(w);
          if (lvl != null && lvl !== 0) colored++;
        }
      });
      return { total, colored, ratio: colored / total };
    },
    // Apply a page change without the existing slideRender CSS
    // animation. The swipe manager already animated the transition
    // visually; we just need to mount the new page's real DOM
    // (word spans, click handlers, etc.) at the end.
    swipeCommitPage(targetIdx) {
      if (singleMode || scrollMode) return;
      if (!Array.isArray(pages) || !pages.length) return;
      const ti = Math.max(0, Math.min(pages.length - 1, targetIdx));
      if (ti === pageIdx) return;
      pageIdx = ti;
      saveProgress();
      try { refreshRecUi(); } catch {}
      notifyPageAdvance(pageIdx);
      renderBody();
      refreshPageCounter();
      refreshNavBoundary();
      applyFocus();
    },
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

    // Lesson mp3 — build the per-sentence segment map so makeSentenceWrap
    // can drop a 🔊 on every sentence the teacher synced.
    setupLessonAudio();

    // Song lessons render each lyric LINE as one tappable unit (no
    // sentence-splitting inside a line — "I have an apple. I want a
    // banana." stays one line with one 🔊). Set before tokeniseBody.
    songMode = !!(lesson && lesson.mode === 'song');
    document.body.classList.toggle('wc-song-mode', songMode);

    // Preview banner — yellow strip at the very top of the page so
    // the teacher knows nothing they do here is being saved. Fades
    // away after 3s so it doesn't permanently steal vertical space
    // (preview tabs often stay open while the teacher tweaks copy).
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
        transition: 'opacity .35s ease, transform .35s ease',
      });
      document.body.appendChild(banner);
      const h = banner.offsetHeight;
      const addedPad = h;
      document.body.style.paddingTop =
        (parseFloat(getComputedStyle(document.body).paddingTop) || 0) + h + 'px';

      // Schedule the disappear. Two-phase: fade + slide-up, then
      // unmount + give back the body padding so the lesson card
      // reclaims the space.
      setTimeout(() => {
        banner.style.opacity   = '0';
        banner.style.transform = 'translateY(-100%)';
      }, 3000);
      setTimeout(() => {
        banner.remove();
        const cur = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
        document.body.style.paddingTop = Math.max(0, cur - addedPad) + 'px';
      }, 3000 + 400);
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

    // Pull the class's hide_features + level_probabilities so
    // sidebar/encounter/popup modules can opt out of disabled features
    // and apply teacher-tuned encounter probabilities. Failing to
    // fetch is non-fatal — we just behave like nothing's overridden.
    if (me.class_id) {
      try {
        const cls = await window.WCDB.classes.byId(me.class_id);
        if (cls && cls.hide_features && typeof cls.hide_features === 'object') {
          classFlags = cls.hide_features;
        }
        if (cls && Array.isArray(cls.level_probabilities)) {
          // Stash on the global WCLesson surface so encounter.js can
          // read it without round-tripping the class table again.
          window.WCLesson.levelProbabilities = cls.level_probabilities;
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
      // Also pull the student's "Use it" messages so words they've
      // already messaged the teacher about get a blue pip in the
      // body — same idea as the green (image) / orange (note) pips
      // but driven by the student's own outbound activity. We
      // filter to THIS lesson so unrelated messages from other
      // lessons don't pollute the dot map.
      try {
        const msgs = await window.WCDB.viz.forStudent(me.id);
        (msgs || []).forEach(m => {
          if (m.lesson_id === lesson.id && m.word) {
            messagedWords.add(String(m.word).toLowerCase());
          }
        });
      } catch (e) { console.warn('viz messages load:', e); }
    }

    sentences = tokeniseBody(lesson.body);
    pages     = paginate(sentences, lesson.body);
    pageIdx   = 0;
    // Resume where the student left off last time. Skipped in preview
    // mode — a teacher previewing always wants page 1. Best-effort:
    // a missing wc_lesson_progress table just leaves pageIdx at 0.
    if (!isPreview) {
      try {
        const prog = await window.WCDB.progress.get(me.id, lessonId);
        if (prog && Number.isFinite(prog.page)) {
          pageIdx = Math.max(0, Math.min(pages.length - 1, prog.page | 0));
        }
      } catch (e) { /* progress is best-effort */ }
    }
    // Seed the page-advance watermark + quiz read-scope from the
    // resume point — a resumed lesson must neither mis-fire an
    // encounter for pages already read nor leave the quiz empty.
    lastAdvancedPage = pageIdx;
    maxSentReached   = lastSentOfPage(pageIdx);
    renderBody();
    wireToolbar();
    refreshPageCounter();
    refreshNavBoundary();
    // Restore the student's saved recordings (Record mode) — async,
    // repaints the record UI when it lands.
    loadRecordings();
    // After first render, walk every page and split anything that
    // overflows the card's visible height into a fresh page. This is
    // why #lessonBody has overflow:hidden (no scroll) — pagination is
    // measurement-based, not sentence-count-based.
    requestAnimationFrame(() => repaginateOverflow());
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
    // Single-sentence mode ALWAYS shows the sentence counter — the
    // student is literally walking through sentences one at a time,
    // so a page count would be meaningless. counterMode='sentence'
    // (set by ›/‹ arrows) also forces this branch in page mode.
    if (counterMode === 'sentence' || singleMode) {
      const flat = sentenceList();
      // "Current sentence" = the sentence the focused word lives in,
      // falling back to single-mode index, falling back to the first
      // sentence of the current page so the counter always has a
      // sensible value.
      let curIdx = 0;
      if (singleMode)             curIdx = singleIdx;
      else if (focusedSentIdx != null) curIdx = focusedSentIdx;
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
  //
  // The *parse* regex is strict (exact `[[IMG:N]]`) so we capture
  // a valid index for the renderer to pull `images[idx]`. The
  // separate *strip* regex is lenient — it scrubs not just valid
  // markers but also partial / single-bracketed / spaced variants
  // ([IMG:0], [[IMG:0], IMG:0) so none of them ever leak into the
  // flat sentence list that TTS reads aloud.
  const IMG_MARKER_PARSE_RE = /\[\[IMG:(\d+)\]\]/g;
  const IMG_MARKER_STRIP_RE = /(?:\[+\s*IMG\s*:\s*\d+\s*\]+|\bIMG\s*:\s*\d+\b)/gi;

  // ----------------------------------------------------------------
  //  Abbreviation-safe sentence splitter
  //
  //  The naive sentence regex (`[^.!?]+[.!?]+["'’)\]]*`) treats EVERY
  //  `.` as a sentence terminator, so "Mr. Smith said hi." becomes
  //  two sentences ("Mr." + "Smith said hi.") and TTS reads each
  //  fragment with an audible pause. We avoid that by replacing the
  //  `.` inside known abbreviations with a private-use placeholder
  //  before the regex runs, then mapping the matched indices back
  //  onto the ORIGINAL text so the spoken / rendered sentence keeps
  //  its real characters.
  //
  //  Covered patterns:
  //    • Personal/military titles  Mr. Mrs. Dr. Prof. Capt. Sgt. …
  //    • Saints / streets / address  St. Ave. Blvd. Mt. Rd. …
  //    • Companies                Inc. Ltd. Co. Corp. Plc. …
  //    • Reference / measurement  No. Vol. Ed. Ch. Fig. vs. etc. …
  //    • Months & days            Jan. Feb. Mon. Tue. …
  //    • Latin / time embedded    e.g.  i.e.  a.m.  p.m.  Ph.D.  N.B.
  //    • All-caps initialisms     U.S.  U.K.  U.S.A.  D.C.  L.A.  E.U.
  //    • Decimal numbers          3.14  0.5  99.9
  // ----------------------------------------------------------------
  const SENT_DOT_PLACEHOLDER = '';
  const SINGLE_DOT_ABBRS = [
    // titles
    'Mr','Mrs','Ms','Mx','Dr','Prof','Sr','Jr','Rev','Hon',
    'Capt','Lt','Gen','Sgt','Maj','Col','Cpl','Pvt','Adm','Cdr',
    // saints / addresses / geography
    'St','Ste','Ave','Blvd','Rd','Hwy','Rte','Mt','Mtn','Pk',
    // companies
    'Inc','Ltd','Co','Corp','Plc',
    // reference / measurement
    'No','Vol','Ed','Ch','Sec','Fig','Ref','pp','vs','etc','cf','approx','min','max','est',
    // months
    'Jan','Feb','Mar','Apr','Jun','Jul','Aug','Sep','Sept','Oct','Nov','Dec',
    // days
    'Mon','Tue','Tues','Wed','Thu','Thur','Thurs','Fri','Sat','Sun',
  ];
  const SINGLE_DOT_ABBR_RE = new RegExp(
    '\\b(' + SINGLE_DOT_ABBRS.join('|') + ')\\.', 'g'
  );
  const EMBEDDED_DOT_ABBR_RE = /\b(?:e\.g|i\.e|a\.m|p\.m|A\.M|P\.M|Ph\.D|N\.B)\./g;
  const INITIALISM_RE = /\b(?:[A-Z]\.){2,}/g;
  const DECIMAL_RE = /(\d)\.(\d)/g;

  function maskAbbreviationsForSentenceSplit(text) {
    if (!text) return '';
    let s = text;
    // 1) Embedded-dot Latin/time abbreviations first — replace ALL
    //    their dots so the trailing one doesn't accidentally also
    //    match the initialism regex below.
    s = s.replace(EMBEDDED_DOT_ABBR_RE, m => m.replace(/\./g, SENT_DOT_PLACEHOLDER));
    // 2) Multi-letter capital initialisms — every dot becomes safe.
    s = s.replace(INITIALISM_RE, m => m.replace(/\./g, SENT_DOT_PLACEHOLDER));
    // 3) Single-dot titles / addresses / months / etc.
    s = s.replace(SINGLE_DOT_ABBR_RE, (m, word) => word + SENT_DOT_PLACEHOLDER);
    // 4) Decimal numbers — a period between digits is never a
    //    sentence end (3.14, 0.5, 99.9).
    s = s.replace(DECIMAL_RE, (m, a, b) => a + SENT_DOT_PLACEHOLDER + b);
    return s;
  }

  // Walks `text` and emits sentence boundaries that respect
  // abbreviations. Returns [{ text, start, end }, …]. Trailing
  // fragments without sentence-final punctuation surface as the
  // last entry so single-word headings still get a sentence span.
  const SENTENCE_BOUNDARY_RE = /[^.!?]+[.!?]+["'’)\]]*/g;
  function splitSentencesSafe(text) {
    if (!text) return [];
    // Song mode — a lyric line is ONE unit, never split on .!? so the
    // whole line stays one tappable sentence (and one 🔊 / chunk).
    if (songMode) {
      return text.trim() ? [{ text, start: 0, end: text.length }] : [];
    }
    const masked = maskAbbreviationsForSentenceSplit(text);
    const out = [];
    const re = new RegExp(SENTENCE_BOUNDARY_RE.source, 'g');
    let m, lastEnd = 0;
    while ((m = re.exec(masked)) !== null) {
      const start = m.index;
      const end   = m.index + m[0].length;
      out.push({ text: text.slice(start, end), start, end });
      lastEnd = end;
    }
    if (lastEnd < text.length) {
      const tail = text.slice(lastEnd);
      if (tail.trim()) {
        out.push({ text: tail, start: lastEnd, end: text.length });
      }
    }
    return out;
  }
  function extractImageMarkers(body) {
    const re = new RegExp(IMG_MARKER_PARSE_RE.source, 'g');
    const parts = [];
    let last = 0; let m;
    while ((m = re.exec(body)) !== null) {
      if (m.index > last) {
        // Also scrub any malformed markers in the text between valid
        // ones (e.g. a [IMG:0] typo) so they don't end up on the
        // page as visible debris or in TTS playback.
        const between = body.slice(last, m.index)
          .replace(IMG_MARKER_STRIP_RE, ' ');
        parts.push({ kind: 'text', text: between });
      }
      parts.push({ kind: 'img',  idx: parseInt(m[1], 10) });
      last = m.index + m[0].length;
    }
    if (last < body.length) {
      const tail = body.slice(last).replace(IMG_MARKER_STRIP_RE, ' ');
      parts.push({ kind: 'text', text: tail });
    }
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

  // Inject `<hr class="wc-page-break">` BEFORE every <h1>/<h2>/<h3>
  // except the first piece of content in the body. Used when the
  // lesson's `headings_start_new_page` flag is on so each heading
  // anchors the top of a fresh page.
  function applyHeadingPageBreaks(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const out = [];
    let hasContentBefore = false;
    Array.from(tmp.childNodes).forEach(node => {
      const isHeading = node.nodeType === Node.ELEMENT_NODE
        && /^H[123]$/.test(node.tagName);
      const isMeaningful = node.nodeType === Node.ELEMENT_NODE
        || (node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (isHeading && hasContentBefore) {
        out.push('<hr class="wc-page-break" />');
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        out.push(node.outerHTML);
      } else if (node.nodeType === Node.TEXT_NODE) {
        out.push(node.textContent);
      }
      if (isMeaningful) hasContentBefore = true;
    });
    return out.join('');
  }

  // Detect lightweight markdown the toolbar emits: `# `/`## `/`### `
  // headings (also lenient — accepts 1-6 hashes, with OR without the
  // following space so `#Title` and `#### Subtitle` both qualify),
  // `**bold**`, `__under__`, `{color:#xxx}…{/color}`, and `---`
  // page breaks. Plain prose without any of these markers skips the
  // markdown→HTML hop and stays on the plain-text path.
  function looksLikeMarkdown(body) {
    if (!body) return false;
    return /^#{1,6}\s*\S/m.test(body)
        || /\*\*[\s\S]+?\*\*/.test(body)
        || /__[\s\S]+?__/.test(body)
        || /\{color:[^}]+\}[\s\S]+?\{\/color\}/.test(body)
        || /^---+\s*$/m.test(body);
  }

  function escapeHtmlText(s) {
    return String(s || '').replace(/[&<>]/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[c]);
  }

  // Convert toolbar markdown to HTML so the existing HTML renderer
  // can take over. Only handles the subset of markers the body
  // toolbar actually inserts — no need for a full CommonMark parser.
  // The output respects the same HTML shape (h1/h2/h3, p, b, u, span,
  // hr.wc-page-break) the contentEditable approach used to produce.
  function markdownToHtml(text) {
    if (!text) return '';
    // Image markers must survive escaping so the HTML tokenizer can
    // still recognise them as `[[IMG:N]]`. They contain no HTML chars
    // anyway, so plain escapeHtml leaves them intact.
    let s = escapeHtmlText(text);

    // Page break — three+ dashes on their own line, possibly with
    // whitespace either side. Output an <hr> with the marker class
    // that tokeniseHtmlBody splits on.
    s = s.replace(/^[ \t]*---+[ \t]*$/gm, '<hr class="wc-page-break" />');

    // Headings (line-start). Order matters — longest prefix wins, so
    // `####` is caught before `##`. `\s*` after the hashes accepts
    // `#Title` (no space) just as readily as `# Title`. We accept up
    // to 6 hashes (full markdown spec) so unexpected `#####`-style
    // titles get converted instead of leaking into prose where TTS
    // would read them as "hash hash hash hash Title".
    s = s.replace(/^######\s*(.+)$/gm, '<h6>$1</h6>');
    s = s.replace(/^#####\s*(.+)$/gm,  '<h5>$1</h5>');
    s = s.replace(/^####\s*(.+)$/gm,   '<h4>$1</h4>');
    s = s.replace(/^###\s*(.+)$/gm,    '<h3>$1</h3>');
    s = s.replace(/^##\s*(.+)$/gm,     '<h2>$1</h2>');
    s = s.replace(/^#\s*(.+)$/gm,      '<h1>$1</h1>');
    // Any leftover hash-only lines (e.g. `##` with nothing after)
    // would otherwise become "## " text. Strip them.
    s = s.replace(/^#+\s*$/gm, '');

    // Inline: bold, then underline, then colour. Use non-greedy + the
    // `s` flag style ([\s\S]+?) so multi-word spans on one line are
    // matched without leaking across multiple constructs.
    s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
    s = s.replace(/__([\s\S]+?)__/g,     '<u>$1</u>');
    s = s.replace(/\{color:([^}]+)\}([\s\S]+?)\{\/color\}/g,
      (_m, col, inner) => `<span style="color:${col}">${inner}</span>`);

    // Walk line-by-line and wrap EACH non-blank line in its own
    // block. A single Enter in the editor becomes a real
    // paragraph break in the rendered lesson, and consecutive
    // bullet lines (`* item` / `- item`) collapse into one
    // <ul>…</ul> so the rendered page shows • dots instead of
    // the raw asterisk.
    const lines = s.split(/\r?\n/);
    // Stage 1: classify every line into {p|li|html|null(blank)}.
    const items = lines.map(raw => {
      const t = raw.trim();
      if (!t) return null;
      // Bullet line: `* item` or `- item` (asterisk/hyphen + at
      // least one space + content). Em-dash, en-dash, etc. don't
      // match — only the plain ASCII hyphen-minus is treated as a
      // bullet marker, so prose like "Mt — climb it" stays prose.
      const bullet = t.match(/^[*\-]\s+(.+)$/);
      if (bullet) return { type: 'li', text: bullet[1] };
      // Already-block HTML (teacher pasted raw markup) — pass through.
      if (/^<(h[1-6]|hr|p|div|ul|ol|li|blockquote)/i.test(t)) {
        return { type: 'html', text: t };
      }
      return { type: 'p', text: t };
    });
    // Stage 2: emit, collapsing runs of consecutive <li> into one <ul>.
    const out = [];
    let i = 0;
    while (i < items.length) {
      const it = items[i];
      if (!it) { i++; continue; }
      if (it.type === 'li') {
        const buf = [];
        while (i < items.length && items[i] && items[i].type === 'li') {
          buf.push('<li>' + items[i].text + '</li>');
          i++;
        }
        out.push('<ul>' + buf.join('') + '</ul>');
        continue;
      }
      if (it.type === 'html') { out.push(it.text); i++; continue; }
      out.push('<p>' + it.text + '</p>');
      i++;
    }
    return out.join('\n');
  }

  // Is this element a heading or a "fake heading" — a short, formatted
  // paragraph the teacher uses as a section title? We accept:
  //   - real <h1>/<h2>/<h3>/<h4>/<h5>/<h6>
  //   - <p> that's short (≤ 80 chars), has NO sentence-final punctuation,
  //     and wraps its content in <b>/<strong>/<u>/<em>/<i> (i.e. the
  //     toolbar's "**bold**" / "__under__" output people use as titles)
  function isTitleLike(el) {
    if (!el || el.nodeType !== 1) return false;
    if (/^H[1-6]$/.test(el.tagName)) return true;
    if (el.tagName !== 'P') return false;
    const text = (el.textContent || '').trim();
    if (!text || text.length > 80) return false;
    if (/[.!?]\s*$/.test(text)) return false;
    return !!el.querySelector('b, strong, u, em, i');
  }

  // Wrap every heading (or fake heading) PLUS its following content
  // block into one `<div class="wc-title-block">`. Subsequent
  // pagination treats the wrapper as a single child — the heading
  // can never end up alone on a page while its image + text live
  // on the next.
  //
  // Multiple consecutive headings (## + ###) are grouped together
  // and bound to whatever non-title follows them.
  function bindTitlesToNextContent(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const kids = Array.from(tmp.childNodes);
    const out  = [];
    const emit = (n) => out.push(n.nodeType === 1 ? n.outerHTML : n.textContent);
    let i = 0;
    while (i < kids.length) {
      const node = kids[i];
      // Whitespace-only text nodes — emit so round-tripped HTML keeps
      // its line breaks (purely cosmetic; aids debugging).
      if (node.nodeType === 3 && !node.textContent.trim()) {
        out.push(node.textContent);
        i++;
        continue;
      }
      // Not a title? Emit as-is and move on.
      if (node.nodeType !== 1 || !isTitleLike(node)) {
        emit(node);
        i++;
        continue;
      }
      // Collect consecutive titles (possibly separated by whitespace
      // text nodes).
      const group = [];
      while (i < kids.length) {
        const n = kids[i];
        if (n.nodeType === 3 && !n.textContent.trim()) { group.push(n); i++; continue; }
        if (n.nodeType === 1 && isTitleLike(n))         { group.push(n); i++; continue; }
        break;
      }
      // Greedily attach the very next content node (any kind — a <p>,
      // an image-only paragraph, even a text node). If we hit end of
      // document with no content to attach, leave the title(s)
      // standalone (only happens if a lesson literally ends with a
      // heading and nothing after).
      let contentNode = null;
      if (i < kids.length) {
        contentNode = kids[i];
        i++;
      }
      const inner = group.map(g =>
        g.nodeType === 1 ? g.outerHTML : g.textContent
      ).join('')
      + (contentNode
          ? (contentNode.nodeType === 1 ? contentNode.outerHTML : contentNode.textContent)
          : '');
      out.push(`<div class="wc-title-block">${inner}</div>`);
    }
    return out.join('');
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
      const isHeading = node.nodeType === Node.ELEMENT_NODE
                     && /^H[1-6]$/.test(node.tagName);
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
      // Defer the split if the just-added node is a heading — a
      // heading must never be the last block on a page (would
      // strand it from the content it titles). Wait one more
      // iteration so the next paragraph (image + text) lands on
      // the same segment.
      if (sentCount >= maxSentences && !isHeading) {
        segs.push(curHtml);
        curHtml = '';
        sentCount = 0;
      }
    });
    if (curHtml) segs.push(curHtml);
    return segs.length ? segs : [html];
  }

  function tokeniseBody(body) {
    // Markdown body? Or plain text with intentional line breaks?
    // Either way we run markdownToHtml — it wraps every non-blank
    // line in its own <p> so a single Enter in the editor becomes
    // a real paragraph break in the rendered lesson. HTML bodies
    // (those the teacher authored via a rich-text toolbar with
    // explicit <p>/<h1>/…) skip this hop so their existing markup
    // isn't disturbed.
    if (!isHtmlBody(body) && body) {
      body = markdownToHtml(body);
    }
    // If the lesson opts into "headings start new page", inject a
    // page-break HR before every h1/h2/h3 that isn't the very first
    // piece of content. The split-by-PAGE_BREAK_RE in the HTML path
    // then turns each heading into the top of a fresh page.
    if (isHtmlBody(body) && lesson && lesson.headings_start_new_page) {
      body = applyHeadingPageBreaks(body);
    }
    // Structurally glue every heading (or "fake heading" — a short
    // bold/underlined paragraph the teacher uses as a chapter title)
    // to the content that follows it. After this, downstream
    // pagination cannot put a heading on one page and its image/text
    // on the next — the wrapper is one top-level child either way.
    if (isHtmlBody(body)) {
      body = bindTitlesToNextContent(body);
    }
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
        // Walk TOP-LEVEL block children (every <p>, <h1>..<h6>,
        // <div>, <li>, <blockquote>) rather than individual text
        // nodes. We use the block's full textContent — which
        // automatically concatenates across <br>, <b>, <u>,
        // <span> etc. — so sentence boundaries are detected on
        // the whole paragraph, not on each inline fragment.
        // This is what fixes the "word-by-word TTS after a #
        // heading" bug: the heading is its own block (one short
        // sentence), and the prose paragraph beneath it is
        // another block (one fluent sentence) — instead of the
        // old behaviour where each text node fragmented further.
        function visitBlock(node) {
          if (!node) return;
          // Element node?
          if (node.nodeType === 1) {
            const tag = node.tagName;
            // Recursive container — descend so its child blocks
            // (e.g. <li> inside <ul>) are treated as their own
            // speech chunks.
            if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE'
                || tag === 'UL' || tag === 'OL') {
              Array.from(node.childNodes).forEach(visitBlock);
              return;
            }
            // Leaf block whose textContent we treat as one chunk.
            const blockTags = /^(P|H[1-6]|LI|BLOCKQUOTE|FIGCAPTION|TD|TH)$/;
            if (blockTags.test(tag)) {
              pushSentencesFromText(node.textContent || '');
              return;
            }
            // Anything else (e.g. an <img> at top level, an <hr>)
            // doesn't contribute speech text — skip.
            return;
          }
          // Top-level text node (rare — would only happen if the
          // segment HTML has bare text outside any block).
          if (node.nodeType === 3) {
            pushSentencesFromText(node.textContent || '');
          }
        }
        function pushSentencesFromText(raw) {
          const text = (raw || '').replace(IMG_MARKER_STRIP_RE, ' ');
          if (!text || !text.trim()) return;
          splitSentencesSafe(text).forEach(s => {
            flat.push({ kind: 'sent', text: s.text, words: extractWordTokens(s.text) });
          });
        }
        Array.from(tmp.childNodes).forEach(visitBlock);
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
      const sents = splitSentencesSafe(seg.text);
      let prevEnd = 0;
      sents.forEach(s => {
        if (s.start > prevEnd) {
          out.push({ kind: 'gap', text: seg.text.slice(prevEnd, s.start) });
        }
        out.push({ kind: 'sent', text: s.text, words: extractWordTokens(s.text) });
        prevEnd = s.end;
      });
      if (prevEnd < seg.text.length) {
        const tail = seg.text.slice(prevEnd);
        if (tail) out.push({ kind: 'gap', text: tail });
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
    // Wipe any chunk-key state — the DOM that owned those classes
    // just disappeared, so the next paintChunkUnderline must start
    // fresh (otherwise it could skip the rise animation thinking
    // the underline is already painted on the new DOM).
    currentChunkKey = null;

    if (singleMode) {
      const flat = sentenceList();
      if (!flat.length) return;
      const i = clamp(singleIdx, 0, flat.length - 1);
      const p = flat[i];
      const wrap = makeSentenceWrap(p, i);
      wrap.classList.add('wc-active', 'wc-single');
      root.appendChild(wrap);
      if (window.WCChunks) window.WCChunks.prefetchSentences([p.text]);
      // After the sentence is in the DOM, measure it and shrink the
      // font if the line wraps past the visible card height. Waits
      // one frame so the browser has computed layout (otherwise
      // scrollHeight returns the pre-paint value).
      requestAnimationFrame(() => fitSingleSentenceToCard());
      return;
    }

    // Continuous-scroll mode — every page stacked into one column.
    if (scrollMode) { renderScroll(root); return; }

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
      // Comic-panel bubbles re-parsed from serialised HTML need a
      // fit pass (their image-load hook won't re-fire on a cache hit).
      requestAnimationFrame(fitAllBubbles);
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
    requestAnimationFrame(fitAllBubbles);
  }

  // Continuous-scroll renderer (⬇ mode). Stacks EVERY page into
  // #lessonBody as a column of `.wc-scroll-page` blocks instead of
  // showing one page at a time. Global sentence indices (data-idx)
  // stay consistent across the whole column so word focus, keyboard
  // nav, TTS auto-advance and recording playback all keep working —
  // they query `.wc-sentence[data-idx]` globally either way.
  function renderScroll(root) {
    const allHtml = pages.length && pages.every(parts =>
      parts.length === 1 && parts[0].kind === 'html');
    const visibleSentences = [];
    let gStart = 0;
    pages.forEach((parts, pi) => {
      const pageWrap = document.createElement('div');
      pageWrap.className = 'wc-scroll-page';
      pageWrap.dataset.page = String(pi);
      if (allHtml) {
        pageWrap.innerHTML = parts[0].html;
        tokenizeTextNodesInPlace(pageWrap, gStart);
        (parts[0].sentences || []).forEach(s => visibleSentences.push(s.text));
        gStart += (parts[0].sentences || []).length;
      } else {
        let pageSentIdx = 0;
        parts.forEach(p => {
          if (p.kind === 'gap') {
            pageWrap.appendChild(document.createTextNode(p.text));
            return;
          }
          if (p.kind === 'img') {
            const img = makeFloatingImage(p.idx);
            if (img) pageWrap.appendChild(img);
            return;
          }
          pageWrap.appendChild(makeSentenceWrap(p, gStart + pageSentIdx));
          visibleSentences.push(p.text);
          pageSentIdx++;
        });
        gStart += pageSentIdx;
      }
      root.appendChild(pageWrap);
    });
    if (window.WCChunks) window.WCChunks.prefetchSentences(visibleSentences);
    requestAnimationFrame(fitAllBubbles);
  }

  // Single-sentence mode auto-fit. The CSS sets the active sentence
  // to font-size: 2em — perfect for a typical 8-15 word sentence,
  // but long ones (40+ words, e.g. a teacher's heavy compound
  // sentence) wrap past the bottom of the card. We measure once and
  // shrink the font progressively until the whole sentence fits,
  // with a 0.85em floor so it never gets unreadably small.
  //
  // Idempotent: re-running with an already-small sentence is a no-op
  // because we reset `style.fontSize` first.
  function fitSingleSentenceToCard() {
    if (!singleMode) return;
    const bodyEl = $('lessonBody');
    if (!bodyEl) return;
    const sentEl = bodyEl.querySelector('.wc-sentence.wc-single');
    if (!sentEl) return;

    // Reset any prior shrink so we start from the CSS-defined 2em.
    sentEl.style.fontSize = '';

    const cardH = bodyEl.clientHeight;
    if (!cardH) return;
    // Fits at the default size? Done.
    if (bodyEl.scrollHeight <= cardH + 2) return;

    // Compute a single-shot approximation from the overflow ratio:
    // if the text is 1.4× the card height, scale to ~1/1.4 of 2em,
    // i.e. ~1.4em. The 0.92 fudge factor accounts for line-wrap
    // adding extra height as fonts shrink unevenly.
    const ratio = cardH / bodyEl.scrollHeight;
    const MIN = 0.85, MAX = 2.0;
    let scale = Math.max(MIN, Math.min(MAX, 2.0 * ratio * 0.92));
    sentEl.style.fontSize = scale.toFixed(2) + 'em';

    // Fine-tune: shrink in 0.05em steps if still overflowing. Cap at
    // 25 iterations so a pathological case can't lock the browser.
    let guard = 25;
    while (guard-- > 0 && scale > MIN && bodyEl.scrollHeight > cardH + 2) {
      scale = Math.max(MIN, scale - 0.05);
      sentEl.style.fontSize = scale.toFixed(2) + 'em';
    }
  }

  // Build a floated <img> for the Nth image attached to this lesson.
  // `corner` decides placement: tl/tr/bl/br float in a corner, cc
  // centres on its own line, and `panel` renders a full-width comic
  // "네모" box. `scale` (defaults to 1.0) scales the base width by
  // 5 %-step adjustments the teacher made in the chip preview.
  //
  // A `panel` image that ALSO carries a `bubbles` array is rendered
  // as a full comic panel — see makeComicPanel.
  // An image record carries EITHER a Storage URL (`url`, new lessons)
  // OR an inline base64 `data_url` (legacy lessons saved before the
  // Storage migration). Prefer the URL; fall back to inline data.
  function imageSrc(rec) {
    return (rec && (rec.url || rec.data_url)) || '';
  }

  function makeFloatingImage(idx) {
    const list = Array.isArray(lesson?.images) ? lesson.images : [];
    const rec  = list[idx];
    const src  = imageSrc(rec);
    if (!rec || !src) return null;
    const scale = Number.isFinite(rec.scale) ? rec.scale : 1.0;

    // Comic panel WITH speech bubbles → positioned text-overlay panel.
    if (rec.corner === 'panel' && Array.isArray(rec.bubbles) && rec.bubbles.length) {
      return makeComicPanel(rec, scale, src);
    }

    const img = document.createElement('img');
    img.className = 'wc-lesson-img wc-corner-' + (rec.corner || 'tr');
    img.src = src;
    img.alt = '';
    img.draggable = false;
    if (scale !== 1.0) {
      if (rec.corner === 'panel') {
        // Comic panel — the CSS base width is 88 % of the card (a big
        // block "네모"), not the 22 % float base. Scale that 88 %
        // directly and cap at 100 % so a grown panel never overflows
        // the white card.
        img.style.width    = Math.min(100, 88 * scale).toFixed(1) + '%';
        img.style.maxWidth = '100%';
      } else if (rec.corner === 'cs') {
        // Small-centred image — base max-width is 140 px (CSS rule).
        // Scale that max so resizing keeps it deliberately small,
        // independent of the 22 % corner-float base.
        img.style.maxWidth = Math.round(140 * scale) + 'px';
        img.style.minWidth = '0';
      } else {
        // The base width comes from the CSS rule (22 % / min 120 / max 220).
        // We override BOTH width and max-width together so the size moves
        // proportionally on both narrow and wide viewports.
        img.style.width    = (22 * scale).toFixed(1) + '%';
        img.style.maxWidth = Math.round(220 * scale) + 'px';
        img.style.minWidth = Math.round(120 * scale) + 'px';
      }
    }
    return img;
  }

  // ============================================================
  //  COMIC PANEL  — image + speech-bubble text overlays
  //
  //  A comic-panel image stores `bubbles: [{x,y,w,h,text}, …]` where
  //  x/y/w/h are 0-1 fractions of the image. For each bubble we lay
  //  a white <span class="wc-bubble"> over that region: the white
  //  background hides the original baked-in lettering, and the
  //  teacher-typed `text` is rendered as REAL tokenised words.
  //
  //  Those words get the full study treatment — colour level on
  //  render, and on tap: amber word-ring, chunk underline, sidebar
  //  word card, chunk TTS. Taps are caught by a delegated listener
  //  on #lessonBody (see wireBubbleDelegation) so they survive the
  //  serialise / re-parse that repaginateOverflow does to panels.
  //
  //  Wrapper + bubbles are <span>s (display-block / absolute via CSS)
  //  rather than <figure>/<div> so the markup stays valid phrasing
  //  content inside the <p> the [[IMG:N]] marker lives in — block
  //  elements there would be re-parented on every innerHTML cycle.
  // ============================================================
  let bubbleSentSeq = 0;   // unique-id source for .wc-bubble-sent

  function makeComicPanel(rec, scale, src) {
    const panel = document.createElement('span');
    panel.className = 'wc-panel';
    if (scale && scale !== 1.0) {
      panel.style.width = Math.min(100, 88 * scale).toFixed(1) + '%';
    }
    const img = document.createElement('img');
    img.className = 'wc-panel-img';
    img.src = src || imageSrc(rec);
    img.alt = '';
    img.draggable = false;
    panel.appendChild(img);

    const pct = (n) => (Math.max(0, Math.min(1, Number(n) || 0)) * 100).toFixed(2) + '%';
    rec.bubbles.forEach(b => {
      if (!b) return;
      const bub = document.createElement('span');
      bub.className = 'wc-bubble';
      // Bubble shape — 'rect' renders a slightly-rounded rectangle;
      // anything else (incl. legacy bubbles with no shape) keeps the
      // default rounded-oval outline.
      if (b.shape === 'rect') bub.classList.add('wc-bub-rect');
      bub.style.left   = pct(b.x);
      bub.style.top    = pct(b.y);
      bub.style.width  = pct(b.w);
      bub.style.height = pct(b.h);
      bub.dataset.text = String(b.text || '');
      // One inner wrapper = the single flex item, so the dialogue is
      // centred both ways and its words wrap within the box width.
      const inner = document.createElement('span');
      inner.className = 'wc-bubble-inner';
      inner.appendChild(makeBubbleSentences(String(b.text || '')));
      bub.appendChild(inner);
      // mp3 slice synced for this bubble? a corner 🔊 plays just it.
      if (audioSegMap) {
        const seg = audioSegMap.get(normAudioKey(String(b.text || '')));
        if (seg) {
          const ab = document.createElement('button');
          ab.className = 'wc-sent-audio wc-bubble-audio';
          ab.type = 'button';
          ab.textContent = '🔊';
          ab.dataset.aStart = String(seg.start);
          ab.dataset.aEnd   = String(seg.end);
          ab.setAttribute('aria-label', 'Play this bubble');
          bub.appendChild(ab);
        }
      }
      // Record control — a 전체 / 문장별 mode toggle + a whole-bubble
      // record button, pinned to the bubble's top-right (Record mode).
      const recCtl = document.createElement('span');
      recCtl.className = 'wc-bubble-rec';
      if (hasTakes(normAudioKey(String(b.text || '')))) recCtl.classList.add('has-rec');
      recCtl.innerHTML =
        '<button class="wc-bub-mode" type="button" title="녹음 모드: 전체 / 문장별">전체</button>' +
        '<button class="wc-rec-btn wc-bub-rec-btn" type="button" aria-label="말풍선 전체 녹음">' +
          '<span class="wc-rec-dot"></span></button>';
      bub.appendChild(recCtl);
      panel.appendChild(bub);
    });

    // Bubble boxes are %-sized, so the text can't be fitted until the
    // image's real pixel dimensions are known.
    const fit = () => fitBubblesIn(panel);
    img.addEventListener('load', fit);
    if (img.complete) requestAnimationFrame(fit);
    return panel;
  }

  // Tokenise bubble dialogue into one or more `.wc-bubble-sent` spans
  // (one per sentence) holding clickable `.w` word spans. Mirrors
  // makeSentenceWrap but for the overlay: a distinct class keeps these
  // out of the body's `.wc-sentence` machinery, and NO direct click
  // handler is bound — bubble taps run through delegation instead.
  function makeBubbleSentences(text) {
    const frag = document.createDocumentFragment();
    const sents = splitSentencesSafe(text);
    const list  = sents.length ? sents.map(s => s.text) : [text];
    list.forEach((sentText, si) => {
      if (!sentText || !sentText.trim()) return;
      if (si > 0) frag.appendChild(document.createTextNode(' '));
      const sent = document.createElement('span');
      sent.className = 'wc-bubble-sent';
      sent.dataset.idx  = 'b' + (bubbleSentSeq++);   // unique chunk-key source
      sent.dataset.text = sentText;
      // Record-mode controls — shown only in the bubble's 문장별 sub-mode.
      const recGrp = document.createElement('span');
      recGrp.className = 'wc-rec-grp';
      if (hasTakes(normAudioKey(sentText))) recGrp.classList.add('has-rec');
      recGrp.innerHTML =
        '<button class="wc-rec-btn" type="button" aria-label="이 문장 녹음">' +
          '<span class="wc-rec-dot"></span></button>' +
        '<button class="wc-rec-tts" type="button" aria-label="이 문장 듣기" title="TTS로 듣기">🔊</button>' +
        '<button class="wc-rec-play" type="button" aria-label="내 녹음 듣기">▶</button>';
      sent.appendChild(recGrp);
      let wIdx = 0;
      extractWordTokens(sentText).forEach(tok => {
        if (tok.kind === 'glue') {
          const g = document.createElement('span');
          g.className = 'w punct';
          g.textContent = tok.text;
          sent.appendChild(g);
          return;
        }
        const sp = document.createElement('span');
        sp.className = 'w';
        sp.dataset.word = tok.lower;
        sp.dataset.wIdx = String(wIdx);
        sp.textContent  = tok.text;
        applyLevelClass(sp, wordLevels.has(tok.lower) ? wordLevels.get(tok.lower) : null);
        sent.appendChild(sp);
        wIdx++;
      });
      frag.appendChild(sent);
    });
    return frag;
  }

  // A bubble word gained focus — by tap (onBubbleWordClick) or by
  // arrow-key step (navBubbleWord). Same study reaction as a body
  // word (onWordClick → applyFocus) but scoped to the overlay: clear
  // any body selection, ring this word, fire wc:word-selected for the
  // sidebar, then paint the chunk underline + speak the chunk.
  let bubbleFocusEl = null;   // currently-focused bubble .w, or null

  // Keep the focused bubble in the reading view. In scroll mode, once
  // reading reaches the SECOND (or later) currently-visible speech
  // bubble, pull that bubble up to the top of the view so the line
  // being read stays near the top. Otherwise just nudge the word in.
  function scrollFocusedBubbleIntoReading(wordEl) {
    const body   = $('lessonBody');
    const bubble = wordEl && wordEl.closest('.wc-bubble');
    if (!scrollMode || !body || !bubble) {
      try { wordEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
      return;
    }
    const bodyRect = body.getBoundingClientRect();
    const visible = Array.from(document.querySelectorAll('#lessonBody .wc-bubble'))
      .map(b => ({ b, r: b.getBoundingClientRect() }))
      .filter(o => o.r.bottom > bodyRect.top + 1 && o.r.top < bodyRect.bottom - 1)
      .sort((a, b) => a.r.top - b.r.top);
    const idx = visible.findIndex(o => o.b === bubble);
    if (idx >= 1) {
      try { bubble.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
    } else {
      try { wordEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
    }
  }

  function focusBubbleWord(wordEl) {
    const sentEl = wordEl && wordEl.closest('.wc-bubble-sent');
    if (!sentEl) return;
    // A bubble selection supersedes any body-word selection.
    focusedSentIdx = null;
    focusedWordIdx = null;
    bubbleFocusEl  = wordEl;
    document.querySelectorAll('.w.focused').forEach(el => el.classList.remove('focused'));
    wordEl.classList.add('focused');
    scrollFocusedBubbleIntoReading(wordEl);

    const lower    = wordEl.dataset.word || '';
    const original = wordEl.textContent  || '';
    const sentText = sentEl.dataset.text || '';
    window.dispatchEvent(new CustomEvent('wc:word-selected', {
      detail: { word: original, lower, sentence: sentText },
    }));

    const wIdx = parseInt(wordEl.dataset.wIdx, 10) || 0;
    window.WCChunks.fetch(sentText).then(chunks => {
      if (bubbleFocusEl !== wordEl) return;   // focus moved on during fetch
      const chunk = window.WCChunks.findChunkAt(chunks, wIdx);
      if (chunk) paintChunkUnderline(sentEl, chunk.indices[0], chunk.indices[1]);
      else       clearChunkUnderline();
      window.dispatchEvent(new CustomEvent('wc:chunk-focused', {
        detail: { chunk: chunk ? chunk.text : null, sentence: sentText },
      }));
      if (chunkMuted) return;
      const speakText = (chunk && chunk.text) ? chunk.text : sentText;
      if (!speakText) return;
      if (window.WCTTS) {
        try { window.WCTTS.stop(); } catch {}
        window.WCTTS.speak(speakText).catch(e =>
          console.warn('[bubble-tts] failed', e && e.message));
      }
    }).catch(e => console.warn('[bubble-tts] chunks fetch failed', e && e.message));
  }

  function onBubbleWordClick(wordEl) { focusBubbleWord(wordEl); }

  // Arrow-key navigation across the page's speech bubbles. The flat
  // DOM order of `.wc-bubble .w` already IS the reading order — panels
  // in body order, bubbles in the teacher's creation order, words in
  // order — so stepping the flat list moves the last word of a bubble
  // straight into the first word of the next bubble.
  function navBubbleWord(dir) {
    if (!bubbleFocusEl || !bubbleFocusEl.isConnected) { bubbleFocusEl = null; return; }
    const words = Array.from(
      document.querySelectorAll('#lessonBody .wc-bubble .w:not(.punct)'));
    const i = words.indexOf(bubbleFocusEl);
    if (i < 0) { bubbleFocusEl = null; return; }
    const j = i + dir;
    if (j < 0 || j >= words.length) return;   // first/last word on the page — stay put
    focusBubbleWord(words[j]);
  }

  // Visual vertical nav for comic-bubble words — ↑/↓ pick the word
  // directly above / below the focused one by screen geometry,
  // crossing bubble boundaries. So ↓ from a word steps to whatever
  // word sits straight below it, even if that word lives in the next
  // speech bubble down.
  function navBubbleVertical(dir) {
    if (!bubbleFocusEl || !bubbleFocusEl.isConnected) { bubbleFocusEl = null; return; }
    const cur   = bubbleFocusEl.getBoundingClientRect();
    const curCx = cur.left + cur.width / 2;
    const cands = [];
    document.querySelectorAll('#lessonBody .wc-bubble .w:not(.punct)').forEach(w => {
      if (w === bubbleFocusEl) return;
      const r = w.getBoundingClientRect();
      // Keep only words on a different line in the chosen direction.
      if (dir > 0) { if (r.top    < cur.bottom - 1) return; }
      else         { if (r.bottom > cur.top    + 1) return; }
      cands.push({ w, r });
    });
    if (!cands.length) return;
    const gap = (c) => dir > 0 ? c.r.top - cur.bottom : cur.top - c.r.bottom;
    cands.sort((a, b) => gap(a) - gap(b));
    const nearest = gap(cands[0]);
    const tol = Math.max(4, cur.height * 0.6);
    // Among the nearest line, pick the word closest in X to the
    // current one — i.e. the word straight below / above.
    const sameLine = cands.filter(c => gap(c) - nearest <= tol);
    sameLine.sort((a, b) => {
      const ax = a.r.left + a.r.width / 2;
      const bx = b.r.left + b.r.width / 2;
      return Math.abs(ax - curCx) - Math.abs(bx - curCx);
    });
    focusBubbleWord(sameLine[0].w);
  }

  // Shrink each bubble's font until its text fits the box. Bubbles
  // are %-sized so this re-runs on image load, render and resize.
  function fitBubblesIn(panelEl) {
    if (panelEl) panelEl.querySelectorAll('.wc-bubble').forEach(fitOneBubble);
  }
  function fitAllBubbles() {
    document.querySelectorAll('#lessonBody .wc-bubble').forEach(fitOneBubble);
  }
  function fitOneBubble(bub) {
    bub.style.fontSize = '';
    // Seed proportional to box height so a big panel reads large and
    // a tiny bubble starts small, then shrink to fit. A small bubble
    // crammed with text shrinks all the way down to a 5px floor so
    // the dialogue still fits rather than overflowing the box.
    let size = Math.max(6, Math.min(22, bub.clientHeight * 0.4));
    bub.style.fontSize = size + 'px';
    let guard = 40;
    while (guard-- > 0 && size > 5 &&
           (bub.scrollHeight > bub.clientHeight + 1 ||
            bub.scrollWidth  > bub.clientWidth  + 1)) {
      size -= 1;
      bub.style.fontSize = size + 'px';
    }
  }

  // ============================================================
  //  LESSON AUDIO  — per-sentence mp3 playback
  //
  //  When the lesson carries an mp3 (audio_url) + audio_segments,
  //  every sentence whose text matches a segment gets a 🔊 button
  //  (added in makeSentenceWrap). Tapping it plays just that slice
  //  of the recording. The 🔊 click is caught by the #lessonBody
  //  delegated listener so it survives re-render / repagination.
  // ============================================================
  let lessonAudioEl = null;   // <audio> element for the lesson mp3
  let audioSegMap   = null;   // Map<normalisedText, {start,end}>
  let audioStopAt   = null;   // pause the clip once playback reaches this

  function normAudioKey(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function setupLessonAudio() {
    const url  = lesson && lesson.audio_url;
    const segs = (lesson && Array.isArray(lesson.audio_segments)) ? lesson.audio_segments : [];
    if (!url || !segs.length) return;
    audioSegMap = new Map();
    segs.forEach(s => {
      if (!s || typeof s.text !== 'string') return;
      const a = Number(s.start), b = Number(s.end);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      audioSegMap.set(normAudioKey(s.text), { start: a, end: b });
    });
    if (!audioSegMap.size) { audioSegMap = null; return; }
    lessonAudioEl = new Audio(url);
    lessonAudioEl.preload = 'metadata';
    lessonAudioEl.addEventListener('timeupdate', () => {
      if (audioStopAt != null && lessonAudioEl.currentTime >= audioStopAt) {
        lessonAudioEl.pause();
        audioStopAt = null;
      }
    });
  }
  function playLessonSegment(start, end) {
    if (!lessonAudioEl) return;
    // The recorded voice and the TTS shouldn't talk over each other.
    try { if (window.WCTTS) window.WCTTS.stop(); } catch {}
    audioStopAt = (Number.isFinite(end) && end > start) ? end : null;
    try {
      lessonAudioEl.pause();
      lessonAudioEl.currentTime = Math.max(0, start || 0);
      lessonAudioEl.play().catch(() => {});
    } catch {}
  }

  // ============================================================
  //  SENTENCE RECORDING  (Record mode + recording bar)
  //
  //  The [Record] toolbar button reveals a round record button on
  //  every sentence and swaps the bottom nav bar for the recording
  //  bar. Each line keeps up to 3 takes ([1][2][3]); the small check
  //  circle on a take marks it as the chosen one. Recordings are
  //  held in memory for the page session.
  // ============================================================
  const recordings  = new Map();  // key → { takes:[{n,blob,url}], selectedN, seq }
  let activeRec     = null;       // { mr, key } while a take is running
  let recActiveKey  = null;       // line the recording bar targets
  let recActiveText = '';         // its display text

  // The line a record button belongs to — a body sentence, a comic
  // bubble sentence, or (whole-bubble button) the bubble itself.
  function recLineEl(btn) {
    return btn.closest('.wc-sentence')
        || btn.closest('.wc-bubble-sent')
        || btn.closest('.wc-bubble');
  }
  function recKeyForBtn(btn) {
    const s = recLineEl(btn);
    return s ? normAudioKey(s.dataset.text || '') : '';
  }
  function recTextForBtn(btn) {
    const s = recLineEl(btn);
    return (s && s.dataset.text) || '';
  }

  // Append a take; keep at most 3, evicting the OLDEST un-checked one.
  function addTake(key, blob) {
    let rec = recordings.get(key);
    if (!rec) { rec = { takes: [], selectedN: null, seq: 0 }; recordings.set(key, rec); }
    rec.seq += 1;
    const take = { n: rec.seq, blob, url: URL.createObjectURL(blob), rowId: null };
    rec.takes.push(take);
    while (rec.takes.length > 3) {
      let i = rec.takes.findIndex(t => t.n !== rec.selectedN);
      if (i < 0) i = 0;
      const gone = rec.takes.splice(i, 1)[0];
      if (gone) {
        if (gone.blob && gone.url) { try { URL.revokeObjectURL(gone.url); } catch {} }
        if (gone.rowId) { try { window.WCDB.recordingsDb.remove(gone.rowId); } catch {} }
        if (gone.n === rec.selectedN) rec.selectedN = null;
      }
    }
    persistTake(key, take, blob);   // best-effort: upload to Storage + DB row
    return rec;
  }

  // Upload a take to Storage and record it in wc_recordings so it
  // survives a reload. Best-effort — a failure just leaves the take
  // session-only (its blob URL still plays for this visit).
  async function persistTake(key, take, blob) {
    if (isPreview || !me || !lessonId) return;
    try {
      const ext = (blob.type && blob.type.indexOf('mp4') >= 0) ? 'm4a' : 'webm';
      const url = await window.WCDB.storage.uploadBlob(blob, ext, 'recordings');
      const row = await window.WCDB.recordingsDb.add({
        user_id: me.id, lesson_id: lessonId,
        sentence_key: key, take_n: take.n, url, selected: false,
      });
      if (row && row.id) take.rowId = row.id;
      // Stash the persistent Storage URL on the take. The local
      // `take.url` is a session-only blob: URL (from
      // URL.createObjectURL); the post-recording message popup needs
      // the Storage URL to send the teacher a link that survives.
      take.storageUrl = url;
    } catch (e) {
      console.warn('[recording] persist failed', e && e.message);
    }
  }

  // Load this student's saved recordings for the lesson — fills the
  // recordings map with Storage-URL takes (no blob). Best-effort.
  async function loadRecordings() {
    if (isPreview || !me || !lessonId) return;
    let rows = [];
    try { rows = await window.WCDB.recordingsDb.list(me.id, lessonId); }
    catch (e) { return; }
    rows.forEach(r => {
      const key = String(r.sentence_key || '');
      if (!key || !r.url) return;
      let rec = recordings.get(key);
      if (!rec) { rec = { takes: [], selectedN: null, seq: 0 }; recordings.set(key, rec); }
      rec.takes.push({ n: r.take_n || (rec.takes.length + 1), url: r.url, rowId: r.id, blob: null });
      rec.seq = Math.max(rec.seq, r.take_n || 0);
      if (r.selected) rec.selectedN = r.take_n;
    });
    recordings.forEach(rec => {
      rec.takes.sort((a, b) => a.n - b.n);
      while (rec.takes.length > 3) rec.takes.shift();
    });
    refreshRecUi();
  }
  // The take used for playback: the checked one, else the most recent.
  function activeTake(key) {
    const rec = recordings.get(key);
    if (!rec || !rec.takes.length) return null;
    if (rec.selectedN != null) {
      const sel = rec.takes.find(t => t.n === rec.selectedN);
      if (sel) return sel;
    }
    return rec.takes[rec.takes.length - 1];
  }
  function hasTakes(key) {
    const rec = recordings.get(key);
    return !!(rec && rec.takes.length);
  }

  function stopActiveRecording() {
    if (activeRec && activeRec.mr && activeRec.mr.state !== 'inactive') {
      try { activeRec.mr.stop(); } catch {}
    }
  }
  async function startRecording(key) {
    if (activeRec || !key) return;
    let stream;
    try {
      // Explicit constraints work better across browsers than the
      // bare `audio: true` (Windows Edge in particular sometimes
      // grabs a silent / wrong source without them).
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
        },
      });
    } catch (e) {
      alert('마이크를 사용할 수 없어요. 브라우저의 마이크 권한을 확인해 주세요.');
      return;
    }
    // Prefer mp4/AAC — its container writes the duration in the
    // header (so no Chromium `duration=Infinity` bug on playback)
    // AND Windows Edge plays MediaRecorder-produced mp4 reliably
    // where it sometimes outputs silent audio for webm/opus blobs
    // (the `<audio>` element thinks it's playing — currentTime
    // advances — but no sound reaches the speakers). Firefox doesn't
    // support mp4 in MediaRecorder, so webm/opus stays as fallback.
    const candidates = [
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
    ];
    let chosenType = '';
    if (typeof MediaRecorder !== 'undefined'
        && typeof MediaRecorder.isTypeSupported === 'function') {
      chosenType = candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
    }
    let mr;
    try {
      mr = chosenType
        ? new MediaRecorder(stream, { mimeType: chosenType })
        : new MediaRecorder(stream);
    } catch (e) {
      stream.getTracks().forEach(t => t.stop());
      alert('녹음을 시작할 수 없어요: ' + (e && e.message));
      return;
    }
    const chunks = [];
    mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      // Strip ;codecs=… from the blob type — some Edge builds refuse
      // to play back a blob whose type carries a codec parameter.
      const recType  = mr.mimeType || chosenType || 'audio/webm';
      const blobType = recType.split(';')[0] || 'audio/webm';
      const blob     = new Blob(chunks, { type: blobType });
      if (!blob.size) {
        console.warn('[recording] empty blob — check mic input');
        alert('녹음이 비어 있어요. 마이크 입력을 확인해 주세요.');
      } else {
        addTake(key, blob);
      }
      activeRec = null;
      refreshRecUi();
    };
    activeRec = { mr, key };
    // Force a flush every 250 ms instead of waiting for stop — some
    // browsers (Windows Edge in particular) otherwise only emit
    // dataavailable on stop, and an Edge bug can fire that event
    // empty, leaving the take silent.
    try { mr.start(250); } catch (e) { mr.start(); }
    refreshRecUi();
  }

  // Chromium MediaRecorder writes WebM blobs without the duration in
  // the header → on Chrome/Edge the <audio> element reports
  // duration = Infinity and fires `ended` the instant we hit play(),
  // producing silence (a long-standing Chromium bug). Workaround:
  // force a seek past the end so Chromium reads the actual length
  // from the WebM trailer, then reset currentTime to 0. Returns a
  // Promise resolving to the prepared <audio>; callers attach
  // handlers + call .play() on it.
  function preparedRecordingAudio(url) {
    return new Promise((resolve) => {
      const a = new Audio(url);
      a.preload = 'auto';
      let settled = false;
      const finish = (why) => {
        if (settled) return;
        settled = true;
        console.log('[rec-prep] resolve (', why, ') duration=', a.duration);
        resolve(a);
      };

      a.addEventListener('loadedmetadata', () => {
        console.log('[rec-prep] loadedmetadata duration=', a.duration);
        if (a.duration !== Infinity && !isNaN(a.duration) && a.duration > 0) {
          finish('native duration');
          return;
        }
        // Force Chromium to scan the WebM trailer by seeking past
        // any plausible recording length. Listen for ANY of the three
        // events a browser might fire as it discovers the real length.
        const onAny = (evt) => {
          a.removeEventListener('seeked',        onAny);
          a.removeEventListener('timeupdate',    onAny);
          a.removeEventListener('durationchange', onAny);
          console.log('[rec-prep] discovered via', evt && evt.type,
            'duration=', a.duration);
          // Reset to start; small tick for the engine to settle.
          a.currentTime = 0;
          setTimeout(() => finish('fixed'), 40);
        };
        a.addEventListener('seeked',        onAny);
        a.addEventListener('timeupdate',    onAny);
        a.addEventListener('durationchange', onAny);
        // 1e6 s ≈ 11 days — past any sane reading recording, but
        // small enough that Edge doesn't reject the seek as nonsense.
        try { a.currentTime = 1e6; }
        catch (e) { console.warn('[rec-prep] seek failed', e && e.message); finish('seek-throw'); }
      }, { once: true });
      a.addEventListener('error', () => {
        console.warn('[rec-prep] error', a.error && a.error.message);
        finish('error');
      }, { once: true });
      setTimeout(() => finish('timeout'), 1500);
    });
  }

  async function playTake(take) {
    if (!take) return;
    try { if (window.WCTTS) window.WCTTS.stop(); } catch {}
    try { if (lessonAudioEl) lessonAudioEl.pause(); } catch {}
    const a = await preparedRecordingAudio(take.url);
    a.play().catch(e =>
      console.warn('[recording] playback failed', e && e.message));
  }

  // ── "Play all my recordings" — the light-blue nav-bar button.
  //    Plays every recorded sentence's chosen take in lesson order.
  //    Hidden until at least one take exists (refreshRecUi toggles it).
  let playAllBusy  = false;
  let playAllAudio = null;
  function playRecordingClip(take) {
    return preparedRecordingAudio(take.url).then(a => new Promise((resolve) => {
      playAllAudio = a;
      const done = () => { if (playAllAudio === a) playAllAudio = null; resolve(); };
      a.onended = a.onerror = a.onpause = done;
      a.play().catch(done);
    }));
  }
  function stopPlayAll() {
    playAllBusy = false;
    if (playAllAudio) { try { playAllAudio.pause(); } catch {} playAllAudio = null; }
    const btn = $('btnPlayRec');
    if (btn) { btn.classList.remove('playing'); btn.textContent = '▶'; }
  }
  async function playAllRecordings() {
    if (playAllBusy) return null;
    playAllBusy = true;
    const btn = $('btnPlayRec');
    if (btn) { btn.classList.add('playing'); btn.textContent = '⏸'; }
    try { if (window.WCTTS) window.WCTTS.stop(); } catch {}
    let interrupted = false;
    try {
      // Page-scoped — only the sentences the student is looking at.
      // In paginated mode that's the rendered page; in scroll mode we
      // narrow to the .wc-scroll-page wrapper for the current pageIdx.
      const sentEls = currentPageSentenceEls();
      for (const span of sentEls) {
        if (!playAllBusy) { interrupted = true; break; }
        const key = normAudioKey(span.dataset.text || span.textContent || '');
        const take = activeTake(key);
        if (!take) continue;
        span.classList.add('wc-tts-reading');
        try { span.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
        await playRecordingClip(take);
        span.classList.remove('wc-tts-reading');
      }
    } finally {
      playAllBusy = false;
      if (btn) { btn.classList.remove('playing'); btn.textContent = '▶'; }
    }
    return interrupted ? 'stopped' : 'done';
  }

  // Sentence elements on the current page — DOM-based so it works
  // for both paginated and continuous-scroll layouts. In scroll mode
  // we narrow to the page block matching the current pageIdx so the
  // "all recorded?" check + page-scoped playback only consider the
  // page the student is on.
  function currentPageSentenceEls() {
    const body = $('lessonBody');
    if (!body) return [];
    const scoped = body.querySelector(
      `.wc-scroll-page[data-page="${pageIdx}"]`);
    const root = scoped || body;
    return Array.from(root.querySelectorAll('.wc-sentence'));
  }
  // True when every sentence on the current page has at least one
  // saved recording — drives the play-all-recordings button colour.
  function allRecordedThisPage() {
    const sentEls = currentPageSentenceEls();
    if (!sentEls.length) return false;
    return sentEls.every(el => {
      const key = normAudioKey(el.dataset.text || el.textContent || '');
      return hasTakes(key);
    });
  }
  // After a "complete green button" playback, run a forced encounter
  // (no probability gate, no page-advance counter — the student
  // earned this one by recording every sentence), then surface the
  // "녹음하면서 어려웠던 단어 적어줘" message popup so the teacher
  // gets the page's recordings + a note in the Visualisation inbox.
  async function runPostRecordingFlow() {
    if (window.WCEncounter && typeof window.WCEncounter.runForPage === 'function') {
      const stats = { pages: 1, words: 0, xp: 0 };
      try { await window.WCEncounter.runForPage(stats); }
      catch (e) { console.warn('[post-rec] encounter run failed', e && e.message); }
    }
    // Always end with the message popup — even if the encounter was
    // skipped / failed, we still want the teacher to receive the page's
    // recordings + the student's reflection.
    showRecordingMessagePopup();
  }

  // Collect persistent Storage URLs of the current page's recordings
  // in DOM order — used by the post-recording message popup.
  function collectPageRecordingUrls() {
    const urls = [];
    currentPageSentenceEls().forEach(el => {
      const key  = normAudioKey(el.dataset.text || el.textContent || '');
      const take = activeTake(key);
      if (!take) return;
      // Freshly-recorded → take.storageUrl was set by persistTake.
      // Loaded-from-DB → take.url IS the Storage URL.
      // Anything still on a blob: URL is session-only and not
      // forwardable to the teacher, so skip it.
      let url = take.storageUrl
        || (take.url && !String(take.url).startsWith('blob:') ? take.url : null);
      if (url) urls.push(url);
    });
    return urls;
  }

  // Modal: "녹음하면서 어려웠던 단어 적어줘." Student types a quick
  // note; we POST it to wc_visualization_messages with the page's
  // recording URLs attached. Teacher reads + replies in the Messages
  // tab (where the audio players render under the prompt).
  function showRecordingMessagePopup() {
    const old = document.getElementById('wcRecMsgHost');
    if (old) old.remove();
    const host = document.createElement('div');
    host.id = 'wcRecMsgHost';
    host.className = 'wc-popup-backdrop';
    host.innerHTML =
      '<div class="wc-popup wc-rec-msg-pop" role="dialog" aria-modal="true">' +
        '<button class="wc-popup-close" aria-label="Close">×</button>' +
        '<h3 style="margin:0 0 4px;">📝 녹음을 마쳤어요!</h3>' +
        '<p class="wc-muted" style="margin:0 0 10px;">내가 가장 잘 말한 단어나 표현은 뭐야? 녹음하면서 어려웠던 단어도 적어줘.</p>' +
        '<textarea id="wcRecMsgInput" rows="4" class="wc-input"' +
          ' style="width:100%;font:inherit;line-height:1.5;"' +
          ' placeholder="예) plan it 부분이 어려웠어요"></textarea>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">' +
          '<button class="wc-btn ghost" id="wcRecMsgSkip" type="button">나중에</button>' +
          '<button class="wc-btn" id="wcRecMsgSend" type="button">보내기 📨</button>' +
        '</div>' +
        '<div id="wcRecMsgStatus" class="wc-muted"' +
          ' style="font-size:12px;margin-top:6px;min-height:1em;"></div>' +
      '</div>';
    document.body.appendChild(host);
    const close = () => host.remove();
    host.querySelector('.wc-popup-close').addEventListener('click', close);
    host.querySelector('#wcRecMsgSkip').addEventListener('click', close);
    host.addEventListener('click', e => { if (e.target === host) close(); });
    host.querySelector('#wcRecMsgSend').addEventListener('click', async () => {
      const ta     = document.getElementById('wcRecMsgInput');
      const status = document.getElementById('wcRecMsgStatus');
      const send   = document.getElementById('wcRecMsgSend');
      const text = (ta.value || '').trim();
      if (!text) { status.textContent = '메시지를 적어줘.'; return; }
      if (isPreview || !me || !lessonId) {
        status.textContent = '미리보기 모드에선 보낼 수 없어요.';
        return;
      }
      send.disabled = true;
      status.textContent = '보내는 중…';
      try {
        const urls = collectPageRecordingUrls();
        await window.WCDB.viz.send(me.id, lessonId, '__recording__', text, urls);
        status.textContent = '잘 보냈어요! ✓';
        setTimeout(close, 1200);
      } catch (e) {
        status.textContent = '보내지 못했어요: ' + (e && e.message || e);
        send.disabled = false;
      }
    });
    // Focus the textarea so the student can start typing right away.
    setTimeout(() => {
      const ta = document.getElementById('wcRecMsgInput');
      if (ta) ta.focus();
    }, 50);
  }

  function anyRecordings() {
    let any = false;
    recordings.forEach(r => { if (r && r.takes && r.takes.length) any = true; });
    return any;
  }

  // ── Recording-bar playback options — TTS / repeat / speed / vs ──
  const REC_SPEEDS = [1, 0.8, 0.6, 0.4, 1.6, 1.4, 1.2];
  let recSpeedIdx  = 0;
  let recTtsMode   = false;   // 줄반복 plays the line via TTS, not the mp3
  let recRepeat    = false;   // 줄반복 loop running
  let vsBusy       = false;

  function recSpeed() { return REC_SPEEDS[recSpeedIdx]; }
  // mp3 segment for the active line, or null.
  function lineSeg() {
    if (!audioSegMap || !recActiveText) return null;
    return audioSegMap.get(normAudioKey(recActiveText)) || null;
  }
  // Speak the active line once via Google TTS; resolves when done.
  function playLineTtsOnce(rate) {
    if (!window.WCTTS || !recActiveText) return Promise.resolve();
    try { if (lessonAudioEl) lessonAudioEl.pause(); } catch {}
    return window.WCTTS.speak(recActiveText, { rate: rate || 1 }).catch(() => {});
  }
  // Play the active line's mp3 slice once at `rate`; falls back to TTS
  // when the line has no synced segment. Resolves when it ends.
  function playLineMp3Once(rate) {
    const seg = lineSeg();
    if (!seg || !lessonAudioEl) return playLineTtsOnce(rate);
    return new Promise((resolve) => {
      try { if (window.WCTTS) window.WCTTS.stop(); } catch {}
      audioStopAt = null;   // our own onTick handles the stop here
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        lessonAudioEl.removeEventListener('timeupdate', onTick);
        lessonAudioEl.removeEventListener('pause', finish);
        resolve();
      };
      const onTick = () => {
        if (lessonAudioEl.currentTime >= seg.end) lessonAudioEl.pause();
      };
      lessonAudioEl.addEventListener('timeupdate', onTick);
      lessonAudioEl.addEventListener('pause', finish);
      lessonAudioEl.playbackRate = rate || 1;
      try {
        lessonAudioEl.pause();
        lessonAudioEl.currentTime = Math.max(0, seg.start);
        lessonAudioEl.play().catch(finish);
      } catch { finish(); }
    });
  }
  // Play the active line's chosen take once; resolves when it ends.
  function playLineRecordingOnce(rate) {
    const take = activeTake(recActiveKey);
    if (!take) return Promise.resolve();
    return preparedRecordingAudio(take.url).then(a => new Promise((resolve) => {
      a.playbackRate = rate || 1;
      a.onended = a.onerror = () => resolve();
      a.play().catch(() => resolve());
    }));
  }
  function stopRecPlaybackAll() {
    recRepeat = false;
    try { if (window.WCTTS) window.WCTTS.stop(); } catch {}
    try { if (lessonAudioEl) lessonAudioEl.pause(); } catch {}
  }
  // 줄반복 — loop the active line until the toggle is switched off.
  async function recRepeatLoop() {
    while (recRepeat) {
      const t0 = Date.now();
      await (recTtsMode ? playLineTtsOnce(recSpeed()) : playLineMp3Once(recSpeed()));
      if (!recRepeat) break;
      // Guard a runaway loop if a playback resolves instantly (error).
      if (Date.now() - t0 < 250) await new Promise(r => setTimeout(r, 400));
    }
  }
  function toggleRecRepeat() {
    recRepeat = !recRepeat;
    if (recRepeat) recRepeatLoop();
    else stopRecPlaybackAll();
    renderRecBar();
  }
  function toggleRecTts() {
    recTtsMode = !recTtsMode;
    renderRecBar();
    if (recTtsMode) playLineTtsOnce(recSpeed());   // preview the line once
  }
  function cycleRecSpeed() {
    recSpeedIdx = (recSpeedIdx + 1) % REC_SPEEDS.length;
    if (lessonAudioEl) { try { lessonAudioEl.playbackRate = recSpeed(); } catch {} }
    renderRecBar();
  }
  // [vs] — play the line's mp3, then TTS, then the recorded take, once
  // each, in order. mp3 / recording steps are skipped when absent.
  async function playRecVs() {
    if (vsBusy) return;
    vsBusy = true;
    renderRecBar();
    try {
      if (lineSeg())                   await playLineMp3Once(1);
      await playLineTtsOnce(1);
      if (activeTake(recActiveKey))    await playLineRecordingOnce(1);
    } finally {
      vsBusy = false;
      renderRecBar();
    }
  }

  function setActiveLine(key, text) {
    // Switching lines stops a running repeat (it was line-specific).
    if (recActiveKey !== (key || null)) stopRecPlaybackAll();
    recActiveKey  = key || null;
    recActiveText = text || '';
    renderRecBar();
  }

  // per-sentence ⏺ — picks the active line and records a take.
  function onRecButtonClick(btn) {
    if (activeRec) { stopActiveRecording(); return; }
    const key = recKeyForBtn(btn);
    if (!key) return;
    setActiveLine(key, recTextForBtn(btn));
    startRecording(key);
  }
  // per-sentence ▶ — plays the line's active take.
  function onRecPlayClick(btn) {
    const key = recKeyForBtn(btn);
    setActiveLine(key, recTextForBtn(btn));
    playTake(activeTake(key));
  }
  // per-sentence 🔊 — TTS-reads the sentence text (always visible in
  // Record mode so the student can hear the model before recording).
  function onRecTtsClick(btn) {
    const sentEl = btn.closest('.wc-sentence') || btn.closest('.wc-bubble-sent');
    if (!sentEl) return;
    const text = sentEl.dataset.text || sentEl.textContent || '';
    if (!text || !window.WCTTS) return;
    try { window.WCTTS.stop(); } catch {}
    window.WCTTS.speak(text).catch(e =>
      console.warn('[rec-tts] failed', e && e.message));
  }

  // Repaint the per-sentence buttons + the recording bar.
  function refreshRecUi() {
    // every record button (per-sentence + per-bubble) shows its state
    document.querySelectorAll('#lessonBody .wc-rec-btn').forEach(btn => {
      const key = recKeyForBtn(btn);
      btn.classList.toggle('recording', !!(activeRec && activeRec.key === key));
    });
    document.querySelectorAll('#lessonBody .wc-rec-grp').forEach(grp => {
      const s   = grp.closest('.wc-sentence') || grp.closest('.wc-bubble-sent');
      const key = s ? normAudioKey(s.dataset.text || '') : '';
      grp.classList.toggle('has-rec', hasTakes(key));
    });
    // per-bubble whole-bubble record control
    document.querySelectorAll('#lessonBody .wc-bubble-rec').forEach(br => {
      const bub = br.closest('.wc-bubble');
      const key = bub ? normAudioKey(bub.dataset.text || '') : '';
      br.classList.toggle('has-rec', hasTakes(key));
    });
    const playRecBtn = $('btnPlayRec');
    if (playRecBtn) {
      const any = anyRecordings();
      playRecBtn.classList.toggle('wc-hidden', !any);
      // Green when every sentence on the current page is recorded —
      // a click then also triggers the post-recording flow.
      playRecBtn.classList.toggle('wc-playrec-complete',
        any && allRecordedThisPage());
    }
    renderRecBar();
  }

  // The recording bar — reflects the active line's takes.
  function renderRecBar() {
    const bar = $('wcRecBar');
    if (!bar) return;
    const recBtn  = bar.querySelector('#recRecBtn');
    const playBtn = bar.querySelector('#recPlayBtn');
    const ttsBtn  = bar.querySelector('#recTtsBtn');
    const repBtn  = bar.querySelector('#recRepeatBtn');
    const spdBtn  = bar.querySelector('#recSpeedBtn');
    const vsBtn   = bar.querySelector('#recVsBtn');
    const takesEl = bar.querySelector('#recTakes');
    const hintEl  = bar.querySelector('#recHint');
    const lineEl  = bar.querySelector('#recLineLabel');

    recBtn.classList.toggle('recording', !!activeRec);
    recBtn.textContent = activeRec ? '⏹' : '⏺';
    if (spdBtn) spdBtn.textContent = recSpeed().toFixed(1) + '×';
    if (ttsBtn) ttsBtn.classList.toggle('active', recTtsMode);
    if (repBtn) repBtn.classList.toggle('active', recRepeat);

    const hasLine = !!recActiveKey;
    [recBtn, playBtn, ttsBtn, repBtn, spdBtn, vsBtn].forEach(b => {
      if (b) b.disabled = !hasLine;
    });

    if (!hasLine) {
      takesEl.innerHTML = '';
      if (lineEl) lineEl.textContent = '';
      hintEl.classList.remove('wc-hidden');
      return;
    }
    hintEl.classList.add('wc-hidden');
    if (lineEl) {
      lineEl.textContent = recActiveText.length > 30
        ? recActiveText.slice(0, 30) + '…' : recActiveText;
    }
    const rec   = recordings.get(recActiveKey);
    const takes = rec ? rec.takes : [];
    playBtn.disabled = !takes.length;
    if (vsBtn) vsBtn.disabled = vsBusy;
    takesEl.innerHTML = takes.map(t =>
      '<span class="wc-take' + (rec.selectedN === t.n ? ' selected' : '') + '">' +
        '<button class="wc-take-check" type="button" data-n="' + t.n + '" aria-label="선택"></button>' +
        '<button class="wc-take-btn" type="button" data-n="' + t.n + '">' + t.n + '</button>' +
      '</span>').join('');
  }

  // Wire the recording bar's controls (once — the bar element is
  // stable, so a single delegated listener survives every render).
  (function wireRecBar() {
    // "Play all my recordings" — nav-bar button. Light blue while
    // the current page is partially recorded → just plays what's
    // there. Green once every sentence on the page has a take →
    // playback ends with an encounter + reward-wheel + the
    // "녹음하면서 어려웠던 단어 적어줘" message popup.
    const playRecBtn = $('btnPlayRec');
    if (playRecBtn) {
      playRecBtn.addEventListener('click', async () => {
        if (playAllBusy) { stopPlayAll(); return; }
        const wasComplete = playRecBtn.classList.contains('wc-playrec-complete');
        const result = await playAllRecordings();
        if (wasComplete && result === 'done') {
          try { await runPostRecordingFlow(); }
          catch (e) { console.warn('[post-rec] flow failed', e && e.message); }
        }
      });
    }
    const bar = $('wcRecBar');
    if (!bar) return;
    bar.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#recRecBtn')) {
        if (activeRec) stopActiveRecording();
        else if (recActiveKey) startRecording(recActiveKey);
        return;
      }
      if (t.closest('#recPlayBtn')) {
        playTake(activeTake(recActiveKey));
        return;
      }
      if (t.closest('#recTtsBtn'))    { toggleRecTts();    return; }
      if (t.closest('#recRepeatBtn')) { toggleRecRepeat(); return; }
      if (t.closest('#recSpeedBtn'))  { cycleRecSpeed();   return; }
      if (t.closest('#recVsBtn'))     { playRecVs();       return; }
      const chk = t.closest('.wc-take-check');
      if (chk) {
        const n   = parseInt(chk.dataset.n, 10);
        const rec = recordings.get(recActiveKey);
        if (rec) {
          rec.selectedN = (rec.selectedN === n) ? null : n;
          renderRecBar();
          if (!isPreview && me && lessonId) {
            try {
              window.WCDB.recordingsDb.setSelected(me.id, lessonId, recActiveKey, rec.selectedN);
            } catch {}
          }
        }
        return;
      }
      const tb = t.closest('.wc-take-btn');
      if (tb) {
        const n    = parseInt(tb.dataset.n, 10);
        const rec  = recordings.get(recActiveKey);
        const take = rec && rec.takes.find(x => x.n === n);
        if (!take) return;
        // Light-green flash while the take plays.
        bar.querySelectorAll('.wc-take.playing').forEach(s => s.classList.remove('playing'));
        const span = tb.closest('.wc-take');
        if (span) span.classList.add('playing');
        try { if (window.WCTTS) window.WCTTS.stop(); } catch {}
        try { if (lessonAudioEl) lessonAudioEl.pause(); } catch {}
        preparedRecordingAudio(take.url).then(a => {
          a.onended = a.onerror = () => { if (span) span.classList.remove('playing'); };
          a.play().catch(() => { if (span) span.classList.remove('playing'); });
        });
      }
    });
  })();

  // HTML body tokenisation. For every block-level element inside
  // `rootEl` (`<p>`, `<h1>`–`<h6>`, `<li>`, `<blockquote>`, table
  // cells, etc.) we replace its children with a fragment of
  // `.wc-sentence` spans built from the block's full textContent.
  //
  // Why per-block instead of per-text-node? Inline tags like
  // `<b>`, `<u>`, `<span>`, and `<br>` split a paragraph into
  // multiple text nodes. The old per-text-node walker treated
  // every fragment as its own "sentence", which made the TTS
  // read short paragraphs word-by-word with long pauses between
  // each fragment. Per-block tokenisation runs sentence detection
  // on the joined string, so a sentence spans across bold / br
  // boundaries and reads naturally.
  //
  // Trade-off: inline `<b>` / `<u>` formatting inside the block
  // is lost in the rendered DOM. Lesson bodies are overwhelmingly
  // prose, so this is acceptable; teachers who want inline
  // emphasis can wrap whole sentences in bold instead.
  function tokenizeTextNodesInPlace(rootEl, startIdx) {
    let globalSentIdx = startIdx || 0;
    const BLOCK_TAGS = /^(P|H[1-6]|LI|BLOCKQUOTE|FIGCAPTION|TD|TH)$/;

    function processBlock(el) {
      // Already tokenised? Leave the block's STRUCTURE alone so any
      // floated <img class="wc-lesson-img"> inside it is preserved
      // (re-running buildSentenceFragment on textContent would strip
      // the image — image elements don't contribute text). BUT we
      // still need to (a) advance the global sentence counter, and
      // (b) re-attach click handlers to the existing .w spans, since
      // those got serialized through innerHTML/outerHTML by the
      // pagination pipeline and lost their JS listeners. Without (b)
      // the words LOOK clickable (have data-w-idx, focus styles) but
      // tapping them is a no-op — the visible "click does nothing"
      // bug that surfaced after repaginate.
      const existing = el.querySelectorAll('.wc-sentence');
      if (existing.length) {
        globalSentIdx += existing.length;
        existing.forEach(sentEl => {
          sentEl.querySelectorAll('.w:not(.punct)').forEach(sp => {
            sp.addEventListener('click', () =>
              onWordClick(sp, sp.dataset.word || '', sp.textContent || ''));
          });
        });
        return;
      }
      // Block has inline emphasis (`<b>`, `<u>`, `<em>`, `<strong>`,
      // `<i>`, `<span>`) — preserve that markup by walking text
      // nodes in place rather than replacing the whole block with
      // a fragment built from plain textContent. (The plain-text
      // path would strip bold/underline visuals.) Each text node
      // becomes its own sentence-wrapped span; sentence detection
      // still happens per-text-node here, which is fine because
      // inline-emphasised paragraphs are usually short (titles,
      // bylines, etc.) and rarely cross a sentence boundary.
      if (el.querySelector('b, strong, u, em, i, span')) {
        wrapTextNodesInPlace(el);
        return;
      }
      const text = el.textContent || '';
      if (!text || !text.trim()) return;
      const frag = buildSentenceFragment(text, globalSentIdx);
      globalSentIdx = frag.nextIdx;
      // Replace ALL children with the sentence-wrapped fragment.
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(frag.frag);
    }

    // Per-text-node sentence wrapping that keeps the block's
    // existing DOM structure (and therefore its <b>/<u>/<span>
    // styling). The block already had children — we walk every
    // text node beneath it and replace each with a sentence-span
    // fragment built from THAT text node alone.
    function wrapTextNodesInPlace(el) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) {
        // Skip text nodes inside script/style (defensive).
        const parent = n.parentNode;
        if (!parent || parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE') continue;
        nodes.push(n);
      }
      nodes.forEach(tn => {
        const text = tn.textContent;
        if (!text || !text.trim()) return;
        const frag = buildSentenceFragment(text, globalSentIdx);
        globalSentIdx = frag.nextIdx;
        tn.parentNode.replaceChild(frag.frag, tn);
      });
    }

    function visit(node) {
      if (!node) return;
      if (node.nodeType === 1) {
        const tag = node.tagName;
        if (BLOCK_TAGS.test(tag)) {
          processBlock(node);
          return;
        }
        // Container — descend into its children. (DIV, SECTION,
        // ARTICLE wrap things like .wc-title-block; UL/OL contain
        // their <li> blocks.)
        if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE'
            || tag === 'UL' || tag === 'OL') {
          Array.from(node.childNodes).forEach(visit);
          return;
        }
        // Otherwise — leaf (img, hr, etc.) — leave alone.
        return;
      }
      if (node.nodeType === 3 && node.textContent && node.textContent.trim()) {
        // Bare text node at the top level — wrap in a synthetic
        // <p> so the sentence span has a place to live.
        const wrap = document.createElement('p');
        node.parentNode.insertBefore(wrap, node);
        wrap.appendChild(node);
        processBlock(wrap);
      }
    }

    Array.from(rootEl.childNodes).forEach(visit);
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
    const sents = splitSentencesSafe(text);
    let prevEnd = 0;
    sents.forEach(s => {
      if (s.start > prevEnd) {
        // Glue between sentences — preserve as plain text so HTML
        // formatting (italic etc.) renders correctly around it.
        frag.appendChild(document.createTextNode(text.slice(prevEnd, s.start)));
      }
      const sentObj = { kind: 'sent', text: s.text, words: extractWordTokens(s.text) };
      frag.appendChild(makeSentenceWrap(sentObj, sentIdx));
      sentIdx++;
      prevEnd = s.end;
    });
    if (prevEnd < text.length) {
      const tail = text.slice(prevEnd);
      if (tail) {
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
    // mp3 slice for this sentence? prepend a 🔊 the student taps to
    // hear just this sentence read from the lesson recording.
    if (audioSegMap) {
      const seg = audioSegMap.get(normAudioKey(p.text));
      if (seg) {
        const ab = document.createElement('button');
        ab.className = 'wc-sent-audio';
        ab.type = 'button';
        ab.textContent = '🔊';
        ab.dataset.aStart = String(seg.start);
        ab.dataset.aEnd   = String(seg.end);
        ab.setAttribute('aria-label', 'Play this sentence');
        wrap.appendChild(ab);
      }
    }
    // Record-mode controls — a round record button (+ a ▶ once a
    // take exists). Hidden by CSS unless Record mode is on.
    {
      const grp = document.createElement('span');
      grp.className = 'wc-rec-grp';
      if (hasTakes(normAudioKey(p.text))) grp.classList.add('has-rec');
      grp.innerHTML =
        '<button class="wc-rec-btn" type="button" aria-label="이 문장 녹음">' +
          '<span class="wc-rec-dot"></span></button>' +
        '<button class="wc-rec-tts" type="button" aria-label="이 문장 듣기" title="TTS로 듣기">🔊</button>' +
        '<button class="wc-rec-play" type="button" aria-label="내 녹음 듣기">▶</button>';
      wrap.appendChild(grp);
    }
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
      // Orange pip — same idea but for teacher-written meanings.
      // When both classes are present the orange dot sits just
      // left of the green dot (handled in CSS).
      if (hasWordNote(tok.lower))  sp.classList.add('has-word-note');
      // Blue pip — student has already messaged the teacher about
      // THIS word via the sidebar "Use it" form. Lets the student
      // see at a glance which words they've already used so the
      // page reads like a record of their own effort.
      if (hasWordMsg(tok.lower)) attachMsgPip(sp);
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

  function hasWordNote(lower) {
    const list = lesson && lesson.word_notes;
    if (!Array.isArray(list) || !list.length) return false;
    const want = String(lower || '').toLowerCase();
    return list.some(wn => (wn.word || '').toLowerCase() === want && wn.note);
  }
  function hasWordMsg(lower) {
    return messagedWords.has(String(lower || '').toLowerCase());
  }
  // Idempotent: adds the .has-word-msg class AND injects the inner
  // <span class="wc-word-msg-dot"> the CSS targets. The dot is an
  // actual child (not a pseudo-element) because ::before / ::after
  // are already taken by the image (green) and note (orange) pips.
  function attachMsgPip(sp) {
    if (!sp || sp.classList.contains('has-word-msg')) return;
    sp.classList.add('has-word-msg');
    if (!sp.querySelector(':scope > .wc-word-msg-dot')) {
      const dot = document.createElement('span');
      dot.className = 'wc-word-msg-dot';
      dot.setAttribute('aria-hidden', 'true');
      sp.appendChild(dot);
    }
  }

  // Sidebar dispatches this after a successful "Use it" Send. We
  // remember the word + tag every visible span for it RIGHT NOW so
  // the dot appears without waiting for the next render.
  window.addEventListener('wc:word-message-sent', (e) => {
    const w = String((e && e.detail && e.detail.word) || '').toLowerCase();
    if (!w) return;
    messagedWords.add(w);
    document.querySelectorAll('#lessonBody .w').forEach(sp => {
      if (sp.dataset && sp.dataset.word === w) attachMsgPip(sp);
    });
  });

  // Flat list of all sentences across the lesson (page-blind). For
  // HTML bodies with page-break markers, sentences are pre-extracted
  // into each html part — concat them all to get the global list.
  function sentenceList() {
    // Read from `pages` (the up-to-date split structure), NOT
    // from the `sentences` array. repaginateOverflow mutates
    // sentences[0].sentences to just the FITTED portion of page 0
    // and stashes the overflow in newly-created page parts that
    // are only present in `pages`. Aggregating from pages gives
    // us the full ordered sentence stream → TTS starts at the
    // right place per page, single-mode nav can walk past the
    // first page, etc.
    const allHtml = pages.length && pages.every(parts =>
      parts.length === 1 && parts[0].kind === 'html');
    if (allHtml) {
      const out = [];
      pages.forEach(parts => {
        (parts[0].sentences || []).forEach(s => out.push(s));
      });
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
  // Chunk-TTS mute state. Default = FALSE (Play chunk ON) so the
  // student hears the chunk as soon as they tap a word — matches
  // the teacher's expectation that the first interaction with a new
  // lesson is the "tap-and-listen" loop. Toggled by the 🔇/🔊 chip
  // in the header. Only affects chunk-on-tap audio; ▶ Listen, sidebar
  // headword 🔊, etc. always play regardless of this flag.
  let chunkMuted = false;
  // Tracks which chunk we last played so arrow-key NAVIGATION inside
  // the same chunk doesn't re-fire TTS on every word. An explicit
  // user click bypasses this dedupe (see lastFocusSource below) —
  // the student tapped the word precisely because they want to hear it.
  let lastPlayedChunkKey = null;
  // 'click' | 'nav' — applyFocus reads this to decide whether to
  // honour the lastPlayedChunkKey dedupe. Clicks always re-speak.
  let lastFocusSource = 'nav';
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
      focusWord(sIdx, wIdx, 'click');
    }
  }

  function focusWord(sIdx, wIdx, source = 'nav') {
    lastFocusSource = source;
    bubbleFocusEl = null;   // a body-word selection supersedes any bubble focus
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
    bubbleFocusEl  = null;
    document.querySelectorAll('.w.focused')
      .forEach(el => el.classList.remove('focused'));
    clearChunkUnderline();    // also resets currentChunkKey
    // Tell the sidebar to revert to its empty state.
    window.dispatchEvent(new CustomEvent('wc:word-deselected'));
  }

  function applyFocus() {
    // Clear ONLY the .focused class (the amber word-ring). The
    // chunk underline (.focused-chunk) is managed by
    // paintChunkUnderline so it can stay in place when the new
    // focus is on a DIFFERENT word inside the SAME chunk — that
    // way the "underline rises" animation only plays on a chunk
    // CHANGE, not on every word-step within the same phrase.
    document.querySelectorAll('.w.focused')
      .forEach(el => el.classList.remove('focused'));

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

    // Chunk highlight + chunk TTS — fire async, bail if focus moved.
    // Snapshot `lastFocusSource` HERE (before any await) so a later
    // applyFocus from slideRender/scroll/etc. can't mutate the global
    // and turn this click's TTS into a dedupe-eligible "nav".
    const seenSent = focusedSentIdx, seenWord = focusedWordIdx;
    const seenSource = lastFocusSource;
    window.WCChunks.fetch(sentText).then(chunks => {
      if (focusedSentIdx !== seenSent || focusedWordIdx !== seenWord) return;
      const chunk = window.WCChunks.findChunkAt(chunks, focusedWordIdx);
      // Paint the chunk underline if we found one. If no chunk
      // matched (rare — empty GPT response, out-of-range index),
      // clear any stale underline so it doesn't visually drift
      // away from the focused word.
      if (chunk) paintChunkUnderline(sentEl, chunk.indices[0], chunk.indices[1]);
      else       clearChunkUnderline();
      // Tell the sidebar which chunk is focused (Kor Bar chunk card).
      window.dispatchEvent(new CustomEvent('wc:chunk-focused', {
        detail: { chunk: chunk ? chunk.text : null, sentence: sentText },
      }));

      // Chunk-tap TTS. When "Play chunk" is on (chunk-muted = false),
      // read the chunk aloud once. If chunks aren't available (network
      // blip / GPT failure / very short sentence), fall back to reading
      // the whole sentence — the teacher's intent was "play the audio
      // for what I tapped", and silence isn't useful.
      //
      // (Preview mode plays too — teachers previewing a lesson need to
      // hear what the student will hear. Earlier we gated this on
      // isPreview, which left preview tabs silent.)
      if (chunkMuted) return;
      const speakText = (chunk && chunk.text) ? chunk.text : sentText;
      if (!speakText) {
        console.warn('[chunk-tts] no speakable text — chunks empty AND sentText empty');
        return;
      }
      const speakKey  = chunk
        ? `${seenSent}::${chunk.indices[0]}-${chunk.indices[1]}`
        : `${seenSent}::sent`;
      // Dedupe only when the focus moved via KEYBOARD ARROW navigation
      // ('nav') and we're still inside the same chunk — keeps the
      // audio from re-firing on every word-step within one phrase.
      // A deliberate tap ('click') always speaks, even on the same
      // chunk. We read the SNAPSHOT taken before the fetch, NOT the
      // live global, so a slideRender that re-runs applyFocus during
      // the in-flight chunk fetch can't reclassify a real click into
      // a dedupe-eligible "nav" and silence it.
      if (seenSource !== 'click' && speakKey === lastPlayedChunkKey) return;
      lastPlayedChunkKey = speakKey;
      if (window.WCTTS) {
        // Stop any in-flight playback so rapid clicks don't pile up.
        try { window.WCTTS.stop(); } catch {}
        window.WCTTS.speak(speakText).catch(e =>
          console.warn('[chunk-tts] failed', e && e.message));
      } else {
        console.warn('[chunk-tts] WCTTS not loaded');
      }
    }).catch(e => console.warn('[chunk-tts] chunks fetch failed', e && e.message));
  }

  // Walk children in order and tag every .w span (word OR glue) whose
  // word-index falls inside [from..to] — gives a continuous underline
  // across spaces/punctuation, the 또박또박 visual.
  //
  // Animation rule: the "rise from below" animation should play only
  // when the chunk CHANGES. Re-focusing a different word inside the
  // SAME chunk should leave the underline exactly as is (no class
  // mutation = no animation restart). We track the currently-painted
  // chunk key on the module scope; if it matches the request, we
  // bail early. If it differs, we wipe the previous .focused-chunk
  // classes (could be on another sentence) and paint fresh.
  let currentChunkKey = null;
  function chunkKeyFor(sentEl, from, to) {
    return `${sentEl.dataset.idx || ''}::${from}-${to}`;
  }
  function clearChunkUnderline() {
    document.querySelectorAll('.focused-chunk')
      .forEach(c => c.classList.remove('focused-chunk'));
    currentChunkKey = null;
  }
  function paintChunkUnderline(sentEl, from, to) {
    const newKey = chunkKeyFor(sentEl, from, to);
    if (newKey === currentChunkKey) return;   // same chunk → no anim, no DOM change
    clearChunkUnderline();
    currentChunkKey = newKey;

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
  //  BUBBLE INTERACTION  — delegated so it survives re-renders
  //
  //  repaginateOverflow serialises rendered panels back to HTML
  //  (children.outerHTML), which would drop directly-bound click
  //  listeners. Binding the handler ONCE on the stable #lessonBody
  //  container — which renderBody only ever empties, never replaces —
  //  keeps bubble words tappable across every render / repagination.
  // ============================================================
  (function wireBubbleDelegation() {
    const body = $('lessonBody');
    if (!body) return;
    body.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      // Record button on a sentence — start / stop a take.
      const rb = t.closest('.wc-rec-btn');
      if (rb) { e.stopPropagation(); onRecButtonClick(rb); return; }
      // ▶ — play back the student's recorded take.
      const rp = t.closest('.wc-rec-play');
      if (rp) { e.stopPropagation(); onRecPlayClick(rp); return; }
      // 🔊 — TTS-read this sentence (always available in Record mode).
      const rt = t.closest('.wc-rec-tts');
      if (rt) { e.stopPropagation(); onRecTtsClick(rt); return; }
      // Comic bubble — 전체 / 문장별 record-mode toggle.
      const bm = t.closest('.wc-bub-mode');
      if (bm) {
        e.stopPropagation();
        const bub = bm.closest('.wc-bubble');
        if (bub) bm.textContent = bub.classList.toggle('wc-bub-mode-sent') ? '문장' : '전체';
        return;
      }
      // 🔊 on a sentence — play that sentence's mp3 slice.
      const ab = t.closest('.wc-sent-audio');
      if (ab) {
        e.stopPropagation();
        playLessonSegment(parseFloat(ab.dataset.aStart), parseFloat(ab.dataset.aEnd));
        return;
      }
      const w = t.closest('.wc-bubble .w');
      if (!w || w.classList.contains('punct')) return;
      onBubbleWordClick(w);
    });
  })();
  // Bubble boxes are %-sized, so a viewport resize changes their
  // pixel size — re-fit the text once the resize settles.
  let _bubbleResizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(_bubbleResizeT);
    _bubbleResizeT = setTimeout(fitAllBubbles, 180);
  });

  // ============================================================
  //  KEYBOARD NAV  — ←/→ word, ↑/↓ chunk
  // ============================================================
  document.addEventListener('keydown', onKeyDown);
  function onKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    // Speech-bubble focus takes over the arrow keys: step through the
    // page's bubbles in reading order (Right/Down = next word, and
    // the last word of a bubble steps into the next bubble's first
    // word; Left/Up = backward). Non-arrow keys still fall through to
    // the switch below (▶ play, page-step, Esc, level grades).
    if (bubbleFocusEl && !bubbleFocusEl.isConnected) bubbleFocusEl = null;
    if (bubbleFocusEl) {
      // ←/→ step the reading order; ↑/↓ move visually up/down,
      // crossing into whatever bubble sits straight above/below.
      if (e.key === 'ArrowRight') { e.preventDefault(); navBubbleWord(+1); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); navBubbleWord(-1); return; }
      if (e.key === 'ArrowDown')  { e.preventDefault(); navBubbleVertical(+1); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); navBubbleVertical(-1); return; }
    }
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); navWord(-1);  return;
      case 'ArrowRight': e.preventDefault(); navWord(+1);  return;
      case 'ArrowUp':    e.preventDefault(); navVertical(-1); return;
      case 'ArrowDown':  e.preventDefault(); navVertical(+1); return;
      // ','  → previous,  '.' → next  (또박또박 convention).
      // In single-sentence mode the unit-of-navigation is one
      // sentence, not a page — so we route the shortcuts through
      // goSingle() instead. (Page mode still steps by page.)
      case ',':
        e.preventDefault();
        if (singleMode) { setCounterMode('sentence'); goSingle(singleIdx - 1); }
        else            { setCounterMode('page');     goPage(pageIdx - 1);     }
        return;
      case '.':
        e.preventDefault();
        if (singleMode) { setCounterMode('sentence'); goSingle(singleIdx + 1); }
        else            { setCounterMode('page');     goPage(pageIdx + 1);     }
        return;
      // Spacebar → play / pause whole-lesson TTS reading. Most
      // natural for a reading app — same as a media player.
      case ' ':          e.preventDefault(); playAllFromCurrent();  return;
      // Esc → clear word selection (focus + chunk underline) AND
      // close the sidebar word card. Cheap escape hatch when the
      // student wants to read without anything highlighted.
      case 'Escape':     e.preventDefault(); clearWordFocus();      return;
    }
    // Level-picker shortcuts — same mapping as 또박또박:
    //   0 / ₩ → -1 (무시 / skip),  1-4 → 1..4,  5 / v → 5 (I know it!)
    // Resolve the focused word — a BODY word (focusedSentIdx) OR a
    // comic-bubble word (bubbleFocusEl). The bubble case was missing,
    // so 1-5 / ₩ did nothing while a bubble word was selected.
    let wordEl = null;
    if (bubbleFocusEl && bubbleFocusEl.isConnected) {
      wordEl = bubbleFocusEl;
    } else if (focusedSentIdx != null && focusedWordIdx != null) {
      const sentEl = document.querySelector(`.wc-sentence[data-idx="${focusedSentIdx}"]`);
      if (sentEl) wordEl = sentEl.querySelector(`.w[data-w-idx="${focusedWordIdx}"]`);
    }
    if (!wordEl) return;
    let st = null;
    if      (e.key === '0' || e.key === '₩')           st = -1;
    else if (e.key === '1')                            st = 1;
    else if (e.key === '2')                            st = 2;
    else if (e.key === '3')                            st = 3;
    else if (e.key === '4')                            st = 4;
    else if (e.key === '5' || e.key === 'v' || e.key === 'V') st = 5;
    if (st === null) return;
    e.preventDefault();
    window.WCLesson.setWordLevel(wordEl.dataset.word, st, wordEl.textContent);
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

  // Pixel-based vertical word navigation. ↑/↓ should pick the word
  // VISUALLY ABOVE / BELOW the currently focused one — exactly what
  // the eye expects — regardless of which sentence it belongs to.
  // The word below might be the next sentence (or even two sentences
  // later) but the cursor jumps where the reader is looking. Because
  // we measure live getBoundingClientRect() values, changing font
  // size / line height re-flows the text and the next ↓ press picks
  // the newly-below word automatically.
  function navVertical(dir) {
    // No word focused yet → land on the first word of the current page,
    // matching navWord's default-focus behaviour.
    if (focusedSentIdx == null) {
      const first = document.querySelector('.wc-sentence .w[data-w-idx="0"]');
      if (first) {
        const sentEl = first.closest('.wc-sentence');
        focusWord(parseInt(sentEl.dataset.idx, 10), 0);
      }
      return;
    }
    const sentEl = document.querySelector(`.wc-sentence[data-idx="${focusedSentIdx}"]`);
    if (!sentEl) return;
    const wordEl = sentEl.querySelector(`.w[data-w-idx="${focusedWordIdx}"]`);
    if (!wordEl) return;

    const curRect = wordEl.getBoundingClientRect();
    const curCx   = curRect.left + curRect.width / 2;

    // Filter to words on a DIFFERENT visual line in the right direction.
    // "Different line" = the candidate's vertical span doesn't overlap
    // the current word's span (1 px slack). This lets wrapped lines of
    // a long sentence count individually instead of being treated as one.
    const allWords = Array.from(document.querySelectorAll('#lessonBody .w:not(.punct)'));
    const candidates = [];
    for (const w of allWords) {
      if (w === wordEl) continue;
      const r = w.getBoundingClientRect();
      if (dir > 0) {
        if (r.top < curRect.bottom - 1) continue;     // same line or above
      } else {
        if (r.bottom > curRect.top + 1) continue;     // same line or below
      }
      candidates.push({ w, r });
    }

    if (candidates.length) {
      // Pick the NEAREST line in the chosen direction (smallest gap
      // between current word's edge and candidate's edge). Then among
      // candidates on that same nearest line, pick the one whose centre
      // X is closest to the current centre X — i.e. directly above/below.
      const gap = (c) => dir > 0
        ? c.r.top    - curRect.bottom
        : curRect.top - c.r.bottom;
      candidates.sort((a, b) => gap(a) - gap(b));
      const nearestGap = gap(candidates[0]);
      // Line tolerance — words on the same line can sit ±a few px due
      // to descenders / superscripts. Use half the current word's
      // height (~half a typical line-height) as the band.
      const lineTol = Math.max(4, curRect.height * 0.5);
      const sameLine = candidates.filter(c => gap(c) - nearestGap <= lineTol);
      sameLine.sort((a, b) => {
        const ax = a.r.left + a.r.width / 2;
        const bx = b.r.left + b.r.width / 2;
        return Math.abs(ax - curCx) - Math.abs(bx - curCx);
      });
      const picked = sameLine[0].w;
      const newSentEl = picked.closest('.wc-sentence');
      if (!newSentEl) return;
      const newSentIdx = parseInt(newSentEl.dataset.idx, 10);
      const newWordIdx = parseInt(picked.dataset.wIdx, 10);
      if (Number.isNaN(newSentIdx) || Number.isNaN(newWordIdx)) return;
      focusWord(newSentIdx, newWordIdx);
      return;
    }

    // No word above/below on this page — flip page and land on the
    // boundary word, mirroring what navWord does at sentence/page edges.
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

  // Measurement-based pagination — walks every page, renders its HTML
  // into the live #lessonBody, and if `scrollHeight > clientHeight`
  // splits the children at the last one that fully fits. The overflow
  // children become a new page, inserted right after. Single-mode is
  // skipped (only one sentence shown, no overflow concern).
  //
  // Idempotent: pages already small enough don't change. Plain-text
  // pages skip too — they're sentence/word objects that we'd have to
  // re-tokenise to split. For now those rely on the 6-sentence cap.
  // Re-run the full pagination pipeline from the unchanged body
  // source. Used when the student changes font size / line height —
  // without this, a previously-split page can never re-merge (the
  // overflow splitter only adds pages, never removes them). Calling
  // this after a font shrink lets the next page's content flow back
  // onto the previous one, matching the user's request:
  //   "글자를 줄이면 다음 페이지의 글자가 interactive하게 그전
  //    페이지에 붙도록 해."
  function repaginateFromScratch() {
    if (!lesson || lesson.body == null) return;
    const bodyEl = $('lessonBody');
    // Hide instantly (no transition) while we re-tokenise and
    // re-measure. Without this the user sees a brief flash of the
    // pre-paginated full body just before `repaginateOverflow`
    // trims it back down — "글자크기 변경 버튼이나 행간 변경
    // 버튼 누르면 일시적으로 그 아래 글이 보였다가 빠르게 사라져".
    if (bodyEl) bodyEl.classList.add('wc-reflowing');

    const rememberedPage   = pageIdx;
    const rememberedSingle = singleIdx;
    sentences = tokeniseBody(lesson.body);
    pages     = paginate(sentences, lesson.body);
    pageIdx   = Math.min(rememberedPage, pages.length - 1);
    singleIdx = rememberedSingle;
    renderBody();
    refreshPageCounter();
    refreshNavBoundary();
    // Wait one frame so the new font/line-height has been painted
    // before we measure overflow, then reveal the body again.
    requestAnimationFrame(() => {
      repaginateOverflow();
      // A second frame guarantees the post-split layout has been
      // committed before we drop the .wc-reflowing class — no
      // intermediate state ever paints.
      requestAnimationFrame(() => {
        if (bodyEl) bodyEl.classList.remove('wc-reflowing');
      });
    });
  }

  function repaginateOverflow() {
    if (singleMode) return;
    // Continuous-scroll mode has no card-height constraint — every
    // page flows in one column — so there is nothing to split. Just
    // re-fit the comic bubbles (this path is also the resize hook).
    if (scrollMode) { requestAnimationFrame(fitAllBubbles); return; }
    const bodyEl = $('lessonBody');
    if (!bodyEl) return;

    // We mutate `pages` in place; track which page we're examining.
    // Re-examine after a split because the new fragment might also
    // overflow (in extreme cases — e.g. a single very long paragraph).
    let p = 0;
    let guard = 0;            // hard cap, prevents infinite loops
    while (p < pages.length && guard < 50) {
      guard++;
      const parts = pages[p];
      // Only paginate HTML pages here. Plain text relies on the
      // sentence-count split + line-height heuristic.
      if (!parts || parts.length !== 1 || parts[0].kind !== 'html') {
        p++; continue;
      }
      // Render this page into the live body so we measure with the
      // real font / line-height / column width.
      bodyEl.innerHTML = parts[0].html;
      tokenizeTextNodesInPlace(bodyEl, globalStartOfPage(p));

      const cardH = bodyEl.clientHeight;
      // Treat the bottom padding (and a tiny extra safety margin)
      // as off-limits. Without this, a sentence whose top fits but
      // whose bottom dips into the padding gets visually clipped —
      // student sees just the top half of the last line. The user
      // explicitly reported this ("마지막 문장이 밑에 여백에 가려").
      const cs            = getComputedStyle(bodyEl);
      const paddingBottom = parseFloat(cs.paddingBottom) || 0;
      const safety        = Math.max(12, paddingBottom);
      const visibleH      = Math.max(0, cardH - safety);

      if (bodyEl.scrollHeight <= visibleH + 2) { p++; continue; }

      // Walk top-level children and find the first one whose bottom
      // edge sits past the safe visible area.
      const children = Array.from(bodyEl.children);
      let cutoff = -1;
      for (let i = 0; i < children.length; i++) {
        const c = children[i];
        if (c.offsetTop + c.offsetHeight > visibleH) { cutoff = i; break; }
      }
      // Heading-orphan rule (print typography 101): a heading must
      // not be left alone at the bottom of a page. If the last
      // FITTED element is a heading (or only whitespace/empties
      // follow the heading), demote it to the overflow page so it
      // stays glued to the content it titles.
      //
      // Triggered most often by the "## Title\n[[IMG:0]]\nText"
      // pattern: the <p> with the floated image + text is tall, so
      // the measurement split lands right after <h2> and the
      // heading sits alone on its own page.
      const originalCutoff = cutoff;
      while (cutoff > 0) {
        const lastFitted = children[cutoff - 1];
        const tag = lastFitted && lastFitted.tagName;
        const isHeading = tag && /^H[1-6]$/.test(tag);
        // Treat an "empty" tail (HR, or a <p> that became empty
        // after image-marker stripping) as transparent — keep
        // walking back so the real preceding heading gets caught.
        const isEmpty = lastFitted
          && !(lastFitted.textContent || '').trim()
          && !lastFitted.querySelector('img');
        if (isHeading || isEmpty) cutoff--;
        else break;
      }
      // If pulling the heading down would empty the page entirely
      // (the heading was the FIRST child on this page already),
      // accept the orphan — a page with nothing on it is worse
      // than a heading-only page.
      if (cutoff <= 0) cutoff = originalCutoff;
      // Edge case: even the first child overflows on its own. Split
      // that single block at SENTENCE boundaries so the early
      // sentences stay on this page and the rest move to the next.
      // Without this branch a long paragraph with no preceding
      // siblings would be visually clipped.
      if (cutoff <= 0) {
        const onlyChild = children[0];
        const sentSpans = onlyChild ? Array.from(onlyChild.querySelectorAll('.wc-sentence')) : [];
        if (sentSpans.length >= 2) {
          // Walk the sentence spans inside the block. We need the
          // span's bottom edge in *body* coordinates — since the
          // block sits at the body's top edge that's just
          // span.offsetTop + span.offsetHeight when the block is
          // its offsetParent. Use getBoundingClientRect for safety
          // (works regardless of nested offsetParent chains).
          const bodyTop = bodyEl.getBoundingClientRect().top;
          let splitAt = -1;
          for (let s = 0; s < sentSpans.length; s++) {
            const r = sentSpans[s].getBoundingClientRect();
            const bottomRelToBody = r.bottom - bodyTop;
            if (bottomRelToBody > visibleH) { splitAt = s; break; }
          }
          if (splitAt > 0) {
            // Build a sibling-of-the-block: same tagName, holding the
            // overflow sentences. Whitespace between spans (text
            // nodes for spacing) goes with the FOLLOWING sentence so
            // each new block starts with the sentence text only.
            const overflowBlock = onlyChild.cloneNode(false);
            // Move sentence spans + their trailing whitespace nodes.
            const toMove = [];
            for (let s = splitAt; s < sentSpans.length; s++) {
              toMove.push(sentSpans[s]);
            }
            // Also move any text/inline nodes that come AFTER the
            // first moved span (within the same parent) so spaces
            // between sentences carry over too.
            const firstMove = toMove[0];
            let walker = firstMove;
            const collected = [];
            while (walker) {
              collected.push(walker);
              walker = walker.nextSibling;
            }
            collected.forEach(n => overflowBlock.appendChild(n));
            const fittedHtml   = onlyChild.outerHTML;
            const overflowHtml = overflowBlock.outerHTML
              + children.slice(1).map(c => c.outerHTML).join('');
            parts[0].html      = fittedHtml;
            parts[0].sentences = extractSentencesFromSegmentHtml(fittedHtml);
            const newPart = {
              kind: 'html',
              html: overflowHtml,
              sentences: extractSentencesFromSegmentHtml(overflowHtml),
            };
            pages.splice(p + 1, 0, [newPart]);
            continue;
          }
        }
        // Truly nothing splittable (one-sentence block taller than
        // the page) — accept the clip and move on.
        p++; continue;
      }

      const fittedHtml   = children.slice(0, cutoff).map(c => c.outerHTML).join('');
      const overflowHtml = children.slice(cutoff).map(c => c.outerHTML).join('');

      parts[0].html      = fittedHtml;
      parts[0].sentences = extractSentencesFromSegmentHtml(fittedHtml);

      const newPart = {
        kind: 'html',
        html: overflowHtml,
        sentences: extractSentencesFromSegmentHtml(overflowHtml),
      };
      pages.splice(p + 1, 0, [newPart]);
      // Loop continues to re-check `p` — the just-trimmed page should
      // now fit; the loop will advance to the new overflow page next.
    }

    // Finished mutating — re-render the page the user is currently on
    // (or page 0 if the active page got shifted out).
    pageIdx = Math.max(0, Math.min(pageIdx, pages.length - 1));
    renderBody();
    refreshPageCounter();
    refreshNavBoundary();
  }

  // Re-extract sentences from a slice of segment HTML — used by
  // repaginateOverflow when a page gets split. Mirrors the walk in
  // tokeniseHtmlBody so the flat sentence list stays accurate for
  // 1문장씩 mode and TTS auto-advance.
  function extractSentencesFromSegmentHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const flat = [];
    const BLOCK_TAGS = /^(P|H[1-6]|LI|BLOCKQUOTE|FIGCAPTION|TD|TH)$/;

    // 1) Fast path — the HTML is the rendered DOM (sentence spans
    //    already in place). Re-use those directly so we don't
    //    explode each word into its own "sentence" again.
    const existingSpans = tmp.querySelectorAll('.wc-sentence');
    if (existingSpans.length) {
      existingSpans.forEach(span => {
        const text = (span.dataset && span.dataset.text)
          ? span.dataset.text
          : (span.textContent || '');
        const clean = text.replace(IMG_MARKER_STRIP_RE, ' ').trim();
        if (!clean) return;
        flat.push({ kind: 'sent', text: clean, words: extractWordTokens(clean) });
      });
      return flat;
    }

    // 2) Slow path — raw segment HTML (no sentence spans yet).
    //    Mirrors tokeniseBody's per-block walk so the flat list
    //    here matches the one the original pagination built.
    function visit(node) {
      if (!node) return;
      if (node.nodeType === 1) {
        const tag = node.tagName;
        if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE'
            || tag === 'UL' || tag === 'OL') {
          Array.from(node.childNodes).forEach(visit);
          return;
        }
        if (BLOCK_TAGS.test(tag)) {
          pushFromText(node.textContent || '');
          return;
        }
        return;
      }
      if (node.nodeType === 3) pushFromText(node.textContent || '');
    }
    function pushFromText(raw) {
      const text = (raw || '').replace(IMG_MARKER_STRIP_RE, ' ');
      if (!text || !text.trim()) return;
      splitSentencesSafe(text).forEach(s => {
        flat.push({ kind: 'sent', text: s.text, words: extractWordTokens(s.text) });
      });
    }
    Array.from(tmp.childNodes).forEach(visit);
    return flat;
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
    // Always start from the top of the current page (in single mode,
    // the visible sentence). The previously-focused word doesn't
    // anchor playback any more — pressing ▶ on a page reads that
    // whole page from the beginning, matching the teacher's mental
    // model of "play this page's audio".
    let i = singleMode ? singleIdx : globalStartOfPage(pageIdx);

    for (; i < flat.length; i++) {
      if (ttsAbort) break;

      // If this sentence lives on a different page (HTML body with
      // page-break markers, or plain-text overflow page), flip first.
      if (!singleMode) {
        const sentPage = pageForGlobalSent(i);
        if (sentPage != null && sentPage !== pageIdx) {
          if (scrollMode) {
            // Scroll mode — every page is already mounted; just keep
            // the counter honest, the scrollIntoView below moves the
            // viewport to the sentence.
            pageIdx = sentPage;
            refreshPageCounter();
          } else {
            goPage(sentPage);
            // Wait for the slide animation (~460 ms) so the new DOM is
            // mounted before we try to find the sentence span.
            await new Promise(r => setTimeout(r, 500));
          }
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
    // Match the static English title set in lesson.html (the markup
    // was previously Korean — we mirror the new "Pause" / "Play"
    // wording here so screen-readers stay in sync with the button's
    // visible state.)
    btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    btn.setAttribute('title',      playing ? 'Pause (spacebar)' : 'Play / pause whole-lesson audio (spacebar)');
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
        // Default = the FIRST sentence of the page the student is on
        // (not the global first). If they tapped a word just before
        // toggling, honour THAT sentence instead. lastSelectedSentenceIdx
        // is initialised to 0, so a never-tapped state correctly falls
        // back to the page-start (||-fallback).
        const pageStart = globalStartOfPage(pageIdx);
        singleIdx = lastSelectedSentenceIdx || pageStart;
      }
      refreshSingleMode();
      // Flash the bottom counter — refreshPageCounter has just swapped
      // its text between "page 3/17" and "sentence 12/84"; the glow
      // matches the cue students get when they tap ‹/› vs ‹‹/›› in
      // page mode, signalling the counter just changed meaning.
      flashCounter();
    });

    // ── Reading-comfort controls: font size +/- and "Read Better"
    // (dyslexia-friendly font). Settings persist per-device.
    const FONT_KEY = 'wc.fontSize.v1';
    const READ_KEY = 'wc.readBetter.v1';
    const BASE_FONT = 20;
    let fontSize = parseInt(localStorage.getItem(FONT_KEY), 10);
    if (!Number.isFinite(fontSize) || fontSize < 14 || fontSize > 40) fontSize = BASE_FONT;
    function applyFontSize() {
      document.documentElement.style.setProperty('--wc-body-font', fontSize + 'px');
      try { localStorage.setItem(FONT_KEY, String(fontSize)); } catch {}
      // After font changes, page heights shift — repaginate from
      // scratch so overflow that previously got split into another
      // page can FLOW BACK if there's now room. (Plain
      // repaginateOverflow only splits, never merges.)
      requestAnimationFrame(() => {
        if (singleMode) { fitSingleSentenceToCard(); return; }
        repaginateFromScratch();
      });
    }
    applyFontSize();
    $('btnFontMinus').addEventListener('click', () => {
      fontSize = Math.max(14, fontSize - 2);
      applyFontSize();
    });
    $('btnFontPlus').addEventListener('click', () => {
      fontSize = Math.min(40, fontSize + 2);
      applyFontSize();
    });

    // Line-spacing controls (↕−/↕+). Stored in localStorage so the
    // student's chosen breathing-room follows them across lessons,
    // exactly like font-size. Range clamps prevent the lines from
    // collapsing on top of each other or stretching off the page.
    const LH_KEY  = 'wc.lineHeight.v1';
    const LH_MIN  = 1.4;
    const LH_MAX  = 3.6;
    const LH_STEP = 0.2;
    const LH_BASE = 2.4;
    let lineHeight = parseFloat(localStorage.getItem(LH_KEY));
    if (!Number.isFinite(lineHeight) || lineHeight < LH_MIN || lineHeight > LH_MAX) {
      lineHeight = LH_BASE;
    }
    function applyLineHeight() {
      document.documentElement.style.setProperty('--wc-body-lh', lineHeight.toFixed(2));
      try { localStorage.setItem(LH_KEY, String(lineHeight)); } catch {}
      // Tightening line-spacing means more text now fits per page;
      // loosening means less fits. Re-build pagination from the
      // unchanged body source so sentences flow naturally between
      // pages in either direction.
      requestAnimationFrame(() => {
        if (singleMode) { fitSingleSentenceToCard(); return; }
        repaginateFromScratch();
      });
    }
    applyLineHeight();
    $('btnLhMinus').addEventListener('click', () => {
      lineHeight = Math.max(LH_MIN, +(lineHeight - LH_STEP).toFixed(2));
      applyLineHeight();
    });
    $('btnLhPlus').addEventListener('click', () => {
      lineHeight = Math.min(LH_MAX, +(lineHeight + LH_STEP).toFixed(2));
      applyLineHeight();
    });

    let readBetter = localStorage.getItem(READ_KEY) === '1';
    function applyReadBetter() {
      document.body.classList.toggle('wc-readable-font', readBetter);
      $('btnReadBetter').classList.toggle('active', readBetter);
      $('btnReadBetter').setAttribute('aria-pressed', readBetter ? 'true' : 'false');
      try { localStorage.setItem(READ_KEY, readBetter ? '1' : '0'); } catch {}
      // Dyslexic font changes per-character width — rebuild pages
      // from scratch so they re-fit the new measurements (sentences
      // flow back to earlier pages if they now fit).
      requestAnimationFrame(() => {
        if (singleMode) { fitSingleSentenceToCard(); return; }
        repaginateFromScratch();
      });
    }
    applyReadBetter();
    $('btnReadBetter').addEventListener('click', () => {
      readBetter = !readBetter;
      applyReadBetter();
    });

    // Animal encounter toggle — pauses the quiz/encounter system so
    // the student can read quietly without random animals popping
    // up. State stored per-device in localStorage; encounter.js
    // reads the flag fresh on every level-up event so this button
    // takes effect immediately without a page reload.
    const HIDE_ENC_KEY = 'wc.hideEncounters.v1';
    // Initial state — the class-level "Start with Animals [On/Off]"
    // toggle (Settings) is now the SINGLE source of truth for every
    // lesson, new or already-studied. Per-lesson `default_animals`
    // is intentionally ignored: the teacher's class toggle should
    // flip every lesson's default in one click. The per-device
    // localStorage is also NOT consulted on init — without that,
    // a student who once toggled 🐾 off would stay OFF forever
    // even after the teacher flips the class toggle. The 🐾 chip
    // still toggles live within the session.
    let hideEncounters = !!(classFlags && classFlags.lessonsAnimalsDefaultOff);
    // Override the placeholder WCLesson.encountersHidden — it was set
    // up top, BEFORE this let-scoped flag existed, so its arrow
    // referenced an out-of-scope `hideEncounters` and THREW on every
    // call. encounter.js calls it on every wc:level-up, so the throw
    // aborted the handler and no quiz ever fired. Re-point it at the
    // live flag the 🐾 chip toggles.
    if (window.WCLesson) {
      window.WCLesson.encountersHidden = () => hideEncounters;
    }
    function applyHideEncounters() {
      const btn = $('btnHideEncounters');
      const ico = $('btnHideEncountersIco');
      const lbl = $('btnHideEncountersLabel');
      if (!btn) return;
      btn.classList.toggle('active', hideEncounters);
      btn.setAttribute('aria-pressed', hideEncounters ? 'true' : 'false');
      // Icon stays the paw 🐾 in both states; the label (off / on)
      // plus the .active class carry the state. "Animals" text dropped.
      if (ico) ico.textContent = '🐾';
      if (lbl) lbl.textContent = hideEncounters ? 'off' : 'on';
      // The 🐾 chip is session-only — its state is never persisted to
      // localStorage. Clear any leftover from the previous behaviour
      // so a stale '1' can't sneak into encounter.js's early-init
      // fallback path before WCLesson installs.
      try { localStorage.removeItem(HIDE_ENC_KEY); } catch {}
    }
    applyHideEncounters();
    if ($('btnHideEncounters')) {
      $('btnHideEncounters').addEventListener('click', () => {
        hideEncounters = !hideEncounters;
        applyHideEncounters();
      });
    }

    // ── Header collapse (⌃ / ⌄ next to the title). Hides the whole
    // toolbar so the reading text gets more room. Default = shown.
    // Persists per device.
    const HEAD_KEY = 'wc.headCollapsed.v1';
    // On mobile, ALWAYS start with the toolbar collapsed — the student
    // sees just the title + ⌃ expand button, with the reading body
    // taking up the full viewport. Tapping ⌃ opens the toolbar for the
    // session; next lesson load goes back to collapsed.  Desktop
    // respects the stored per-device preference as before.
    let headCollapsed = window.matchMedia('(max-width: 900px)').matches
      ? true
      : (localStorage.getItem(HEAD_KEY) === '1');
    function applyHeadCollapsed() {
      document.body.classList.toggle('wc-head-collapsed', headCollapsed);
      const b = $('btnHeadCollapse');
      if (b) {
        // NOTE: do NOT touch b.textContent — the button holds two
        // inline SVG icons (.ht-coll-open / .ht-coll-closed) and CSS
        // swaps which is visible based on body.wc-head-collapsed.
        // Overwriting textContent would wipe both SVGs and leave the
        // button blank.
        b.setAttribute('aria-expanded', headCollapsed ? 'false' : 'true');
        b.title = headCollapsed ? 'Show the toolbar' : 'Hide the toolbar';
      }
      try { localStorage.setItem(HEAD_KEY, headCollapsed ? '1' : '0'); } catch {}
    }
    applyHeadCollapsed();
    if ($('btnHeadCollapse')) {
      $('btnHeadCollapse').addEventListener('click', () => {
        headCollapsed = !headCollapsed;
        applyHeadCollapsed();
      });
    }

    // ── Aa — reveals / hides the text-size + line-spacing controls
    // (A−/A+/↕−/↕+). Default = hidden, so only [Aa] shows. Per device.
    const FZ_OPEN_KEY = 'wc.textOptsOpen.v1';
    let fzOpen = localStorage.getItem(FZ_OPEN_KEY) === '1';
    function applyFzOpen() {
      document.body.classList.toggle('wc-fz-open', fzOpen);
      const b = $('btnTextOpts');
      if (b) {
        b.classList.toggle('active', fzOpen);
        b.setAttribute('aria-pressed', fzOpen ? 'true' : 'false');
      }
      try { localStorage.setItem(FZ_OPEN_KEY, fzOpen ? '1' : '0'); } catch {}
    }
    applyFzOpen();
    if ($('btnTextOpts')) {
      $('btnTextOpts').addEventListener('click', () => {
        fzOpen = !fzOpen;
        applyFzOpen();
      });
    }

    // ── Kor Bar / Eng Bar — sidebar language toggle. Default = Kor.
    // The Korean sidebar content arrives in a later phase; for now
    // this persists the choice and flags <body> (wc-bar-kor /
    // wc-bar-eng) so that phase can hook in.
    const BAR_LANG_KEY = 'wc.barLang.v1';
    let barLang = localStorage.getItem(BAR_LANG_KEY) === 'eng' ? 'eng' : 'kor';
    function applyBarLang() {
      document.body.classList.toggle('wc-bar-kor', barLang === 'kor');
      document.body.classList.toggle('wc-bar-eng', barLang === 'eng');
      const lbl = $('btnBarLangLabel');
      if (lbl) lbl.textContent = barLang === 'kor' ? 'Kor Bar' : 'Eng Bar';
      try { localStorage.setItem(BAR_LANG_KEY, barLang); } catch {}
      // Tell the sidebar to re-render the current word in the new
      // language (sidebar.js listens — Phase 3 Kor Bar).
      window.dispatchEvent(new CustomEvent('wc:bar-lang-changed',
        { detail: { lang: barLang } }));
    }
    applyBarLang();
    if ($('btnBarLang')) {
      $('btnBarLang').addEventListener('click', () => {
        barLang = barLang === 'kor' ? 'eng' : 'kor';
        applyBarLang();
      });
    }

    // ── Continuous-scroll toggle (⬇ off / on, next to Kor Bar).
    // ON drops pagination and flows the whole lesson in one
    // scrollable column. Resolution order for the initial state
    // mirrors the 🐾 / Play-chunk chips:
    //   1. per-lesson default_scroll (teacher's choice on upload)
    //   2. per-device localStorage override
    //   3. out-of-the-box default — ON for comic lessons (panels
    //      read best stacked), OFF for text / song lessons.
    const SCROLL_KEY = 'wc.scrollMode.v1';
    if (lesson && typeof lesson.default_scroll === 'boolean') {
      scrollMode = lesson.default_scroll;
    } else {
      const stored = localStorage.getItem(SCROLL_KEY);
      if (stored === '1')      scrollMode = true;
      else if (stored === '0') scrollMode = false;
      else                     scrollMode = !!(lesson && lesson.mode === 'comic');
    }
    function applyScrollMode() {
      document.body.classList.toggle('wc-scroll-mode', scrollMode);
      const b = $('btnScrollMode'), lbl = $('btnScrollModeLabel');
      if (b) {
        b.classList.toggle('active', scrollMode);
        b.setAttribute('aria-pressed', scrollMode ? 'true' : 'false');
      }
      if (lbl) lbl.textContent = scrollMode ? 'on' : 'off';
    }
    applyScrollMode();
    // Watch the body scroll so scroll mode can flip pageIdx + fire
    // wc:page-advanced as the student scrolls (no-op when paginated).
    const scrollWatchEl = $('lessonBody');
    if (scrollWatchEl) scrollWatchEl.addEventListener('scroll', onBodyScroll);
    // The first renderBody() (init, before wireToolbar) drew the
    // paginated layout — rebuild as the scroll column now if that is
    // the resolved default. repaginateFromScratch re-tokenises and
    // re-renders via renderBody → renderScroll.
    if (scrollMode) repaginateFromScratch();
    if ($('btnScrollMode')) {
      $('btnScrollMode').addEventListener('click', () => {
        scrollMode = !scrollMode;
        try { localStorage.setItem(SCROLL_KEY, scrollMode ? '1' : '0'); } catch {}
        applyScrollMode();
        // Rebuild the body in the new mode. In scroll mode, land the
        // student on the page they were reading.
        repaginateFromScratch();
        if (scrollMode) {
          const tgt = document.querySelector(
            `.wc-scroll-page[data-page="${pageIdx}"]`);
          if (tgt) requestAnimationFrame(() =>
            tgt.scrollIntoView({ block: 'start' }));
        }
      });
    }

    // ── Record mode — reveals a per-sentence record button so the
    // student can record themselves reading. Session-only (default
    // off); leaving the mode aborts any take in progress.
    let recMode = false;
    function applyRecMode() {
      document.body.classList.toggle('wc-record-mode', recMode);
      const b = $('btnRecord');
      if (b) {
        b.classList.toggle('active', recMode);
        b.setAttribute('aria-pressed', recMode ? 'true' : 'false');
      }
      // The bottom nav bar swaps to the recording bar in record mode.
      const recBar = $('wcRecBar'), navBar = $('lessonBar');
      if (recBar) recBar.classList.toggle('wc-hidden', !recMode);
      if (navBar) navBar.classList.toggle('wc-hidden', recMode);
      if (!recMode) { stopActiveRecording(); stopRecPlaybackAll(); }
      else renderRecBar();
    }
    applyRecMode();
    if ($('btnRecord')) {
      $('btnRecord').addEventListener('click', () => {
        recMode = !recMode;
        applyRecMode();
      });
    }

    // Window resize — the card height changes (e.g. browser zoom,
    // window resize, mobile orientation). Re-fit the single-mode
    // sentence and re-paginate page mode. Debounced so a drag-resize
    // doesn't fire 60×/sec.
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (singleMode) fitSingleSentenceToCard();
        else            repaginateOverflow();
      }, 120);
    });

    // Per-lesson `default_play_chunk` set by the teacher in My
    // Lessons (true → Play chunk ON, false → muted). Missing/NULL
    // falls back to the out-of-the-box default (ON). Replaces the
    // module-level chunkMuted default before refreshMuteUi runs so
    // the chip paints correctly on the first frame. The matching
    // override for hideEncounters lives next to its own declaration
    // further down — can't touch it here because it's let-scoped
    // inside wireToolbar and not yet in scope.
    if (lesson && lesson.default_play_chunk === false) chunkMuted = true;
    else                                                chunkMuted = false;

    // Chunk-mute chip — toggles whether tapping a word triggers a
    // one-shot TTS read of its surrounding chunk. Default = Play
    // chunk ON (see chunkMuted declaration up top).
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

  // Persist the student's current page so the next visit resumes
  // here. Debounced — fast page-flipping shouldn't spam the DB —
  // and best-effort: a save failure (or missing table) is swallowed.
  let _progressSaveT = null;
  function saveProgress() {
    if (isPreview) return;
    clearTimeout(_progressSaveT);
    _progressSaveT = setTimeout(() => {
      Promise.resolve()
        .then(() => window.WCDB.progress.save(me.id, lessonId, pageIdx))
        .catch(() => { /* progress is best-effort */ });
    }, 1200);
  }

  // Highest global sentence index belonging to page `pi`.
  function lastSentOfPage(pi) {
    const total = sentenceList().length;
    if (!total) return 0;
    if (pi + 1 >= pages.length) return total - 1;
    return Math.max(0, globalStartOfPage(pi + 1) - 1);
  }

  // Announce that the student has moved FORWARD onto page `pi`.
  // encounter.js counts these to decide when an animal quiz appears
  // (page-boundary trigger — keeps the reading flow unbroken). Fires
  // once per newly-reached page; moving back never fires. TTS
  // auto-advance is excluded — a quiz must not talk over the reader.
  function notifyPageAdvance(pi) {
    if (!Number.isFinite(pi)) return;
    // Always extend the read-scope watermark, even on a backward
    // move or during TTS — the student HAS seen this far.
    maxSentReached = Math.max(maxSentReached, lastSentOfPage(pi));
    if (pi <= lastAdvancedPage) return;       // not a new forward page
    lastAdvancedPage = pi;
    // Cumulative reading odometer for the SDT reward fade — counts
    // every forward page, including TTS auto-advance (the student is
    // still reading along).
    bumpPagesRead();
    if (ttsPlaying) return;                   // don't interrupt playback
    window.dispatchEvent(new CustomEvent('wc:page-advanced', {
      detail: { page: pi, total: pages.length },
    }));
  }

  // Bump wc_users.total_pages_read — the reward-fade odometer. Keeps
  // the cached session in sync (so home.html's daily grant sees the
  // new total) and debounce-persists. Best-effort; mirrors
  // saveProgress / encounter.js bumpCoins. Skipped in preview mode.
  let _pagesReadSaveT = null;
  function bumpPagesRead() {
    if (isPreview || !me) return;
    me.total_pages_read = (me.total_pages_read || 0) + 1;
    try {
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw);
        u.total_pages_read = me.total_pages_read;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch {}
    clearTimeout(_pagesReadSaveT);
    _pagesReadSaveT = setTimeout(() => {
      Promise.resolve()
        .then(() => window.WCDB.users.update(me.id, { total_pages_read: me.total_pages_read }))
        .catch(() => { /* odometer is best-effort */ });
    }, 1200);
  }

  // Continuous-scroll mode — which page block currently fills the
  // top of the reading viewport (highest page whose top edge has
  // scrolled to/above the viewport top). Drives the bottom counter.
  function currentScrollPageIdx() {
    const body = $('lessonBody');
    if (!body) return pageIdx;
    const els = body.querySelectorAll('.wc-scroll-page');
    if (!els.length) return pageIdx;
    const bodyTop = body.getBoundingClientRect().top;
    let idx = 0;
    els.forEach(el => {
      if (el.getBoundingClientRect().top - bodyTop <= 12) {
        const p = parseInt(el.dataset.page, 10);
        if (Number.isFinite(p)) idx = p;
      }
    });
    return idx;
  }
  // Which "reading unit" the student has scrolled into — the page-turn
  // unit for the encounter trigger. For a COMIC lesson each panel
  // image counts as one page (teacher spec: "이미지 1개 = 1페이지"),
  // so we step over `.wc-panel`; otherwise over `.wc-scroll-page`.
  function currentAdvanceIdx() {
    const body = $('lessonBody');
    if (!body) return pageIdx;
    let units = body.querySelectorAll('.wc-panel');
    if (!units.length) units = body.querySelectorAll('.wc-scroll-page');
    if (!units.length) return pageIdx;
    const bodyTop = body.getBoundingClientRect().top;
    let idx = 0;
    units.forEach((el, n) => {
      if (el.getBoundingClientRect().top - bodyTop <= 12) idx = n;
    });
    return idx;
  }
  // Scroll handler (scroll mode only) — keeps pageIdx + the counter
  // in sync as the student scrolls, and fires wc:page-advanced when
  // they reach a new page. rAF-throttled so a scroll burst is cheap.
  let _scrollRaf = 0;
  function onBodyScroll() {
    if (!scrollMode || _scrollRaf) return;
    _scrollRaf = requestAnimationFrame(() => {
      _scrollRaf = 0;
      const idx = currentScrollPageIdx();
      if (idx !== pageIdx) {
        pageIdx = idx;
        saveProgress();
        refreshPageCounter();
        refreshNavBoundary();
        // Page-scoped state — repaint the play-all button so its
        // green-when-fully-recorded colour recalculates per page.
        try { refreshRecUi(); } catch {}
      }
      // Encounter trigger steps per reading unit — per comic panel,
      // or per scroll-page for prose.
      notifyPageAdvance(currentAdvanceIdx());
    });
  }

  function goPage(next) {
    if (!pages.length) return;
    const prev = pageIdx;
    pageIdx = Math.max(0, Math.min(pages.length - 1, next));
    if (pageIdx === prev) return;
    saveProgress();
    // Continuous-scroll mode — every page is already in the DOM, so
    // a "page flip" just scrolls that page's block to the top
    // instead of re-rendering with the slide animation. The scroll
    // listener (onBodyScroll) fires wc:page-advanced for scroll mode,
    // so goPage does NOT fire it here — that would double-count.
    if (scrollMode) {
      singleIdx = globalStartOfPage(pageIdx);
      refreshPageCounter();
      refreshNavBoundary();
      // Page changed → repaint the play-all button (green/blue).
      try { refreshRecUi(); } catch {}
      const tgt = document.querySelector(
        `.wc-scroll-page[data-page="${pageIdx}"]`);
      if (tgt) { try { tgt.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} }
      return;
    }
    // In single-mode, flipping pages with ‹‹ / ›› should land the
    // student on THAT page's first sentence — not reset to the
    // global first sentence (which is what `singleIdx = 0` did, so
    // every page-flip in single mode appeared to "stay on the same
    // sentence" because index 0 is always the lesson's opening line).
    singleIdx = globalStartOfPage(pageIdx);
    // Update the counter NOW (don't wait for the 180-ms slide).
    refreshPageCounter();
    // Page changed → repaint the play-all button (green/blue).
    try { refreshRecUi(); } catch {}
    // Paginated mode — a goPage IS the page turn (no scroll listener).
    notifyPageAdvance(pageIdx);
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
    // 1-Sentence mode has no page chrome, but crossing into a new
    // page still counts as a page turn for the encounter trigger.
    const pg = pageForGlobalSent(singleIdx);
    if (pg != null) notifyPageAdvance(pg);
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
