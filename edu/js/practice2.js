// =============================================================
//  Practice 2 — Subtraction Mental Methods 2
//
//  Builds on SMM1 with new methods drawn from Maths Week 5:
//
//    1 — RECAP visual: ones − ones, ten-frame (e.g. 9 − 6)
//    2 — RECAP: 2-digit − 1-digit no-borrow (e.g. 28 − 2)
//    3 — SUBTRACT-TO-TEN visual: 26 − 8 = 26 − 6 − 2, with two
//        ten-frames + extras. Drag/tap to choose the SPLIT and the
//        REMAINDER chips. Wrong drag → tap the slot to undo.
//    4 — SUBTRACT-TO-TEN no visual: same decomposition, chips only.
//    5 — 10s & 1s: 35 − 13 = 35 − 10 − 3 chip decomposition.
//    6 — Bigger numbers: 124 − 13, 389 − 57. Number-fact extension
//        (Use 7 − 5 to solve 70 − 50 / 700 − 500). Single answer box.
//
//  Adaptive:
//    • Start at level 1.
//    • FAST PATH — 3 correct in a row at the current level bumps
//      straight up to the next stage (with 🎉 toast).
//    • SLOW PATH — every 5 questions: ≥ 4 / 5 → up, ≤ 1 / 5 → down.
//    • 3 wrong in a row → "stop or keep going?" prompt.
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

  // Subtract-to-ten split. Returns { a, b, split, remainder, answer }
  // where a - b = a - split - remainder AND (a - split) is a tens
  // boundary. e.g. 26 − 8 → split=6, remainder=2, answer=18.
  function genSubToTen(min, max) {
    while (true) {
      const a = rand(min, max);
      const aOnes = a % 10;
      // Need b > aOnes so we cross a ten (otherwise it's a plain
      // no-borrow problem and the "subtract to ten" method isn't
      // interesting). Cap b at 9 — single digit is the canonical
      // PDF case.
      if (aOnes >= 1 && aOnes <= 8) {
        const minB = aOnes + 1;
        if (minB > 9) continue;
        const b = rand(minB, 9);
        const split = aOnes;            // 26 − 6 → 20
        const remainder = b - split;    // 8 − 6 = 2
        return { a, b, split, remainder, answer: a - b };
      }
    }
  }

  function genQuestion(lv) {
    if (lv === 1) {
      // Recap: ones − ones, visual
      const a = rand(4, 9);
      const b = rand(1, a);
      return { type: 'visual-ones', a, b, answer: a - b };
    }
    if (lv === 2) {
      // 2-digit − 1-digit no borrow (e.g. 28 − 2, 36 − 3)
      const tens = rand(1, 9);
      const ones = rand(2, 9);
      const sub  = rand(1, ones);
      const a = tens * 10 + ones;
      return { type: 'visual-teen', a, b: sub, answer: a - sub };
    }
    if (lv === 3) {
      // Subtract-to-ten WITH visual, decomposition slots
      return Object.assign({ type: 'visual-subtoten' }, genSubToTen(13, 49));
    }
    if (lv === 4) {
      // Subtract-to-ten NO visual, decomposition slots
      return Object.assign({ type: 'chips-subtoten' }, genSubToTen(21, 89));
    }
    if (lv === 5) {
      // 10s & 1s decomposition: 35 − 13 = 35 − 10 − 3
      const aT = rand(2, 9), aO = rand(1, 9);
      const bT = rand(1, Math.max(1, aT - 1));
      const bO = rand(0, aO);
      const a = aT * 10 + aO;
      const b = bT * 10 + bO;
      return {
        type: 'chips-tensones',
        a, b, bT: bT * 10, bO,
        answer: a - b,
      };
    }
    // lv === 6 — Bigger numbers + number-fact extension (single MC).
    // Mix two flavours so the kid sees both:
    //   • 3-digit − 2-digit no-borrow (124 − 13, 389 − 57)
    //   • "If 7-5=2, what is 70-50?" — extended number facts
    if (Math.random() < 0.5) {
      // Extended number fact
      const seedA = rand(2, 9);
      const seedB = rand(1, seedA - 1);
      const scale = [10, 100][rand(0, 1)];
      return { type: 'mc-big', a: seedA * scale, b: seedB * scale, answer: (seedA - seedB) * scale };
    } else {
      // 3-digit − 2-digit no borrow
      const aH = rand(1, 4);
      const aT = rand(2, 9), aO = rand(2, 9);
      const bT = rand(1, aT - 1 < 0 ? 1 : aT);
      const bO = rand(0, aO);
      const a = aH * 100 + aT * 10 + aO;
      const b = bT * 10 + bO;
      return { type: 'mc-big', a, b, answer: a - b };
    }
  }

  function mcChoices(correct) {
    const choices = new Set([correct]);
    while (choices.size < 4) {
      // Plausible distractors near the correct value.
      const scale = correct >= 100 ? 10 : 2;
      const delta = rand(-5 * scale, 5 * scale);
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
    currentQ = genQuestion(level);
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
      case 'visual-ones':     body = renderVisualOnes(q);     break;
      case 'visual-teen':     body = renderVisualTeen(q);     break;
      case 'visual-subtoten': body = renderVisualSubToTen(q); break;
      case 'chips-subtoten':  body = renderChipsSubToTen(q);  break;
      case 'chips-tensones':  body = renderChipsTensOnes(q);  break;
      case 'mc-big':          body = renderMC(q);             break;
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
  // -- L2 visual: 2-digit − 1-digit, all frames full except last --
  function renderVisualTeen(q) {
    const ones = q.a % 10;
    const fullFrames = Math.floor(q.a / 10);
    const frames = [];
    for (let f = 0; f < fullFrames; f++) {
      const cells = [];
      for (let i = 0; i < 10; i++) cells.push(`<div class="pr-cell"><div class="pr-dot"></div></div>`);
      frames.push(`<div class="pr-frame">${cells.join('')}</div>`);
    }
    if (ones > 0) {
      const cells = [];
      for (let i = 0; i < 10; i++) {
        cells.push(`<div class="pr-cell">${i < ones ? `<div class="pr-dot" data-i="${i}"></div>` : ''}</div>`);
      }
      frames.push(`<div class="pr-frame">${cells.join('')}</div>`);
    }
    return `
      <div class="pr-q"><span>${q.a}</span> − <span>${q.b}</span> = ?</div>
      <div class="pr-visual"><div class="pr-frames-row">${frames.join('')}</div></div>
      <p class="pr-instr">Tap ${q.b} dot${q.b===1?'':'s'} from the last frame, then type the answer.</p>
      <div class="pr-answer-row"><input type="number" id="ansInput" class="pr-input" inputmode="numeric"></div>
    `;
  }
  // -- L3 visual: subtract-to-ten with chips ---------------------
  //  26 − 8  →  26 − [6] − [2]  →  [18]
  //  Show all 26 dots as full frames + remainder; method shown as
  //  filled-in equation skeleton (kid drags chips into the empty
  //  slots, picking the SPLIT then the REMAINDER then the ANSWER).
  function renderVisualSubToTen(q) {
    const fullFrames = Math.floor(q.a / 10);
    const ones = q.a % 10;
    const frames = [];
    for (let f = 0; f < fullFrames; f++) {
      const cells = [];
      for (let i = 0; i < 10; i++) cells.push(`<div class="pr-cell"><div class="pr-dot"></div></div>`);
      frames.push(`<div class="pr-frame">${cells.join('')}</div>`);
    }
    if (ones > 0) {
      const cells = [];
      for (let i = 0; i < 10; i++) {
        cells.push(`<div class="pr-cell">${i < ones ? `<div class="pr-dot"></div>` : ''}</div>`);
      }
      frames.push(`<div class="pr-frame">${cells.join('')}</div>`);
    }
    return `
      <div class="pr-q"><span>${q.a}</span> − <span>${q.b}</span> = ?</div>
      <div class="pr-visual"><div class="pr-frames-row">${frames.join('')}</div></div>
      <p class="pr-instr">First subtract to a ten. Goal: <strong>${q.a}</strong> − <strong>${q.split}</strong> − <strong>${q.remainder}</strong> = <strong>${q.answer}</strong></p>
      ${renderDecompRow(q.a)}
      ${renderChipPool([q.split, q.remainder, q.answer, q.a - q.split])}
    `;
  }
  // -- L4 chips: subtract-to-ten no visual ----------------------
  function renderChipsSubToTen(q) {
    return `
      <div class="pr-q"><span>${q.a}</span> − <span>${q.b}</span> = ?</div>
      <p class="pr-instr">Subtract to a ten. Goal: <strong>${q.a}</strong> − <strong>${q.split}</strong> − <strong>${q.remainder}</strong> = <strong>${q.answer}</strong></p>
      ${renderDecompRow(q.a)}
      ${renderChipPool([q.split, q.remainder, q.answer,
                        q.split + 1, q.remainder + 1, q.a - q.split])}
    `;
  }
  // -- L5 chips: 10s & 1s decomposition (35 − 13 = 35 − 10 − 3) -
  function renderChipsTensOnes(q) {
    return `
      <div class="pr-q"><span>${q.a}</span> − <span>${q.b}</span> = ?</div>
      <p class="pr-instr">Take away the 10s, then the 1s. Goal: <strong>${q.a}</strong> − <strong>${q.bT}</strong> − <strong>${q.bO}</strong> = <strong>${q.answer}</strong></p>
      ${renderDecompRow(q.a)}
      ${renderChipPool([q.bT, q.bO, q.answer,
                        q.bT + 10, Math.max(0, q.bO + 2), q.answer - 1, q.answer + 2])}
    `;
  }
  // Shared decomposition slot row: [a] − [?] − [?] = [?]
  function renderDecompRow(aPrefilled) {
    return `
      <div class="pr-decomp">
        <div class="slot filled" data-slot="0">${aPrefilled}</div>
        <span>−</span>
        <div class="slot" data-slot="1">?</div>
        <span>−</span>
        <div class="slot" data-slot="2">?</div>
        <span>=</span>
        <div class="slot" data-slot="3">?</div>
      </div>
    `;
  }
  function renderChipPool(values) {
    // Dedupe + shuffle. Negatives filtered (extended-distractors).
    const pool = [...new Set(values.filter(v => v >= 0))];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return `<div class="pr-chips">
      ${pool.map(v => `<button class="pr-chip" data-v="${v}" draggable="true">${v}</button>`).join('')}
    </div>`;
  }
  // -- L6 multiple choice (big numbers + extended facts) --------
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
    if (q.type === 'visual-ones' || q.type === 'visual-teen') {
      const dots = document.querySelectorAll('.pr-dot[data-i]');
      dots.forEach(d => {
        d.addEventListener('click', () => {
          d.classList.toggle('taken');
        });
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
    } else if (q.type === 'mc-big') {
      document.querySelectorAll('.pr-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;
          checkMC(q, parseInt(btn.dataset.c, 10), btn);
        });
      });
    } else if (q.type === 'visual-subtoten' || q.type === 'chips-subtoten') {
      wireDecomp(q, [q.a, q.split, q.remainder, q.answer]);
    } else if (q.type === 'chips-tensones') {
      wireDecomp(q, [q.a, q.bT, q.bO, q.answer]);
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

  // Decomp: fills four slots according to `expected`. Slot 0 is
  // pre-filled with q.a (the starting number), so kids actually
  // only fill slots 1, 2, 3 — but we still grade all four so the
  // feedback can flag if anyone monkey-patched slot 0 somehow.
  // Drag-cancel: tapping a filled (non-pre-filled) slot pops the
  // chip back to the pool.
  function wireDecomp(q, expected) {
    const slots = document.querySelectorAll('.pr-decomp .slot');
    const slotVals = new Array(slots.length).fill(-1);
    // Slot 0 starts already filled with q.a → mark it.
    slotVals[0] = q.a;

    function nextEmpty() {
      // Skip slot 0 (pre-filled). Fill 1 → 2 → 3 left-to-right.
      for (let i = 1; i < slotVals.length; i++) if (slotVals[i] === -1) return i;
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
        answered = true;
        let allOk = true;
        for (let k = 1; k < slotVals.length; k++) {
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

    function unfill(i) {
      if (answered) return;
      if (i === 0) return;                 // pre-filled — locked
      if (slotVals[i] === -1) return;
      const v = slotVals[i];
      slots[i].textContent = '?';
      slots[i].classList.remove('filled');
      slots[i].style.borderColor = '';
      slots[i].style.background  = '';
      slots[i].style.color       = '';
      slotVals[i] = -1;
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
      if (i === 0) return;                 // pre-filled — no listeners
      slot.addEventListener('dragover', e => e.preventDefault());
      slot.addEventListener('drop', e => {
        e.preventDefault();
        if (answered) return;
        const v = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!Number.isFinite(v)) return;
        if (slotVals[i] !== -1) unfill(i);
        const btn = document.querySelector('.pr-chip[data-v="' + v + '"]:not(:disabled)');
        fill(v, btn);
      });
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
    let leveled = false;
    if (levelStreak >= 3 && level < 6) {
      level++;
      showLevelUpToast(level);
      leveled = true;
      levelCorrect = 0; levelTotal = 0; levelWrong = 0; levelStreak = 0;
      saveProgress();
    }
    if (!leveled && levelTotal >= 5) {
      if (levelCorrect >= 4 && level < 6) {
        level++;
        showLevelUpToast(level);
      } else if (levelCorrect <= 1 && level > 1) {
        level--;
      }
      levelCorrect = 0; levelTotal = 0; levelWrong = 0; levelStreak = 0;
      saveProgress();
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
