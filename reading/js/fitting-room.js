// =============================================================
//  Teacher → Fitting Room — per-category position offset editor
//
//  Stores offsets in localStorage as `virtual.wear_offsets.v1`.
//  The Space (focus/virtual/index.html) reads the same key on
//  load, so teacher changes are reflected in any avatar opened
//  from the same browser. localStorage is per-origin (shared by
//  /focus/reading and /focus/virtual), but NOT shared across
//  devices — for cross-device sync we'd need a Supabase column.
//
//  Implementation note: the wearables manifest is duplicated from
//  focus/virtual/index.html. Update both when adding wearables.
// =============================================================

(function () {
  const STORAGE_KEY       = 'virtual.wear_offsets.v1';
  const SIZE_STORAGE_KEY  = 'virtual.wear_sizes.v1';
  const LAYER_STORAGE_KEY = 'virtual.wear_layers.v1';
  const SAMPLE_KEY        = 'virtual.fitting_sample.v1';
  // Must match the CSS `transform: scale(...)` on #fitPreview in
  // teacher.html so drag-distance maps cleanly to 1-px logical
  // movement inside the preview.
  const PREVIEW_SCALE    = 2.5;

  const CATEGORIES = ['hair','hat','top','bottom','shoes','face','glasses','beard'];

  // Matches WEAR_OFFSETS_DEFAULTS in focus/virtual/index.html.
  // Wearables are 100×100 (face is 52×52) on a 46×68 actor, so
  // the centred offset is x=-27 horizontally and y=-16 for the
  // body-area items; shoes need y=-32 to bottom-align.
  const DEFAULTS = {
    face:    { x: -3,  y: 4   },
    glasses: { x: -27, y: -16 },
    beard:   { x: -27, y: -16 },
    hair:    { x: -27, y: -16 },
    hat:     { x: -27, y: -16 },
    shoes:   { x: -27, y: -32 },
    bottom:  { x: -27, y: -16 },
    top:     { x: -27, y: -16 },
  };

  // LAYER_DEFAULTS uses teacher-facing numbering where 1 = top
  // (front-most) and bigger numbers sink behind. CSS z-index is
  // computed as (100 − layer) when applied. Inverting the spec
  // face << glasses, beard << hair << hat / bottom << top gives:
  //   top=1, bottom=2, shoes=3, hat=4, hair=5, glasses=6,
  //   beard=6, face=7.
  const LAYER_DEFAULTS = {
    top:    1, bottom: 2, shoes:  3, hat:    4,
    hair:   5, glasses: 6, beard:  6, face:   7,
  };
  function layerToZ(layer) {
    return 100 - (parseInt(layer, 10) || 1);
  }
  function clampLayer(n) {
    n = parseInt(n, 10);
    if (!isFinite(n)) return 1;
    if (n < 1)  return 1;
    if (n > 99) return 99;
    return n;
  }

  const SIZE_DEFAULTS = {
    face:    52,  glasses: 100, beard:   100, hair:    100,
    hat:     100, shoes:   100, bottom:  100, top:     100,
  };

  // Mirror of WEARABLES in focus/virtual/index.html.
  const WEARABLES = {
    face: ['face2'],
    hair: [
      '1H1-7Y8oSBdWFYWKq633H','1ZCuGaKs09jbzO35J8oZ3','2QKU5hkFBGSn1woB5CDNE',
      '3DCrAmizMwmXldUiUq1nO','3XklMM_tyRipq20tNztwb','6NX7-ZE6Xcs9je6TJZA5R',
      '9NXMp5udWXJ2SySXxqwdU','9cyCGrvrZDxJlpxGTj4S0','9jgSNDdnt6Oc4zQja-1ab',
      'ARoKuH0zzDnMz7SJ-BY70','AcvgbkFYYTpjIHzxAv8MG','BdooPUnjOd2oxWvjJ3Q8k',
      'G5lnV-rj0B5SuFnU3lvec','LM9Qiy673O80MQ_QptV-M','NDHsgW4AzoVlhsw7Wo_gb',
      'OR0tV5FxSNYjZgPBj-Ojf','PwWZr_K-SI8hTBVGMgqT9','Qf9WlnluhJnJR3-512dQZ',
      'WYut_hmWlA2eqDIYt6cTN','XzWXgdX-aIOOclBO65ab0','c7bP-dUt3ySWC9nfcmvfA',
      'co4RGDdkuZ2oV5L04Bpbu','dpb3vUFgMJNPR6yB24J00','epOiQImHmPaZsuOZN3c5p',
      'fASD2IqjGaEeQcoGB_KCf','fYH1lsBm7xEMrBm0_C1qZ','fkBzUVu5mTyAKHdnH9juE',
      'g8Bo_3CRPJ7jSk0cwLerm','iEgkAe6Q58XBqmY98w9Yr','j2uZHhytLkm7XQbtnC255',
      'jdz08hmTa9S2ixepHALyD','jtSDFen89S7P0VKj1iPzY','kHFkgyGbclqxr6foDKqPT',
      'maZ_P5Gwvi2RTLJMo70lO','mytryzM6nq0TLxf3Nh6fH','oprUlOzXgSVn0WKkP0i6S',
      'p_cRco1e4sm1v6pp7p9Rm','qA5O2048M2vXuVzvX1Dct','qmvvkXho7p3SgSKQFTJ7a',
      'tPNrnEJhe_aiClDvIauFq'
    ],
    beard: [
      '1_8TjDNB_1vq6yfVQpQJp','3gLz0bM8-QiwtPxgAg__X','9r2a1wlbDyT_pRJ_kzFsK',
      'AqPIbE-3sw7JlCL2FkcGY','BDO9vU5BiEmU0Q_nUxiDQ','Tbkd-E-cC2JS_dJetB2Kw',
      'nCR0YsUeBCZNIuEXIDaDi','omx8YnWO2M66kAxRnAhtR','rfrLEQF0veqK4wtsVextk',
      'zPI0EXuf0qoaUJro4Vph4'
    ],
    glasses: [
      '60uLBVmNfNajyOafV_FjZ','70SMlcxczrU0FjCgR2cAk','99uf4OlGEqgRQjXCoNILT',
      'A2UzF-fnpu4XxvOppHhPe','B-RvTJnYroBpLbEDvU_aI','EDrba0D0Lp-YO_bMRR-PT',
      'abV-UuXcVbHUTaBD9wt_D','hGS1fY1IELK9tstC356tq','iUN6L7MFZ7ZzFHHtDVDKT'
    ],
    hat: [
      'Gvhhuy3P3CVQxtzmZPGEu','K4PkpaZVXM5FWtiuYAivw','Mx5FLt63fe22tdamAE3K_',
      'N8_l_qdorKfDIe6thrGaV','NFd7wj2CO-S30p_Ujj2cl','UjEQbmzXEVnyV4QG0PYKu',
      'UtMeddHLkho6RLtV6DYaR','Uuopw2FDbZi3kN-w0-reU','VZSXiXzEDbTsPo8QDtCjb',
      'Vy4LlMZyG7Fv7QBwPqMb6','_aKUzjpo2Y3bs6l1Sc5S8','cP6SkhVwcksK_LsGzLO8R',
      'h8Faqgfh9-AZ3kDs_MczB','hPNyXg0Jm4KH38a9Q-YmA','iBRnFQ63hRv1IRjw3LplL',
      'k3IKZhTzMOGycW-6R8BBF','kgseVqRIgEu9qumZUS1s7','oHR1ggIZ4C7VFUsEz50X8',
      'oIMiRgCHiWPwRD0njUSq2','sdXxQjAmrI9k1VjPO9_WY','ueSLPKzj8FNr_gA4DorBH',
      'ynqDKmkTfiVarXv19oHS0'
    ],
    top: [
      '-Qmo0kMBOCCoFCpme9gNH','0MC1mAphEnu5dzt4jhHKj','7iO0xUduiVZaTx_XaAeCb',
      '9cHk8NthhHb2AYafkjDeh','FeL_npAKFms9VTzDTN_Da','GhaKRr9N1nnCPeur2JlTJ',
      'LiKy1Jtzdoy9IWLaQE52g','ZYds4LNGXumeRTE0eIaGS','bcQw31cQjC6G53Jvp2LfG',
      'sIeEZrP4KdBkx7y8nz83i'
    ],
    shoes: [
      '4i9zz74WVce3Ol4KaGTbT','FXeNUfzZ0g8dLWW95_JiG','XwHDSL9cO1Gye2aYoTk1U'
    ],
    bottom: [
      '7GbcGCfjgqfw-N0mAtSq4','RsawWs-u5jOXRH0fdixuB','_rQxF69mPUwMtqtNBuLP1',
      'iqRXSd6PYhP2fiDCOSj6V','zqyAIcohhN_5XKtlA0DKN'
    ],
  };

  // -------- state --------
  //
  //  Two-state-per-category button:
  //    • Off      — not in editSet, button is white. Wearable
  //                 hidden from the preview.
  //    • Selected — in editSet, button is orange with a dashed
  //                 outline on the preview. Visible AND editable
  //                 (drag, arrow keys, size controls all act).
  //
  //  Clicking a button toggles in/out of editSet. Multiple
  //  buttons can be selected at the same time; every selected
  //  category moves and resizes together as a group.
  //
  //  lastClicked is the most-recent button press, used as the
  //  "focus" for the X/Y/size display and the sample-item
  //  dropdown when several are selected.
  let offsets    = loadOffsets();
  let sizes      = loadSizes();
  let layers     = loadLayers();
  const editSet  = new Set();
  let lastClicked = null;
  const wearImgs = {}; // cat → img element, for in-place drag updates
  let activeBase = 'boy';
  let sampleItem = loadSample();

  function focusCat() {
    if (lastClicked && editSet.has(lastClicked)) return lastClicked;
    if (editSet.size) return editSet.values().next().value;
    return null;
  }

  // Seed default sample item per category (first manifest entry).
  for (const cat of CATEGORIES) {
    if (!sampleItem[cat] && WEARABLES[cat] && WEARABLES[cat].length) {
      sampleItem[cat] = WEARABLES[cat][0];
    }
  }

  function loadOffsets() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return Object.assign({}, DEFAULTS, parsed);
        }
      }
    } catch {}
    return Object.assign({}, DEFAULTS);
  }
  function saveOffsets() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(offsets)); } catch {}
  }
  function loadSizes() {
    try {
      const raw = localStorage.getItem(SIZE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return Object.assign({}, SIZE_DEFAULTS, parsed);
        }
      }
    } catch {}
    return Object.assign({}, SIZE_DEFAULTS);
  }
  function saveSizes() {
    try { localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(sizes)); } catch {}
  }
  function loadLayers() {
    try {
      const raw = localStorage.getItem(LAYER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return Object.assign({}, LAYER_DEFAULTS, parsed);
        }
      }
    } catch {}
    return Object.assign({}, LAYER_DEFAULTS);
  }
  function saveLayers() {
    try { localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(layers)); } catch {}
  }
  function loadSample() {
    try {
      const raw = localStorage.getItem(SAMPLE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {};
  }
  function saveSample() {
    try { localStorage.setItem(SAMPLE_KEY, JSON.stringify(sampleItem)); } catch {}
  }

  // -------- colour key (copy of index.html algorithm) --------
  const cache = new Map();
  function processWearable(cat, id) {
    const key = cat + ':' + id;
    if (cache.has(key)) return cache.get(key);
    const url = '../virtual/wearables/' + cat + '/' + id + '.png';
    const p = new Promise(function (resolve) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          const c = document.createElement('canvas');
          c.width  = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, c.width, c.height);
          // Backgrounds + silhouette outline all colour-keyed on
          // 5+ consecutive pixel runs:
          //   #9193a6 — lighter grey background
          //   #696c72 — darker grey background
          //   #000000 — black outline around shapes
          colourKey(data, 5, 0x91, 0x93, 0xa6);
          colourKey(data, 5, 0x69, 0x6c, 0x72);
          colourKey(data, 5, 0x00, 0x00, 0x00);
          ctx.putImageData(data, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch (e) { resolve(url); }
      };
      img.onerror = function () { resolve(''); };
      img.src = url;
    });
    cache.set(key, p);
    return p;
  }
  function colourKey(imgData, runLen, kr, kg, kb) {
    const d = imgData.data;
    const w = imgData.width, h = imgData.height;
    const mask = new Uint8Array(w * h);
    function isKey(i) { return d[i] === kr && d[i+1] === kg && d[i+2] === kb && d[i+3] > 0; }
    for (let y = 0; y < h; y++) {
      let s = -1;
      for (let x = 0; x < w; x++) {
        if (isKey((y*w+x)*4)) { if (s < 0) s = x; }
        else if (s >= 0) {
          if (x - s >= runLen) for (let k = s; k < x; k++) mask[y*w+k] = 1;
          s = -1;
        }
      }
      if (s >= 0 && w - s >= runLen) for (let k = s; k < w; k++) mask[y*w+k] = 1;
    }
    for (let x = 0; x < w; x++) {
      let s = -1;
      for (let y = 0; y < h; y++) {
        if (isKey((y*w+x)*4)) { if (s < 0) s = y; }
        else if (s >= 0) {
          if (y - s >= runLen) for (let k = s; k < y; k++) mask[k*w+x] = 1;
          s = -1;
        }
      }
      if (s >= 0 && h - s >= runLen) for (let k = s; k < h; k++) mask[k*w+x] = 1;
    }
    for (let p = 0; p < w*h; p++) {
      if (mask[p]) d[p*4+3] = 0;
    }
  }

  // -------- UI rendering --------
  function renderCatRow() {
    const row = document.getElementById('fitCatRow');
    if (!row) return;
    row.innerHTML = '';
    CATEGORIES.forEach(function (cat) {
      const b = document.createElement('button');
      b.type = 'button';
      const layerN = layers[cat] || LAYER_DEFAULTS[cat] || 1;
      b.textContent = cat[0].toUpperCase() + cat.slice(1) + ' (' + layerN + ')';
      b.style.padding = '6px 12px';
      b.style.fontSize = '13px';
      b.style.borderRadius = '999px';
      b.style.border = '1px solid #d1d5db';
      b.style.cursor = 'pointer';
      b.style.fontFamily = 'inherit';
      b.style.fontWeight = '600';
      if (editSet.has(cat)) {
        b.style.background = '#f97316';   // orange — selected
        b.style.color = '#fff';
        b.style.borderColor = '#ea580c';
      } else {
        b.style.background = '#fff';
        b.style.color = '#374151';
      }
      b.addEventListener('click', function () {
        toggleCat(cat);
        // Pull focus onto the 🎯 button so the next ↑ ↓ ← →
        // press is captured by the dedicated keydown listener
        // below (and not by the browser's page-scroll default).
        const keyBtn = document.getElementById('fitKeyFocus');
        if (keyBtn) keyBtn.focus();
      });
      row.appendChild(b);
    });
  }

  // Toggle a category in/out of editSet. Multi-select works
  // because each click is independent — clicking Hat doesn't
  // affect Hair's state.
  function toggleCat(cat) {
    if (editSet.has(cat)) {
      editSet.delete(cat);
      if (lastClicked === cat) lastClicked = null;
    } else {
      editSet.add(cat);
      lastClicked = cat;
    }
    renderCatRow();
    renderItemSelect();
    renderEditModeUI();
    renderPreview();
  }

  function renderItemSelect() {
    const sel = document.getElementById('fitItemSelect');
    if (!sel) return;
    sel.innerHTML = '';
    const cat = focusCat();
    if (!cat) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(pick an element above)';
      sel.appendChild(opt);
      sel.disabled = true;
      renderEditModeUI();
      renderPreview();
      return;
    }
    sel.disabled = false;
    const items = WEARABLES[cat] || [];
    if (!items.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(no items in ' + cat + ')';
      sel.appendChild(opt);
    } else {
      items.forEach(function (id) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id.length > 24 ? id.slice(0, 24) + '…' : id;
        sel.appendChild(opt);
      });
      if (sampleItem[cat] && items.indexOf(sampleItem[cat]) >= 0) {
        sel.value = sampleItem[cat];
      } else {
        sel.value = items[0];
        sampleItem[cat] = items[0];
        saveSample();
      }
    }
    renderOffsetDisplay();
    renderEditModeUI();
    renderPreview();
  }

  function renderOffsetDisplay() {
    const cat = focusCat();
    if (!cat) return; // handled by renderEditModeUI
    const off = offsets[cat] || { x: 0, y: 0 };
    document.getElementById('fitX').textContent = off.x;
    document.getElementById('fitY').textContent = off.y;
    document.getElementById('fitSize').value  = sizes[cat]  || SIZE_DEFAULTS[cat]  || 100;
    document.getElementById('fitLayer').value = layers[cat] || LAYER_DEFAULTS[cat] || 1;
  }
  function clampSize(n) {
    n = parseInt(n, 10);
    if (!isFinite(n)) return 100;
    if (n < 1)   return 1;
    if (n > 500) return 500;
    return n;
  }
  // Increment / decrement EVERY category in editSet by `delta` —
  // preserves relative sizes between selected elements.
  function bumpSize(delta) {
    if (!editSet.size) return;
    for (const cat of editSet) {
      const current = sizes[cat] || SIZE_DEFAULTS[cat] || 100;
      sizes[cat] = clampSize(current + delta);
    }
    saveSizes();
    renderOffsetDisplay();
    renderPreview();
  }
  // Set every category in editSet to the same absolute value
  // (typed into the number input).
  function setSizeAll(value) {
    if (!editSet.size) return;
    const v = clampSize(value);
    for (const cat of editSet) sizes[cat] = v;
    saveSizes();
    renderOffsetDisplay();
    renderPreview();
  }

  // Layer is per-element (not group). +/- and input act on the
  // current focus category only — stacking is intrinsically a
  // single-element property, even when multiple are selected.
  function bumpLayer(delta) {
    const cat = focusCat();
    if (!cat) return;
    const cur = layers[cat] || LAYER_DEFAULTS[cat] || 1;
    layers[cat] = clampLayer(cur + delta);
    saveLayers();
    renderCatRow();      // button label refreshes "Name (N)"
    renderOffsetDisplay();
    renderPreview();
  }
  function setLayer(value) {
    const cat = focusCat();
    if (!cat) return;
    layers[cat] = clampLayer(value);
    saveLayers();
    renderCatRow();
    renderOffsetDisplay();
    renderPreview();
  }

  function renderPreview() {
    const preview = document.getElementById('fitPreview');
    if (!preview) return;
    const base = document.getElementById('fitBase');
    base.src = '../virtual/images/characters/' + activeBase + '/down.png';

    Array.from(preview.querySelectorAll('img.fit-wear')).forEach(function (n) { n.remove(); });
    for (const k of Object.keys(wearImgs)) delete wearImgs[k];

    // Render EVERY category in editSet — they're all visible
    // AND draggable. Walking CATEGORIES order keeps z-stacking
    // deterministic (face below hair below hat, etc.).
    CATEGORIES.forEach(function (cat) {
      if (!editSet.has(cat)) return;
      const id = sampleItem[cat];
      if (!id) return;
      const off  = offsets[cat] || { x: 0, y: 0 };
      const size = sizes[cat]   || SIZE_DEFAULTS[cat] || 100;
      const img = document.createElement('img');
      img.className = 'fit-wear';
      img.alt = '';
      img.draggable = false;
      img.style.position = 'absolute';
      img.style.left   = off.x + 'px';
      img.style.top    = off.y + 'px';
      img.style.width  = size + 'px';
      img.style.height = size + 'px';
      img.style.zIndex = layerToZ(layers[cat] || LAYER_DEFAULTS[cat] || 1);
      img.style.imageRendering = 'pixelated';
      img.style.userSelect = 'none';
      img.style.webkitUserDrag = 'none';
      img.style.outline = '1px dashed rgba(249, 115, 22, 0.9)';
      img.style.outlineOffset = '0px';
      img.style.pointerEvents = 'auto';
      img.style.cursor = 'grab';
      img.addEventListener('mousedown', startWearableDrag);
      preview.appendChild(img);
      wearImgs[cat] = img;
      processWearable(cat, id).then(function (src) {
        if (src) img.src = src;
      });
    });
  }

  // Mouse-drag any wearable in editSet → moves the WHOLE editSet
  // by the same delta (each wearable preserves its relative
  // position). Distance is divided by PREVIEW_SCALE so the drag
  // resolution matches the arrow-key 1-px step. localStorage is
  // only written on mouseup to avoid hammering it 60 times per
  // second.
  function startWearableDrag(e) {
    if (!editSet.size) return;
    e.preventDefault();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const snapshot = {};
    for (const cat of editSet) {
      snapshot[cat] = Object.assign({}, offsets[cat] || { x: 0, y: 0 });
      if (wearImgs[cat]) wearImgs[cat].style.cursor = 'grabbing';
    }

    function onMove(ev) {
      const dx = Math.round((ev.clientX - startMouseX) / PREVIEW_SCALE);
      const dy = Math.round((ev.clientY - startMouseY) / PREVIEW_SCALE);
      for (const cat of editSet) {
        const o = { x: snapshot[cat].x + dx, y: snapshot[cat].y + dy };
        offsets[cat] = o;
        const img = wearImgs[cat];
        if (img) {
          img.style.left = o.x + 'px';
          img.style.top  = o.y + 'px';
        }
      }
      renderOffsetDisplay();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      for (const cat of editSet) {
        if (wearImgs[cat]) wearImgs[cat].style.cursor = 'grab';
      }
      saveOffsets();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  // Reflect the selection state in the small panel beside the
  // preview. Controls are active iff at least one category is
  // selected. When more than one is selected, the label spells
  // out every one so the teacher can see the full group.
  function renderEditModeUI() {
    const sMinus = document.getElementById('fitSizeMinus');
    const sPlus  = document.getElementById('fitSizePlus');
    const sInput = document.getElementById('fitSize');
    const lMinus = document.getElementById('fitLayerMinus');
    const lPlus  = document.getElementById('fitLayerPlus');
    const lInput = document.getElementById('fitLayer');
    const label  = document.getElementById('fitActiveLabel');
    const xEl    = document.getElementById('fitX');
    const yEl    = document.getElementById('fitY');

    const enabled = editSet.size > 0;

    if (!enabled) {
      label.textContent = '(none selected — click an element button)';
      xEl.textContent = '–';
      yEl.textContent = '–';
      sInput.value = '';
      lInput.value = '';
    } else {
      const names = [];
      CATEGORIES.forEach(function (c) {
        if (editSet.has(c)) names.push(c[0].toUpperCase() + c.slice(1));
      });
      label.textContent = names.join(' + ') +
        (editSet.size > 1 ? ' ✏ group edit' : ' ✏ edit');
    }

    [sMinus, sPlus, sInput, lMinus, lPlus, lInput].forEach(function (el) {
      if (!el) return;
      el.disabled = !enabled;
      el.style.opacity = enabled ? '1' : '0.4';
      el.style.cursor  = enabled ? '' : 'not-allowed';
    });
  }

  function bindEvents() {
    document.getElementById('fitBaseSelect').addEventListener('change', function (e) {
      activeBase = e.target.value;
      renderPreview();
    });
    document.getElementById('fitItemSelect').addEventListener('change', function (e) {
      const v = e.target.value;
      if (!v) return;
      const cat = focusCat();
      if (!cat) return;
      sampleItem[cat] = v;
      saveSample();
      renderPreview();
    });

    // Reset this element → reset EVERY category in editSet to its
    // defaults (offset + size). If nothing is in edit mode, do
    // nothing rather than silently picking one for the teacher.
    document.getElementById('fitResetBtn').addEventListener('click', function () {
      if (!editSet.size) return;
      for (const cat of editSet) {
        offsets[cat] = Object.assign({}, DEFAULTS[cat]);
        sizes[cat]   = SIZE_DEFAULTS[cat];
        layers[cat]  = LAYER_DEFAULTS[cat];
      }
      saveOffsets();
      saveSizes();
      saveLayers();
      renderCatRow();
      renderOffsetDisplay();
      renderPreview();
    });
    document.getElementById('fitResetAllBtn').addEventListener('click', function () {
      offsets = Object.assign({}, DEFAULTS);
      sizes   = Object.assign({}, SIZE_DEFAULTS);
      layers  = Object.assign({}, LAYER_DEFAULTS);
      saveOffsets();
      saveSizes();
      saveLayers();
      renderCatRow();
      renderOffsetDisplay();
      renderPreview();
    });

    // Size controls. +/- buttons step every editSet member by 1
    // (preserving relative sizes). Number input sets every
    // editSet member to the typed absolute value. Width and
    // height stay locked because wearables are 1:1 squares.
    document.getElementById('fitSizeMinus').addEventListener('click', function () { bumpSize(-1); });
    document.getElementById('fitSizePlus' ).addEventListener('click', function () { bumpSize( 1); });
    document.getElementById('fitSize').addEventListener('input', function (e) {
      setSizeAll(e.target.value);
    });

    // Layer controls. Operate on the focus category only
    // (lastClicked) — layer is an intrinsically single-element
    // property. The +/- buttons step by 1, the input takes any
    // value 1–99.
    document.getElementById('fitLayerMinus').addEventListener('click', function () { bumpLayer(-1); });
    document.getElementById('fitLayerPlus' ).addEventListener('click', function () { bumpLayer( 1); });
    document.getElementById('fitLayer').addEventListener('input', function (e) {
      setLayer(e.target.value);
    });
    document.getElementById('fitCopyBtn').addEventListener('click', function () {
      const json = JSON.stringify({ offsets: offsets, sizes: sizes, layers: layers }, null, 2);
      const msg = document.getElementById('fitCopyMsg');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(function () {
          msg.textContent = 'Copied. Paste into WEAR_OFFSETS_DEFAULTS in focus/virtual/index.html to make it the permanent default for every browser.';
          setTimeout(function () { msg.textContent = ''; }, 8000);
        }).catch(function () {
          msg.textContent = 'Clipboard blocked — JSON: ' + json;
        });
      } else {
        msg.textContent = 'JSON: ' + json;
      }
    });

    // 💾 Save & Apply — push the offsets to Supabase so every
    // student picks them up on next load, AND broadcast on the
    // Realtime channel so currently-open The Space tabs reflect
    // the change without reloading.
    document.getElementById('fitSaveBtn').addEventListener('click', function () {
      saveAndApply();
    });
  }

  async function saveAndApply() {
    const msg = document.getElementById('fitCopyMsg');
    const btn = document.getElementById('fitSaveBtn');
    const SUPA = window.WC_SUPABASE;

    if (!SUPA || !SUPA.url || !SUPA.anon) {
      msg.textContent = 'Supabase config missing — check supabase-config.js.';
      return;
    }

    btn.disabled = true;
    msg.textContent = 'Saving…';

    // 1) Durable persistence: upsert the single 'global' row.
    let dbOk = false;
    try {
      const r = await fetch(SUPA.url + '/rest/v1/wc_avatar_offsets?on_conflict=id', {
        method: 'POST',
        headers: {
          apikey:         SUPA.anon,
          Authorization:  'Bearer ' + SUPA.anon,
          'Content-Type': 'application/json',
          Prefer:         'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id:         'global',
          offsets:    offsets,
          sizes:      sizes,
          layers:     layers,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(function () { return ''; });
        throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 200));
      }
      dbOk = true;
    } catch (e) {
      msg.textContent = 'Save failed: ' + e.message +
        '. Did you run supabase-add-avatar-offsets.sql in Supabase SQL Editor?';
      btn.disabled = false;
      return;
    }

    // 2) Live push: broadcast on the same Realtime channel that
    //    students already listen on. Best-effort — the durable
    //    upsert is the source of truth, this just shortens the
    //    "wait until reload" window for connected tabs.
    let liveOk = false;
    if (window.supabase && window.supabase.createClient) {
      try {
        const client = window.supabase.createClient(SUPA.url, SUPA.anon, {
          realtime: { params: { eventsPerSecond: 5 } },
        });
        const channel = client.channel('the-space-room');
        await new Promise(function (resolve, reject) {
          const timeout = setTimeout(function () {
            reject(new Error('subscribe timeout'));
          }, 4000);
          channel.subscribe(function (status) {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timeout);
              resolve();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(timeout);
              reject(new Error('subscribe ' + status));
            }
          });
        });
        await channel.send({
          type:    'broadcast',
          event:   'offsets',
          payload: { offsets: offsets, sizes: sizes, layers: layers, at: Date.now() },
        });
        liveOk = true;
        // Tidy up — we only needed a one-shot send.
        setTimeout(function () {
          try { client.removeAllChannels(); } catch {}
        }, 300);
      } catch (e) {
        console.warn('Live broadcast failed (non-fatal):', e);
      }
    }

    msg.textContent = dbOk && liveOk
      ? '✓ Saved and pushed live to everyone.'
      : '✓ Saved. Currently-connected students will see it on next reload.';
    setTimeout(function () { msg.textContent = ''; }, 6000);
    btn.disabled = false;

    // Helper: apply a 1-px nudge to every category in editSet,
    // persist, and re-render. Shared between the two key
    // listeners below so behaviour stays identical.
    function nudgeBy(dx, dy) {
      if (!editSet.size) return false;
      for (const cat of editSet) {
        const off = offsets[cat] || (offsets[cat] = { x: 0, y: 0 });
        off.x += dx;
        off.y += dy;
      }
      saveOffsets();
      renderOffsetDisplay();
      renderPreview();
      return true;
    }
    function arrowDelta(e) {
      if (e.key === 'ArrowLeft')  return [-1,  0];
      if (e.key === 'ArrowRight') return [ 1,  0];
      if (e.key === 'ArrowUp')    return [ 0, -1];
      if (e.key === 'ArrowDown')  return [ 0,  1];
      return null;
    }

    // PRIMARY: the 🎯 square button in the grey panel. Clicking
    // it pulls focus here, then ↑ ↓ ← → fire keydown ON THIS
    // ELEMENT before any page-level scroll handler. preventDefault
    // stops the page from scrolling, stopPropagation keeps the
    // fallback window listener (below) from also firing.
    document.getElementById('fitKeyFocus').addEventListener('keydown', function (e) {
      const d = arrowDelta(e);
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      nudgeBy(d[0], d[1]);
    });

    // FALLBACK: window-level listener for browsers/environments
    // where the dedicated button isn't focused. Skipped while a
    // form control has focus (so typing in the size/layer inputs
    // works) and while the Fitting Room tab is hidden.
    window.addEventListener('keydown', function (e) {
      const tab = document.getElementById('tab-fitting');
      if (!tab || tab.classList.contains('wc-hidden')) return;
      if (!editSet.size) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const d = arrowDelta(e);
      if (!d) return;
      e.preventDefault();
      nudgeBy(d[0], d[1]);
    });
  }

  function init() {
    if (!document.getElementById('fitPreview')) return; // not on teacher page
    renderCatRow();
    renderItemSelect();
    renderEditModeUI();
    renderPreview();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
