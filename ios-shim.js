/* ===========================================================================
   iOS Capacitor shim — activates ONLY when running inside the Capacitor-built
   iOS app (window.Capacitor is present). On regular web (GitHub Pages, mobile
   Safari) this file is a no-op so the same focus/ source ships everywhere.

   What it does:
     1. Hide the splash screen as soon as the first paint is ready.
     2. Style the native status bar to match the app background.
     3. Schedule a local notification at every pomodoro phase boundary so the
        alarm fires even when the app is backgrounded — Apple-required
        "native value-add" so the App Store doesn't reject as a web wrapper.
     4. Add body classes on iOS keyboard show/hide for CSS hooks.
     5. Fire a haptic tap on task complete (subtle native polish).

   Uses window.Capacitor.Plugins.* APIs directly (no bundler / no ES imports)
   so this file works as a plain <script src="ios-shim.js">.

   Loaded from focus/index.html with:
       <script defer src="ios-shim.js?v=ios-1"></script>
   ========================================================================= */
(function iosShim() {
  // Detect Capacitor host. Falls through cleanly on plain web.
  const Cap = (typeof window !== 'undefined') ? window.Capacitor : null;
  if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) {
    return;   // Running in a browser / GitHub Pages — nothing to do.
  }
  document.documentElement.classList.add('is-native-ios');
  if (Cap.getPlatform && Cap.getPlatform() === 'ios') {
    document.documentElement.classList.add('platform-ios');
  }

  const P = Cap.Plugins || {};

  // ---- 1. Hide splash as soon as the DOM is ready ----
  if (P.SplashScreen) {
    try { P.SplashScreen.hide({ fadeOutDuration: 250 }); } catch (_) {}
  }

  // ---- 2. Status-bar styling ----
  // overlay:true → the WebView is full-screen (under the status bar) and the
  // bar is a transparent overlay. The topbar's own env(safe-area-inset-top)
  // padding (in index.html) is the SINGLE inset source, so content stays clear
  // of the clock from first paint. (Pairs with capacitor.config.json
  // contentInset:"never" + StatusBar.overlaysWebView:true.)
  if (P.StatusBar) {
    try { P.StatusBar.setStyle({ style: 'DEFAULT' }); } catch (_) {}
    try { P.StatusBar.setOverlaysWebView({ overlay: true }); } catch (_) {}
  }

  // ---- 3. Local notifications for pomodoro phase boundaries ----
  // Bidoro's tickPomodoro() flips state.activeTimer.pendingPhaseConfirm at
  // each work/break boundary. We schedule a one-shot iOS notification so the
  // user gets a banner even if the app is backgrounded — without this, the
  // alarm sound + popup are only seen when the WebView is foregrounded.
  let _scheduledForPhase = null;
  if (P.LocalNotifications) {
    try { P.LocalNotifications.requestPermissions(); } catch (_) {}
    setInterval(scheduleNextPomoNotification, 1000);
  }
  function scheduleNextPomoNotification() {
    if (!P.LocalNotifications) return;
    const state = window.state || null;     // Bidoro exposes state globally
    if (!state) return;
    const at = state.activeTimer;
    if (!at || at.type !== 'pomodoro' || at.paused || at.pendingPhaseConfirm) {
      if (_scheduledForPhase) {
        try { P.LocalNotifications.cancel({ notifications: [{ id: 4242 }] }); } catch (_) {}
        _scheduledForPhase = null;
      }
      return;
    }
    const phaseEnd = (+at.phaseStartedAt || +at.startedAt) + (+at.phaseDurationMs || 0);
    if (_scheduledForPhase === phaseEnd) return;
    try { P.LocalNotifications.cancel({ notifications: [{ id: 4242 }] }); } catch (_) {}
    const body = (at.phase === 'work')
      ? 'Work session done. Time for a break?'
      : 'Break is over. Back to work?';
    try {
      // iOS notification icon is ALWAYS the app icon automatically — no
      // separate parameter to set. We deliberately do NOT pass smallIcon /
      // largeIcon / iconColor here: those are Android-only fields and on iOS
      // they're ignored at best, confusing at worst (the previous
      // `smallIcon: 'ic_stat_icon'` referenced a non-existent Android drawable).
      // The app icon comes from Assets.xcassets/AppIcon.appiconset, which is
      // regenerated from resources/icon.png by `capacitor-assets generate --ios`
      // on every Bidoro Build & Deploy run.
      P.LocalNotifications.schedule({
        notifications: [{
          id: 4242,
          title: 'Bidoro',
          body,
          schedule: { at: new Date(phaseEnd) },
          // (user) Unified notification alarm tone for EVERY Bidoro notification: start4.
          // iOS notification sounds must be a bundled caf/wav/aiff (mp3 isn't supported), so
          // start4.mp3 is shipped as start4.caf in the app bundle (see ios/App/App/start4.caf,
          // added to the App target's Copy Bundle Resources). Plays when the iPhone is in ring
          // mode + screen-off as the banner fires.
          sound: 'start4.caf'
        }]
      });
      _scheduledForPhase = phaseEnd;
    } catch (_) {}
  }

  // (user) Tapping ANY Bidoro notification — from another in-app screen, another app, or with the
  // screen off — must land on the app HOME, so the timer-end menu (showPomoPhaseConfirm) is right
  // there to choose from. Navigate home, then nudge the phase-confirm (it self-guards if nothing's due).
  if (P.LocalNotifications && typeof P.LocalNotifications.addListener === 'function') {
    try {
      P.LocalNotifications.addListener('localNotificationActionPerformed', function () {
        try { if (typeof window.showPage === 'function') window.showPage('focus'); } catch (_) {}
        setTimeout(function () { try { if (typeof window.showPomoPhaseConfirm === 'function') window.showPomoPhaseConfirm(); } catch (_) {} }, 450);
      });
    } catch (_) {}
  }

  // ---- 4. Keyboard body-class hooks ----
  // On keyboardWillShow the plugin reports the keyboard's pixel height. We
  // publish it as the CSS variable --kb-height on <html> and add the
  // body.ios-kb-open class. CSS (in index.html) uses these to lift every
  // .modal up so it sits just above the keyboard with a small gap, and to
  // cap the modal's height (scroll-if-taller) so it never runs off the top.
  if (P.Keyboard) {
    try {
      P.Keyboard.addListener('keyboardWillShow', (info) => {
        const h = (info && typeof info.keyboardHeight === 'number')
          ? info.keyboardHeight : 300;
        document.documentElement.style.setProperty('--kb-height', h + 'px');
        document.body.classList.add('ios-kb-open');
        // Matrix +Add: lift the picker above the (virtual) keyboard. Physical keyboards
        // don't fire this event, so they correctly get no scroll.
        try { if (window.bidoroKbScroll) window.bidoroKbScroll(h); } catch (_) {}
      });
      P.Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('ios-kb-open');
        document.documentElement.style.setProperty('--kb-height', '0px');
        try { if (window.bidoroKbScroll) window.bidoroKbScroll(0); } catch (_) {}
      });
    } catch (_) {}
  }

  // ---- 5. Haptic feedback ----
  if (P.Haptics) {
    // Override the universal helper so callers throughout focus/index.html
    // (block drag, reorder step, task complete, etc.) get REAL iOS Haptic
    // Engine taps instead of the web Vibration-API fallback (which iOS
    // Safari ignores anyway).
    window.bidoroHaptic = function (style) {
      const map = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };
      try { P.Haptics.impact({ style: map[style] || 'LIGHT' }); } catch (_) {}
    };
    // Existing task-complete sound→haptic bridge.
    const origPlayFx = window.playFx;
    if (typeof origPlayFx === 'function') {
      window.playFx = function (name) {
        if (name === 'complete') {
          try { P.Haptics.impact({ style: 'MEDIUM' }); } catch (_) {}
        }
        return origPlayFx.apply(this, arguments);
      };
    }
  }

  // ---- 5b. Universal Links — friend invite (https://bidoro.app/?addfriend=CODE) ----
  // When the app is INSTALLED, tapping an invite link opens the app directly (Associated
  // Domains + the AASA at bidoro.app/.well-known/apple-app-site-association). Capacitor delivers
  // the URL via the App plugin. We hand it to the web's _consumeAddParam(url) — signed-in →
  // instant friend; guest → in-app sign-up then auto-add. Same code path as the web landing, so
  // there's nothing extra to maintain. (No deferred deep link needed: a non-installed friend
  // completes the add on the web and the app inherits it on next same-account login.)
  function _handleAddUrl(url) {
    if (!url || !/[?&]addfriend=/i.test(url)) return;   // ignore non-invite links (gcal callback, etc.)
    if (typeof window._bidoroConsumeAddParam === 'function') {
      try { window._bidoroConsumeAddParam(url); } catch (_) {}
    } else {
      window.__bidoroPendingAddUrl = url;   // app still booting → index.html drains this when ready
    }
  }
  if (P.App && typeof P.App.addListener === 'function') {
    try { P.App.addListener('appUrlOpen', (data) => _handleAddUrl(data && data.url)); } catch (_) {}
    // Cold launch (app was not running when the link was tapped): read the launch URL.
    try { if (typeof P.App.getLaunchUrl === 'function') P.App.getLaunchUrl().then((r) => { if (r && r.url) _handleAddUrl(r.url); }).catch(() => {}); } catch (_) {}
  }

  // ---- 6. Scroll to top on first paint ----
  // Inside the iOS Capacitor app, force the page back to the TOP after
  // load. WKWebView sometimes restores a previous scroll offset OR ends up
  // partway down because of dynamic content settling — both leave the
  // user staring at the middle of the page on launch. Two-stage scroll
  // (immediate + 500 ms) catches late-arriving block heights.
  function _scrollToTop() {
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (_) {}
  }
  window.addEventListener('load', () => {
    setTimeout(_scrollToTop, 50);
    setTimeout(_scrollToTop, 500);
  });

  // ---- 7. iCloud Key-Value sync ----
  // Mirrors a small set of localStorage keys into NSUbiquitousKeyValueStore
  // (via the custom Capacitor plugin ICloudKVPlugin). iCloud auto-syncs
  // these to every other device signed into the same Apple ID — so iPhone
  // ↔ iPad sync works with zero account setup.
  //
  // Strategy:
  //   • On boot: pull from iCloud first. If iCloud is newer than the local
  //     copy (or local is empty), apply iCloud's value and reload state.
  //   • On every saveState (= localStorage.setItem of our key), push the
  //     fresh JSON up to iCloud.
  //   • On external change ('change' event from the plugin): another device
  //     pushed → pull, replace local, re-render.
  //
  // We only sync the MAIN app state key. The 1 MB iCloud KV limit is plenty.
  if (P.ICloudKV) {
    const ICLOUD_KEYS = ['concentration-app-v1'];   // main state (STORAGE_KEY)
    let _pushDebounce = null;

    // Bidoro PRO gate: cross-device iCloud sync is a paid feature. Free users
    // stay fully local — never push to or pull from iCloud KV.
    function _bidoroPremium() { try { return !!(window.state && window.state.premium); } catch (_) { return false; } }

    function pushICloud(key) {
      if (!_bidoroPremium()) return;        // free tier: local-only
      if (_pushDebounce) clearTimeout(_pushDebounce);
      // Coalesce rapid saves (typing in a textbox etc.) — 600 ms idle.
      _pushDebounce = setTimeout(async () => {
        try {
          const value = localStorage.getItem(key);
          await P.ICloudKV.set({ key, value: value == null ? '' : value });
        } catch (_) {}
      }, 600);
    }

    async function pullICloudAndApply(key) {
      if (!_bidoroPremium()) return;        // free tier: local-only
      try {
        const res = await P.ICloudKV.get({ key });
        const cloudVal = res && res.value;
        if (!cloudVal) return;                  // nothing on iCloud yet
        const localVal = localStorage.getItem(key);
        if (cloudVal === localVal) return;       // already in sync
        // iCloud copy wins. Replace local and re-hydrate Bidoro.
        localStorage.setItem(key, cloudVal);
        if (typeof window.loadState === 'function') {
          try {
            window.state = window.loadState();
          } catch (_) {}
        }
        if (typeof window.renderAll === 'function') {
          try { window.renderAll(); } catch (_) {}
        }
        if (typeof window.renderFocusMatrix === 'function') {
          try { window.renderFocusMatrix(); } catch (_) {}
        }
        if (typeof window.drawGauge === 'function') {
          try { window.drawGauge(); } catch (_) {}
        }
      } catch (_) {}
    }

    // Initial pull (after a short delay so Bidoro's loadState has finished).
    setTimeout(() => {
      ICLOUD_KEYS.forEach(pullICloudAndApply);
    }, 400);

    // Mirror every relevant localStorage.setItem to iCloud.
    const _origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      _origSetItem.apply(this, arguments);
      if (ICLOUD_KEYS.indexOf(k) >= 0) {
        pushICloud(k);
      }
    };
    // Removals too.
    const _origRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (k) {
      _origRemoveItem.apply(this, arguments);
      if (ICLOUD_KEYS.indexOf(k) >= 0) {
        try { P.ICloudKV.remove({ key: k }); } catch (_) {}
      }
    };

    // Listen for external changes (another device pushed an update).
    try {
      P.ICloudKV.addListener('change', (data) => {
        if (!_bidoroPremium()) return;       // free tier: ignore incoming iCloud changes
        if (!data || !data.key) return;
        if (ICLOUD_KEYS.indexOf(data.key) < 0) return;
        // Apply the new value coming FROM iCloud. Suppress the re-mirror by
        // calling the original setItem directly (bypass our wrapper).
        try {
          if (data.value == null || data.value === '') {
            _origRemoveItem.call(localStorage, data.key);
          } else {
            _origSetItem.call(localStorage, data.key, data.value);
          }
        } catch (_) {}
        // Re-hydrate state + redraw.
        if (typeof window.loadState === 'function') {
          try { window.state = window.loadState(); } catch (_) {}
        }
        if (typeof window.renderAll === 'function') {
          try { window.renderAll(); } catch (_) {}
        }
        if (typeof window.renderFocusMatrix === 'function') {
          try { window.renderFocusMatrix(); } catch (_) {}
        }
        if (typeof window.drawGauge === 'function') {
          try { window.drawGauge(); } catch (_) {}
        }
      });
    } catch (_) {}

    // Expose so the user / debugger can poke at it.
    window.__iCloudKV = { push: pushICloud, pull: pullICloudAndApply };
  }

  // ---- 8. Home-screen widget data push ----
  // The WidgetKit widget (BidoroWidget) can't read this WebView's localStorage,
  // so we push a tiny JSON snapshot to native, which stashes it in the shared
  // App Group (group.com.moonleon.bidoro) + reloads the widget timeline. Native
  // dedupes (only reloads when the snapshot actually changed), so pushing
  // liberally here is fine.
  //
  // Pairs with the "bidoroWidget" WKScriptMessageHandler in AppDelegate.swift
  // and BidoroSnapshot.load() in BidoroWidget.swift — keep the field names in
  // sync across all three.
  (function widgetBridge() {
    function handler() {
      return (window.webkit && window.webkit.messageHandlers &&
              window.webkit.messageHandlers.bidoroWidget) || null;
    }
    if (!handler()) return;   // older app build without the widget handler

    // Today's earnings = sum of moneyLog deltas since local midnight — mirrors
    // moneyChangeForScale('D') in index.html so the widget's "Today +$X" equals
    // the in-app money card.
    function todayDelta(state) {
      try {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        const cutoff = d.getTime();
        let sum = 0;
        const log = state.moneyLog || [];
        for (let i = 0; i < log.length; i++) {
          const e = log[i];
          if (e && e.timestamp >= cutoff) sum += (+e.delta || 0);
        }
        return sum;
      } catch (_) { return 0; }
    }

    // Bucket fill 0…1. Prefer the live 3D-bucket ratio; fall back to the raw
    // state value (water / DEFAULT_H = 150) when the bucket isn't mounted yet.
    function waterRatio(state) {
      try {
        if (typeof window.bidoroBucketWaterRatio === 'function') {
          const r = window.bidoroBucketWaterRatio();
          if (typeof r === 'number' && r > 0) return Math.max(0, Math.min(1, r));
        }
      } catch (_) {}
      try {
        const w = state.bucket && state.bucket.water;
        if (typeof w === 'number') return Math.max(0, Math.min(1, w / 150));
      } catch (_) {}
      return 0;
    }

    // Bucket geometry for the widget's 3D rendering: face count N (3–8) + each
    // face's wall height as a 0–1 fraction (px / DEFAULT_H=150). Mirrors the 3D
    // bucket's per-face heights (state.bucket.heights) so the widget's faceted
    // pail matches the in-app bucket's silhouette + pillar levels.
    function bucketGeometry(state) {
      try {
        const b = state.bucket || {};
        const n0 = +b.N;
        const N = (n0 >= 3 && n0 <= 8) ? Math.round(n0) : 7;
        const hs = Array.isArray(b.heights) ? b.heights : [];
        const heights = [];
        for (let i = 0; i < N; i++) {
          const px = (typeof hs[i] === 'number' && hs[i] > 0) ? hs[i] : 150;
          heights.push(Math.max(0.1, Math.min(1, px / 150)));
        }
        return { faces: N, heights: heights };
      } catch (_) {
        return { faces: 7, heights: [1, 1, 1, 1, 1, 1, 1] };
      }
    }

    // Per-face category names (the "big category" labels painted on the in-app 3D
    // bucket faces) — state.bucket.faceText[i].title, falling back to the 7 default
    // pillar names. The widget paints these small on each face so it matches the app.
    function bucketFaceNames(state, N) {
      const fallback = ['Mind', 'Body', 'Joy', 'Money', 'Growth', 'Study / Work', 'People'];
      const out = [];
      try {
        const ft = (state.bucket && state.bucket.faceText) || [];
        for (let i = 0; i < N; i++) {
          const t = (ft[i] && ft[i].title) ? String(ft[i].title) : (fallback[i] || ('Side ' + (i + 1)));
          out.push(t.replace(/\s+/g, ' ').trim());
        }
      } catch (_) {
        for (let i = 0; i < N; i++) out.push(fallback[i] || ('Side ' + (i + 1)));
      }
      return out;
    }

    // Incomplete tasks across the matrix — mirrors the unfinished-task filter in
    // index.html (!t.done && non-empty text).
    function openTasks(state) {
      try {
        let n = 0;
        ['q1', 'q2', 'q3', 'q4'].forEach(q => {
          const arr = (state.tasks && state.tasks[q]) || [];
          for (let i = 0; i < arr.length; i++) {
            const t = arr[i];
            if (t && !t.done && t.text && String(t.text).trim()) n++;
          }
        });
        return n;
      } catch (_) { return 0; }
    }

    // EXACTLY today's task bars (matches the matrix): uses the app's _tasksOnDate so
    // future-deferred tasks are excluded and DONE tasks are included (shown checked).
    // Returns { items: [{ n, q, d }] capped at 12, total } — incomplete first, done last.
    function todayTasks(state) {
      try {
        const qi = { q1: 0, q2: 1, q3: 2, q4: 3 };
        let list = null;
        const key = (typeof window._calDateKey === 'function') ? window._calDateKey(new Date()) : null;
        if (key && typeof window._tasksOnDate === 'function') {
          list = window._tasksOnDate(key);          // [{ q, idx, task, ... }]
        }
        let rows = [];
        if (Array.isArray(list)) {
          for (const o of list) {
            if (!o || !o.task) continue;
            const t = o.task;
            const name = (t.text && String(t.text).trim()) || '';
            if (!name) continue;
            rows.push({ n: name.slice(0, 40), q: (qi[o.q] != null ? qi[o.q] : -1), d: !!t.done });
          }
        } else {
          // Fallback (app too old / not loaded): matrix-style filter — drop future-deferred, keep done.
          ['q1', 'q2', 'q3', 'q4'].forEach(q => {
            const arr = (state.tasks && state.tasks[q]) || [];
            for (let i = 0; i < arr.length; i++) {
              const t = arr[i];
              if (!t || !t.text || !String(t.text).trim()) continue;
              if (key && typeof t.createdAt === 'number' && typeof window._calDateKey === 'function'
                  && window._calDateKey(t.createdAt) > key) continue;
              rows.push({ n: String(t.text).trim().slice(0, 40), q: qi[q], d: !!t.done });
            }
          });
        }
        rows.sort((a, b) => (a.d ? 1 : 0) - (b.d ? 1 : 0));   // incomplete first, done last (stable)
        return { items: rows.slice(0, 12), total: rows.length };
      } catch (_) { return { items: [], total: 0 }; }
    }

    // Upcoming SCHEDULED BLOCKS for the gauge widget. Mirrors state.scheduledBlocks
    // (see drawGauge/renderScheduledBlocks in index.html) but trimmed to a compact
    // shape: { s, e, q, br, t } = start/end epoch-ms, quadrant index 0–3 (-1 if
    // none/break), isBreak, task title. Only blocks that overlap [now, now+12h] are
    // pushed (the widget shows a forward window with "now" pinned near the top),
    // capped at 18 so the snapshot JSON stays tiny.
    function scheduleBlocks(state) {
      try {
        const raw = (state && Array.isArray(state.scheduledBlocks)) ? state.scheduledBlocks : [];
        const now = Date.now();
        const horizon = now + 12 * 3600000;
        const qIdx = { q1: 0, q2: 1, q3: 2, q4: 3 };
        const out = [];
        for (let i = 0; i < raw.length; i++) {
          const b = raw[i];
          if (!b || b._preview) continue;
          let s = +b.startMs, e = +b.endMs;
          // The running q4 stopwatch block grows DOWN to the now-line: include it as
          // [start, now] even though its end == now (which the normal filter drops).
          const isActiveUp = !!(b.uptask && b.activeAt != null && !b.activeEndMs);
          if (isActiveUp) {
            e = now;
            if (!(e > s)) s = e - 60000;                // min 1-min so a fresh one shows
          } else {
            if (!(e > s)) continue;
            // (user) also keep RECENT-PAST blocks (above the now-line). The widget
            // window starts ~20 min before now, so include anything ending within the
            // last 40 min (buffer) up to the 12 h horizon.
            if (e <= now - 40 * 60000 || s >= horizon) continue;
          }
          const isBreak = !!b.isBreak;
          out.push({
            s: s,
            e: e,
            q: isBreak ? -1 : (qIdx[b.q] != null ? qIdx[b.q] : -1),
            br: isBreak,
            // (user) keep-going overrun (ㄱ-arm): the widget draws this as the full-width head →
            // RIGHT-1/3 arm where a planned block sits below it, mirroring the app's gauge.
            x: b._actualExt ? 1 : 0,
            t: isBreak ? '' : String(b.taskName || b.trackerName || '').trim().slice(0, 40)
          });
        }
        out.sort((a, b) => a.s - b.s);
        return out.slice(0, 18);
      } catch (_) { return []; }
    }

    // Effective locale (resolves 'auto' via the device language) — self-contained so it
    // doesn't depend on the app's bidoroLocale().
    function pickLoc(state) {
      let l = (state && state.locale) || 'auto';
      if (l === 'auto') { let n = 'en'; try { n = (navigator.language || 'en').toLowerCase(); } catch (_) {}
        l = n.indexOf('ko') === 0 ? 'ko' : n.indexOf('zh') === 0 ? 'zh' : n.indexOf('ja') === 0 ? 'ja'
          : n.indexOf('es') === 0 ? 'es' : n.indexOf('fr') === 0 ? 'fr' : 'en'; }
      return ['en','ko','zh','ja','es','fr'].indexOf(l) >= 0 ? l : 'en';
    }
    // Localized "Session N" / "Break N" for the focus widget — mirrors the app's
    // _pomoCountsForToday (today's 3 AM rollover, counted per current task).
    function pomoSessionLabel(state, at, taskTitle) {
      if (!at) return '';
      const now = new Date();
      const cutoff = new Date(now); cutoff.setHours(3, 0, 0, 0);
      if (now.getTime() < cutoff.getTime()) cutoff.setDate(cutoff.getDate() - 1);
      const since = cutoff.getTime();
      let workN = 0, breakN = 0;
      const log = state.watchLog;
      if (Array.isArray(log)) for (const e of log) {
        if (!e) continue;
        const t = (+e.startedAt) || (+e.endedAt) || 0;
        if (t < since) continue;
        if (taskTitle && e.name !== taskTitle) continue;
        if (e.type === 'pomodoro') workN++;
        else if (e.type === 'pomodoro-break') breakN++;
      }
      const loc = pickLoc(state);
      if (at.phase === 'work') {
        const n = workN + 1;
        return ({ en: 'Session ' + n, ko: '세션 ' + n, zh: '第 ' + n + ' 节', ja: 'セッション ' + n, es: 'Sesión ' + n, fr: 'Séance ' + n })[loc] || ('Session ' + n);
      }
      const n = breakN + 1;
      return ({ en: 'Break ' + n, ko: '휴식 ' + n, zh: '休息 ' + n, ja: '休憩 ' + n, es: 'Descanso ' + n, fr: 'Pause ' + n })[loc] || ('Break ' + n);
    }

    // GTD goal/deadline as epoch-ms for the gauge widget's blue line. Mirrors the app's
    // combineDateTime(deadlineDate, deadline, {rolling}) — daily ('every') scope rolls to
    // today's time; a pinned date is used as-is. 0 when no goal is set.
    function gtdGoalMs(state) {
      const time = state.deadline;
      if (!time) return 0;
      const p = String(time).split(':'); const h = +p[0], m = +p[1];
      if (isNaN(h) || isNaN(m)) return 0;
      let dateStr = state.deadlineDate || '';
      if (state.gtdScope === 'every') dateStr = '';   // daily → roll to today
      const now = Date.now();
      if (dateStr) { const dt = new Date(dateStr + 'T' + time); const ms = dt.getTime(); return isNaN(ms) ? 0 : ms; }
      const d = new Date(now); d.setHours(h, m, 0, 0);
      if (d.getTime() < now) d.setDate(d.getDate() + 1);   // passed today → tomorrow
      return d.getTime();
    }

    function buildPayload() {
      const state = window.state;
      if (!state) return null;
      let phase = '', phaseStartMs = 0, phaseEndMs = 0, paused = false, taskTitle = '', sessionLabel = '';
      let quad = -1, uptimer = false;
      const _qIdx = (q) => ({ q1: 0, q2: 1, q3: 2, q4: 3 })[q];
      const _taskName = (a) => { try { const arr = state.tasks && state.tasks[a.q]; const t = arr && arr[a.idx]; return (t && t.text) ? String(t.text).trim() : ''; } catch (_) { return ''; } };
      const at = state.activeTimer;
      if (at && at.type === 'pomodoro' && (at.phase === 'work' || at.phase === 'break')) {
        phase = at.phase;
        paused = !!at.paused;
        quad = (_qIdx(at.q) != null) ? _qIdx(at.q) : -1;
        phaseStartMs = (+at.phaseStartedAt || +at.startedAt || 0);
        if (at.pendingPhaseConfirm) {
          phaseEndMs = Date.now();   // boundary reached, awaiting confirm → ~0
        } else {
          phaseEndMs = phaseStartMs + (+at.phaseDurationMs || 0);
        }
        taskTitle = _taskName(at);
        sessionLabel = pomoSessionLabel(state, at, taskTitle);
      } else if (at && at.type === 'uptask') {
        // q4 distraction STOPWATCH — counts UP, no fixed end. Theme = q4 blue.
        phase = 'work';
        uptimer = true;
        paused = !!at.paused;
        quad = (_qIdx(at.q) != null) ? _qIdx(at.q) : 3;
        phaseStartMs = (+at.startedAt || 0);
        phaseEndMs = 0;            // open-ended
        taskTitle = _taskName(at);
        sessionLabel = '';         // q4 stopwatch has no "Session N" badge
      }
      const geo = bucketGeometry(state);
      const _tt = todayTasks(state);
      return {
        money: (typeof state.money === 'number') ? state.money : 0,
        todayDelta: todayDelta(state),
        water: waterRatio(state),
        faces: geo.faces,
        heights: geo.heights,
        faceNames: bucketFaceNames(state, geo.faces),
        frontFace: (function () {
          try {
            return (typeof window.bidoroBucket3DFrontFace === 'function')
              ? (window.bidoroBucket3DFrontFace() | 0) : 0;
          } catch (_) { return 0; }
        })(),
        phase: phase,
        phaseStartMs: phaseStartMs,
        phaseEndMs: phaseEndMs,
        paused: paused,
        taskTitle: taskTitle,
        sessionLabel: sessionLabel,
        quad: quad,
        uptimer: uptimer,
        tasksOpen: _tt.total,
        tasks: _tt.items.map(o => o.n),
        taskQuads: _tt.items.map(o => o.q),
        taskDone: _tt.items.map(o => o.d),
        blocks: scheduleBlocks(state),
        goalMs: gtdGoalMs(state),
        updatedMs: Date.now()
      };
    }

    function pushWidget() {
      const h = handler();
      if (!h) return;
      const payload = buildPayload();
      if (!payload) return;
      try { h.postMessage(payload); } catch (_) {}
    }
    window.__bidoroPushWidget = pushWidget;   // manual trigger for debugging

    // Push on first paint (after state has loaded), on a gentle 12 s interval
    // (covers the per-minute money drip + keeps the phase countdown end fresh),
    // and — most importantly — right before the app backgrounds, since that's
    // exactly when the user is looking at the home-screen widget. JS is frozen
    // while backgrounded, so the interval costs nothing off-screen.
    window.addEventListener('load', () => { setTimeout(pushWidget, 1200); });
    setInterval(pushWidget, 12000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') pushWidget();
    });
    window.addEventListener('pagehide', pushWidget);
    window.addEventListener('blur', pushWidget);
  })();

  // ---- 9. In-App Purchase (Bidoro PRO) + App Store review ----
  // JS → native bridges. The StoreKit logic lives natively (StoreKitBridge.swift,
  // wired through the "bidoroIAP" / "bidoroReview" WKScriptMessageHandlers in
  // AppDelegate.swift). Native calls back into the page via:
  //    window.bidoroSetPremium(on, plan)               — entitlement changed
  //    window.bidoroSetPrices({monthly, yearly, ...})  — localized App-Store prices
  // (both defined in index.html's paywall module). Product IDs:
  //    com.moonleon.bidoro.pro.monthly / com.moonleon.bidoro.pro.yearly
  (function iapBridge() {
    function mh(name) {
      return (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers[name]) || null;
    }
    window.BidoroIAP = {
      products: function () { const h = mh('bidoroIAP'); if (h) try { h.postMessage({ action: 'products' }); } catch (_) {} },
      purchase: function (plan) { const h = mh('bidoroIAP'); if (h) try { h.postMessage({ action: 'purchase', plan: plan }); } catch (_) {} },
      restore:  function () { const h = mh('bidoroIAP'); if (h) try { h.postMessage({ action: 'restore' }); } catch (_) {} },
      status:   function () { const h = mh('bidoroIAP'); if (h) try { h.postMessage({ action: 'status' }); } catch (_) {} }
    };
    window.BidoroReview = {
      request: function () { const h = mh('bidoroReview'); if (h) try { h.postMessage({ action: 'request' }); } catch (_) {} }
    };
    // On launch, ask native for the live entitlement + localized prices so a
    // returning subscriber is unlocked with no tap and the paywall shows real
    // App Store prices.
    window.addEventListener('load', function () {
      setTimeout(function () {
        const h = mh('bidoroIAP');
        if (h) { try { h.postMessage({ action: 'status' }); h.postMessage({ action: 'products' }); } catch (_) {} }
      }, 800);
    });
  })();
})();
