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

  // Score each voice; the highest-scored female English voice wins.
  function score(v) {
    const name = v.name || '';
    const lang = v.lang || '';
    const isFemale = namedAs(name, FEMALE_NAMES);
    const isMale   = namedAs(name, MALE_NAMES);

    // Hard exclusion: known male names → never pick.
    if (isMale && !isFemale) return -1;

    let s = 0;
    if (isFemale) s += 100;                       // female heavily preferred
    if (/en[-_]GB/i.test(lang)) s += 40;          // British best
    else if (/en[-_]NZ/i.test(lang)) s += 25;
    else if (/en[-_]AU/i.test(lang)) s += 22;
    else if (/en[-_]IE/i.test(lang)) s += 20;
    else if (/en[-_]US/i.test(lang)) s += 15;
    else if (/^en/i.test(lang)) s += 8;
    else s -= 50;                                  // not English: avoid

    // Prefer high-quality (Edge online / Apple enhanced / neural).
    if (/online|natural|premium|enhanced|neural/i.test(name)) s += 8;
    if (/desktop/i.test(name)) s += 1;             // tiebreak vs old voices

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
