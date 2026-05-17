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

    // The standalone "Imagine this!" + "From my teacher" panels are
    // now folded INTO the word card so each conversation stays
    // anchored to the word it's about. We always hide the legacy
    // containers (kept in the HTML for backwards compat).
    const v = document.getElementById('sideViz');
    const r = document.getElementById('sideReplies');
    if (v) v.classList.add('wc-hidden');
    if (r) r.classList.add('wc-hidden');

    // Preview mode (opened from teacher dashboard's "Preview" button)
    // shouldn't poll for replies — there's no student session.
    if (!L.isPreview && !flags.hideVisualizationSidebar) {
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

    // Empty state — no word picked yet. Show a quick guide to the
    // level-bar buttons + their keyboard shortcuts so the student
    // knows what to do on first landing.
    if (!state) {
      wrap.innerHTML = `
        <div class="wc-help">
          <h3 class="wc-help-title">📖 How to mark your words</h3>
          <p class="wc-side-hint" style="margin: 0 0 12px;">
            Tap any word in the lesson — then pick a button below to
            remember how well you know it.
          </p>
          <ul class="wc-help-levels">
            <li>
              <span class="wc-help-btn ignore">🗑</span>
              <span class="wc-help-text">Skip — I don't need this</span>
              <kbd>0</kbd>
            </li>
            <li>
              <span class="wc-help-btn s1">1</span>
              <span class="wc-help-text">Just learning it</span>
              <kbd>1</kbd>
            </li>
            <li>
              <span class="wc-help-btn s2">2</span>
              <span class="wc-help-text">Seen it before</span>
              <kbd>2</kbd>
            </li>
            <li>
              <span class="wc-help-btn s3">3</span>
              <span class="wc-help-text">I know what it means</span>
              <kbd>3</kbd>
            </li>
            <li>
              <span class="wc-help-btn s4">4</span>
              <span class="wc-help-text">Almost there</span>
              <kbd>4</kbd>
            </li>
            <li>
              <span class="wc-help-btn known">✓</span>
              <span class="wc-help-text">I know it perfectly</span>
              <kbd>5</kbd> <kbd>v</kbd>
            </li>
          </ul>
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

    // "Disable, but still show" mode for the message form.
    //  - Preview tab  → no real student session, sending would write
    //    a row attributed to a placeholder UUID.
    //  - Class flag `hideVisualizationSidebar` → teacher opted out.
    // In either case we still render the form (the teacher
    // previewing wants to *see* the feature exists), but disable
    // the textarea + send button so it can't actually post.
    const flags = (lessonRef && lessonRef.classFlags) || {};
    const msgDisabled = !!lessonRef.isPreview || !!flags.hideVisualizationSidebar;

    // Lemma the GPT returned (e.g. "scare" when the student tapped
    // "scared"). Used to bold any matching-prefix word in every bullet
    // and to colour the inflection suffix sky-blue — matches the
    // student's mental model of "where does this word come from?".
    const lemma = (info?.lemma || w.lower || w.word || '').toLowerCase();

    // Build the new bullets only when GPT returned content. Each
    // bullet runs through `lemmaHl` so lemma matches and inflected
    // forms appear bold + sky-blue inline.
    function bulletList() {
      const exampleEn = (info.examples && info.examples[0] && info.examples[0].en) || '';
      const sayIt     = Array.isArray(info.say_it)      ? info.say_it      : [];
      const family    = Array.isArray(info.word_family) ? info.word_family : [];
      const similar   = Array.isArray(info.similar)     ? info.similar     : [];
      const opposite  = Array.isArray(info.opposite)    ? info.opposite    : [];
      const rows = [];
      rows.push(bulletRow('Meaning',     lemmaHl(info.definition, lemma)));
      if (exampleEn)        rows.push(bulletRow('Example',     lemmaHl(exampleEn, lemma)));
      if (sayIt.length)     rows.push(bulletRow('Say it',      sayIt   .map(s => lemmaHl(s, lemma)).join(' <span class="wc-bullet-sep">/</span> ')));
      if (family.length)    rows.push(bulletRow('Word family', family  .map(s => lemmaHl(s, lemma)).join(' <span class="wc-bullet-sep">/</span> ')));
      if (similar.length)   rows.push(bulletRow('Similar',     similar .map(s => lemmaHl(s, lemma)).join(', ')));
      if (opposite.length)  rows.push(bulletRow('Opposite',    opposite.map(s => lemmaHl(s, lemma)).join(', ')));
      return `<ul class="wc-word-bullets">${rows.join('')}</ul>`;
    }
    function bulletRow(label, valueHtml) {
      return `<li><span class="wc-bullet-label">${escapeHtml(label)}:</span> ${valueHtml}</li>`;
    }

    // "Use it" frame from GPT (e.g. "I feel scared when ____.") or a
    // safe fallback if GPT skipped it.
    const useFrame = (info && info.use_it && info.use_it.trim())
      ? info.use_it.trim()
      : `Use ${info?.lemma || w.word || w.lower || 'this word'} in a sentence: ____.`;
    // We pre-fill the textarea with the frame up to (and including the
    // space before) "____" so the student only types the missing piece.
    // If the frame doesn't contain "____" we just leave the textarea
    // empty and rely on the visible prompt instead.
    const blankIdx = useFrame.indexOf('____');
    const prefilled = blankIdx >= 0
      ? useFrame.slice(0, blankIdx).replace(/\s*$/, ' ')
      : '';

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
              <!-- Definition kept as the headline meaning row above the
                   bulletted breakdown — the bullets repeat it as
                   "Meaning:" for visual parity with Example / Say it /
                   etc. so each row reads the same shape. -->
              <div class="wc-word-def">${lemmaHl(info.definition, lemma)}</div>
              ${bulletList()}
            `
            : `<div class="wc-muted">Couldn't fetch info. Try tapping again!</div>`
        }

        <!-- "Use it" practice form — the student writes the frame
             sentence with their own ending, and the teacher can reply
             with coins / a sticker / a note (see teacher dashboard).
             Disabled in preview / when the class hid the sidebar — we
             still render so previewing teachers see the layout. -->
        <div class="wc-word-msg wc-use-it" id="wcWordMsg">
          <div class="wc-use-it-title">💌 Use it: <span class="wc-use-it-frame">${lemmaHl(useFrame, lemma)}</span></div>
          <textarea id="wcWordMsgInput"
                    class="wc-word-msg-input"
                    rows="2"
                    placeholder="${escapeHtml(useFrame)}"
                    ${msgDisabled ? 'disabled' : ''}>${escapeHtml(prefilled)}</textarea>
          <div class="wc-use-it-hint">
            Write “${escapeHtml(useFrame)}” to get money 🪙
          </div>
          <button id="wcWordMsgSend" class="wc-word-msg-send" type="button"
                  ${msgDisabled ? 'disabled title="Disabled in preview"' : ''}>
            Send 📨
          </button>
          <div id="wcWordMsgStatus" class="wc-word-msg-status"></div>
          <div id="wcWordMsgThread" class="wc-word-msg-thread"></div>
        </div>
      </div>
    `;

    const tts = $('wcWordTts');
    if (tts) tts.addEventListener('click', () => {
      if (window.WCTTS) window.WCTTS.speak(info?.lemma || w.word || '').catch(()=>{});
    });

    // Wire the message form unless we rendered it in disabled mode
    // (no real student session → no send + no thread fetch).
    if (!msgDisabled) wireWordMessageForm(w);
  }

  // ============================================================
  //  Per-word teacher messaging — sits inside the word card.
  //
  //  Each message is a row in wc_visualization_messages with the
  //  selected word stamped on it. Teacher replies with a sticker
  //  (animal sprite) + optional note via respondWithGift.
  //
  //  We render at most the 3 most recent messages for THIS word
  //  so a chatty student doesn't bury the word card.
  // ============================================================
  async function wireWordMessageForm(w) {
    const input  = $('wcWordMsgInput');
    const send   = $('wcWordMsgSend');
    const status = $('wcWordMsgStatus');
    if (!input || !send || !status) return;

    send.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) {
        status.textContent = 'Write something first!';
        status.className = 'wc-word-msg-status err';
        return;
      }
      send.disabled = true;
      status.textContent = 'Sending…';
      status.className = 'wc-word-msg-status';
      try {
        await window.WCDB.viz.send(lessonRef.me.id, lessonRef.lesson.id,
          w.lower, text);
        input.value = '';
        status.textContent = 'Sent! Keep reading. ✓';
        status.className = 'wc-word-msg-status ok';
        renderWordMessages(w.lower);
        setTimeout(() => { status.textContent = ''; }, 4000);
      } catch (e) {
        status.textContent = 'Could not send. Try again.';
        status.className = 'wc-word-msg-status err';
      } finally {
        send.disabled = false;
      }
    });

    renderWordMessages(w.lower);
  }

  // Fetch all the student's messages and render only those tied to
  // this word. (For Year-4 traffic volumes this is fine; if it
  // grows, swap to a server-side filter.)
  async function renderWordMessages(wordLower) {
    const host = $('wcWordMsgThread');
    if (!host) return;
    let msgs = [];
    try { msgs = await window.WCDB.viz.forStudent(lessonRef.me.id); } catch {}
    const mine = (msgs || []).filter(m => (m.word || '').toLowerCase() === wordLower);
    if (!mine.length) { host.innerHTML = ''; return; }

    host.innerHTML = mine.slice(0, 3).map(m => {
      const replied = !!(m.responded_at || m.teacher_response
                         || m.gift_animal_set != null
                         || (m.gift_money && m.gift_money > 0));
      const stickerSrc = (m.gift_animal_set != null && m.gift_animal_index != null)
        ? window.WCAssets.spriteFor(m.gift_animal_set, m.gift_animal_index, false)
        : '';
      // Money gift chip — visible alongside the sticker / text reply
      // whenever the teacher attached coins to the response.
      const money = (m.gift_money && m.gift_money > 0) ? m.gift_money : 0;
      const moneyChip = money
        ? `<span class="wc-msg-money">🪙 +${money}</span>`
        : '';
      return `
        <div class="wc-msg-row">
          <div class="wc-msg-mine">${escapeHtml(m.prompt || '')}</div>
          ${replied ? `
            <div class="wc-msg-reply">
              ${stickerSrc ? `<img class="wc-msg-sticker" src="${stickerSrc}" alt=""/>` : ''}
              ${moneyChip}
              ${m.teacher_response ? `<div class="wc-msg-text">${escapeHtml(m.teacher_response)}</div>` : ''}
            </div>
          ` : `<div class="wc-msg-waiting">Waiting for your teacher…</div>`}
        </div>
      `;
    }).join('');
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
    // If the reply is for the word currently in the card, refresh
    // the thread inline so the student sees it without re-tapping.
    const msgWord = (msg.word || '').toLowerCase();
    if (selectedWord && msgWord && selectedWord.lower === msgWord) {
      renderWordMessages(msgWord);
    }
    showToast(L, msg);
    if (msg.gift_animal_set != null && msg.gift_animal_index != null) {
      try {
        await window.WCDB.pets.catch_(L.me.id, msg.gift_animal_set, msg.gift_animal_index,
          (L.me.encounter_level || 1));
      } catch {}
    }
    // Money gift — credit the student's coin balance + update the
    // header counter, mirroring encounter.js bumpCoins so the
    // optimistic UI and persisted row stay in sync.
    if (msg.gift_money && msg.gift_money > 0) {
      try { await creditMoneyGift(L, msg.gift_money); } catch {}
    }
  }

  // Add `delta` coins to the current user's wc_users.money, update
  // the bottom-bar 🪙 counter optimistically, and refresh the cached
  // session so other tabs (profile / home) see the new balance on
  // their next render. Failure is logged but not surfaced — the
  // coins are still on the message row, so a refresh recovers them
  // (idempotent: we use seen-ids to never double-credit).
  async function creditMoneyGift(L, delta) {
    const before = L.me.money || 0;
    const after  = Math.max(0, before + delta);
    L.me.money = after;
    const el = document.getElementById('userMoney');
    if (el) el.textContent = String(after);
    try {
      await window.WCDB.users.update(L.me.id, { money: after });
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw); u.money = after;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch (e) {
      console.warn('money gift credit failed', e);
    }
  }
  function showToast(L, msg) {
    const t = document.createElement('div');
    t.className = 'wc-toast';
    const hasSticker = (msg.gift_animal_set != null && msg.gift_animal_index != null);
    const hasMoney   = (msg.gift_money && msg.gift_money > 0);
    const sprite = hasSticker
      ? `<img src="${window.WCAssets.spriteFor(msg.gift_animal_set, msg.gift_animal_index, false)}" alt=""/>`
      : hasMoney ? '🪙' : '💌';
    // Headline prefers money > sticker > generic reply so the student
    // sees the most exciting word first.
    const headline = hasMoney
      ? `Your teacher sent you 🪙 ${msg.gift_money}!`
      : hasSticker
        ? 'Your teacher sent a sticker!'
        : 'Your teacher replied!';
    const wordHint = msg.word ? ` (about <em>${escapeHtml(msg.word)}</em>)` : '';
    t.innerHTML = `
      <div class="wc-toast-sprite">${sprite.startsWith('<img') ? sprite : `<span>${sprite}</span>`}</div>
      <div>
        <strong>${headline}</strong>${wordHint}<br>
        <span class="wc-muted">${escapeHtml(msg.teacher_response || 'Open this word to read it.')}</span>
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

  // Same pattern for teacher-written meanings — when the tapped word
  // has an entry, the note is rendered as an extra "From your teacher"
  // card directly below the GPT definition. Returns the trimmed note
  // string or null.
  function findWordNote(lower) {
    const list = lessonRef?.lesson?.word_notes;
    if (!Array.isArray(list) || !list.length) return null;
    const want = String(lower || '').toLowerCase();
    const hit  = list.find(wn => (wn.word || '').toLowerCase() === want);
    return hit && hit.note ? String(hit.note).trim() : null;
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

  // Walk `text`, find every alphabetic run, and:
  //   - exact lemma match     → bold        (<strong>scare</strong>)
  //   - inflected lemma form  → bold + sky  (<strong>scar</strong><sky>ed</sky>)
  //   - everything else       → plain (escaped) text
  //
  // "Inflected" = shares a prefix of length ≥ 0.7 * lemma.length AND
  // ≥ 3 letters with the lemma. The 0.7 threshold tolerates short
  // suffix swaps (scare → scary) while rejecting unrelated lookalikes
  // (e.g. "scar" ≠ "scare"). Punctuation and non-letter characters
  // pass through unchanged. Used by every bullet so the reader's eye
  // can spot the headword inside Meaning / Example / Word family /
  // Similar / Opposite at a glance.
  function lemmaHl(text, lemma) {
    const ll = String(lemma || '').toLowerCase();
    if (!text) return '';
    if (!ll) return escapeHtml(String(text));
    const re = /([A-Za-z]+)|([^A-Za-z]+)/g;
    const out = [];
    let m;
    while ((m = re.exec(String(text))) !== null) {
      if (m[1]) {
        const word = m[1];
        const lo   = word.toLowerCase();
        if (lo === ll) {
          out.push(`<strong>${escapeHtml(word)}</strong>`);
        } else {
          let i = 0;
          while (i < Math.min(lo.length, ll.length) && lo[i] === ll[i]) i++;
          const minShared = Math.max(3, Math.floor(ll.length * 0.7));
          if (i >= minShared && i <= lo.length) {
            const base = escapeHtml(word.slice(0, i));
            const tail = escapeHtml(word.slice(i));
            out.push(tail
              ? `<strong>${base}</strong><span class="wc-hl-infl">${tail}</span>`
              : `<strong>${base}</strong>`);
          } else {
            out.push(escapeHtml(word));
          }
        }
      } else {
        out.push(escapeHtml(m[2]));
      }
    }
    return out.join('');
  }
})();
