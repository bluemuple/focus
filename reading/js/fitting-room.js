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
  const STORAGE_KEY      = 'virtual.wear_offsets.v1';
  const SIZE_STORAGE_KEY = 'virtual.wear_sizes.v1';
  const SAMPLE_KEY       = 'virtual.fitting_sample.v1';
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

  // z-order is fixed in code (matches the spec face << glasses,
  // beard << hair << hat / bottom << top). Size is editable;
  // SIZE_DEFAULTS is the starting square dimension per category
  // — wearables are 1:1 so a single value covers width and height.
  const Z_ORDER = {
    face:    1, glasses: 2, beard:   2, hair:    3,
    hat:     4, shoes:   5, bottom:  6, top:     7,
  };
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
  let offsets    = loadOffsets();
  let sizes      = loadSizes();
  let activeCat  = null;   // null until the teacher picks a category
  let editMode   = false;  // 1st click selects; 2nd click toggles edit
  let activeBase = 'boy';
  let sampleItem = loadSample();

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
          // Two background-fill greys: #9193a6 and #696c72. Either
          // becomes transparent on a 5+ pixel run.
          colourKey(data, 5, 0x91, 0x93, 0xa6);
          colourKey(data, 5, 0x69, 0x6c, 0x72);
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
  //
  //  Two-state per category-button:
  //    • Inactive — white pill, grey text. Clicking selects.
  //    • Selected (view) — indigo pill. Clicking again toggles
  //      Edit mode. The preview shows ONLY this category.
  //    • Selected (edit) — orange pill. Position/size controls
  //      are enabled (arrow keys nudge, size buttons usable).
  //
  //  Switching to a different category drops you back into view
  //  mode for that category.
  function renderCatRow() {
    const row = document.getElementById('fitCatRow');
    if (!row) return;
    row.innerHTML = '';
    CATEGORIES.forEach(function (cat) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = cat[0].toUpperCase() + cat.slice(1);
      b.style.padding = '6px 12px';
      b.style.fontSize = '13px';
      b.style.borderRadius = '999px';
      b.style.border = '1px solid #d1d5db';
      b.style.cursor = 'pointer';
      b.style.fontFamily = 'inherit';
      b.style.fontWeight = '600';
      if (cat === activeCat && editMode) {
        b.style.background = '#f97316';   // orange — edit mode
        b.style.color = '#fff';
        b.style.borderColor = '#ea580c';
      } else if (cat === activeCat) {
        b.style.background = '#6366f1';   // indigo — view mode
        b.style.color = '#fff';
        b.style.borderColor = '#6366f1';
      } else {
        b.style.background = '#fff';
        b.style.color = '#374151';
      }
      b.addEventListener('click', function () {
        if (cat === activeCat) {
          editMode = !editMode;
        } else {
          activeCat = cat;
          editMode = false;
        }
        renderCatRow();
        renderItemSelect();
        renderEditModeUI();
      });
      row.appendChild(b);
    });
  }

  function renderItemSelect() {
    const sel = document.getElementById('fitItemSelect');
    if (!sel) return;
    sel.innerHTML = '';
    if (!activeCat) {
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
    const items = WEARABLES[activeCat] || [];
    if (!items.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(no items in ' + activeCat + ')';
      sel.appendChild(opt);
    } else {
      items.forEach(function (id) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id.length > 24 ? id.slice(0, 24) + '…' : id;
        sel.appendChild(opt);
      });
      if (sampleItem[activeCat] && items.indexOf(sampleItem[activeCat]) >= 0) {
        sel.value = sampleItem[activeCat];
      } else {
        sel.value = items[0];
        sampleItem[activeCat] = items[0];
        saveSample();
      }
    }
    renderOffsetDisplay();
    renderEditModeUI();
    renderPreview();
  }

  function renderOffsetDisplay() {
    if (!activeCat) return; // handled by renderEditModeUI
    const off = offsets[activeCat] || { x: 0, y: 0 };
    document.getElementById('fitX').textContent = off.x;
    document.getElementById('fitY').textContent = off.y;
    document.getElementById('fitSize').value = sizes[activeCat] || SIZE_DEFAULTS[activeCat] || 100;
  }
  function clampSize(n) {
    n = parseInt(n, 10);
    if (!isFinite(n)) return SIZE_DEFAULTS[activeCat] || 100;
    if (n < 1)   return 1;
    if (n > 500) return 500;
    return n;
  }
  function updateSize(newSize) {
    if (!activeCat || !editMode) return;
    sizes[activeCat] = clampSize(newSize);
    saveSizes();
    renderOffsetDisplay();
    renderPreview();
  }

  function renderPreview() {
    const preview = document.getElementById('fitPreview');
    if (!preview) return;
    const base = document.getElementById('fitBase');
    base.src = '../virtual/images/characters/' + activeBase + '/down.png';

    // Drop any previously-rendered wearable images.
    Array.from(preview.querySelectorAll('img.fit-wear')).forEach(function (n) { n.remove(); });

    // Show only the active category (or nothing if none selected).
    if (!activeCat) return;
    const cat  = activeCat;
    const id   = sampleItem[cat];
    if (!id) return;
    const off  = offsets[cat] || { x: 0, y: 0 };
    const size = sizes[cat]   || SIZE_DEFAULTS[cat] || 100;
    const img = document.createElement('img');
    img.className = 'fit-wear';
    img.alt = '';
    img.draggable = false; // suppress native HTML5 image drag
    img.style.position = 'absolute';
    img.style.left   = off.x + 'px';
    img.style.top    = off.y + 'px';
    img.style.width  = size + 'px';
    img.style.height = size + 'px';
    img.style.zIndex = Z_ORDER[cat] || 1;
    img.style.imageRendering = 'pixelated';
    img.style.userSelect = 'none';
    img.style.webkitUserDrag = 'none';
    if (editMode) {
      // Dashed orange outline + grab cursor signal that this layer
      // is draggable; click-and-drag updates offsets[activeCat]
      // live and persists on mouseup.
      img.style.outline = '1px dashed rgba(249, 115, 22, 0.9)';
      img.style.outlineOffset = '0px';
      img.style.pointerEvents = 'auto';
      img.style.cursor = 'grab';
      img.addEventListener('mousedown', function (e) { startWearableDrag(e, img); });
    } else {
      img.style.pointerEvents = 'none';
    }
    preview.appendChild(img);
    processWearable(cat, id).then(function (src) {
      if (src) img.src = src;
    });
  }

  // Mouse-drag the wearable layer inside the preview. Distance is
  // divided by PREVIEW_SCALE so 1 logical px per (scale) viewport
  // pixels — matching the arrow-key step. The element's left/top
  // are updated live while dragging; localStorage write happens
  // once on mouseup so we don't thrash storage with every pixel.
  function startWearableDrag(e, img) {
    if (!activeCat || !editMode) return;
    e.preventDefault();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const start = Object.assign({}, offsets[activeCat] || { x: 0, y: 0 });
    img.style.cursor = 'grabbing';

    function onMove(ev) {
      const dx = Math.round((ev.clientX - startMouseX) / PREVIEW_SCALE);
      const dy = Math.round((ev.clientY - startMouseY) / PREVIEW_SCALE);
      offsets[activeCat] = { x: start.x + dx, y: start.y + dy };
      img.style.left = offsets[activeCat].x + 'px';
      img.style.top  = offsets[activeCat].y + 'px';
      renderOffsetDisplay();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      img.style.cursor = 'grab';
      saveOffsets();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  // Toggle the size controls' visual disabled state and add a hint
  // about edit mode. Arrow keys are gated separately inside the
  // keydown handler.
  function renderEditModeUI() {
    const minus = document.getElementById('fitSizeMinus');
    const plus  = document.getElementById('fitSizePlus');
    const input = document.getElementById('fitSize');
    const label = document.getElementById('fitActiveLabel');
    const xEl   = document.getElementById('fitX');
    const yEl   = document.getElementById('fitY');

    if (!activeCat) {
      label.textContent = '(none selected)';
      xEl.textContent = '–';
      yEl.textContent = '–';
      input.value = '';
      [minus, plus, input].forEach(function (el) {
        el.disabled = true;
        el.style.opacity = '0.4';
        el.style.cursor = 'not-allowed';
      });
      return;
    }

    const labelText = activeCat[0].toUpperCase() + activeCat.slice(1);
    label.textContent = editMode ? labelText + '  ✏ edit' : labelText;
    [minus, plus, input].forEach(function (el) {
      el.disabled = !editMode;
      el.style.opacity = editMode ? '1' : '0.4';
      el.style.cursor  = editMode ? '' : 'not-allowed';
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
      sampleItem[activeCat] = v;
      saveSample();
      renderPreview();
    });

    document.getElementById('fitResetBtn').addEventListener('click', function () {
      if (!activeCat) return;
      offsets[activeCat] = Object.assign({}, DEFAULTS[activeCat]);
      sizes[activeCat]   = SIZE_DEFAULTS[activeCat];
      saveOffsets();
      saveSizes();
      renderOffsetDisplay();
      renderPreview();
    });
    document.getElementById('fitResetAllBtn').addEventListener('click', function () {
      offsets = Object.assign({}, DEFAULTS);
      sizes   = Object.assign({}, SIZE_DEFAULTS);
      saveOffsets();
      saveSizes();
      renderOffsetDisplay();
      renderPreview();
    });

    // Size controls. +/- buttons step by 1px; the number input
    // lets the teacher type an exact value. Width and height are
    // locked together because all wearables are 1:1 squares.
    document.getElementById('fitSizeMinus').addEventListener('click', function () {
      updateSize((sizes[activeCat] || SIZE_DEFAULTS[activeCat] || 100) - 1);
    });
    document.getElementById('fitSizePlus').addEventListener('click', function () {
      updateSize((sizes[activeCat] || SIZE_DEFAULTS[activeCat] || 100) + 1);
    });
    document.getElementById('fitSize').addEventListener('input', function (e) {
      updateSize(e.target.value);
    });
    document.getElementById('fitCopyBtn').addEventListener('click', function () {
      const json = JSON.stringify({ offsets: offsets, sizes: sizes }, null, 2);
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
          payload: { offsets: offsets, sizes: sizes, at: Date.now() },
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

    // Arrow keys nudge the active element 1 px. Only fires when
    // the Fitting Room tab is visible, a category is in edit mode,
    // and the user isn't typing into an input/select.
    window.addEventListener('keydown', function (e) {
      const tab = document.getElementById('tab-fitting');
      if (!tab || tab.classList.contains('wc-hidden')) return;
      if (!activeCat || !editMode) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft')  dx = -1;
      if (e.key === 'ArrowRight') dx =  1;
      if (e.key === 'ArrowUp')    dy = -1;
      if (e.key === 'ArrowDown')  dy =  1;
      if (!dx && !dy) return;
      e.preventDefault();
      const off = offsets[activeCat] || (offsets[activeCat] = { x: 0, y: 0 });
      off.x += dx;
      off.y += dy;
      saveOffsets();
      renderOffsetDisplay();
      renderPreview();
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
