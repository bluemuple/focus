// =============================================================
//  Practice — Subtraction Mental Methods 1
//
//  Six adaptive difficulty levels:
//    1 — ones − ones, visual (5×2 ten-frame, removed buttons coloured)
//    2 — ones − ones, NO visual (multiple choice)
//    3 — teen − ones, no borrow, visual (two frames + crossed dots)
//    4 — teen − ones, no borrow, NO visual
//    5 — 2-digit − 2-digit, no borrow, decomposition slots
//        (drag/tap chips to fill X − Yt − Yo = ?)
//    6 — 2-digit − 2-digit, single answer slot
//
//  Adaptive:
//    • Start at level 3.
//    • FAST PATH — 3 correct IN A ROW at the current level bumps
//      you straight up to the next stage (and shows a 🎉 toast).
//      A single wrong answer resets the streak.
//    • SLOW PATH — every 5 questions: ≥ 4 / 5 steps UP, ≤ 1 / 5
//      steps DOWN. Stays otherwise. (Kept as a safety net for the
//      kid who is right 4-of-5 but never strings 3 together.)
//    • 3 WRONG in the current level → "stop or keep going?" prompt.
//
//  Cumulative score = sum of (correct × 10) across all sessions,
//  saved to wc_users.practice_state.cumulative. Used by home.html
//  to gate the Race button.
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);
  const me = window.WCAuth && window.WCAuth.session();
  if (!me) { window.location.href = './index.html'; return; }

  // ---- State ------------------------------------------------------
  let level = 3;                     // current level (1..6)
  let cumulative = 0;                // sum of (correct * 10) ever
  // Per-session running tally for the current level — used by the
  // adaptive step rule and the "3 wrong → stop?" prompt.
  let levelCorrect = 0;
  let levelTotal   = 0;
  let levelWrong   = 0;
  // Consecutive correct answers in this level — 3-in-a-row earns
  // an automatic level-up. Any wrong answer resets it to 0.
  let levelStreak  = 0;
  let currentQ = null;
  let answered = false;

  // ---- Per-level question pool guards ----------------------------
  // No-repeat-within-session: per-level Set of "a-b" keys we've
  // already shown. Reset when the kid leaves a level so the next
  // visit starts fresh. genUnique() retries the random generator
  // until it lands on a key not in the Set (up to 50 attempts).
  const seen = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set() };
  // Question-count cap per level. After this many questions in a
  // level, the slow-path adaptive rule fires. Levels 3–6 are 4 per
  // the new spec; levels 1–2 keep the original 5.
  const LEVEL_CAP = { 1: 5, 2: 5, 3: 4, 4: 4, 5: 4, 6: 4 };
  // Up/down thresholds derived from the cap: ≥75% → up, ≤25% → down.
  function adaptThresholds(lv) {
    const cap = LEVEL_CAP[lv];
    return { up: cap === 5 ? 4 : 3, down: 1 };
  }
  function qKey(q) { return q.a + '-' + q.b; }
  function genUnique(lv) {
    for (let i = 0; i < 50; i++) {
      const q = genQuestion(lv);
      if (!seen[lv].has(qKey(q))) { seen[lv].add(qKey(q)); return q; }
    }
    // Pool exhausted — return whatever (rare; only if the kid lingers
    // far past the per-level cap without leveling out).
    return genQuestion(lv);
  }

  // ---- Boot -------------------------------------------------------
  (async function init() {
    try {
      const fresh = await window.WCDB.users.byId(me.id);
      const ps = (fresh && fresh.practice_state && typeof fresh.practice_state === 'object') ? fresh.practice_state : {};
      level      = Math.max(1, Math.min(6, ps.level || 3));
      cumulative = ps.cumulative || 0;
    } catch (e) { console.warn('practice_state load failed', e); }
    paintCumulative();
    nextQuestion();
  })();

  function paintCumulative() {
    $('cumulative').textContent = cumulative;
    $('levelInfo').textContent  = 'Level ' + level;
  }

  // ---- Question generation ---------------------------------------
  // Random integer in [lo, hi] inclusive.
  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

  function genQuestion(lv) {
    if (lv === 1 || lv === 2) {
      const a = rand(2, 9);
      const b = rand(1, a);
      return { type: lv === 1 ? 'visual-ones' : 'mc-ones', a, b, answer: a - b };
    }
    if (lv === 3) {
      // teen-style WITH visual: a ≤ 39 so the ten-frames stay at
      // most 4 frames wide (and the picture fits the card). tens
      // capped at 3 enforces that without extra checks.
      const tens = rand(1, 3);
      const ones = rand(1, 9);
      const sub  = rand(1, ones);                 // no borrow
      const a = tens * 10 + ones;
      return { type: 'visual-teen', a, b: sub, answer: a - sub };
    }
    if (lv === 4) {
      // teen-style NO visual — no a-cap needed.
      const tens = rand(1, 9);
      const ones = rand(1, 9);
      const sub  = rand(1, ones);
      const a = tens * 10 + ones;
      return { type: 'mc-teen', a, b: sub, answer: a - sub };
    }
    if (lv === 5 || lv === 6) {
      // 2-digit − 2-digit, no borrow. No ten-frame visual on these
      // levels (L5 is the drag/chip decomp, L6 is MC) → no a-cap.
      const aT = rand(2, 9), aO = rand(1, 9);
      const bT = rand(1, aT - 1 < 0 ? 1 : aT);    // bT ≤ aT
      const bO = rand(0, aO);                     // bO ≤ aO
      const a = aT * 10 + aO;
      const b = bT * 10 + bO;
      return { type: lv === 5 ? 'decomp' : 'mc-2digit', a, b, bT: bT * 10, bO, answer: a - b };
    }
  }

  // Generate a set of 3 random wrong answers near the correct value.
  function mcChoices(correct) {
    const choices = new Set([correct]);
    while (choices.size < 4) {
      const delta = rand(-5, 5);
      const c = correct + delta;
      if (c >= 0 && c !== correct) choices.add(c);
    }
    const arr = [...choices];
    // Shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---- Rendering -------------------------------------------------
  function nextQuestion() {
    currentQ = genUnique(level);
    answered = false;
    paintCumulative();
    render();
  }

  function render() {
    const card = $('card');
    const q = currentQ;
    const heading = `<div class="pr-level-label">Level ${level}</div>`;
    let body = '';
    switch (q.type) {
      case 'visual-ones': body = renderVisualOnes(q); break;
      case 'mc-ones':     body = renderMC(q);          break;
      case 'visual-teen': body = renderVisualTeen(q); break;
      case 'mc-teen':     body = renderMC(q);          break;
      case 'decomp':      body = renderDecomp(q);      break;
      case 'mc-2digit':   body = renderMC(q);          break;
    }
    card.innerHTML = heading + body +
      `<div class="pr-feedback" id="feedback"><span id="fbBody"></span></div>
       <div class="pr-actions">
         <button class="pr-next" id="nextBtn" disabled>Next →</button>
       </div>`;
    wireRender(q);
    $('nextBtn').addEventListener('click', onNext);
  }

  // -- L1 visual: 5×2 ten-frame, click to take dots away ----------
  function renderVisualOnes(q) {
    const cells = [];
    for (let i = 0; i < 10; i++) {
      const hasDot = i < q.a;
      cells.push(`<div class="pr-cell">${hasDot ? `<div class="pr-dot" data-i="${i}"></div>` : ''}</div>`);
    }
    return `
      <div class="pr-q"><span>${q.a}</span> − <span>${q.b}</span> = ?</div>
      <div class="pr-visual"><div class="pr-frame">${cells.join('')}</div></div>
      <p class="pr-instr">Tap ${q.b} dot${q.b===1?'':'s'} to take them away, then type the answer.</p>
      <div class="pr-answer-row"><input type="number" id="ansInput" class="pr-input" inputmode="numeric"></div>
    `;
  }
  // -- L3 visual: two ten-frames, first FULL + second with `a%10` ----
  function renderVisualTeen(q) {
    const ones = q.a % 10;
    const f1 = [];
    for (let i = 0; i < 10; i++) f1.push(`<div class="pr-cell"><div class="pr-dot"></div></div>`);
    const f2 = [];
    for (let i = 0; i < 10; i++) {
      f2.push(`<div class="pr-cell">${i < ones ? `<div class="pr-dot" data-i="${i}"></div>` : ''}</div>`);
    }
    return `
      <div class="pr-q"><span>${q.a}</span> − <span>${q.b}</span> = ?</div>
      <div class="pr-visual"><div class="pr-frames-row">
        <div class="pr-frame">${f1.join('')}</div>
        <div class="pr-frame">${f2.join('')}</div>
      </div></div>
      <p class="pr-instr">Tap ${q.b} dot${q.b===1?'':'s'} from the right frame to take away, then type the answer.</p>
      <div class="pr-answer-row"><input type="number" id="ansInput" class="pr-input" inputmode="numeric"></div>
    `;
  }
  // -- L2/L4/L6 multiple choice ----------------------------------
  function renderMC(q) {
    const choices = mcChoices(q.answer);
    return `
      <div class="pr-q"><span>${q.a}</span> − <span>${q.b}</span> = ?</div>
      <div class="pr-choices">
        ${choices.map(c => `<button class="pr-choice" data-c="${c}">${c}</button>`).join('')}
      </div>
    `;
  }
  // -- L5 decomposition: 35 − 13 = [  ] − [  ] − [  ] = [  ]  ---
  function renderDecomp(q) {
    // Pool: a, bT, bO, answer + a few distractors
    const pool = [q.a, q.bT, q.bO, q.answer,
                  q.a + 1, q.bT + 10, Math.max(0, q.bO + 2), q.answer - 1, q.answer + 2]
                 .filter((v, i, a) => v >= 0 && a.indexOf(v) === i);
    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return `
      <div class="pr-q"><span>${q.a}</span> − <span>${q.b}</span></div>
      <div class="pr-decomp">
        <div class="slot" data-slot="0">?</div>
        <span>−</span>
        <div class="slot" data-slot="1">?</div>
        <span>−</span>
        <div class="slot" data-slot="2">?</div>
        <span>=</span>
        <div class="slot" data-slot="3">?</div>
      </div>
      <p class="pr-instr">Tap (or drag) chips below to fill the boxes left-to-right.<br>
        Goal: <strong>${q.a}</strong> − <strong>${q.bT}</strong> − <strong>${q.bO}</strong> = <strong>${q.answer}</strong></p>
      <div class="pr-chips">
        ${pool.map(v => `<button class="pr-chip" data-v="${v}" draggable="true">${v}</button>`).join('')}
      </div>
    `;
  }

  // ---- Wire after render ----------------------------------------
  function wireRender(q) {
    if (q.type === 'visual-ones' || q.type === 'visual-teen') {
      const dots = document.querySelectorAll('.pr-dot[data-i]');
      let taken = 0;
      dots.forEach(d => {
        d.addEventListener('click', () => {
          if (d.classList.contains('taken')) {
            d.classList.remove('taken'); taken--;
          } else {
            d.classList.add('taken'); taken++;
          }
        });
      });
      const inp = $('ansInput');
      inp.addEventListener('input', () => {
        const v = parseInt(inp.value, 10);
        $('nextBtn').disabled = !Number.isFinite(v);
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !$('nextBtn').disabled) checkInput(q, inp.value); });
      $('nextBtn').addEventListener('click', () => {}, { once: true });   // wire below
      // Repurpose Next button to first check then advance
      const next = $('nextBtn');
      next.disabled = true;
      const oldHandler = next.onclick;
      next.onclick = () => {
        if (!answered) { checkInput(q, inp.value); return; }
        onNext();
      };
    } else if (q.type.startsWith('mc-')) {
      document.querySelectorAll('.pr-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;
          const c = parseInt(btn.dataset.c, 10);
          checkMC(q, c, btn);
        });
      });
    } else if (q.type === 'decomp') {
      wireDecomp(q);
    }
  }

  function checkInput(q, raw) {
    const v = parseInt(raw, 10);
    if (!Number.isFinite(v)) return;
    answered = true;
    const isOk = (v === q.answer);
    showFeedback(isOk, q);
    $('nextBtn').disabled = false;
  }
  function checkMC(q, picked, btn) {
    answered = true;
    const isOk = (picked === q.answer);
    document.querySelectorAll('.pr-choice').forEach(b => {
      b.disabled = true;
      const c = parseInt(b.dataset.c, 10);
      if (c === q.answer) b.classList.add('correct');
      else if (c === picked) b.classList.add('wrong');
    });
    showFeedback(isOk, q);
    $('nextBtn').disabled = false;
  }
  // Decomp: fills [a, bT, bO, answer] in order with tap/drag.
  // Each slot remembers which chip's value it currently holds so a
  // mis-drag can be popped back (chip re-enabled) by tapping the
  // filled slot. This is the "drag-cancel" behaviour the kid needs
  // when they aim wrong with their finger on a tablet.
  function wireDecomp(q) {
    const expected = [q.a, q.bT, q.bO, q.answer];
    const slots = document.querySelectorAll('.pr-decomp .slot');
    const slotVals = [-1, -1, -1, -1];   // -1 = empty

    function nextEmpty() {
      for (let i = 0; i < 4; i++) if (slotVals[i] === -1) return i;
      return -1;
    }

    function fill(val, srcBtn) {
      if (answered) return;
      const i = nextEmpty();
      if (i < 0) return;
      slots[i].textContent = val;
      slots[i].classList.add('filled');
      slotVals[i] = val;
      if (srcBtn) srcBtn.disabled = true;
      if (nextEmpty() === -1) {
        // All four filled — grade now.
        answered = true;
        let allOk = true;
        for (let k = 0; k < 4; k++) {
          if (slotVals[k] !== expected[k]) {
            slots[k].style.borderColor = '#ef4444';
            slots[k].style.background  = '#fee2e2';
            slots[k].style.color       = '#b91c1c';
            allOk = false;
          }
        }
        showFeedback(allOk, q);
        $('nextBtn').disabled = false;
      }
    }

    // Tap a FILLED slot to pop its chip back (mis-drag cancel).
    // Frozen after the kid has clicked through to the check so the
    // grade doesn't shift under them.
    function unfill(i) {
      if (answered) return;
      if (slotVals[i] === -1) return;
      const v = slotVals[i];
      slots[i].textContent = '?';
      slots[i].classList.remove('filled');
      slots[i].style.borderColor = '';
      slots[i].style.background  = '';
      slots[i].style.color       = '';
      slotVals[i] = -1;
      // Re-enable a chip with the same data-v. Picks the first
      // disabled match so multiple identical pool values still work.
      const chip = document.querySelector('.pr-chip[data-v="' + v + '"][disabled]');
      if (chip) chip.disabled = false;
    }

    document.querySelectorAll('.pr-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered || btn.disabled) return;
        fill(parseInt(btn.dataset.v, 10), btn);
      });
      btn.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', btn.dataset.v));
    });
    slots.forEach((slot, i) => {
      slot.addEventListener('dragover', e => e.preventDefault());
      slot.addEventListener('drop', e => {
        e.preventDefault();
        if (answered) return;
        const v = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!Number.isFinite(v)) return;
        // If this slot is already filled, allow a swap: pop the
        // old chip back first, then fill with the new one.
        if (slotVals[i] !== -1) unfill(i);
        const btn = document.querySelector('.pr-chip[data-v="' + v + '"]:not(:disabled)');
        fill(v, btn);
      });
      // Tap-to-undo: clicking a filled slot pops its chip back so
      // the kid can re-aim. Title + cursor hint advertise the
      // gesture without on-screen instructions.
      slot.title = 'Tap to take it back';
      slot.style.cursor = 'pointer';
      slot.addEventListener('click', () => unfill(i));
    });
  }

  // ---- Feedback + tally + stop prompt ----------------------------
  function showFeedback(isOk, q) {
    const fb = $('feedback');
    fb.classList.add('show', isOk ? 'ok' : 'err');
    $('fbBody').innerHTML = isOk
      ? `✓ Yes! ${q.a} − ${q.b} = <strong>${q.answer}</strong>.`
      : `✗ The right answer is <strong>${q.answer}</strong>.  (${q.a} − ${q.b} = ${q.answer})`;
    levelTotal++;
    if (isOk) { levelCorrect++; cumulative += 10; levelStreak++; }
    else      { levelWrong++; levelStreak = 0; }
    paintCumulative();
    saveProgress();
  }

  // Floating "Level up!" celebration. Auto-removes itself after a
  // short beat so the kid notices the bump without losing the new
  // question underneath.
  function showLevelUpToast(newLevel) {
    const old = document.querySelector('.pr-levelup');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'pr-levelup';
    t.innerHTML = `🎉 <strong>Level up!</strong> Welcome to Level ${newLevel}`;
    document.body.appendChild(t);
    // Trigger the fade-in by adding the class on the next frame.
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 2200);
  }

  function onNext() {
    // 3 wrong in this level → ask to stop.
    if (levelWrong >= 3) {
      if (confirm("You've missed 3 in a row. Do you want to stop now?")) {
        window.location.href = './home.html';
        return;
      }
      // Continue — reset wrong streak counter (but keep tallies)
      levelWrong = 0;
    }
    const prevLevel = level;
    // FAST PATH — 3 correct in a row pops the kid up a stage
    // immediately. Skip the slow per-level cap rule for this turn
    // so we don't double-bump.
    let leveled = false;
    if (levelStreak >= 3 && level < 6) {
      level++;
      showLevelUpToast(level);
      leveled = true;
      levelCorrect = 0; levelTotal = 0; levelWrong = 0; levelStreak = 0;
      saveProgress();
    }
    // SLOW PATH — after LEVEL_CAP questions in a level, decide a
    // step. Cap is 5 for L1–L2 and 4 for L3–L6 (per the new spec).
    if (!leveled && levelTotal >= LEVEL_CAP[level]) {
      const { up, down } = adaptThresholds(level);
      if (levelCorrect >= up   && level < 6) { level++; showLevelUpToast(level); }
      else if (levelCorrect <= down && level > 1) { level--; }
      levelCorrect = 0; levelTotal = 0; levelWrong = 0; levelStreak = 0;
      saveProgress();
    }
    // Whenever we LEAVE a level (up or down), wipe the seen-set
    // for the previous AND the destination level so the kid gets
    // a fresh, repeat-free batch on the next visit.
    if (level !== prevLevel) {
      seen[prevLevel].clear();
      seen[level].clear();
    }
    nextQuestion();
  }

  // ---- Persistence ----------------------------------------------
  async function saveProgress() {
    if (!me.id || String(me.id).startsWith('guest-')) return;
    const state = { level, cumulative, scores: {} };
    state.scores[String(level)] = { correct: levelCorrect, total: levelTotal };
    try {
      await window.WCDB.users.update(me.id, { practice_state: state });
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw); u.practice_state = state;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch (e) { /* ignore network blips */ }
  }
})();
