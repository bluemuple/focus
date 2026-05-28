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
  if (P.StatusBar) {
    try { P.StatusBar.setStyle({ style: 'DEFAULT' }); } catch (_) {}
    try { P.StatusBar.setBackgroundColor({ color: '#ffffff' }); } catch (_) {}
    try { P.StatusBar.setOverlaysWebView({ overlay: false }); } catch (_) {}
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
          sound: null
        }]
      });
      _scheduledForPhase = phaseEnd;
    } catch (_) {}
  }

  // ---- 4. Keyboard body-class hooks ----
  if (P.Keyboard) {
    try {
      P.Keyboard.addListener('keyboardWillShow', () => {
        document.body.classList.add('ios-kb-open');
      });
      P.Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('ios-kb-open');
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

    function pushICloud(key) {
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
})();
