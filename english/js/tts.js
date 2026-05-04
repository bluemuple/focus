// Text-to-speech (British female).
// Uses the browser's built-in Web Speech API. On Microsoft Edge this resolves to
// the Edge AI / Azure neural voices (e.g. "Microsoft Sonia/Libby Online (Natural)")
// when the user is online — matching the spec. On other browsers it falls back to
// the best available en-GB female voice (or any English female voice).

(() => {
  let cachedVoices = null;

  function loadVoices() {
    return new Promise((resolve) => {
      const v = speechSynthesis.getVoices();
      if (v && v.length) { cachedVoices = v; resolve(v); return; }
      speechSynthesis.onvoiceschanged = () => {
        cachedVoices = speechSynthesis.getVoices();
        resolve(cachedVoices);
      };
      setTimeout(() => resolve(speechSynthesis.getVoices() || []), 1500);
    });
  }

  function pickVoice(voices) {
    if (!voices || !voices.length) return null;
    const female = /(female|woman|sonia|libby|hollie|olivia|amy|emma|maisie|abby|aria|jenny|natasha|molly|kate|fiona|moira|samantha|karen|kimberly|ivy|isla|catherine|allison)/i;
    const male   = /(\bmale\b|\bman\b|ryan|thomas|brian|guy|william|connor|mitchell|liam|david|alex|daniel|mark|fred|matthew|joey|justin|kevin)/i;
    const isFemale = (n) => female.test(n) && !male.test(n);

    // 1) en-GB female (Edge: Sonia/Libby; macOS: Kate/Serena/Daniel-female; Win: Hazel)
    let v = voices.find(x => /en[-_]GB/i.test(x.lang) && isFemale(x.name));
    if (v) return v;
    // 2) en-GB any (still British)
    v = voices.find(x => /en[-_]GB/i.test(x.lang));
    if (v) return v;
    // 3) any English female
    v = voices.find(x => /^en/i.test(x.lang) && isFemale(x.name));
    if (v) return v;
    // 4) any English voice
    v = voices.find(x => /^en/i.test(x.lang));
    return v || voices[0];
  }

  let lastUtter = null;
  function stop() {
    try { speechSynthesis.cancel(); } catch(e){}
    lastUtter = null;
  }
  async function speak(text, opts = {}) {
    if (!('speechSynthesis' in window)) return;
    text = (text || '').toString().trim();
    if (!text) return;
    stop();
    const voices = await loadVoices();
    const voice = pickVoice(voices);
    const u = new SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-GB'; }
    u.rate  = opts.rate  ?? 0.95;
    u.pitch = opts.pitch ?? 1.0;
    u.volume = opts.volume ?? 1;
    if (typeof opts.onend === 'function') u.onend = opts.onend;
    lastUtter = u;
    speechSynthesis.speak(u);
  }
  function isSpeaking() {
    return !!('speechSynthesis' in window) && speechSynthesis.speaking;
  }

  window.TTS = { speak, stop, isSpeaking, loadVoices };
})();
