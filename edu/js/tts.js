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
  // Rename the local var so it doesn't shadow the global `URL` object —
  // that shadowing broke base64ToBlobUrl()'s `URL.createObjectURL()`
  // call (it was being invoked on the supabase URL STRING, which
  // doesn't have that method).
  const SB_URL = (window.WC_SUPABASE && window.WC_SUPABASE.url)  || '';
  const ANON   = (window.WC_SUPABASE && window.WC_SUPABASE.anon) || '';
  // NOTE: endpoint is `wc-tts-google`, NOT `tts-google` — the latter
  // is already owned by the sibling 뚜벅뚜벅 site in this same
  // Supabase project. The `wc-` prefix keeps them separate.
  const TTS_FN = SB_URL ? SB_URL.replace(/\/+$/, '') + '/functions/v1/wc-tts-google' : '';

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
    // Sanitise the input so the synthesiser never tries to "say" any
    // of the structural / placeholder markup that leaks through from
    // the body text. Two concerns:
    //   1. Markers / tags that aren't real speech (e.g. [[IMG:0]],
    //      <span>) get stripped entirely.
    //   2. Brackets/parens are removed so the Web Speech fallback
    //      doesn't announce them ("opening parenthesis"). Google TTS
    //      handles them gracefully, but Web Speech APIs on macOS /
    //      Windows literally read out the punctuation name.
    text = String(text || '')
      // Image markers — robust against unbalanced/single-bracket
      // variants. Matches [[IMG:0]], [IMG:0], [[IMG:0], [IMG:0]],
      // anything where one-or-more `[` wraps `IMG:N` wraps one-or-
      // more `]`. The `\s*` tolerates accidental spaces inside.
      .replace(/\[+\s*IMG\s*:\s*\d+\s*\]+/gi, ' ')
      // Bare IMG:N tokens that already lost their brackets somewhere
      // upstream — paranoid catch-all so the synthesiser never
      // pronounces them.
      .replace(/\bIMG\s*:\s*\d+\b/gi, ' ')
      // Generic balanced [[key:value]] markers (defensive).
      .replace(/\[\[[^\]]*\]\]/g, ' ')
      // Stray HTML tags (defensive — sentence text shouldn't have any
      // by the time it reaches TTS, but page-break HRs / leftover
      // markdown→HTML fragments occasionally sneak in).
      .replace(/<[^>]+>/g, ' ')
      // Markdown page-break (---) on its own line.
      .replace(/^---+\s*$/gm, ' ')
      // Stray markdown heading marks — strip EVERY `#` regardless of
      // position. The old "(^|\\s)#+" pattern missed mid-word hashes
      // like `Tag#1`, which Google TTS would announce as "Tag hash one"
      // and inject long pauses around (making the rest of the sentence
      // sound like it's being read word-by-word). Stripping all `#`
      // chars lets the surrounding text flow normally.
      .replace(/#+/g, ' ')
      // Stray bold/underline wrappers — leftover ** or __ pairs that
      // weren't stripped upstream. Keep the inner text.
      .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
      .replace(/__([\s\S]*?)__/g,     '$1')
      // Bracket families — Web Speech on macOS/Windows announces them
      // as "opening parenthesis" etc., and Google TTS occasionally
      // pauses long enough that they sound spelled-out. Strip every
      // common ASCII + CJK bracket type, keeping the inner text.
      //   ASCII : [ ] ( ) { } < >
      //   CJK   : （）「」『』〔〕【】〈〉《》〖〗
      .replace(/[\[\](){}<>（）「」『』〔〕【】〈〉《》〖〗]/g, ' ')
      // Collapse all whitespace runs.
      .replace(/\s+/g, ' ')
      .trim();
    // Empty or whitespace-only after sanitising → no-op. Saves a
    // round-trip + prevents the playback loop from stalling on a
    // 200 ms "play nothing" call.
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
      if (!r.ok) {
        // Surface the server's actual error message so deploy mishaps
        // (missing GOOGLE_CLOUD_API_KEY, voice unavailable, etc.) are
        // diagnosable from the browser console without trawling
        // Supabase logs.
        const detail = await r.text().catch(() => '');
        throw new Error('wc-tts-google ' + r.status + ' :: ' + detail.slice(0, 300));
      }
      const j = await r.json();
      if (!j.audio_base64) throw new Error('no audio');
      let url;
      try {
        url = base64ToBlobUrl(j.audio_base64, 'audio/mp3');
      } catch (blobErr) {
        throw new Error('blob: ' + (blobErr.message || blobErr));
      }
      memCache.set(key, url);
      try {
        return await playUrl(url);
      } catch (playErr) {
        throw new Error('play: ' + (playErr.message || playErr));
      }
    } catch (err) {
      // Tag the failure stage so we can tell apart fetch / blob / play
      // problems at a glance in the console.
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
