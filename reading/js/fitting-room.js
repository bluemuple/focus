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
  const STORAGE_KEY = 'virtual.wear_offsets.v1';
  const SAMPLE_KEY  = 'virtual.fitting_sample.v1';

  const CATEGORIES = ['hair','hat','top','bottom','shoes','face','glasses','beard'];

  const DEFAULTS = {
    face:    { x: 20, y: 4   },
    glasses: { x: -4, y: -4  },
    beard:   { x: -4, y: -4  },
    hair:    { x: -4, y: -4  },
    hat:     { x: -4, y: -4  },
    shoes:   { x: -4, y: 36  },
    bottom:  { x: -4, y: -4  },
    top:     { x: -4, y: -4  },
  };

  // CSS-equivalent dimensions / z-order for each category. Kept
  // small here because the teacher preview always uses defaults
  // (the teacher tool only changes position, not size).
  const WEAR_DIM = {
    face:    { w: 52,  h: 52,  z: 1 },
    glasses: { w: 100, h: 100, z: 2 },
    beard:   { w: 100, h: 100, z: 2 },
    hair:    { w: 100, h: 100, z: 3 },
    hat:     { w: 100, h: 100, z: 4 },
    shoes:   { w: 100, h: 100, z: 5 },
    bottom:  { w: 100, h: 100, z: 6 },
    top:     { w: 100, h: 100, z: 7 },
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
    bottom: [],
  };

  // -------- state --------
  let offsets    = loadOffsets();
  let activeCat  = 'hair';
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
          colourKey(data, 5, 0x91, 0x93, 0xa6);
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
      b.textContent = cat[0].toUpperCase() + cat.slice(1);
      b.style.padding = '6px 12px';
      b.style.fontSize = '13px';
      b.style.borderRadius = '999px';
      b.style.border = '1px solid #d1d5db';
      b.style.cursor = 'pointer';
      b.style.fontFamily = 'inherit';
      b.style.fontWeight = '600';
      if (cat === activeCat) {
        b.style.background = '#6366f1';
        b.style.color = '#fff';
        b.style.borderColor = '#6366f1';
      } else {
        b.style.background = '#fff';
        b.style.color = '#374151';
      }
      b.addEventListener('click', function () {
        activeCat = cat;
        renderCatRow();
        renderItemSelect();
      });
      row.appendChild(b);
    });
  }

  function renderItemSelect() {
    const sel = document.getElementById('fitItemSelect');
    if (!sel) return;
    sel.innerHTML = '';
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
    document.getElementById('fitActiveLabel').textContent =
      activeCat[0].toUpperCase() + activeCat.slice(1);
    renderOffsetDisplay();
    renderPreview();
  }

  function renderOffsetDisplay() {
    const off = offsets[activeCat] || { x: 0, y: 0 };
    document.getElementById('fitX').textContent = off.x;
    document.getElementById('fitY').textContent = off.y;
  }

  function renderPreview() {
    const preview = document.getElementById('fitPreview');
    if (!preview) return;
    const base = document.getElementById('fitBase');
    base.src = '../virtual/images/characters/' + activeBase + '/down.png';

    // Drop any previously-rendered wearable images.
    Array.from(preview.querySelectorAll('img.fit-wear')).forEach(function (n) { n.remove(); });

    for (const cat of CATEGORIES) {
      const id = sampleItem[cat];
      if (!id) continue;
      const dim = WEAR_DIM[cat];
      const off = offsets[cat] || { x: 0, y: 0 };
      const img = document.createElement('img');
      img.className = 'fit-wear';
      img.alt = '';
      img.style.position = 'absolute';
      img.style.left   = off.x + 'px';
      img.style.top    = off.y + 'px';
      img.style.width  = dim.w + 'px';
      img.style.height = dim.h + 'px';
      img.style.zIndex = dim.z;
      img.style.imageRendering = 'pixelated';
      img.style.pointerEvents  = 'none';
      // Visually highlight the active category to make positioning
      // adjustments easier to spot.
      if (cat === activeCat) {
        img.style.outline = '1px dashed rgba(99, 102, 241, 0.8)';
        img.style.outlineOffset = '0px';
      }
      preview.appendChild(img);
      processWearable(cat, id).then(function (src) {
        if (src) img.src = src;
      });
    }
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
      offsets[activeCat] = Object.assign({}, DEFAULTS[activeCat]);
      saveOffsets();
      renderOffsetDisplay();
      renderPreview();
    });
    document.getElementById('fitResetAllBtn').addEventListener('click', function () {
      offsets = Object.assign({}, DEFAULTS);
      saveOffsets();
      renderOffsetDisplay();
      renderPreview();
    });
    document.getElementById('fitCopyBtn').addEventListener('click', function () {
      const json = JSON.stringify(offsets, null, 2);
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

    // Arrow keys nudge the active element 1 px. Only fires when
    // the Fitting Room tab is visible and the user isn't typing
    // into an input/select.
    window.addEventListener('keydown', function (e) {
      const tab = document.getElementById('tab-fitting');
      if (!tab || tab.classList.contains('wc-hidden')) return;
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
    renderPreview();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
