// Tiny Web Speech wrapper.
// Prefers an en-GB female voice (like the Edge "Sonia / Libby" family).
// Falls back gracefully through en-NZ → en-AU → any English voice.
(() => {
  let cached = null;
  function loadVoices() {
    return new Promise((resolve) => {
      const v = speechSynthesis.getVoices();
      if (v && v.length) { cached = v; resolve(v); return; }
      speechSynthesis.onvoiceschanged = () => { cached = speechSynthesis.getVoices(); resolve(cached); };
      setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
    });
  }
  function pickVoice(voices, opts={}) {
    const wantFemale = opts.gender !== 'male';
    if (!voices || !voices.length) return null;
    // Common female / male voice-name fragments across browsers + OSes
    const femaleNames = /(female|woman|girl|sonia|libby|hollie|olivia|amy|emma|maisie|abby|ada|jenny|aria|emily|natasha|molly|isla|samantha|karen|tessa|fiona|moira|veena|kate|serena|allison|joanna|salli|kimberly|kendra|ivy|nicole|mia|aoife|catherine|monica|paulina|francisca|laura)/i;
    const maleNames   = /(male\b|man|boy|ryan|thomas|brian|guy|william|connor|mitchell|liam|david|alex|daniel|mark|fred|jorge|diego|matthew|joey|justin|kevin|russell|aaron|reed)/i;
    const isFemale = (n) => femaleNames.test(n) && !maleNames.test(n);
    const isMale   = (n) => maleNames.test(n)   && !femaleNames.test(n);
    const matchGender = (n) => wantFemale ? isFemale(n) : isMale(n);

    // PASS 1 — locale-by-locale, gender-matched voices (prefer en-GB → en-NZ → en-AU → any en)
    const localePrefs = [/en[-_]GB/i, /en[-_]NZ/i, /en[-_]AU/i, /^en/i];
    for (const re of localePrefs) {
      const v = voices.find(x => re.test(x.lang) && matchGender(x.name));
      if (v) return v;
    }
    // PASS 2 — any English voice with matching gender (catches non-standard names)
    let v = voices.find(x => /^en/i.test(x.lang) && matchGender(x.name));
    if (v) return v;
    // PASS 3 — any English voice that is NOT clearly the OPPOSITE gender
    const oppositeIs = wantFemale ? isMale : isFemale;
    v = voices.find(x => /^en/i.test(x.lang) && !oppositeIs(x.name));
    if (v) return v;
    // PASS 4 — fall back to any English voice, then anything
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
    stop();
    const voices = await loadVoices();
    const voice = pickVoice(voices, opts);
    const u = new SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-GB'; }
    u.rate  = opts.rate  ?? 0.95;
    u.pitch = opts.pitch ?? 1.05;
    u.volume = opts.volume ?? 1;
    if (typeof opts.onend === 'function') u.onend = opts.onend;
    lastUtter = u;
    speechSynthesis.speak(u);
  }

  window.TTS = { speak, stop, loadVoices };
})();
