// =============================================================
//  Practice 2 — Subtraction Mental Methods 2
//
//  Six levels, all 2-digit no-borrow subtraction. Picture levels
//  cap `a` at 39 so the ten-frame row fits the card.
//
//    L1 — 2-digit − 1-digit, WITH picture   (e.g. 25 − 4)
//    L2 — 2-digit − 2-digit, WITH picture   (e.g. 25 − 14)
//    L3 — 2-digit − 2-digit, NO picture     (e.g. 25 − 14)
//    L4 — 2-digit − 1-digit, NO picture     (e.g. 39 − 6)
//    L5 — 2-digit − 2-digit, WITH picture   (e.g. 39 − 16)
//    L6 — 2-digit − 2-digit, NO picture     (e.g. 39 − 16, bigger range)
//
//  Adaptive:
//    • Start at level 1.
//    • FAST PATH — 3 correct in a row → level up + 🎉 toast.
//    • SLOW PATH — after LEVEL_CAP questions in a level:
//        - ≥ up threshold correct → up
//        - ≤ down threshold correct → down
//        - else stay
//      LEVEL_CAP is 5 for L1–L2 and 4 for L3–L6 (per the new spec
//      that limits each L3+ level to 4 problems per visit).
//    • 3 wrong in a row → "stop or keep going?" prompt.
//
//  No-repeat-within-session: per-level Set of "a-b" keys we've
//  already shown. Reset when the kid leaves a level so the next
//  visit starts fresh.
//
//  Cumulative score = sum of (correct × 10), persisted to
//  wc_users.smm2_practice_state.cumulative. ≥ 80 unlocks Race 2.
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);
  const me = window.WCAuth && window.WCAuth.session();
  if (!me) { window.location.href = './index.html'; return; }

  // ---- State ------------------------------------------------------
  let level = 1;
  let cumulative = 0;
  let levelCorrect = 0;
  let levelTotal   = 0;
  let levelWrong   = 0;
  let levelStreak  = 0;
  let currentQ = null;
  let answered = false;

  // ---- Per-level question pool guards ----------------------------
  const seen = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set() };
  const LEVEL_CAP = { 1: 5, 2: 5, 3: 4, 4: 4, 5: 4, 6: 4 };
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
    return genQuestion(lv);
  }

  // ---- Boot -------------------------------------------------------
  (async function init() {
    try {
      const fresh = await window.WCDB.users.byId(me.id);
      const ps = (fresh && fresh.smm2_practice_state && typeof fresh.smm2_practice_state === 'object') ? fresh.smm2_practice_state : {};
      level      = Math.max(1, Math.min(6, ps.level || 1));
      cumulative = ps.cumulative || 0;
    } catch (e) { console.warn('smm2 practice_state load failed', e); }
    paintCumulative();
    nextQuestion();
  })();

  function paintCumulative() {
    $('cumulative').textContent = cumulative;
    $('levelInfo').textContent  = 'Level ' + level;
  }

  // ---- Question generation ---------------------------------------
  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

  // 2-digit minus 2-digit, no borrow, with a capped at `aMax`.
  //   • aT (tens digit of a) in [2, floor(aMax/10)]
  //   • bT in [1, aT - 1]  (strictly less so it's a real 2-digit b)
  //   • aO in [2, 9]       (≥ 2 leaves room for bO)
  //   • bO in [0, aO]      (no borrow)
  function twoDigMinusTwoDig(aMax) {
    const maxT = Math.floor(aMax / 10);
    const aT = rand(2, maxT);
    const aO = rand(2, 9);
    const a  = aT * 10 + aO;
    if (a > aMax) return twoDigMinusTwoDig(aMax); // re-roll on overflow
    const bT = rand(1, Math.max(1, aT - 1));
    const bO = rand(0, aO);
    const b  = bT * 10 + bO;
    return { a, b, answer: a - b };
  }

  // 2-digit minus 1-digit, no borrow.
  //   • a in [aMin, aMax] with ones >= 1 (so we can subtract at least 1)
  //   • b in [1, ones(a)]
  function twoDigMinusOneDig(aMin, aMax) {
    while (true) {
      const a = rand(aMin, aMax);
      const ones = a % 10;
      if (ones >= 1) {
        const b = rand(1, ones);
        return { a, b, answer: a - b };
      }
    }
  }

  function genQuestion(lv) {
    if (lv === 1) {
      // L1: WITH picture, 2-digit − 1-digit (e.g. 25 − 4).
      // a ≤ 29 keeps the picture to 3 frames max.
      const q = twoDigMinusOneDig(11, 29);
      return Object.assign({ type: 'visual-input' }, q);
    }
    if (lv === 2) {
      // L2: WITH picture, 2-digit − 2-digit (e.g. 25 − 14).
      // a ≤ 29 keeps the picture compact.
      const q = twoDigMinusTwoDig(29);
      return Object.assign({ type: 'visual-input' }, q);
    }
    if (lv === 3) {
      // L3: NO picture, same shape as L2 (e.g. 25 − 14).
      // Up to 39 (still small) since no picture constraint.
      const q = twoDigMinusTwoDig(39);
      return Object.assign({ type: 'mc' }, q);
    }
    if (lv === 4) {
      // L4: NO picture, 2-digit − 1-digit (e.g. 39 − 6). a can
      // span the whole 2-digit range now.
      const q = twoDigMinusOneDig(11, 99);
      return Object.assign({ type: 'mc' }, q);
    }
    if (lv === 5) {
      // L5: WITH picture, 2-digit − 2-digit (e.g. 39 − 16).
      // a ≤ 39 caps the picture to 4 frames.
      const q = twoDigMinusTwoDig(39);
      return Object.assign({ type: 'visual-input' }, q);
    }
    // lv === 6: NO picture, 2-digit − 2-digit, bigger range.
    const q = twoDigMinusTwoDig(99);
    return Object.assign({ type: 'mc' }, q);
  }

  function mcChoices(correct) {
    const choices = new Set([correct]);
    while (choices.size < 4) {
      const delta = rand(-9, 9);
      const c = correct + delta;
      if (c >= 0 && c !== correct) choices.add(c);
    }
    const arr = [...choices];
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
      case 'visual-input': body = renderVisualInput(q); break;
      case 'mc':           body = renderMC(q);          break;
    }
    card.innerHTML = heading + body +
      `<div class="pr-feedback" id="feedback"><span id="fbBody"></span></div>
       <div class="pr-actions">
         <button class="pr-next" id="nextBtn" disabled>Next →</button>
       </div>`;
    wireRender(q);
    $('nextBtn').addEventListener('click', onNext);
  }

  // Render `a` dots across as many full ten-frames as needed,
  // plus a partial frame for the leftover ones. Every dot is
  // tappable as a visual "take away" aid — toggles a × overlay.
  // The kid still types the answer in the input.
  function renderVisualInput(q) {
    const fullFrames = Math.floor(q.a / 10);
    const ones       = q.a % 10;
    const frames = [];
    let globalIdx = 0;
    for (let f = 0; f < fullFrames; f++) {
      const cells = [];
      for (let i = 0; i < 10; i++) {
        cells.push(`<div class="pr-cell"><div class="pr-dot" data-i="${globalIdx++}"></div></div>`);
      }
      frames.push(`<div class="pr-frame">${cells.join('')}</div>`);
    }
    if (ones > 0) {
      const cells = [];
      for (let i = 0; i < 10; i++) {
        cells.push(`<div class="pr-cell">${i < ones ? `<div class="pr-dot" data-i="${globalIdx++}"></div>` : ''}</div>`);
      }
      frames.push(`<div class="pr-frame">${cells.join('')}</div>`);
    }
    return `
      <div class="pr-q"><span>${q.a}</span> − <span>${q.b}</span> = ?</div>
      <div class="pr-visual"><div class="pr-frames-row">${frames.join('')}</div></div>
      <p class="pr-instr">Tap dots to take them away (or just count in your head), then type the answer.</p>
      <div class="pr-answer-row"><input type="number" id="ansInput" class="pr-input" inputmode="numeric"></div>
    `;
  }

  function renderMC(q) {
    const choices = mcChoices(q.answer);
    return `
      <div class="pr-q"><span>${q.a}</span> − <span>${q.b}</span> = ?</div>
      <div class="pr-choices">
        ${choices.map(c => `<button class="pr-choice" data-c="${c}">${c}</button>`).join('')}
      </div>
    `;
  }

  // ---- Wire after render ----------------------------------------
  function wireRender(q) {
    if (q.type === 'visual-input') {
      document.querySelectorAll('.pr-dot[data-i]').forEach(d => {
        d.addEventListener('click', () => d.classList.toggle('taken'));
      });
      const inp = $('ansInput');
      inp.addEventListener('input', () => {
        const v = parseInt(inp.value, 10);
        $('nextBtn').disabled = !Number.isFinite(v);
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !$('nextBtn').disabled) checkInput(q, inp.value);
      });
      const next = $('nextBtn');
      next.disabled = true;
      next.onclick = () => {
        if (!answered) { checkInput(q, inp.value); return; }
        onNext();
      };
    } else if (q.type === 'mc') {
      document.querySelectorAll('.pr-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;
          checkMC(q, parseInt(btn.dataset.c, 10), btn);
        });
      });
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

  function showLevelUpToast(newLevel) {
    const old = document.querySelector('.pr-levelup');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'pr-levelup';
    t.innerHTML = `🎉 <strong>Level up!</strong> Welcome to Level ${newLevel}`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 2200);
  }

  function onNext() {
    if (levelWrong >= 3) {
      if (confirm("You've missed 3 in a row. Do you want to stop now?")) {
        window.location.href = './home.html';
        return;
      }
      levelWrong = 0;
    }
    const prevLevel = level;
    let leveled = false;
    if (levelStreak >= 3 && level < 6) {
      level++;
      showLevelUpToast(level);
      leveled = true;
      levelCorrect = 0; levelTotal = 0; levelWrong = 0; levelStreak = 0;
      saveProgress();
    }
    if (!leveled && levelTotal >= LEVEL_CAP[level]) {
      const { up, down } = adaptThresholds(level);
      if (levelCorrect >= up   && level < 6) { level++; showLevelUpToast(level); }
      else if (levelCorrect <= down && level > 1) { level--; }
      levelCorrect = 0; levelTotal = 0; levelWrong = 0; levelStreak = 0;
      saveProgress();
    }
    // Fresh batch on every level visit — wipe both the level we
    // just left AND the one we're entering so repeat problems
    // don't bleed across visits.
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
      await window.WCDB.users.update(me.id, { smm2_practice_state: state });
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw); u.smm2_practice_state = state;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch (e) { /* ignore network blips */ }
  }
})();
