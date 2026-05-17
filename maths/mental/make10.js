// =============================================================
//  Make 10 — number-bond visualiser with popsicles.
//
//  State:
//    greenCount  0..10  (left input, green popsicles, from LEFT)
//    redCount    0..10  (right input, red popsicles, from RIGHT)
//    form        'add' | 'sub-left' | 'sub-right'
//
//  Cell occupancy rule:
//    - cells[0 .. greenCount-1]              → green popsicle
//    - cells[10-redCount .. 9]               → red popsicle
//    - When greenCount + redCount > 10 (only possible mid-update),
//      whichever was JUST added wins and the other shrinks by the
//      overlap. We clamp through setGreen / setRed so this never
//      persists as visible state.
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);

  const PER_FRAME = 10;
  let greenCount = 7;
  let redCount   = 3;
  let form       = 'add';     // 'add' | 'sub-left' | 'sub-right'

  // ---- Click sound -----------------------------------------------
  const clickSrc = $('clickSound');
  function playClick() {
    if (!clickSrc) return;
    try { const s = clickSrc.cloneNode(); s.volume = 0.6; s.play().catch(()=>{}); } catch {}
  }

  // ---- Frame rendering -------------------------------------------
  // Build the 10 cells once; only the popsicle children inside
  // change as state evolves. That way the pop-in animation on each
  // cell plays only when its OCCUPANCY changes.
  function buildFrame() {
    const host = $('frame');
    host.innerHTML = '';
    for (let i = 0; i < PER_FRAME; i++) {
      const cell = document.createElement('div');
      cell.className = 'm10-cell';
      cell.dataset.idx = String(i);
      // Pre-create both colour popsicles inside; we toggle .show
      // on the right one for the cell's current state.
      const g = document.createElement('div');
      g.className = 'm10-pop green';
      const r = document.createElement('div');
      r.className = 'm10-pop red';
      cell.appendChild(g);
      cell.appendChild(r);
      host.appendChild(cell);
    }
  }

  function renderFrame() {
    const cells = document.querySelectorAll('.m10-cell');
    cells.forEach((cell, i) => {
      const g = cell.querySelector('.m10-pop.green');
      const r = cell.querySelector('.m10-pop.red');
      // Green fills from left: indices 0 to greenCount-1.
      const wantGreen = i < greenCount;
      // Red fills from right: indices 10-redCount to 9.
      const wantRed   = i >= (PER_FRAME - redCount);
      // Overlap resolution — if both want this cell, RED wins by
      // default (most recent action will adjust the OTHER count
      // through setGreen / setRed, so this only matters
      // transiently).
      g.classList.toggle('show', wantGreen && !wantRed);
      r.classList.toggle('show', wantRed);
    });
  }

  // ---- State setters ---------------------------------------------
  // Clamp such that green + red ≤ 10. Typing in one input shrinks
  // the OTHER if necessary (we honour the most-recent intent).
  function setGreen(n, opts = {}) {
    n = Math.max(0, Math.min(10, n | 0));
    greenCount = n;
    if (greenCount + redCount > 10) redCount = 10 - greenCount;
    if (!opts.skipInputs) syncInputs();
    renderFrame();
    renderDesc();
    syncSum();
  }
  function setRed(n, opts = {}) {
    n = Math.max(0, Math.min(10, n | 0));
    redCount = n;
    if (greenCount + redCount > 10) greenCount = 10 - redCount;
    if (!opts.skipInputs) syncInputs();
    renderFrame();
    renderDesc();
    syncSum();
  }

  function syncInputs() {
    const li = $('leftInput'); const ri = $('rightInput');
    if (li && document.activeElement !== li) li.value = greenCount;
    if (ri && document.activeElement !== ri) ri.value = redCount;
  }

  // ---- Equation row (rebuilt on form change) ---------------------
  // Each piece (left input, op, right input, =, 10, op2, etc.)
  // gets re-attached fresh, but the same input elements are reused
  // by moving them around — keeps the input listeners intact and
  // lets the focus / value survive a form swap.
  let leftInput, rightInput;   // single shared inputs across forms

  function ensureInputs() {
    if (!leftInput) {
      leftInput = document.createElement('input');
      leftInput.id = 'leftInput';
      leftInput.type = 'number';
      leftInput.className = 'm10-num m10-num-green';
      leftInput.min = 0; leftInput.max = 10;
      leftInput.inputMode = 'numeric';
      leftInput.value = greenCount;
      leftInput.addEventListener('input', () => {
        const v = parseInt(leftInput.value, 10);
        setGreen(Number.isFinite(v) ? v : 0, { skipInputs: true });
      });
      leftInput.addEventListener('dblclick', () => onToggleForm('left'));
    }
    if (!rightInput) {
      rightInput = document.createElement('input');
      rightInput.id = 'rightInput';
      rightInput.type = 'number';
      rightInput.className = 'm10-num m10-num-red';
      rightInput.min = 0; rightInput.max = 10;
      rightInput.inputMode = 'numeric';
      rightInput.value = redCount;
      rightInput.addEventListener('input', () => {
        const v = parseInt(rightInput.value, 10);
        setRed(Number.isFinite(v) ? v : 0, { skipInputs: true });
      });
      rightInput.addEventListener('dblclick', () => onToggleForm('right'));
    }
  }

  function makeOp(text, klass) {
    const s = document.createElement('span');
    s.className = 'm10-op ' + (klass || '');
    s.textContent = text;
    return s;
  }
  // Right-hand side of the equation = the LIVE sum of green + red.
  // (Was a hard-coded "10" earlier.) Saved into `sumSpan` so the
  // setter functions can update its text in-place without rebuilding
  // the whole equation row on every keystroke.
  let sumSpan = null;
  function makeSum() {
    const s = document.createElement('span');
    s.className = 'm10-num m10-ten';
    s.textContent = String(greenCount + redCount);
    sumSpan = s;
    return s;
  }
  function syncSum() {
    if (sumSpan) sumSpan.textContent = String(greenCount + redCount);
  }

  function renderEquation() {
    ensureInputs();
    const eq = $('eqRow');
    eq.innerHTML = '';
    if (form === 'add') {
      eq.appendChild(leftInput);
      eq.appendChild(makeOp('+', 'm10-op-plus'));
      eq.appendChild(rightInput);
      eq.appendChild(makeOp('='));
      eq.appendChild(makeSum());
    } else if (form === 'sub-left') {
      // L = 10 − R
      eq.appendChild(leftInput);
      eq.appendChild(makeOp('='));
      eq.appendChild(makeSum());
      eq.appendChild(makeOp('−', 'm10-op-minus'));
      eq.appendChild(rightInput);
    } else if (form === 'sub-right') {
      // R = 10 − L
      eq.appendChild(rightInput);
      eq.appendChild(makeOp('='));
      eq.appendChild(makeSum());
      eq.appendChild(makeOp('−', 'm10-op-minus'));
      eq.appendChild(leftInput);
    }
    syncInputs();
  }

  // ---- Description text ------------------------------------------
  function renderDesc() {
    const el = $('desc');
    if (greenCount + redCount === 10 && greenCount > 0 && redCount > 0) {
      el.innerHTML =
        `<span class="num-10">10</span> is made of ` +
        `<span class="num-g">${greenCount}</span> and ` +
        `<span class="num-r">${redCount}</span>`;
    } else if (greenCount + redCount === 10) {
      // Edge case: one is 0 — still "10 is made of N and 0" reads OK.
      el.innerHTML =
        `<span class="num-10">10</span> is made of ` +
        `<span class="num-g">${greenCount}</span> and ` +
        `<span class="num-r">${redCount}</span>`;
    } else {
      const need = 10 - (greenCount + redCount);
      el.innerHTML =
        `<span class="ghost">Add ${need} more to make 10!</span>`;
    }
  }

  // ---- Equation toggle with arc animation ------------------------
  // From 'add' → 'sub-left' / 'sub-right': the +R term swoops over
  // 10 in a half-circle and lands on the right, the + becoming −
  // with a red flash. Implemented as a temporary "flyer" element
  // animating via a CSS @keyframes; once it finishes we rebuild
  // the equation row in the new form.
  //
  // From 'sub-*' → 'add' (toggle off): same idea but reversed —
  // the −R term flies back left. We use the same flyer animation
  // with negated coordinates.
  function onToggleForm(which) {
    playClick();
    const newForm =
      (form === 'add' && which === 'left')  ? 'sub-left'  :
      (form === 'add' && which === 'right') ? 'sub-right' :
      'add';   // any toggle while in a sub-form returns to add
    if (newForm === form) return;
    animateFormChange(form, newForm);
  }

  function animateFormChange(fromForm, toForm) {
    // Capture the CURRENT positions of the moving piece (the
    // operand that will swap sides — `+R` or `+L` depending on
    // form). We use the centre of "10" as a pivot point.
    const tenEl = $('eqRow').querySelector('.m10-ten');
    if (!tenEl) { form = toForm; renderEquation(); renderDesc(); return; }

    // Figure out which "side" of 10 the flyer starts on.
    //   add → sub-left  : the +R element is currently LEFT of 10
    //                     (between leftInput and =), flies RIGHT
    //   add → sub-right : the +L element... wait — for sub-right
    //                     the LEFT operand flips with the RIGHT.
    //                     The +R stays in place visually; the L
    //                     moves to the right side. But that's a
    //                     bigger reorder. Simpler: keep the same
    //                     flyer pattern — "+ <other operand>"
    //                     arcs from left of 10 to right of 10.
    //   sub-* → add     : the − operand flies BACK from right to
    //                     left, regaining a + sign.
    let flyerText, dx, dy = 0, becomesMinus;
    const tenRect = tenEl.getBoundingClientRect();
    const tenCx = tenRect.left + tenRect.width / 2;
    const tenCy = tenRect.top  + tenRect.height / 2;

    if (fromForm === 'add' && toForm === 'sub-left') {
      // +R flies from before-10 to after-10. Start = (left of 10 - 50).
      // End   = right of 10 + 50.
      flyerText = '+' + redCount;
      dx = (tenRect.right + 60) - (tenRect.left - 60);   // approx travel
      becomesMinus = true;
    } else if (fromForm === 'add' && toForm === 'sub-right') {
      flyerText = '+' + greenCount;
      dx = (tenRect.right + 60) - (tenRect.left - 60);
      becomesMinus = true;
    } else if (toForm === 'add') {
      // Flying back from right to left — minus → plus.
      const num = (fromForm === 'sub-left') ? redCount : greenCount;
      flyerText = '−' + num;
      dx = -((tenRect.right + 60) - (tenRect.left - 60));
      becomesMinus = false;
    }

    // Pre-position the flyer at the operand's current visual spot.
    const host = $('flyerHost');
    const flyer = document.createElement('div');
    flyer.className = 'm10-flyer';
    flyer.textContent = flyerText;
    flyer.style.left = (
      (fromForm === 'add' ? (tenRect.left - 80) : (tenRect.right + 40))
    ) + 'px';
    flyer.style.top  = (tenRect.top + 6) + 'px';
    flyer.style.setProperty('--dx', dx + 'px');
    flyer.style.setProperty('--dy', dy + 'px');
    host.appendChild(flyer);

    // Hide the original operand AND the connecting + / − while
    // the flyer is mid-arc, then rebuild the equation in the new
    // form when it lands.
    const eq = $('eqRow');
    // crude hide: drop opacity of everything except 10 + LEFT (or RIGHT)
    // input — keeping the "stays put" side legible.
    eq.classList.add('m10-eq-mid-anim');
    [...eq.children].forEach(child => {
      // Hide the operand spans (+, −) and the input that's moving.
      // The "static" input on the left (for the new form) stays.
      const isMovingOp   = child.classList.contains('m10-op-plus')
                        || child.classList.contains('m10-op-minus');
      const isMovingInput = (fromForm === 'add' && toForm === 'sub-left'  && child === rightInput)
                         || (fromForm === 'add' && toForm === 'sub-right' && child === leftInput)
                         || (fromForm === 'sub-left'  && toForm === 'add' && child === rightInput)
                         || (fromForm === 'sub-right' && toForm === 'add' && child === leftInput);
      if (isMovingOp || isMovingInput) {
        child.style.visibility = 'hidden';
      }
    });

    // Kick the animation on the next frame so the start position
    // is applied first.
    requestAnimationFrame(() => flyer.classList.add('go'));

    flyer.addEventListener('animationend', () => {
      flyer.remove();
      eq.classList.remove('m10-eq-mid-anim');
      // Clear the inline `visibility: hidden` we set during the
      // animation — without this, when renderEquation() re-attaches
      // the SAME input element in its new slot, the hidden style
      // travels with it and the moved number stays invisible on
      // the right of "10".
      if (leftInput)  leftInput.style.visibility  = '';
      if (rightInput) rightInput.style.visibility = '';
      form = toForm;
      renderEquation();
      renderDesc();
    }, { once: true });
  }

  // ---- Sis buttons ------------------------------------------------
  // Single click: add a popsicle of that colour. When all 10 cells
  // are full, clicking the OPPOSITE colour pushes one of THIS
  // colour off (red-sis at full → red++ and green-- by one).
  // Double click: flip equation form (green-sis = left, red-sis = right).
  $('greenSis').addEventListener('click', () => {
    playClick();
    if (greenCount >= 10) return;
    if (greenCount + redCount < 10) {
      setGreen(greenCount + 1);
    } else {
      // Full. Green pushes red off.
      setRed(Math.max(0, redCount - 1));
      setGreen(greenCount + 1);
    }
  });
  $('redSis').addEventListener('click', () => {
    playClick();
    if (redCount >= 10) return;
    if (greenCount + redCount < 10) {
      setRed(redCount + 1);
    } else {
      // Full. Red pushes green off.
      setGreen(Math.max(0, greenCount - 1));
      setRed(redCount + 1);
    }
  });
  $('greenSis').addEventListener('dblclick', () => onToggleForm('left'));
  $('redSis').addEventListener('dblclick',   () => onToggleForm('right'));

  // ---- Hide toggle ------------------------------------------------
  function toggleHide() {
    playClick();
    const btn = $('hideBtn');
    const next = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    btn.textContent = next ? 'Show' : 'Hide';
    document.body.classList.toggle('eq-hidden', next);
  }
  $('hideBtn').addEventListener('click', toggleHide);

  // ---- Keyboard shortcuts -----------------------------------------
  //   ←            click green sis  (add a green popsicle)
  //   →            click red sis    (add a red popsicle)
  //   a            double-click green sis  (flip to "L = 10 − R")
  //   d            double-click red sis    (flip to "R = 10 − L")
  // Skipped while an <input> is focused so the student can still
  // type digits / use arrow keys to step the input value.
  function isInInput() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isInInput()) return;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        $('greenSis').click();
        break;
      case 'ArrowRight':
        e.preventDefault();
        $('redSis').click();
        break;
      case 'a':
      case 'A':
        e.preventDefault();
        onToggleForm('left');
        break;
      case 'd':
      case 'D':
        e.preventDefault();
        onToggleForm('right');
        break;
      case ' ':
        e.preventDefault();
        // Clear board — both counts to 0, frame empty, equation
        // reads "0 + 0 = 10" so the student can start a new bond.
        playClick();
        setGreen(0);
        setRed(0);
        break;
      case 'h':
      case 'H':
        e.preventDefault();
        toggleHide();
        break;
    }
  });

  // ---- Boot -------------------------------------------------------
  buildFrame();
  renderEquation();
  renderFrame();
  renderDesc();
})();
