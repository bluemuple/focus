// Text-to-speech — Cloud-only.
//
// We only call Google Cloud TTS via the Supabase Edge Function (`tts`) — Web
// Speech is intentionally NOT used. There's no engine toggle for the user;
// every speak() call goes through Cloud and any failure logs a warning.
//
// Audio cache: Cloud responses are cached as Blob URLs in memory keyed by
// (voice + text). Same word clicked again replays from memory instantly.
// We also reuse a SINGLE <audio> element (src-swap) to avoid the iOS Safari
// autoplay-policy reject on every new Audio object, and to dodge Chrome's
// "play() interrupted by pause()" race when sentences hand off quickly.

(() => {
  const audioCache = new Map();   // voice + '|' + text  →  objectURL

  let cloudAudio = null;
  function getCloudAudio() {
    if (!cloudAudio) {
      cloudAudio = new Audio();
      cloudAudio.preload = 'auto';
    }
    return cloudAudio;
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

  async function speak(text, opts = {}) {
    text = (text || '').toString().trim();
    if (!text) return;
    stop();

    const voice = opts.voice || 'en-US-Neural2-F';
    const rate  = opts.rate  ?? 1.0;
    const ck    = voice + '|' + text;

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

    const audio = getCloudAudio();
    // Detach previous handlers and stop the current playback. The src swap
    // below would otherwise reject the prior play() promise as "hard"
    // failure, which we silently catch as benign at the bottom of this fn.
    audio.onended = null;
    audio.onerror = null;
    try { audio.pause(); } catch (e) {}
    audio.src = url;
    pendingOnend = (typeof opts.onend === 'function') ? opts.onend : null;
    audio.onended = () => firePending();
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

  window.TTS = { speak, stop, isSpeaking };
})();
