// =============================================================
//  WordCatch — lesson sidebar
//
//  Four panels (top → bottom):
//    1. Next animal progress       — sticky goal, gamified
//    2. My word ice creams         — per-level counts using the
//                                    cropped level icons
//    3. Imagine this! (viz prompt) — student → teacher message
//    4. From my teacher            — replies (text + gift animal)
//
//  Reads global state from lesson.js (window.WCLesson):
//    .me              → wc_users row
//    .lesson          → wc_lessons row
//    .wordLevels      → Map<lower → level>
//    .onWordLevelChange(cb) → subscribe to changes
//
//  Doesn't write to wordLevels itself — that's lesson.js's job.
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);

  // We need the lesson controller's state. lesson.js exposes WCLesson
  // after init; we wait one tick to make sure that side has populated.
  document.addEventListener('DOMContentLoaded', () => setTimeout(initWhenReady, 0));
  if (document.readyState !== 'loading') setTimeout(initWhenReady, 0);

  function initWhenReady() {
    // lesson.js exposes WCLesson immediately but `lesson` is null until
    // the async fetch resolves — wait for that, otherwise the sidebar
    // panels render with empty state we can't recover from.
    if (!window.WCLesson || !window.WCLesson.me || !window.WCLesson.lesson) {
      setTimeout(initWhenReady, 100);
      return;
    }
    init(window.WCLesson);
  }

  function init(L) {
    const flags = L.classFlags || {};

    // Encounters disabled? Hide the progress panel entirely — that
    // panel is meaningless without an animal-catching loop.
    if (flags.hideEncounters) {
      const p = document.getElementById('sideProgress');
      if (p) p.classList.add('wc-hidden');
    } else {
      renderProgress(L);
    }

    renderWordStats(L);

    // Visualisation sidebar disabled by class settings?
    if (flags.hideVisualizationSidebar) {
      const v = document.getElementById('sideViz');
      const r = document.getElementById('sideReplies');
      if (v) v.classList.add('wc-hidden');
      if (r) r.classList.add('wc-hidden');
    } else {
      renderVizForm(L);
      renderReplies(L);
    }

    L.onWordLevelChange(() => {
      renderWordStats(L);
      if (!flags.hideEncounters) renderProgress(L);
    });

    if (!flags.hideEncounters) {
      window.addEventListener('wc:counter-changed', () => renderProgress(L));
      window.addEventListener('wc:encounter-end',   () => renderProgress(L));
    }

    if (!flags.hideVisualizationSidebar) {
      window.WCDB.realtime.pollViz(L.me.id, new Date(Date.now() - 24*3600*1000).toISOString(),
        (msg) => onReplyArrived(L, msg));
    }
  }

  // ============================================================
  //  PANEL 1 — progress to next animal
  // ============================================================
  async function renderProgress(L) {
    const wrap = $('sideProgress');
    if (!wrap) return;
    const lvl   = L.me.encounter_level || 1;
    const spec  = window.WCLevels.spec(lvl);
    const need  = spec.threshold;
    // Pull live counter (server-of-truth — sidebar is reactive to it).
    let count = 0;
    try {
      const row = await window.WCDB.encounters.get(L.me.id, L.lesson.id);
      count = row?.count_value || 0;
    } catch {}
    const pct = Math.max(0, Math.min(100, Math.round(count * 100 / need)));
    const remain = Math.max(0, need - count);

    // Silhouette of the next animal at this level — assumes the lesson's
    // animal_set; 'mixed' picks a random one for the teaser.
    const setName = (L.lesson.animal_set === 'mixed')
      ? window.WCAssets.allSetNames[(lvl-1) % window.WCAssets.allSetNames.length]
      : L.lesson.animal_set;
    const idx     = lvl - 1;   // animal_index 0..9 ⇔ encounter_level 1..10
    const sprite  = window.WCAssets.spriteFor(setName, idx, true);
    const label   = window.WCAssets.labelFor(setName, idx);

    wrap.innerHTML = `
      <div class="wc-side-title">🐾 Next animal</div>
      <div class="wc-progress-row">
        <img class="wc-progress-sprite" src="${sprite}" alt="" />
        <div class="wc-progress-info">
          <div class="wc-progress-label">
            ${remain > 0
              ? `<strong>${remain}</strong> more click${remain===1?'':'s'} to find it!`
              : `Almost! Tap a word to make it appear ✨`}
          </div>
          <div class="wc-progress">
            <div class="wc-progress-bar" style="width:${pct}%"></div>
          </div>
          <div class="wc-side-hint">Level ${lvl} · mystery: <em>${label || '???'}</em></div>
        </div>
      </div>
    `;
  }

  // ============================================================
  //  PANEL 2 — word level ice creams
  // ============================================================
  function renderWordStats(L) {
    const wrap = $('sideWordStats');
    if (!wrap) return;
    // count per level
    const counts = { '-1': 0, '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    L.wordLevels.forEach((lvl) => {
      const key = String(lvl);
      if (counts[key] !== undefined) counts[key]++;
    });
    // Render the 6 ice creams (-1, 1..5). Level 0 is "unseen" — kids
    // don't need to see that count; their attention should land on
    // what they've *done* (clicked).
    const ORDER = [-1, 1, 2, 3, 4, 5];
    const html = ORDER.map(lvl => {
      const img = window.WCAssets.levels[lvl].real;
      const n   = counts[String(lvl)] || 0;
      const cls = n > 0 ? '' : 'wc-stat-empty';
      const tip = (lvl === -1) ? 'Skipped' : `Level ${lvl}`;
      return `
        <div class="wc-stat ${cls}" title="${tip}">
          <img src="${img}" alt="${tip}" />
          <span class="wc-stat-count">${n}</span>
        </div>`;
    }).join('');
    wrap.innerHTML = `
      <div class="wc-side-title">🍦 My words</div>
      <div class="wc-stat-grid">${html}</div>
    `;
  }

  // ============================================================
  //  PANEL 3 — Imagine this! (visualisation prompt → teacher)
  // ============================================================
  function renderVizForm(L) {
    const wrap = $('sideViz');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="wc-side-title">💭 Imagine this!</div>
      <p class="wc-side-hint" style="margin: 4px 0 8px;">
        Pick a word and tell your teacher what picture you see in your head.
        She'll send back an animal as a thank you! 🦒
      </p>
      <div class="wc-field" style="margin-bottom:8px;">
        <select id="vizWord" class="wc-select">
          <option value="">— any word —</option>
        </select>
      </div>
      <textarea id="vizPrompt" class="wc-textarea" rows="3"
        placeholder="I see…"></textarea>
      <button id="vizSend" class="wc-btn block wc-mt-12">Send to my teacher 📨</button>
      <div id="vizSent" class="wc-alert ok wc-hidden">Sent! Keep reading — your teacher will reply soon.</div>
      <div id="vizErr"  class="wc-alert error wc-hidden"></div>
    `;
    // Word picker — pull words the student has clicked at all (level ≠ 0),
    // most recent first. Cap at 30 for sanity.
    const sel = $('vizWord');
    const clicked = [...L.wordLevels.entries()]
      .filter(([,lvl]) => lvl !== 0)
      .slice(0, 30);
    clicked.forEach(([w]) => {
      const opt = document.createElement('option');
      opt.value = w; opt.textContent = w;
      sel.appendChild(opt);
    });

    $('vizSend').addEventListener('click', async () => {
      const word   = $('vizWord').value || null;
      const prompt = $('vizPrompt').value.trim();
      const err    = $('vizErr');
      const ok     = $('vizSent');
      err.classList.add('wc-hidden');
      ok .classList.add('wc-hidden');
      if (!prompt) {
        err.textContent = 'Write what you imagine first!';
        err.classList.remove('wc-hidden');
        return;
      }
      try {
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
  //  PANEL 4 — replies from teacher (text + gift animal)
  // ============================================================
  async function renderReplies(L) {
    const wrap = $('sideReplies');
    if (!wrap) return;
    let msgs = [];
    try {
      msgs = await window.WCDB.viz.forStudent(L.me.id);
    } catch {}
    const replied = msgs.filter(m => m.responded_at);
    wrap.innerHTML = `<div class="wc-side-title">🎁 From my teacher</div>`;
    if (!replied.length) {
      wrap.insertAdjacentHTML('beforeend',
        `<p class="wc-side-hint">No replies yet. Keep reading and sending!</p>`);
      return;
    }
    const list = document.createElement('div');
    list.className = 'wc-reply-list';
    replied.slice(0, 5).forEach(m => {
      list.appendChild(replyCard(m));
    });
    wrap.appendChild(list);
  }

  function replyCard(m) {
    const card = document.createElement('div');
    card.className = 'wc-reply';
    const giftHtml = (m.gift_animal_set != null && m.gift_animal_index != null)
      ? `<img class="wc-reply-gift"
              src="${window.WCAssets.spriteFor(m.gift_animal_set, m.gift_animal_index, false)}"
              alt="${window.WCAssets.labelFor(m.gift_animal_set, m.gift_animal_index)}" />`
      : '';
    card.innerHTML = `
      ${giftHtml}
      <div class="wc-reply-body">
        ${m.teacher_response ? `<div class="wc-reply-text">${escapeHtml(m.teacher_response)}</div>` : ''}
        ${m.word ? `<div class="wc-side-hint">re: <em>${escapeHtml(m.word)}</em></div>` : ''}
      </div>
    `;
    return card;
  }

  // ============================================================
  //  Realtime — a new reply just arrived: toast + refresh panel +
  //  if there's an animal gift, drop it into the student's pets.
  // ============================================================
  async function onReplyArrived(L, msg) {
    // refresh the replies panel
    renderReplies(L);
    // toast on screen
    showToast(L, msg);
    // auto-add the gift animal to the student's pets (one-shot)
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
      <div class="wc-toast-sprite">${typeof sprite === 'string' && sprite.startsWith('<img') ? sprite : `<span>${sprite}</span>`}</div>
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
