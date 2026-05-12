// =============================================================
//  WordCatch — TTS service
//
//  Primary:   Google Cloud TTS via the `wc-tts-google` edge function,
//             voice = en-NZ-Wavenet-A. Cached server-side so the
//             same sentence costs nothing after the first play.
//  Fallback:  Web Speech API speechSynthesis with whichever en-NZ
//             voice the browser offers (Safari/Chrome). If no
//             en-NZ voice is available, falls back to en-AU then
//             en-GB then en-US.
//
//  Memory cache: per-page session, key = "<voice>:<rate>:<text>".
//  Saves a network round-trip when the same word / sentence is
//  played twice in one reading.
//
//  Exposes window.WCTTS:
//    .speak(text, opts?)   → returns Promise that resolves when
//                            playback ends (or rejects on error)
//    .stop()               → halts current playback
// =============================================================
(() => {
  const URL  = (window.WC_SUPABASE && window.WC_SUPABASE.url)  || '';
  const ANON = (window.WC_SUPABASE && window.WC_SUPABASE.anon) || '';
  // NOTE: endpoint is `wc-tts-google`, NOT `tts-google` — the latter
  // is already owned by the sibling 뚜벅뚜벅 site in this same
  // Supabase project. The `wc-` prefix keeps them separate.
  const TTS_FN = URL ? URL.replace(/\/+$/, '') + '/functions/v1/wc-tts-google' : '';

  const memCache = new Map();   // key → blob URL
  let currentAudio = null;
  let currentUtter = null;

  function stop() {
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.currentTime = 0; } catch {}
      currentAudio = null;
    }
    if (currentUtter) {
      try { window.speechSynthesis.cancel(); } catch {}
      currentUtter = null;
    }
  }

  async function speak(text, opts) {
    text = String(text || '').trim();
    if (!text) return;
    stop();

    // Default voice matches 또박또박's "NZ" pick — Google's en-AU-Neural2-A
    // (NZ/AU female, warm tone). Wavenet was previously default but
    // Neural2 has cleaner prosody on short chunk-length utterances.
    const voice = (opts && opts.voice) || 'en-AU-Neural2-A';
    const rate  = (opts && opts.rate)  || 1.0;
    const key   = `${voice}:${rate.toFixed(2)}:${text}`;

    // Cached blob URL from earlier in this session.
    if (memCache.has(key)) {
      return playUrl(memCache.get(key));
    }

    // Try edge function first.
    try {
      if (!TTS_FN) throw new Error('edge fn url not configured');
      const r = await fetch(TTS_FN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON,
          Authorization: 'Bearer ' + ANON,
        },
        body: JSON.stringify({ text, voice, rate }),
      });
      if (!r.ok) throw new Error('wc-tts-google ' + r.status);
      const j = await r.json();
      if (!j.audio_base64) throw new Error('no audio');
      const url = base64ToBlobUrl(j.audio_base64, 'audio/mp3');
      memCache.set(key, url);
      return playUrl(url);
    } catch (err) {
      console.warn('[TTS] edge fn failed, falling back to Web Speech:', err.message || err);
      return webSpeechSpeak(text, rate);
    }
  }

  function playUrl(url) {
    return new Promise((resolve, reject) => {
      const a = new Audio(url);
      currentAudio = a;
      a.onended = () => { currentAudio = null; resolve(); };
      a.onerror = () => { currentAudio = null; reject(new Error('audio play error')); };
      a.play().catch(reject);
    });
  }

  // ---------- Web Speech API fallback ----------
  // Voice picking — cache the chosen voice once it's available.
  let _pickedVoice = null;
  function pickVoice() {
    if (_pickedVoice) return _pickedVoice;
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    // priority order: en-NZ, en-AU, en-GB, en-US, any en
    const pref = ['en-NZ', 'en-AU', 'en-GB', 'en-US'];
    for (const lang of pref) {
      const v = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase()));
      if (v) { _pickedVoice = v; return v; }
    }
    _pickedVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) || null;
    return _pickedVoice;
  }
  // Voices populate asynchronously in some browsers (Chrome) — listen so
  // the first speak() after page load still picks something useful.
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.onvoiceschanged = () => { _pickedVoice = null; pickVoice(); }; } catch {}
  }

  function webSpeechSpeak(text, rate) {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) return reject(new Error('Web Speech unsupported'));
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = (v && v.lang) || 'en-NZ';
      u.rate = rate;
      u.onend   = () => { currentUtter = null; resolve(); };
      u.onerror = (e) => { currentUtter = null; reject(new Error('speech error: ' + (e.error || ''))); };
      currentUtter = u;
      window.speechSynthesis.speak(u);
    });
  }

  function base64ToBlobUrl(b64, mime) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime || 'audio/mp3' });
    return URL.createObjectURL(blob);
  }

  window.WCTTS = { speak, stop };
})();
