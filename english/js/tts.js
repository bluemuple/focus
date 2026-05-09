// Text-to-speech — Cloud-only, Google Neural2 voices.
//
// We only call Google Cloud TTS via the Supabase Edge Function (`tts`) — Web
// Speech is intentionally NOT used. The default voice is `en-US-Neural2-F`
// (warm female); the user can pick any voice from VOICES below via the
// playbar menu. Whatever they pick is persisted in localStorage and applied
// to every speak() call (word taps, sentence playback, etc.).
//
// Audio cache: Cloud responses are cached as Blob URLs in memory keyed by
// (voice + text). Same word clicked again replays from memory instantly.
// We also reuse a SINGLE <audio> element (src-swap) to avoid the iOS Safari
// autoplay-policy reject on every new Audio object, and to dodge Chrome's
// "play() interrupted by pause()" race when sentences hand off quickly.

(() => {
  // Voices surfaced in the playbar's voice picker. Mix of accents so the
  // user can pick one that matches their target dialect (US / UK / NZ).
  // The "label" is what appears on the picker button — short letters /
  // accent badges so the row stays compact on mobile.
  // Voices are tagged with `lang` so the picker can show only the
  // relevant ones for the current target language ('en' or 'ja').
  // The user's preferred voice is saved per-language so a JP-mode
  // pick doesn't override their EN-mode pick and vice versa.
  const VOICES = [
    // ---- English ----
    { id: 'en-US-Neural2-F',     lang: 'en', label: 'US',  gender: '여자', note: 'US 여성 — 활발한 톤 (기본)' },
    { id: 'en-US-Neural2-H',     lang: 'en', label: 'US+', gender: '여자', note: 'US 여성 — 밝은 톤' },
    { id: 'en-US-Neural2-J',     lang: 'en', label: 'US♂', gender: '남자', note: 'US 남성 — 편안한 톤' },
    { id: 'en-GB-Neural2-A',     lang: 'en', label: 'UK',  gender: '여자', note: 'UK 영국 여성 — 밝은 톤' },
    { id: 'en-AU-Neural2-A',     lang: 'en', label: 'NZ',  gender: '여자', note: 'NZ/AU 여성' },
    { id: 'en-AU-Neural2-B',     lang: 'en', label: 'NZ♂', gender: '남자', note: 'NZ/AU 남성' },
    // ---- Japanese (Google Cloud TTS ja-JP-Neural2 family) ----
    { id: 'ja-JP-Neural2-B',     lang: 'ja', label: 'JP',  gender: '여자', note: '일본어 여성 (기본)' },
    { id: 'ja-JP-Neural2-C',     lang: 'ja', label: 'JP♂', gender: '남자', note: '일본어 남성' },
    { id: 'ja-JP-Neural2-D',     lang: 'ja', label: 'JP+', gender: '남자', note: '일본어 남성 — 차분한 톤' },
  ];
  const DEFAULT_VOICE_BY_LANG = {
    en: 'en-US-Neural2-F',
    ja: 'ja-JP-Neural2-B',
  };
  // Per-language stored preference so the user's JP voice doesn't clobber
  // their EN voice on switch. English keeps the legacy un-suffixed key
  // for back-compat; Japanese gets `eng.v1.ttsVoice.ja`.
  function _voiceKey(lang) {
    return lang === 'en' ? 'eng.v1.ttsVoice' : ('eng.v1.ttsVoice.' + lang);
  }
  function _curLang() {
    return (window.DB && window.DB.getLang && window.DB.getLang()) || 'en';
  }
  function listVoices() {
    // Only voices for the current target language show up in the picker.
    const lang = _curLang();
    return VOICES.filter(v => v.lang === lang);
  }
  function getVoice() {
    const lang = _curLang();
    try {
      const v = localStorage.getItem(_voiceKey(lang));
      if (v && VOICES.some(o => o.id === v && o.lang === lang)) return v;
    } catch (e) {}
    return DEFAULT_VOICE_BY_LANG[lang] || DEFAULT_VOICE_BY_LANG.en;
  }
  function setVoice(v) {
    if (!v) return;
    const meta = VOICES.find(o => o.id === v);
    if (!meta) return;
    try { localStorage.setItem(_voiceKey(meta.lang), v); } catch (e) {}
  }

  const audioCache = new Map();   // voice + '|' + text  →  objectURL

  // Double-buffered audio elements for gapless transitions.
  // `cloudAudio` is the currently playing element. `primedAudio` is a
  // SECOND element with the next sentence's blob URL already loaded
  // (preload='auto' + .load() forces buffering). When speak() is
  // called for a URL that matches primedAudio.src, we SWAP — the
  // primed element becomes the active one and play() starts almost
  // instantly (no src-swap decode delay). This collapses sentence-to-
  // sentence gaps from ~80-150 ms to ~10-30 ms in practice.
  let cloudAudio = null;
  let primedAudio = null;
  function getCloudAudio() {
    if (!cloudAudio) {
      cloudAudio = new Audio();
      cloudAudio.preload = 'auto';
    }
    return cloudAudio;
  }
  function getPrimedAudio() {
    if (!primedAudio) {
      primedAudio = new Audio();
      primedAudio.preload = 'auto';
    }
    return primedAudio;
  }
  // Pre-load `url` into the primedAudio element so a subsequent
  // speak() with that same URL can hot-swap instead of paying the
  // src-set + decode latency. Idempotent — re-priming the same URL
  // is a no-op.
  function primeNext(url) {
    if (!url) return;
    const a = getPrimedAudio();
    if (a.src === url) return;       // already primed
    try { a.pause(); } catch (_) {}
    a.src = url;
    try { a.load(); } catch (_) {}   // force preload of buffer
  }

  let currentAudio = null;
  // Track the most recently registered onend callback so stop() / a play()
  // rejection can release any outer await waiting for "this sentence is
  // done" — otherwise the sentence-loop in startTTS hangs.
  let pendingOnend = null;
  function firePending() {
    const cb = pendingOnend; pendingOnend = null;
    if (typeof cb === 'function') { try { cb(); } catch (e) {} }
  }

  function stop() {
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (e) {}
      currentAudio = null;
    }
    firePending();
  }

  async function fetchCloudAudio(text, voice, rate) {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.anon) throw new Error('Supabase not configured');
    const url = cfg.url.replace(/\/+$/, '') + '/functions/v1/tts';
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + cfg.anon,
        'apikey':        cfg.anon,
      },
      body: JSON.stringify({ text, voice, rate }),
    });
    if (!r.ok) {
      let detail = '';
      try { detail = await r.text(); } catch (e) {}
      throw new Error('cloud TTS ' + r.status + (detail ? ' ' + detail.slice(0, 200) : ''));
    }
    const blob = await r.blob();
    if (!blob.size) throw new Error('cloud TTS empty');
    return URL.createObjectURL(blob);
  }

  // Cache key includes rate — Google Cloud TTS bakes the rate INTO the audio
  // (it's not a client-side playbackRate), so the same text at 0.9× and 1.5×
  // are different audio buffers. Using `voice|text` alone meant changing
  // speed mid-session would replay the stale cached audio at the old speed.
  function cacheKey(voice, rate, text) {
    return voice + '|' + (rate || 1) + '|' + text;
  }

  // Pre-warm the cache for `text` without playing it. Called by the
  // sentence-playback loop to fetch the NEXT sentence's audio while the
  // current one is still playing — by the time speak() runs for the next
  // sentence it's a memory hit, eliminating the ~200-500ms Edge Function
  // round-trip that used to gap each period.
  async function prefetch(text, opts = {}) {
    text = stripQuotes((text || '').toString()).trim();
    if (!text) return;
    const voice = opts.voice || getVoice();
    const rate  = opts.rate  ?? 1.0;
    const ck    = cacheKey(voice, rate, text);
    let url = audioCache.get(ck);
    if (!url) {
      try {
        url = await fetchCloudAudio(text, voice, rate);
        audioCache.set(ck, url);
      } catch (_) {
        // Silent — if prefetch fails, normal speak() will retry and surface
        // the error there.
        return;
      }
    }
    // ALSO prime the secondary audio element so the upcoming speak()
    // can hot-swap. (Both fresh fetches AND cache hits prime — ensures
    // gapless transitions even when the URL has been around since
    // an earlier session.)
    primeNext(url);
  }

  // Quote characters are read aloud as "open quote / close quote" by some
  // Google Neural2 voices (especially in news-style prompts). Strip them
  // before synthesis so the audio sounds like fluent reading rather than
  // dictation. Both straight (" ') and curly (" " ' ') quotes get removed.
  function stripQuotes(text) {
    return String(text || '').replace(/[“”„‟"‘’‚‛']/g, '');
  }

  async function speak(text, opts = {}) {
    text = stripQuotes((text || '').toString()).trim();
    if (!text) return;
    stop();

    // Use the explicit `opts.voice` if the caller asked for one; otherwise
    // fall back to the user's saved preference (or the default Neural2 voice).
    const voice = opts.voice || getVoice();
    const rate  = opts.rate  ?? 1.0;
    const ck    = cacheKey(voice, rate, text);

    let url = audioCache.get(ck);
    if (!url) {
      try {
        url = await fetchCloudAudio(text, voice, rate);
        audioCache.set(ck, url);
      } catch (e) {
        console.warn('[TTS] cloud failed:', e && e.message || e);
        // No fallback engine — fire the pending onend so the caller's loop
        // doesn't hang waiting for an end-of-audio signal that will never come.
        if (typeof opts.onend === 'function') {
          try { opts.onend(); } catch (er) {}
        }
        return;
      }
    }

    // ── Hot-swap with primedAudio when its src matches ──
    // If the lesson's prefetch loop already primed the secondary audio
    // element with this URL (and the browser has buffered it via
    // load()), we swap roles: the PRIMED element becomes the active
    // one, and the previously-active becomes the new "primed slot"
    // for the NEXT prefetch to write into. Eliminates the src-set +
    // decode latency that produced the audible inter-sentence gap.
    let audio;
    if (primedAudio && primedAudio.src && primedAudio.src === url) {
      // Swap.
      const prev = cloudAudio;
      cloudAudio = primedAudio;
      primedAudio = prev;
      audio = cloudAudio;
      // Reset event listeners on the (now-active) audio. Don't change
      // src — it's already set + buffered.
      audio.onended = null;
      audio.onerror = null;
      audio.onplaying = null;
      audio.ontimeupdate = null;
      // Rewind in case it was previously partially played somehow.
      try { audio.currentTime = 0; } catch (_) {}
    } else {
      audio = getCloudAudio();
      // Detach previous handlers and stop the current playback. The src
      // swap below would otherwise reject the prior play() promise as
      // "hard" failure, which we silently catch as benign at the
      // bottom of this fn.
      audio.onended = null;
      audio.onerror = null;
      audio.onplaying = null;
      audio.ontimeupdate = null;       // reset midpoint tracking
      try { audio.pause(); } catch (e) {}
      audio.src = url;
    }
    pendingOnend = (typeof opts.onend === 'function') ? opts.onend : null;
    audio.onended = () => firePending();
    // `onplay` callers want to know when audio AUDIBLY starts (so they can
    // align UI like a sentence underline with the speech). `playing` fires
    // as soon as the audio is actually producing sound — strictly after any
    // network/decode delay — which is what we want, vs. `play` which fires
    // earlier (right after .play() is called, before sound starts).
    if (typeof opts.onplay === 'function') {
      let fired = false;
      audio.onplaying = () => {
        if (fired) return;
        fired = true;
        try { opts.onplay(); } catch (e) {}
      };
    }
    // `onMidpoint` + `midpointFraction` — fire ONCE when the audio's
    // currentTime crosses the requested fraction of total duration.
    // Used by the lesson page to slide to the next page mid-utterance
    // when a STITCHED cross-page sentence is playing: audio crosses
    // the page-A-tail / total ratio → trigger goPage(+1) so the new
    // page is in place before the audio finishes. Self-removes after
    // firing; reset on every speak() via the ontimeupdate=null above.
    if (typeof opts.onMidpoint === 'function'
        && typeof opts.midpointFraction === 'number'
        && opts.midpointFraction > 0 && opts.midpointFraction < 1) {
      let fired = false;
      const frac = opts.midpointFraction;
      audio.ontimeupdate = () => {
        if (fired) return;
        if (audio.duration > 0 && audio.currentTime >= audio.duration * frac) {
          fired = true;
          audio.ontimeupdate = null;
          try { opts.onMidpoint(); } catch (e) {}
        }
      };
    }
    currentAudio = audio;

    try {
      await audio.play();
    } catch (e) {
      // play() preempted by a sibling stop() / src swap during fast handoff.
      // Treat as benign — fire pending so the caller's loop moves on.
      if (e && (e.name === 'AbortError' || /interrupt/i.test(e.message || ''))) {
        firePending();
        return;
      }
      console.warn('[TTS] play failed:', e && e.message || e);
      firePending();
    }
  }

  function isSpeaking() {
    return !!(currentAudio && !currentAudio.paused && !currentAudio.ended);
  }

  window.TTS = { speak, stop, isSpeaking, listVoices, getVoice, setVoice, prefetch };
})();
