// Text-to-speech.
//
// Two engines:
//   • cloud — Google Cloud TTS (Neural2 voices) via Supabase Edge Function
//             `tts`. Highest quality. Default when configured.
//   • web   — Browser's built-in Web Speech API. Uses Edge / OS voices. Free,
//             zero-setup, but lower quality than Neural2 on most browsers.
//
// Selection is persisted in localStorage. If cloud fails (no key, network,
// rate limit, etc.) we automatically fall back to web for the rest of the
// session and remember the failure so we don't keep paying the round-trip.
//
// Audio cache: cloud responses are cached as object URLs in memory keyed by
// (voice + text). Same word clicked again replays from memory instantly.

(() => {
  const ENGINE_KEY = 'eng.v1.tts_engine';
  let ENGINE = (function () {
    try {
      const v = localStorage.getItem(ENGINE_KEY);
      return v === 'web' ? 'web' : 'cloud';   // default: cloud
    } catch (e) { return 'cloud'; }
  })();
  let cloudFailedThisSession = false;

  function setEngine(name) {
    if (!['web', 'cloud'].includes(name)) return;
    ENGINE = name;
    cloudFailedThisSession = false;
    try { localStorage.setItem(ENGINE_KEY, name); } catch (e) {}
  }
  function getEngine() { return ENGINE; }

  // ================== Web Speech (built-in) ==================
  let cachedVoices = null;
  const FEMALE_NAMES = [
    'Sonia', 'Libby', 'Hollie', 'Olivia', 'Maisie', 'Aria', 'Jenny',
    'Ana', 'Michelle', 'Nancy', 'Sara', 'Ashley', 'Cora', 'Elizabeth',
    'Hazel', 'Zira', 'Susan', 'Eva',
    'Samantha', 'Allison', 'Ava', 'Karen', 'Moira', 'Tessa',
    'Fiona', 'Veena', 'Catherine', 'Kate', 'Serena', 'Nicole', 'Kathy',
    'female',
  ];
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
  function score(v) {
    const name = v.name || '';
    const lang = v.lang || '';
    if (!/^en/i.test(lang)) return -1;
    const isFemale = namedAs(name, FEMALE_NAMES);
    const isMale   = namedAs(name, MALE_NAMES);
    if (isMale && !isFemale) return -1;
    let s = 0;
    if (/online.*natural|natural.*online/i.test(name)) s += 130;
    else if (/enhanced|premium|neural/i.test(name))   s += 90;
    else if (/online|cloud/i.test(name))               s += 50;
    if (isFemale) s += 40;
    if (/en[-_]GB/i.test(lang))      s += 8;
    else if (/en[-_]US/i.test(lang)) s += 8;
    else if (/en[-_]AU/i.test(lang)) s += 5;
    else if (/en[-_]IE/i.test(lang)) s += 5;
    else                              s += 3;
    return s;
  }
  function pickVoice(voices) {
    if (!voices || !voices.length) return null;
    const ranked = voices.map(v => ({ v, s: score(v) }))
                         .filter(x => x.s > 0)
                         .sort((a, b) => b.s - a.s);
    if (ranked.length) return ranked[0].v;
    const anyEng = voices.find(x => /^en/i.test(x.lang) && !namedAs(x.name, MALE_NAMES));
    return anyEng || voices.find(x => /^en/i.test(x.lang)) || voices[0];
  }

  let lastUtter = null;
  let currentAudio = null;

  function stop() {
    try { speechSynthesis.cancel(); } catch (e) {}
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (e) {}
      currentAudio = null;
    }
    lastUtter = null;
  }

  async function speakViaWeb(text, opts = {}) {
    if (!('speechSynthesis' in window)) return;
    const voices = await loadVoices();
    const voice = pickVoice(voices);
    const u = new SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-GB'; }
    u.rate   = opts.rate   ?? 0.95;
    u.pitch  = opts.pitch  ?? 1.1;
    u.volume = opts.volume ?? 1;
    if (typeof opts.onend === 'function') u.onend = opts.onend;
    lastUtter = u;
    speechSynthesis.speak(u);
  }

  // ================== Google Cloud TTS (via Supabase) ==================
  // In-memory cache: same text + voice → same Blob URL (instant replay).
  const audioCache = new Map();   // key: voice + '|' + text  →  objectURL

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

  async function speakViaCloud(text, opts = {}) {
    const voice = opts.voice || 'en-US-Neural2-F';
    const rate  = opts.rate  ?? 1.0;
    const ck = voice + '|' + text;
    let url = audioCache.get(ck);
    if (!url) {
      url = await fetchCloudAudio(text, voice, rate);
      audioCache.set(ck, url);
    }
    const audio = new Audio(url);
    audio.preload = 'auto';
    if (typeof opts.onend === 'function') audio.onended = opts.onend;
    currentAudio = audio;
    await audio.play();
  }

  // ================== unified entry point ==================
  async function speak(text, opts = {}) {
    text = (text || '').toString().trim();
    if (!text) return;
    stop();

    if (ENGINE === 'cloud' && !cloudFailedThisSession) {
      try { await speakViaCloud(text, opts); return; }
      catch (e) {
        cloudFailedThisSession = true;
        console.warn('[TTS] cloud failed, falling back to web speech:', e && e.message || e);
      }
    }
    return speakViaWeb(text, opts);
  }

  function isSpeaking() {
    if (currentAudio && !currentAudio.paused && !currentAudio.ended) return true;
    return !!('speechSynthesis' in window) && speechSynthesis.speaking;
  }

  function listVoices() {
    const voices = speechSynthesis.getVoices();
    const ranked = voices.map(v => ({ name: v.name, lang: v.lang, score: score(v) }))
                         .sort((a, b) => b.score - a.score);
    console.table(ranked);
    return ranked;
  }

  window.TTS = {
    speak, stop, isSpeaking, loadVoices, listVoices,
    setEngine, getEngine,
  };
})();
