// =============================================================
//  Mental Subtraction — tens-frame visualiser
//
//  Equation row pieces (every number is wrapped so we can layer
//  a coloured-digit overlay on top of the input):
//
//    [X-wrap] − [Y-wrap] = [decomp row, if Y≥10 & ones>0] [ans]
//
//  Above each NUMBER:
//    • Gradient bubble — red→green pill. Click toggles colour-
//      coding for that number (tens digit red, ones digit green).
//      Y's gradient also colours the decomposition box digits +
//      paints the matching dog cells in the tens-frame below.
//    • "?" bubble (Y only, when Y≥10) — auto-fills the
//      decomposition boxes with the correct values
//      (e.g. 29-13 → middle box 10, right box 3). Live typing in
//      the decomp boxes triggers the same cell highlights so the
//      student can spot the matching colours by hand too.
//
//  Click sound: every BUTTON click plays maths/sounds/click.mp3
//  (cloned per call so rapid taps don't queue).
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- State ------------------------------------------------------
  const pressedStack = [];     // flat list of pressed dog ids (for render)
  // Per-USER-ACTION history. Each entry records the dog ids that
  // were flipped by that single action so Backspace can undo the
  // entire action — a frame-check that pressed 10 dogs comes back
  // as 10 unpresses in one Backspace, not ten.
  //   { type: 'press' | 'unpress', ids: string[] }
  const actionHistory = [];
  let colorX        = false;   // gradient on X is active
  let highlightTens = false;   // gradient on Y → also true for Y≥10 with tens
  let highlightOnes = false;   // gradient on Y → also true for Y with ones digit

  const PER_FRAME = 10;

  // ---- Click sound -----------------------------------------------
  // Cloning the source <audio> means tapping fast doesn't choke a
  // single Audio instance ("Sound already playing" stutter). We
  // catch the play() rejection silently — autoplay policies will
  // block the first sound until the user interacts, but every
  // click IS a user interaction so subsequent plays work.
  const clickSrc = $('clickSound');
  function playClick() {
    if (!clickSrc) return;
    try {
      const s = clickSrc.cloneNode();
      s.volume = 0.6;
      s.play().catch(() => {});
    } catch {}
  }

  // Clamp every numeric input to at most TWO digits (max 99). Strips
  // non-digits too so a stray '-' or 'e' (type=number lets those
  // through) can't leak into readEquation. Called at the top of
  // each input handler so the rest of the handler reads the cleaned
  // value rather than the raw keystroke.
  function clampDigits(el) {
    const cleaned = String(el.value || '').replace(/\D/g, '').slice(0, 2);
    if (cleaned !== el.value) el.value = cleaned;
  }

  // ---- Inputs (typing) -------------------------------------------
  $('inputX').addEventListener('input', () => {
    clampDigits($('inputX'));
    pressedStack.length = 0;
    actionHistory.length = 0;
    clearHighlights();
    $('inputDecTens').value = '';
    $('inputDecOnes').value = '';
    setHint('');
    updateAll();
  });
  $('inputY').addEventListener('input', () => {
    clampDigits($('inputY'));
    pressedStack.length = 0;
    actionHistory.length = 0;
    clearHighlights();
    $('inputDecTens').value = '';
    $('inputDecOnes').value = '';
    setHint('');
    updateAll();
  });
  $('inputAns').addEventListener('input', () => {
    clampDigits($('inputAns'));
    setHint('');
  });
  $('inputDecTens').addEventListener('input', () => {
    clampDigits($('inputDecTens'));
    const { x, y } = readEquation();
    const mode     = decompMode(x, y);
    const expected = expectedDecomp(x, y, mode).tens;
    const typed    = parseInt($('inputDecTens').value, 10);
    highlightTens = Number.isFinite(typed) && typed === expected && expected > 0;
    applyAllColors();
    applyHighlightUi();
    applyCellHighlights();
    syncGradY();
    setHint('');
  });
  $('inputDecOnes').addEventListener('input', () => {
    clampDigits($('inputDecOnes'));
    const { x, y } = readEquation();
    const mode     = decompMode(x, y);
    const expected = expectedDecomp(x, y, mode).ones;
    const typed    = parseInt($('inputDecOnes').value, 10);
    highlightOnes = Number.isFinite(typed) && typed === expected && expected > 0;
    applyAllColors();
    applyHighlightUi();
    applyCellHighlights();
    syncGradY();
    setHint('');
  });

  // ---- Bubble buttons --------------------------------------------
  // Gradient buttons — one per number. data-target='x' toggles
  // colorX; data-target='y' toggles both Y-highlights.
  document.querySelectorAll('.mh-grad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      const target = btn.dataset.target;
      if (target === 'x') {
        colorX = !colorX;
      } else if (target === 'y') {
        const { x, y } = readEquation();
        const mode = decompMode(x, y);
        const yOnes = y % 10;
        // Which bands MAKE SENSE to light up for this equation?
        //   sub-to-ten → both (make-10 chunk + remainder chunk)
        //   tens-ones  → both (tens place + ones place of Y)
        //   pure Y<10  → only ones (no tens to colour)
        //   pure Y%10=0 → only tens
        let wantsTens, wantsOnes;
        if (mode === 'sub-to-ten') {
          wantsTens = true;
          wantsOnes = true;
        } else {
          wantsTens = y >= 10;
          wantsOnes = (y < 10) || yOnes > 0;
        }
        const allOn = (!wantsTens || highlightTens) && (!wantsOnes || highlightOnes);
        if (allOn) {
          highlightTens = false;
          highlightOnes = false;
        } else {
          highlightTens = wantsTens;
          highlightOnes = wantsOnes;
        }
      }
      applyAllColors();
      applyHighlightUi();
      applyCellHighlights();
      syncGradButtons();
    });
  });

  // "?" button — TOGGLES the decomposition boxes. First click fills
  // them with the correct values (e.g. 13 → 10 and 3); a second
  // click empties them again. The decomp input handlers reflect
  // both directions: filling activates the matching cell + digit
  // highlights, clearing turns them off.
  $('qBtn').addEventListener('click', () => {
    playClick();
    const { x, y } = readEquation();
    const mode = decompMode(x, y);
    if (mode === 'none') return;
    const exp = expectedDecomp(x, y, mode);
    // Are the boxes already showing the right values? If so, the
    // click is a "hide" toggle — wipe them. Compare against the
    // EXPECTED values so manual typing doesn't accidentally trigger
    // the hide branch (we only auto-clear what we'd auto-fill).
    const tensCurrent  = parseInt($('inputDecTens').value, 10);
    const onesCurrent  = parseInt($('inputDecOnes').value, 10);
    const tensFilled = (tensCurrent === exp.tens);
    const onesFilled = (exp.ones === 0) || (onesCurrent === exp.ones);
    if (tensFilled && onesFilled) {
      $('inputDecTens').value = '';
      $('inputDecOnes').value = '';
    } else {
      $('inputDecTens').value = exp.tens;
      if (exp.ones > 0) $('inputDecOnes').value = exp.ones;
    }
    // Dispatch input events so the existing live-typing handlers
    // re-run — they recompute highlight state from the new (or
    // emptied) values.
    $('inputDecTens').dispatchEvent(new Event('input', { bubbles: true }));
    $('inputDecOnes').dispatchEvent(new Event('input', { bubbles: true }));
  });

  // ---- Check / Reset ---------------------------------------------
  $('checkBtn').addEventListener('click', () => { playClick(); checkAnswer(); });
  $('resetBtn').addEventListener('click', () => {
    playClick();
    pressedStack.length = 0;
    actionHistory.length = 0;
    $('inputAns').value = '';
    $('inputDecTens').value = '';
    $('inputDecOnes').value = '';
    clearHighlights();
    setHint('');
    updateAll();
  });

  // ---- Reading the equation --------------------------------------
  function readEquation() {
    let x = parseInt($('inputX').value, 10);
    let y = parseInt($('inputY').value, 10);
    if (!Number.isFinite(x) || x < 0) x = 0;
    if (!Number.isFinite(y) || y < 0) y = 0;
    if (y > x) y = x;
    return { x, y, dogsX: x, dogsY: y };
  }

  // Which decomposition pattern fits this equation?
  //   'none'       no decomposition needed (Y < 10 with X_ones ≥ Y,
  //                or Y is a pure multiple of 10).
  //   'tens-ones'  the original "take the 10s, then the 1s" path —
  //                Y ≥ 10 with non-zero ones. Boxes hold
  //                [Y_tens × 10, Y_ones]. e.g. 35 − 13 → 10, 3
  //   'sub-to-ten' the new "make-a-ten first" path from PDF page 3 —
  //                Y < 10 AND X ≥ 10 AND X_ones < Y AND X_ones > 0.
  //                Boxes hold [X_ones, Y − X_ones]. e.g. 26 − 8 →
  //                26 − 6 − 2 = 18 (first strip X down to a ten,
  //                then take what's left from the now-clean ten).
  function decompMode(x, y) {
    const yOnes = y % 10;
    if (y >= 10 && yOnes > 0) return 'tens-ones';
    const xOnes = x % 10;
    if (y > 0 && y < 10 && x >= 10 && xOnes > 0 && xOnes < y) return 'sub-to-ten';
    return 'none';
  }
  // Expected values for the two middle decomp boxes, given the mode.
  function expectedDecomp(x, y, mode) {
    if (mode === 'tens-ones') {
      return { tens: Math.floor(y / 10) * 10, ones: y % 10 };
    }
    if (mode === 'sub-to-ten') {
      const xOnes = x % 10;
      return { tens: xOnes, ones: y - xOnes };
    }
    return { tens: 0, ones: 0 };
  }

  // ---- Master update ---------------------------------------------
  function updateAll() {
    const { x, y } = readEquation();
    const mode = decompMode(x, y);

    // Decomp row visibility — show the three-box layout whenever a
    // mental method (tens-ones OR sub-to-ten) applies. "Pure" cases
    // (Y < 10 with X_ones ≥ Y, or Y a multiple of 10) skip the row.
    const showDecomp = mode !== 'none';
    $('decompRow').hidden = !showDecomp;
    if (showDecomp) $('inputDecX').value = x;

    // "?" bubble — visible whenever a decomposition fits.
    $('qBtn').hidden = !showDecomp;

    renderFrames();
    applyAllColors();
    applyHighlightUi();
    applyCellHighlights();
    syncGradButtons();
  }

  // ============================================================
  //  COLOUR OVERLAYS — paint the tens digit red + ones digit green
  //  on top of any input that has its colour-coding flag on.
  //
  //  `mode` controls how the digits are tagged:
  //    'per-digit' (default)  tens digit → red, ones digit → green.
  //                           Used for X, Y, X-static — they're
  //                           "real" numbers whose digits carry
  //                           place-value meaning.
  //    'all-tens'             every digit gets the .tens class
  //                           (whole number painted red). Used by
  //                           the decomp middle box: "10" IS the
  //                           tens part of Y, so the 0 reads red
  //                           alongside the 1 — they belong to one
  //                           tens-block, not separate digits.
  //    'all-ones'             every digit .ones (whole green).
  //                           Used by the decomp right box.
  // ============================================================
  function renderNumberOverlay(overlayId, value, on, mode) {
    const ov = $(overlayId);
    if (!ov) return;
    const wrap = ov.closest('.mh-num-wrap');
    if (wrap) wrap.classList.toggle('has-color', !!on);
    if (!on) { ov.innerHTML = ''; return; }
    const v = String(value ?? '');
    if (!v) { ov.innerHTML = ''; return; }
    let html = '';
    if (mode === 'all-tens') {
      html = v.split('').map(c => `<span class="d tens">${c}</span>`).join('');
    } else if (mode === 'all-ones') {
      html = v.split('').map(c => `<span class="d ones">${c}</span>`).join('');
    } else {
      const ones = v.slice(-1);
      const tens = v.length >= 2 ? v.slice(-2, -1) : '';
      const rest = v.length >= 3 ? v.slice(0, -2) : '';
      if (rest) html += `<span class="d">${rest}</span>`;
      if (tens) html += `<span class="d tens">${tens}</span>`;
      html += `<span class="d ones">${ones}</span>`;
    }
    ov.innerHTML = html;
  }

  // Repaints every per-digit overlay from the current state.
  //   colorX  → X overlay + X-static (decomp X) overlay (per-digit)
  //   anyY    → Y overlay (per-digit)
  //           + decomp tens box (all-tens, e.g. "10" → both red)
  //           + decomp ones box (all-ones)
  function applyAllColors() {
    const { x, y } = readEquation();
    const anyY = highlightTens || highlightOnes;

    renderNumberOverlay('xOverlay',       x,                          colorX);
    renderNumberOverlay('decXOverlay',    x,                          colorX);
    renderNumberOverlay('yOverlay',       y,                          anyY);
    renderNumberOverlay('decTensOverlay', $('inputDecTens').value,    anyY, 'all-tens');
    renderNumberOverlay('decOnesOverlay', $('inputDecOnes').value,    anyY, 'all-ones');
  }

  // The Y overlay can have tens/ones digits independently coloured
  // (e.g. if only the right decomp box has matched). Tag the
  // individual digits with .hl so CSS shows or hides the colour
  // per-digit, on top of the overlay rendering.
  function applyHighlightUi() {
    [
      { ovId: 'yOverlay',       tens: highlightTens, ones: highlightOnes },
      { ovId: 'decTensOverlay', tens: highlightTens, ones: highlightTens },
      { ovId: 'decOnesOverlay', tens: highlightOnes, ones: highlightOnes },
    ].forEach(({ ovId, tens, ones }) => {
      const ov = $(ovId);
      if (!ov) return;
      ov.querySelectorAll('.d.tens').forEach(d => d.classList.toggle('hl', tens));
      ov.querySelectorAll('.d.ones').forEach(d => d.classList.toggle('hl', ones));
    });
    $('inputDecTens').classList.toggle('matched', highlightTens);
    $('inputDecOnes').classList.toggle('matched', highlightOnes);
  }

  function clearHighlights() {
    colorX = false;
    highlightTens = false;
    highlightOnes = false;
    applyAllColors();
    applyHighlightUi();
    syncGradButtons();
    document.querySelectorAll('.mh-dog, .mh-cell').forEach(el => {
      el.classList.remove('hl-tens', 'hl-ones');
    });
  }

  // Light up the active state on the two gradient bubbles +
  // disable / hide the "?" bubble per Y's value.
  function syncGradButtons() {
    document.querySelectorAll('.mh-grad-btn').forEach(btn => {
      const t = btn.dataset.target;
      const on = (t === 'x') ? colorX : (highlightTens || highlightOnes);
      btn.classList.toggle('active', on);
    });
  }
  function syncGradY() { syncGradButtons(); }

  // ============================================================
  //  FRAME RENDERING + dog interactions
  // ============================================================
  function renderFrames() {
    const host = $('framesHost');
    host.innerHTML = '';
    const { dogsX } = readEquation();
    const totalFrames = Math.max(1, Math.ceil(dogsX / PER_FRAME));
    const counts = [];
    let remaining = dogsX;
    for (let i = 0; i < totalFrames; i++) {
      const take = Math.min(PER_FRAME, remaining);
      counts.push(take);
      remaining -= take;
    }

    counts.forEach((dogCount, frameIdx) => {
      const wrap = document.createElement('div');
      wrap.className = 'mh-frame-wrap';

      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'mh-frame-check';
      check.dataset.frame = String(frameIdx);
      check.setAttribute('aria-label', 'Cross out every dog in this group of ten');
      check.title = 'Cross out the whole ten';
      check.innerHTML =
        '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">' +
          '<path d="M4 10.5l3.5 3.5L16 5.5" stroke="currentColor" ' +
                  'stroke-width="2.5" fill="none" stroke-linecap="round" ' +
                  'stroke-linejoin="round"/>' +
        '</svg>';
      check.addEventListener('click', () => { playClick(); onFrameCheck(frameIdx); });
      wrap.appendChild(check);

      const frame = document.createElement('div');
      frame.className = 'mh-frame';
      frame.dataset.frame = String(frameIdx);
      for (let slot = 0; slot < PER_FRAME; slot++) {
        const cell = document.createElement('div');
        cell.className = 'mh-cell';
        if (slot < dogCount) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'mh-dog';
          btn.dataset.frame = String(frameIdx);
          btn.dataset.slot  = String(slot);
          btn.dataset.id    = `f${frameIdx}-${slot}`;
          btn.setAttribute('aria-label', 'Dog — click to subtract');
          btn.addEventListener('click', () => { playClick(); onDogClick(btn); });
          cell.appendChild(btn);
        }
        frame.appendChild(cell);
      }
      wrap.appendChild(frame);
      host.appendChild(wrap);
    });

    syncPressedClasses();
    syncEnabledClicks();
    syncFrameChecks();
  }

  function allDogsInOrder() {
    return Array.from(document.querySelectorAll('.mh-dog'));
  }
  function isPressed(id) { return pressedStack.includes(id); }

  function onDogClick(btn) {
    const id  = btn.dataset.id;
    const idx = pressedStack.indexOf(id);
    if (idx >= 0) {
      pressedStack.splice(idx, 1);
      actionHistory.push({ type: 'unpress', ids: [id] });
    } else {
      pressedStack.push(id);
      actionHistory.push({ type: 'press', ids: [id] });
    }
    setHint('');
    syncPressedClasses();
    syncFrameChecks();
  }

  function onFrameCheck(frameIdx) {
    const frame = document.querySelector(`.mh-frame[data-frame="${frameIdx}"]`);
    if (!frame) return;
    const dogs = Array.from(frame.querySelectorAll('.mh-dog'));
    if (!dogs.length) return;
    const allPressed = dogs.every(d => isPressed(d.dataset.id));
    if (allPressed) {
      // Unpress every dog in the frame as ONE action.
      const ids = dogs.map(d => d.dataset.id);
      dogs.forEach(d => {
        const i = pressedStack.indexOf(d.dataset.id);
        if (i >= 0) pressedStack.splice(i, 1);
      });
      actionHistory.push({ type: 'unpress', ids });
    } else {
      // Press any unpressed dogs in the frame as ONE action.
      const ids = [];
      dogs.forEach(d => {
        if (!isPressed(d.dataset.id)) {
          pressedStack.push(d.dataset.id);
          ids.push(d.dataset.id);
        }
      });
      if (ids.length) actionHistory.push({ type: 'press', ids });
    }
    setHint('');
    syncPressedClasses();
    syncFrameChecks();
  }

  function syncFrameChecks() {
    document.querySelectorAll('.mh-frame-check').forEach(check => {
      const frameIdx = check.dataset.frame;
      const frame = document.querySelector(`.mh-frame[data-frame="${frameIdx}"]`);
      const dogs  = frame ? Array.from(frame.querySelectorAll('.mh-dog')) : [];
      if (!dogs.length) {
        check.disabled = true;
        check.classList.remove('checked');
        return;
      }
      check.disabled = false;
      check.classList.toggle('checked', dogs.every(d => isPressed(d.dataset.id)));
    });
  }

  function syncPressedClasses() {
    allDogsInOrder().forEach(b => {
      b.classList.toggle('pressed', isPressed(b.dataset.id));
      b.classList.remove('glow');
    });
  }
  function syncEnabledClicks() {
    allDogsInOrder().forEach(b => { b.disabled = false; });
  }

  // ============================================================
  //  CELL HIGHLIGHTS — frame-aligned tens / ones colouring
  //
  //  Driven by EITHER the X or the Y gradient bubble:
  //    Y gradient → colour cells per Y's breakdown (the part
  //                 being subtracted). Takes precedence when
  //                 BOTH gradients are active, because Y is the
  //                 specific operation the student is doing.
  //    X gradient → colour cells per X's breakdown (the full
  //                 number). Useful for visualising "29 = 2 tens
  //                 + 9 ones" before subtracting anything.
  //
  //  Either way the rule is identical: tens digit → first N FULL
  //  frames red; ones digit → last `ones` dogs of the last frame
  //  (spillover backward if the last frame is too small for ones).
  // ============================================================
  function applyCellHighlights() {
    const all = allDogsInOrder();
    all.forEach(b => {
      b.classList.remove('hl-tens', 'hl-ones');
      if (b.parentElement) b.parentElement.classList.remove('hl-tens', 'hl-ones');
    });
    const yActive = highlightTens || highlightOnes;
    if (!yActive && !colorX) return;

    const { x, y } = readEquation();
    const mode = decompMode(x, y);

    // ---- sub-to-ten path -----------------------------------------
    // 26 − 8 → first cross the rightmost X_ones dots (the "make-10"
    // step), then the next (Y − X_ones) dots leftward of those.
    // Both chunks live at the END of the dot list — that's the
    // mental picture of subtracting backwards.
    if (mode === 'sub-to-ten' && yActive) {
      const xOnes = x % 10;
      const remn  = y - xOnes;            // remainder after the make-10 step
      // Red ("tens" colour) — the make-10 chunk at the very end.
      if (highlightTens && xOnes > 0) {
        for (let i = Math.max(0, all.length - xOnes); i < all.length; i++) {
          all[i].classList.add('hl-tens');
          if (all[i].parentElement) all[i].parentElement.classList.add('hl-tens');
        }
      }
      // Green ("ones" colour) — the remainder, just before the
      // make-10 chunk.
      if (highlightOnes && remn > 0) {
        const endIdx   = Math.max(0, all.length - xOnes);
        const startIdx = Math.max(0, endIdx - remn);
        for (let i = startIdx; i < endIdx; i++) {
          all[i].classList.add('hl-ones');
          if (all[i].parentElement) all[i].parentElement.classList.add('hl-ones');
        }
      }
      return;
    }

    // Pick the driving number + which colour bands to show.
    let value, srcTens, srcOnes, doTens, doOnes;
    if (yActive) {
      // Y is the focus of the subtraction — its breakdown wins
      // even when X's gradient is also lit.
      value   = y;
      srcTens = Math.floor(y / 10);
      srcOnes = y % 10;
      doTens  = highlightTens;
      doOnes  = highlightOnes;
    } else {
      // X gradient drives — show X's full digit breakdown. Both
      // bands are unconditionally on so 29 reads as 2 reds + 9 greens.
      value   = x;
      srcTens = Math.floor(x / 10);
      srcOnes = x % 10;
      doTens  = true;
      doOnes  = true;
    }

    if (value < 10) {
      if (doOnes && srcOnes > 0) {
        for (let i = Math.max(0, all.length - srcOnes); i < all.length; i++) {
          all[i].classList.add('hl-ones');
          if (all[i].parentElement) all[i].parentElement.classList.add('hl-ones');
        }
      }
      return;
    }

    const frames     = Array.from(document.querySelectorAll('.mh-frame'));
    const framesDogs = frames.map(f => Array.from(f.querySelectorAll('.mh-dog')));
    const lastIdx   = framesDogs.length - 1;

    if (doOnes && srcOnes > 0) {
      let remaining = srcOnes;
      for (let f = lastIdx; f >= 0 && remaining > 0; f--) {
        const frame = framesDogs[f];
        const take  = Math.min(remaining, frame.length);
        const start = frame.length - take;
        for (let i = start; i < frame.length; i++) {
          frame[i].classList.add('hl-ones');
          if (frame[i].parentElement) frame[i].parentElement.classList.add('hl-ones');
        }
        remaining -= take;
      }
    }
    if (doTens && srcTens > 0) {
      const fullIdx = [];
      for (let f = 0; f < framesDogs.length; f++) {
        if (framesDogs[f].length === PER_FRAME) fullIdx.push(f);
      }
      const picked = fullIdx.slice(0, srcTens);
      picked.forEach(idx => {
        framesDogs[idx].forEach(b => {
          b.classList.add('hl-tens');
          if (b.parentElement) b.parentElement.classList.add('hl-tens');
        });
      });
    }
  }

  // ============================================================
  //  CHECK
  // ============================================================
  function checkAnswer() {
    const { x, y, dogsY } = readEquation();
    const ansRaw = parseInt($('inputAns').value, 10);
    if (!Number.isFinite(ansRaw)) {
      return setHint('Type your answer in the orange box first!', 'err');
    }
    const expected = x - y;
    if (ansRaw !== expected) {
      return setHint(`Hmm — try again. (${x} − ${y} isn't ${ansRaw}.)`, 'err');
    }
    const pressed = pressedStack.length;
    if (pressed !== dogsY) {
      const missing = dogsY - pressed;
      if (missing > 0) {
        return setHint(`Almost! Press ${missing} more dog${missing === 1 ? '' : 's'} first.`, 'err');
      }
      return setHint(`Too many pressed — unpress ${pressed - dogsY}.`, 'err');
    }
    const all = allDogsInOrder();
    const unpressed = all.filter(b => !isPressed(b.dataset.id));
    unpressed.forEach(b => b.classList.add('glow'));
    setHint(`Yes! ${x} − ${y} = ${expected} 🎉`, 'ok');
  }

  function setHint(msg, kind) {
    const el = $('hint');
    el.textContent = msg || '';
    el.className = 'mh-hint' + (kind ? ' ' + kind : '');
  }

  // ---- Keyboard shortcuts -----------------------------------------
  // Esc        reset (same as the ↺ Reset button)
  // 1-9        cross out the entire Nth tens-frame (1-indexed)
  // Space      press the rightmost un-pressed dog (subtract one)
  // Tab        focus next equation input (X → Y → decomp → ans)
  // Shift+Tab  focus previous equation input
  //
  // Number / Space keys are SUPPRESSED while an input is focused so
  // the student can still type digits / spaces into the equation.
  // Tab + Esc always work, including from inside an input — Tab so
  // the cursor can move between boxes, Esc so the student can bail
  // out of a half-typed answer in one keystroke.
  const TAB_ORDER = ['inputX', 'inputY', 'inputDecTens', 'inputDecOnes', 'inputAns'];

  function isInInput() {
    const el = document.activeElement;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  }

  function visibleTabOrder() {
    const decompHidden = $('decompRow').hidden;
    return TAB_ORDER.filter(id => {
      const el = $(id);
      if (!el) return false;
      // Decomp inputs are only useful when the decomp row is visible.
      if (decompHidden && (id === 'inputDecTens' || id === 'inputDecOnes')) return false;
      return true;
    });
  }

  function cycleTabFocus(reverse) {
    const order = visibleTabOrder();
    if (!order.length) return;
    const focused = document.activeElement;
    const idx = focused ? order.indexOf(focused.id) : -1;
    let nextIdx;
    if (idx === -1) {
      nextIdx = reverse ? order.length - 1 : 0;
    } else if (reverse) {
      nextIdx = (idx - 1 + order.length) % order.length;
    } else {
      nextIdx = (idx + 1) % order.length;
    }
    const next = $(order[nextIdx]);
    if (next) {
      next.focus();
      // Select the whole value so the next keystroke overwrites it
      // — matches the "tap a box, type your answer" feel.
      try { next.select(); } catch {}
    }
  }

  function pressRightmostUnpressedDog() {
    const all = allDogsInOrder();
    for (let i = all.length - 1; i >= 0; i--) {
      if (!isPressed(all[i].dataset.id)) {
        all[i].click();   // invokes onDogClick → playClick + state update
        return true;
      }
    }
    return false;
  }

  document.addEventListener('keydown', (e) => {
    // Skip when a modifier other than Shift is held — Cmd/Ctrl/Alt
    // combos belong to the browser (copy, refresh, etc.).
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (document.activeElement) document.activeElement.blur();
      $('resetBtn').click();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      cycleTabFocus(e.shiftKey);
      return;
    }
    // Enter — Check answer. Works even when typing in an input
    // (more natural than reaching for the mouse after typing the
    // answer). Doesn't fire when a button is focused so the user
    // can still hit Enter to activate other buttons normally.
    if (e.key === 'Enter') {
      const el = document.activeElement;
      if (el && el.tagName === 'BUTTON') return;   // let button activate
      e.preventDefault();
      $('checkBtn').click();
      return;
    }
    // Numbers + Space leak through to inputs so typing still works.
    if (isInInput()) return;
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      const check = document.querySelector(`.mh-frame-check[data-frame="${idx}"]`);
      if (check && !check.disabled) check.click();
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      pressRightmostUnpressedDog();
      return;
    }
    // `h` toggles the Hide button (collapses the tens-frame area).
    // Same key as the equivalent shortcut on make10.html so the
    // two pages feel consistent.
    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      $('hideBtn').click();
      return;
    }
    // Backspace — undo the most recent USER ACTION as one unit.
    // Pressing a whole frame (✓ button or 1-9 key) counted as ONE
    // action, so a single Backspace unwinds the entire ten at once.
    // A single-dog tap was also one action → undoes just that dog.
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (!actionHistory.length) return;
      const last = actionHistory.pop();
      if (last.type === 'press') {
        // Reverse: remove these ids from pressedStack.
        last.ids.forEach(id => {
          const i = pressedStack.indexOf(id);
          if (i >= 0) pressedStack.splice(i, 1);
        });
      } else {
        // Reverse an unpress: add these ids back.
        last.ids.forEach(id => {
          if (!pressedStack.includes(id)) pressedStack.push(id);
        });
      }
      playClick();
      syncPressedClasses();
      syncFrameChecks();
      return;
    }
  });

  // ---- Cell-style picker (bottom-left) ----------------------------
  // Three radio-style chips: 🐶 dog faces (default), ⚪ plain
  // circles, 🍦 popsicles. Toggled via body classes; CSS swaps
  // the visuals. Each click plays the shared click sound.
  document.querySelectorAll('.mh-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      const style = btn.dataset.style;
      document.body.classList.toggle('cells-circle',   style === 'circle');
      document.body.classList.toggle('cells-popsicle', style === 'popsicle');
      document.querySelectorAll('.mh-style-btn').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      // First time the student enters EITHER themed mode (dog or
      // popsicle) → show its welcome image. Subsequent switches
      // don't re-trigger. Plain ⚪ circle has no welcome.
      if (style === 'popsicle' || style === 'dog') showWelcome(style);
    });
  });

  // ---- Hide button (above style picker) ---------------------------
  // Toggles a body class that collapses the tens-frame area. Lets
  // the student tackle a problem "in their head" without the
  // visual aid, then re-show to verify.
  $('hideBtn').addEventListener('click', () => {
    playClick();
    const btn = $('hideBtn');
    const next = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    btn.textContent = next ? 'Show' : 'Hide';
    document.body.classList.toggle('frames-hidden', next);
  });

  // ---- Welcome overlay --------------------------------------------
  // Shows a centred themed image with a dim backdrop the FIRST time
  // the page enters a given mode. Per-mode shown-once flag, reset
  // on full page refresh (state lives in module memory, not
  // localStorage). Dismiss with any click or Esc.
  const welcomeImages = {
    dog:      './dog-sm.png',
    popsicle: './popsicle-welcome-sm.png',
  };
  const welcomeShown = { dog: false, popsicle: false };
  function showWelcome(mode) {
    const src = welcomeImages[mode];
    if (!src) return;
    if (welcomeShown[mode]) return;
    welcomeShown[mode] = true;
    const ov  = $('welcome');
    const img = $('welcomeImg');
    if (!ov || !img) return;
    img.src = src;
    ov.hidden = false;
  }
  function dismissWelcome() {
    const ov = $('welcome');
    if (!ov || ov.hidden) return false;
    ov.hidden = true;
    return true;
  }
  // Backdrop click dismisses. The image inside has pointer-events:
  // none in CSS so its clicks also bubble to the backdrop.
  $('welcome').addEventListener('click', dismissWelcome);
  // Esc dismisses too (intercept before the existing Esc handler
  // would fire reset — feels strange to reset on welcome dismiss).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('welcome').hidden) {
      e.preventDefault();
      e.stopImmediatePropagation();
      dismissWelcome();
    }
  }, true);   // capture phase so we run before the bubble-phase Esc → reset

  // First paint: enter popsicle mode (default) and show its welcome.
  showWelcome('popsicle');

  // ---- First paint ------------------------------------------------
  updateAll();
})();
