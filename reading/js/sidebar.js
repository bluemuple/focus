// =============================================================
//  WordCatch — lesson sidebar (또박또박-style word-detail panel)
//
//  New layout (Phase: word-detail-sidebar):
//    1. Word card           — selected word's dictionary entry
//       · headword + 🔊 pronunciation
//       · IPA (compact)
//       · Year-3 definition (matches sentence sense)
//       · "Often used with…" collocations
//       · Ice-cream level picker (silhouette → colour when picked)
//    2. Imagine this! — kept (student → teacher gift loop)
//    3. From my teacher — kept (replies + auto-catch animals)
//
//  Removed (per spec): "Next animal" progress, "My words" ice cream
//  stats. The selected-word card is now the primary focus.
//
//  Drives off `wc:word-selected` events fired by lesson.js. Reads
//  per-word levels from WCLesson.wordLevels, writes through the
//  same upsert path lesson.js uses.
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', () => setTimeout(initWhenReady, 0));
  if (document.readyState !== 'loading') setTimeout(initWhenReady, 0);

  function initWhenReady() {
    if (!window.WCLesson || !window.WCLesson.me || !window.WCLesson.lesson) {
      setTimeout(initWhenReady, 100);
      return;
    }
    init(window.WCLesson);
  }

  let lessonRef = null;
  let selectedWord = null;   // { word, lower, sentence } — last clicked
  let activeInfo   = null;   // most recent dictionary entry

  function init(L) {
    lessonRef = L;
    const flags = L.classFlags || {};

    renderWordCard(null);   // initial empty-state
    renderLevelBar();       // initial hidden state

    // Preview mode (opened from teacher dashboard's "Preview" button)
    // shouldn't show student-specific panels — there's no student to
    // send a viz prompt FROM, and no teacher to send replies TO.
    if (L.isPreview || flags.hideVisualizationSidebar) {
      const v = document.getElementById('sideViz');
      const r = document.getElementById('sideReplies');
      if (v) v.classList.add('wc-hidden');
      if (r) r.classList.add('wc-hidden');
    } else {
      renderVizForm(L);
      renderReplies(L);
      window.WCDB.realtime.pollViz(L.me.id,
        new Date(Date.now() - 24*3600*1000).toISOString(),
        (msg) => onReplyArrived(L, msg));
    }

    // Wired from lesson.js — fires whenever a word is tapped. The
    // closure captures `d.lower` so we can detect "did the user
    // click another word while this fetch was in flight?" — if so
    // we drop the late response so the sidebar never flashes the
    // wrong word's definition + collocations.
    window.addEventListener('wc:word-selected', (e) => {
      const d = e.detail || {};
      selectedWord = { word: d.word, lower: d.lower, sentence: d.sentence };
      activeInfo = null;        // wipe old info immediately
      renderWordCard({ loading: true });
      renderLevelBar();
      const wantedLower    = d.lower;
      const wantedSentence = d.sentence || '';
      window.WCWordInfo.fetch(d.word, d.sentence).then(info => {
        // Bail if the user has since clicked another word OR even
        // re-clicked the same word in a different sentence (sense
        // disambiguation needs a fresh fetch for that case).
        if (!selectedWord) return;
        if (selectedWord.lower    !== wantedLower)    return;
        if ((selectedWord.sentence || '') !== wantedSentence) return;
        activeInfo = info;
        renderWordCard({ info });
      });
    });
    // Esc — clear sidebar selection, revert to empty state.
    window.addEventListener('wc:word-deselected', () => {
      selectedWord = null;
      activeInfo   = null;
      renderWordCard(null);
      renderLevelBar();
    });
    // Level changes (from lesson.js or this sidebar) → refresh picker.
    L.onWordLevelChange(({ word }) => {
      if (selectedWord && word === selectedWord.lower) {
        renderWordCard({ info: activeInfo });
        renderLevelBar();
      }
    });
  }

  // ============================================================
  //  PANEL 1 — Word card
  // ============================================================
  function renderWordCard(state) {
    const wrap = $('sideWord');
    if (!wrap) return;

    // Empty state — no word picked yet.
    if (!state) {
      wrap.innerHTML = `
        <div class="wc-word-empty">
          <div class="wc-word-empty-icon">📖</div>
          <p>Tap any word in the lesson<br>to see what it means!</p>
        </div>
      `;
      return;
    }

    const w = selectedWord || {};
    const info = state.info;
    const isLoading = state.loading;

    const currentLevel = lessonRef.wordLevels.has(w.lower)
      ? lessonRef.wordLevels.get(w.lower) : null;

    // `pronunciation` is the new UFLI Foundations field; fall back to
    // legacy `ipa` if an older cache row from the v1 schema returns.
    const pron = info?.pronunciation || info?.ipa || '';

    // Show the headword AS THE STUDENT TAPPED IT (inflected form),
    // with the inflection suffix coloured sky-blue à la 또박또박. This
    // makes the lemma↔inflection split visually obvious — e.g.
    //   "consult" + "ed"   → "consult<sky>ed</sky>"
    //   "book"    + "s"    → "book<sky>s</sky>"
    //   "run"     + "ning" → "run<sky>ning</sky>"
    // Irregular forms (went / go, was / be) get no overlap → we just
    // show the inflected form plain (no false split).
    const headHtml = inflectionHtml(w.word || '', info?.lemma || '');

    wrap.innerHTML = `
      <div class="wc-word-card">
        <div class="wc-word-head">
          <div class="wc-word-text">
            <h2>${headHtml}</h2>
            ${pron ? `<div class="wc-word-ipa">${escapeHtml(pron)}</div>` : ''}
          </div>
          <button class="wc-word-tts" id="wcWordTts" title="Hear it">🔊</button>
        </div>

        ${isLoading
          ? `<div class="wc-word-loading">Looking it up…</div>`
          : info
            ? `
              <div class="wc-word-def">${escapeHtml(info.definition)}</div>
              ${findWordImage(w.lower)
                ? `<div class="wc-word-image-wrap">
                    <img class="wc-word-image" src="${findWordImage(w.lower)}" alt="${escapeHtml(w.lower)}" />
                  </div>`
                : ''}
              ${info.collocations && info.collocations.length ? `
                <div class="wc-word-collo-title">Often used with:</div>
                <ul class="wc-word-collo">
                  ${info.collocations.map(c => `
                    <li>
                      <strong>${escapeHtml(c.phrase)}</strong>
                      ${c.gloss ? ` — <span class="wc-muted">${escapeHtml(c.gloss)}</span>` : ''}
                    </li>
                  `).join('')}
                </ul>
              ` : ''}
            `
            : `<div class="wc-muted">Couldn't fetch info. Try tapping again!</div>`
        }
      </div>
    `;

    const tts = $('wcWordTts');
    if (tts) tts.addEventListener('click', () => {
      if (window.WCTTS) window.WCTTS.speak(info?.lemma || w.word || '').catch(()=>{});
    });
  }

  // ============================================================
  //  Bottom-fixed level bar — 또박또박 design (🗑 1 2 3 4 ✓)
  //
  //  Six round 36-px buttons, centered, with the active level
  //  filled green. Tooltips on hover via data-tip. Mirrors the
  //  parent site's .ls-bottom-fixed strip pixel-for-pixel so
  //  students switching between the two sites see one design.
  // ============================================================
  function renderLevelBar() {
    const wrap = document.getElementById('sideLevelBar');
    if (!wrap) return;
    // The strip is ALWAYS visible — when no word is selected the
    // six buttons render disabled so the row stays as a steady visual
    // anchor at the bottom of the sidebar (matches 또박또박's
    // .ls-bottom-fixed which never collapses).
    wrap.hidden = false;

    const currentLevel = selectedWord && lessonRef.wordLevels.has(selectedWord.lower)
      ? lessonRef.wordLevels.get(selectedWord.lower) : null;

    // [-1, 1, 2, 3, 4, 5] → six buttons. Inner glyphs match 또박또박:
    //   -1 = 🗑, 1-4 = digit, 5 = ✓
    const buttons = [
      { state: -1, label: '🗑', cls: 'ignore', tip: '무시 (Skip) · 0' },
      { state:  1, label: '1',  cls: '',        tip: 'Level 1 · 1' },
      { state:  2, label: '2',  cls: '',        tip: 'Level 2 · 2' },
      { state:  3, label: '3',  cls: '',        tip: 'Level 3 · 3' },
      { state:  4, label: '4',  cls: '',        tip: 'Level 4 · 4' },
      { state:  5, label: '✓', cls: 'known',   tip: 'I know it! · 5' },
    ];

    const noWord = !selectedWord;
    wrap.innerHTML = `
      <div class="level-bar">
        ${buttons.map(b => `
          <button class="lv-btn ${b.cls} ${b.state === currentLevel ? 'active' : ''}"
                  data-state="${b.state}" data-tip="${b.tip}"
                  ${noWord ? 'disabled' : ''}>
            ${b.label}
          </button>
        `).join('')}
      </div>
    `;

    wrap.querySelectorAll('.lv-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!selectedWord) return;
        const s = parseInt(btn.dataset.state, 10);
        window.WCLesson.setWordLevel(selectedWord.lower, s, selectedWord.word);
      });
    });
  }

  // ============================================================
  //  PANEL 2 — Imagine this! (visualisation → teacher)
  // ============================================================
  function renderVizForm(L) {
    const wrap = $('sideViz');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="wc-side-title">💭 Imagine this!</div>
      <p class="wc-side-hint" style="margin: 4px 0 8px;">
        Tell your teacher the picture you see in your head — she might send back an animal! 🦒
      </p>
      <textarea id="vizPrompt" class="wc-textarea" rows="2" placeholder="I see…"></textarea>
      <button id="vizSend" class="wc-btn block wc-mt-12">Send to my teacher 📨</button>
      <div id="vizSent" class="wc-alert ok wc-hidden">Sent! Keep reading.</div>
      <div id="vizErr"  class="wc-alert error wc-hidden"></div>
    `;
    $('vizSend').addEventListener('click', async () => {
      const prompt = $('vizPrompt').value.trim();
      const err = $('vizErr'); const ok = $('vizSent');
      err.classList.add('wc-hidden'); ok.classList.add('wc-hidden');
      if (!prompt) {
        err.textContent = 'Write what you imagine first!';
        err.classList.remove('wc-hidden'); return;
      }
      try {
        // The word currently in the sidebar is a natural anchor — if
        // the student is mid-conversation about a word, ship that
        // word along so the teacher's reply lands in context.
        const word = selectedWord?.lower || null;
        await window.WCDB.viz.send(L.me.id, L.lesson.id, word, prompt);
        $('vizPrompt').value = '';
        ok.classList.remove('wc-hidden');
        setTimeout(() => ok.classList.add('wc-hidden'), 6000);
      } catch (e) {
        err.textContent = 'Could not send. Try again in a sec.';
        err.classList.remove('wc-hidden');
      }
    });
  }

  // ============================================================
  //  PANEL 3 — Replies from teacher
  // ============================================================
  async function renderReplies(L) {
    const wrap = $('sideReplies');
    if (!wrap) return;
    let msgs = [];
    try { msgs = await window.WCDB.viz.forStudent(L.me.id); } catch {}
    const replied = msgs.filter(m => m.responded_at);
    wrap.innerHTML = `<div class="wc-side-title">🎁 From my teacher</div>`;
    if (!replied.length) {
      wrap.insertAdjacentHTML('beforeend',
        `<p class="wc-side-hint">No replies yet.</p>`);
      return;
    }
    const list = document.createElement('div');
    list.className = 'wc-reply-list';
    replied.slice(0, 3).forEach(m => {
      const giftSrc = (m.gift_animal_set != null && m.gift_animal_index != null)
        ? window.WCAssets.spriteFor(m.gift_animal_set, m.gift_animal_index, false) : '';
      const card = document.createElement('div');
      card.className = 'wc-reply';
      card.innerHTML = `
        ${giftSrc ? `<img class="wc-reply-gift" src="${giftSrc}" alt=""/>` : ''}
        <div class="wc-reply-body">
          ${m.teacher_response ? `<div class="wc-reply-text">${escapeHtml(m.teacher_response)}</div>` : ''}
          ${m.word ? `<div class="wc-side-hint">re: <em>${escapeHtml(m.word)}</em></div>` : ''}
        </div>
      `;
      list.appendChild(card);
    });
    wrap.appendChild(list);
  }

  // Teacher reply arrived live → toast + auto-catch + refresh.
  //
  // De-dup: every message we've already toasted on THIS device is
  // remembered in localStorage. Without this, every page reload
  // would re-toast all replies from the last 24 hours (because
  // pollViz uses a 24-hour look-back window). With it, each new
  // reply pops once per device, ever.
  const SEEN_KEY = 'wc.viz.seen.v1';
  function getSeenIds() {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function markSeen(id) {
    const set = getSeenIds();
    set.add(id);
    // Cap stored size — keep the most recent 200 IDs only.
    const arr = [...set].slice(-200);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(arr)); } catch {}
  }

  async function onReplyArrived(L, msg) {
    if (!msg || !msg.id) return;
    if (getSeenIds().has(msg.id)) return;   // already shown on this device
    markSeen(msg.id);
    renderReplies(L);
    showToast(L, msg);
    if (msg.gift_animal_set != null && msg.gift_animal_index != null) {
      try {
        await window.WCDB.pets.catch_(L.me.id, msg.gift_animal_set, msg.gift_animal_index,
          (L.me.encounter_level || 1));
      } catch {}
    }
  }
  function showToast(L, msg) {
    const t = document.createElement('div');
    t.className = 'wc-toast';
    const sprite = (msg.gift_animal_set != null)
      ? `<img src="${window.WCAssets.spriteFor(msg.gift_animal_set, msg.gift_animal_index, false)}" alt=""/>`
      : '🎁';
    t.innerHTML = `
      <div class="wc-toast-sprite">${sprite.startsWith('<img') ? sprite : `<span>${sprite}</span>`}</div>
      <div>
        <strong>Your teacher sent a gift!</strong><br>
        <span class="wc-muted">${escapeHtml(msg.teacher_response || 'A new friend just arrived.')}</span>
      </div>
    `;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(), 400); }, 7000);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }

  // Look up the teacher-uploaded image for this word, if any. Matched
  // by case-insensitive equality against the lower form. Words without
  // an entry return null → the sidebar renders no image area at all.
  function findWordImage(lower) {
    const list = lessonRef?.lesson?.word_images;
    if (!Array.isArray(list) || !list.length) return null;
    const want = String(lower || '').toLowerCase();
    const hit  = list.find(wi => (wi.word || '').toLowerCase() === want);
    return hit ? hit.data_url : null;
  }

  // Split `displayed` (the inflected form the student tapped) into a
  // base portion that shares a prefix with `lemma`, and the leftover
  // inflection. Returns HTML with the inflection wrapped in
  // `.wc-hl-infl` (sky-blue). When the overlap is too short to be
  // meaningful (irregular forms, or no lemma supplied), fall back to
  // the displayed word unchanged.
  function inflectionHtml(displayed, lemma) {
    const d = String(displayed || '');
    const l = String(lemma || '');
    const dl = d.toLowerCase(), ll = l.toLowerCase();
    if (!ll || dl === ll) return escapeHtml(d);
    let i = 0;
    while (i < Math.min(dl.length, ll.length) && dl[i] === ll[i]) i++;
    // Need at least 2 shared letters to treat the rest as inflection.
    // Otherwise (went/go, was/be) just show the plain word.
    if (i < 2 || i >= d.length) return escapeHtml(d);
    return escapeHtml(d.slice(0, i)) + `<span class="wc-hl-infl">${escapeHtml(d.slice(i))}</span>`;
  }
})();
