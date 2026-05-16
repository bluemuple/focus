// =============================================================
//  WordCatch — word click popup
//
//  Triggered by lesson.js on word click. Shows:
//    - the word + a 🔊 button (en-NZ-Wavenet-A pronunciation)
//    - vocabulary.com lookup inside an iframe — many CDNs block
//      framing via X-Frame-Options/CSP, so we also surface a
//      "Open in a new tab" button as a guaranteed fallback.
//    - level controls: "I know it!" (advances level by 1, max 5)
//      and "Skip — I don't care" (sets level to -1 / 무시).
//
//  No buttons needed for "look at meaning" / "mark difficult" —
//  the colour level itself communicates familiarity. Year 4 kids
//  parse fewer buttons better than nuanced state machines.
//
//  Exposes window.WCWordPopup.open({ word, lower, level,
//                                    onLevelChange(nextLevel) }).
// =============================================================
(() => {
  let host = null;
  let onLevelChangeCb = null;
  let iframeTimeout = null;

  function ensureHost() {
    if (host) return host;
    host = document.createElement('div');
    host.id = 'wcWordPopup';
    host.className = 'wc-popup-backdrop wc-hidden';
    host.innerHTML = `
      <div class="wc-popup" role="dialog" aria-modal="true">
        <button class="wc-popup-close" aria-label="Close">×</button>
        <div class="wc-popup-header">
          <span class="wc-popup-word"></span>
          <button class="wc-popup-tts wc-btn ghost" title="Hear it">🔊</button>
        </div>
        <!-- 또박또박-style level bar: 🗑 1 2 3 4 ✓ — left = ignore,
             right = mastered, middle digits = familiarity tiers. The
             pill backgrounds preview the resulting word colour so kids
             can see what each level "looks like" before tapping. -->
        <div class="wc-level-bar" role="radiogroup" aria-label="Word level">
          <button class="lv-btn ignore" data-state="-1" title="Skip / 무시">🗑</button>
          <button class="lv-btn"        data-state="1"  title="Learning">1</button>
          <button class="lv-btn"        data-state="2"  title="Seen it">2</button>
          <button class="lv-btn"        data-state="3"  title="Familiar">3</button>
          <button class="lv-btn"        data-state="4"  title="Almost there">4</button>
          <button class="lv-btn known"  data-state="5"  title="I know it!">✓</button>
        </div>
        <div class="wc-popup-divider"></div>
        <div class="wc-popup-dict">
          <iframe class="wc-popup-iframe" src="about:blank" referrerpolicy="no-referrer"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
          <div class="wc-popup-iframe-fail wc-hidden">
            <p class="wc-muted">The dictionary couldn’t open here.</p>
            <a class="wc-btn wc-popup-newtab" target="_blank" rel="noopener">Open in a new tab ↗</a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(host);

    host.addEventListener('click', e => {
      if (e.target === host) close();
    });
    host.querySelector('.wc-popup-close').addEventListener('click', close);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !host.classList.contains('wc-hidden')) close();
    });
    return host;
  }

  function close() {
    if (!host) return;
    host.classList.add('wc-hidden');
    if (iframeTimeout) { clearTimeout(iframeTimeout); iframeTimeout = null; }
    // Clear iframe so audio/video inside stops.
    const fr = host.querySelector('.wc-popup-iframe');
    if (fr) fr.src = 'about:blank';
    window.WCTTS && window.WCTTS.stop();
  }

  function levelDot(level) {
    if (level === -1) return '<span class="lvl--1 lvl-dot" title="Skipped">⛔</span>';
    if (level === 0)  return '<span class="lvl-0 lvl-dot" title="New">·</span>';
    const filled = '★'.repeat(level);
    const empty  = '☆'.repeat(5 - level);
    return `<span class="lvl-${level} lvl-dot">${filled}${empty}</span>`;
  }

  function open({ word, lower, level, onLevelChange }) {
    ensureHost();
    onLevelChangeCb = onLevelChange || (() => {});
    const root = host.querySelector('.wc-popup');

    host.querySelector('.wc-popup-word').textContent = word;

    // Highlight the pill matching the current level (if any).
    host.querySelectorAll('.wc-level-bar .lv-btn').forEach(btn => {
      const s = parseInt(btn.dataset.state, 10);
      btn.classList.toggle('active', s === level);
      btn.onclick = () => bumpAndClose(s);
    });

    // TTS pronunciation.
    host.querySelector('.wc-popup-tts').onclick = () => {
      window.WCTTS.speak(word).catch(() => {});
    };

    // Dictionary iframe + new-tab fallback. Many dictionary sites
    // (vocabulary.com included) send X-Frame-Options:SAMEORIGIN —
    // the iframe will appear blank. We can't detect that from JS
    // due to cross-origin restrictions, so we ALWAYS show the
    // "Open in a new tab" button as a sibling, and additionally
    // hide the iframe if it hasn't fired `load` within 4 seconds.
    const slug = encodeURIComponent(lower);
    const vocabUrl = `https://www.vocabulary.com/dictionary/${slug}`;
    const fr = host.querySelector('.wc-popup-iframe');
    const fail = host.querySelector('.wc-popup-iframe-fail');
    const newTab = host.querySelector('.wc-popup-newtab');
    newTab.href = vocabUrl;
    newTab.textContent = `Look up “${word}” on vocabulary.com ↗`;
    fail.classList.remove('wc-hidden');   // always show the fallback button up front

    // Strict school content filter? Class can force "new-tab only" —
    // we hide the iframe and rely entirely on the external link.
    const iframeBlocked = !!(window.WCLesson && window.WCLesson.classFlags
                              && window.WCLesson.classFlags.hideDictionaryIframe);
    if (iframeBlocked) {
      fr.classList.add('wc-hidden');
      fr.src = 'about:blank';
    } else {
      fr.classList.remove('wc-hidden');
      fr.src = vocabUrl;
    }

    if (iframeTimeout) clearTimeout(iframeTimeout);
    iframeTimeout = setTimeout(() => {
      // If the iframe never fires load (X-Frame-Options blocked it
      // OR the page is very slow) we collapse the iframe and rely
      // on the new-tab button.
      try {
        if (!fr.contentDocument && !fr.contentWindow) {
          fr.classList.add('wc-hidden');
        }
      } catch { /* cross-origin → expected to throw */ }
    }, 4000);
    fr.onload = () => {
      // load fired — show the iframe (some browsers fire load even
      // on a blocked frame, but most sites that block don't).
      fr.classList.remove('wc-hidden');
    };

    host.classList.remove('wc-hidden');
    root.focus();
  }

  async function bumpAndClose(nextLevel) {
    try { await onLevelChangeCb(nextLevel); } catch {}
    close();
  }

  window.WCWordPopup = { open, close };
})();
