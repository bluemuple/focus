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

    renderWordCard(null);  // initial empty-state

    if (!flags.hideVisualizationSidebar) {
      renderVizForm(L);
      renderReplies(L);
      window.WCDB.realtime.pollViz(L.me.id,
        new Date(Date.now() - 24*3600*1000).toISOString(),
        (msg) => onReplyArrived(L, msg));
    } else {
      const v = document.getElementById('sideViz');
      const r = document.getElementById('sideReplies');
      if (v) v.classList.add('wc-hidden');
      if (r) r.classList.add('wc-hidden');
    }

    // Wired from lesson.js — fires whenever a word is tapped.
    window.addEventListener('wc:word-selected', (e) => {
      const d = e.detail || {};
      selectedWord = { word: d.word, lower: d.lower, sentence: d.sentence };
      renderWordCard({ loading: true });
      window.WCWordInfo.fetch(d.word, d.sentence).then(info => {
        activeInfo = info;
        renderWordCard({ info });
      });
    });
    // Level changes (from lesson.js or this sidebar) → refresh picker.
    L.onWordLevelChange(({ word }) => {
      if (selectedWord && word === selectedWord.lower) {
        renderWordCard({ info: activeInfo });
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
    wrap.innerHTML = `
      <div class="wc-word-card">
        <div class="wc-word-head">
          <div class="wc-word-text">
            <h2>${escapeHtml(info?.lemma || w.word || '')}</h2>
            ${pron ? `<div class="wc-word-ipa">${escapeHtml(pron)}</div>` : ''}
          </div>
          <button class="wc-word-tts" id="wcWordTts" title="Hear it">🔊</button>
        </div>

        ${isLoading
          ? `<div class="wc-word-loading">Looking it up…</div>`
          : info
            ? `
              <div class="wc-word-def">${escapeHtml(info.definition)}</div>
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

        <!-- Ice-cream level picker. Each slot shows a silhouette by
             default; the user's chosen level (if any) is rendered with
             the colour image. Clicking any slot saves that level. -->
        <div class="wc-word-levelpicker-label">How well do you know this word?</div>
        <div class="wc-word-levelpicker" role="radiogroup">
          ${[-1, 1, 2, 3, 4, 5].map(lvl => {
            const isCurrent = lvl === currentLevel;
            const img = isCurrent
              ? window.WCAssets.levels[lvl].real
              : window.WCAssets.levels[lvl].silhouette;
            const label = lvl === -1 ? 'Skip' : (lvl === 5 ? 'I know it!' : `Lv ${lvl}`);
            return `
              <button class="wc-lvl-pick ${isCurrent ? 'on' : ''}" data-level="${lvl}" title="${label}">
                <img src="${img}" alt="${label}" />
                <span>${label}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const tts = $('wcWordTts');
    if (tts) tts.addEventListener('click', () => {
      if (window.WCTTS) window.WCTTS.speak(info?.lemma || w.word || '').catch(()=>{});
    });
    wrap.querySelectorAll('.wc-lvl-pick').forEach(btn => {
      btn.addEventListener('click', async () => {
        const next = parseInt(btn.dataset.level, 10);
        if (!selectedWord) return;
        // Delegate to lesson.js's persistence helper (it also fires
        // wc:level-up if applicable for the encounter system).
        window.WCLesson.setWordLevel(selectedWord.lower, next, selectedWord.word);
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
  async function onReplyArrived(L, msg) {
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
})();
