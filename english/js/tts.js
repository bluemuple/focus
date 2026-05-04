// Text-to-speech — always female. Prefers British (en-GB), then any English.
// Uses the browser's built-in Web Speech API. On Microsoft Edge this resolves to
// Microsoft's neural female voices (Sonia / Libby / Aria / Jenny) when online.
// On other browsers it falls back to the best available English female voice.

(() => {
  let cachedVoices = null;

  // Known female voice names across major platforms / browsers.
  const FEMALE_NAMES = [
    // Microsoft Edge / Azure neural
    'Sonia', 'Libby', 'Hollie', 'Olivia', 'Maisie', 'Aria', 'Jenny',
    'Ana', 'Michelle', 'Nancy', 'Sara', 'Ashley', 'Cora', 'Elizabeth',
    // Windows local
    'Hazel', 'Zira', 'Susan', 'Eva',
    // macOS / iOS
    'Samantha', 'Allison', 'Ava', 'Susan', 'Karen', 'Moira', 'Tessa',
    'Fiona', 'Veena', 'Catherine', 'Kate', 'Serena', 'Nicole', 'Kathy',
    // Google / Android
    'female',
  ];

  // Known male voice names — never picked.
  const MALE_NAMES = [
    'David', 'Mark', 'James', 'George', 'Liam', 'Ryan', 'Brian',
    'Guy', 'Thomas', 'Connor', 'William', 'Mitchell', 'Daniel',
    'Alex', 'Fred', 'Aaron', 'Bruce', 'Tom', 'Matthew',
    'Joey', 'Justin', 'Kevin', 'Russell', 'Reed', 'Eddy',
    'Oliver', 'Arthur', 'Diego', 'Jorge', 'male', 'man',
  ];

  function namedAs(name, list) {
    if (!name) return false;
    return list.some(n => new RegExp('\\b' + n + '\\b', 'i').test(name));
  }

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

  // Score each voice. Quality dominates over accent — we want the most
  // natural-sounding voice the browser/OS offers, regardless of locale.
  // Edge's Microsoft Online (Natural) voices win on Windows/Edge; macOS
  // Enhanced/Premium voices win on Apple; Google's voices win on Chrome.
  function score(v) {
    const name = v.name || '';
    const lang = v.lang || '';
    const isFemale = namedAs(name, FEMALE_NAMES);
    const isMale   = namedAs(name, MALE_NAMES);

    // Must be English.
    if (!/^en/i.test(lang)) return -1;
    // Hard exclusion: known male names.
    if (isMale && !isFemale) return -1;

    let s = 0;
    // ===== Quality is the dominant signal =====
    // Edge online neural (Sonia / Libby / Aria / Jenny / Emma) — top tier.
    if (/online.*natural|natural.*online/i.test(name)) s += 130;
    // Other neural / enhanced / premium voices (macOS enhanced, Google neural).
    else if (/enhanced|premium|neural/i.test(name))   s += 90;
    // Plain Edge online (without "Natural") still beats stock OS.
    else if (/online|cloud/i.test(name))               s += 50;

    // Female bonus — accent doesn't matter to us.
    if (isFemale) s += 40;

    // Mild locale tiebreak so two equally-good voices fall back to en-GB/US.
    if (/en[-_]GB/i.test(lang))      s += 8;
    else if (/en[-_]US/i.test(lang)) s += 8;
    else if (/en[-_]AU/i.test(lang)) s += 5;
    else if (/en[-_]IE/i.test(lang)) s += 5;
    else                              s += 3;

    return s;
  }

  function pickVoice(voices) {
    if (!voices || !voices.length) return null;
    const ranked = voices
      .map(v => ({ v, s: score(v) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s);
    if (ranked.length) return ranked[0].v;
    // No clearly-female English voice was found — fall back to any English voice
    // that isn't on the male denylist.
    const anyEng = voices.find(x => /^en/i.test(x.lang) && !namedAs(x.name, MALE_NAMES));
    return anyEng || voices.find(x => /^en/i.test(x.lang)) || voices[0];
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
    u.rate   = opts.rate   ?? 0.95;
    // Slightly higher pitch leans the synth toward a feminine timbre even when
    // the picked voice is a generic / unnamed engine voice.
    u.pitch  = opts.pitch  ?? 1.1;
    u.volume = opts.volume ?? 1;
    if (typeof opts.onend === 'function') u.onend = opts.onend;
    lastUtter = u;
    speechSynthesis.speak(u);
  }
  function isSpeaking() {
    return !!('speechSynthesis' in window) && speechSynthesis.speaking;
  }

  // Optional debug helper: window.TTS.listVoices() in the console shows what's
  // available and which voice would be picked.
  function listVoices() {
    const voices = speechSynthesis.getVoices();
    const ranked = voices.map(v => ({ name: v.name, lang: v.lang, score: score(v) }))
                         .sort((a, b) => b.score - a.score);
    console.table(ranked);
    return ranked;
  }

  window.TTS = { speak, stop, isSpeaking, loadVoices, listVoices };
})();
