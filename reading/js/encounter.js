// =============================================================
//  WordCatch — animal encounter system
//
//  Listens to wc:level-up events from lesson.js. Each event is
//  filtered through two throttles (per-word + global), then bumps
//  the persistent counter in wc_encounter_counters. When the
//  counter hits the threshold for the student's encounter_level
//  (see js/levels.js), an encounter is triggered: quiz modal,
//  catch or fail.
//
//  Throttle rationale
//    - per-word (60s): clicking the same word over and over (kids
//      will) shouldn't farm encounters. They want a *variety* of
//      words to count.
//    - global (5s): rapid clicks across different words within a
//      few seconds are usually accidental / curiosity-burst and
//      shouldn't count either.
//
//  Reward rationale
//    - +1 coin per qualifying click (the cheap reward — frequent
//      and predictable).
//    - +50 × encounter_level coins per catch (the big payout).
//    - 0 coins per failed catch (encouraging effort, not gaming).
//
//  Coin & encounter_level changes are written eagerly to wc_users
//  so a refresh / different tab shows the same totals.
// =============================================================

(() => {
  const me = window.WCAuth.session();
  if (!me || me.role !== 'student') return;

  const PER_WORD_THROTTLE_MS = 60 * 1000;
  const GLOBAL_THROTTLE_MS   =  5 * 1000;
  // Probability that a qualifying level-up actually fires an encounter.
  // Previously every Nth click (N = level threshold) triggered for sure;
  // we now roll the dice on each color-change so animals feel like a
  // surprise reward, not a counter the kids learn to game. 3/5 = 60%.
  const TRIGGER_PROBABILITY = 0.6;

  // Tiny stopword list — words a Year-4 reader has long since mastered
  // and which therefore make boring quiz subjects ("What does 'was'
  // mean?"). When the triggering word is in here, we substitute the
  // hardest word from the visible page so the quiz tests something
  // worth asking about. The list is intentionally small: anything
  // longer than 4 letters and not in here is fair game.
  const STOPWORDS = new Set([
    'the','and','but','for','nor','yet','so','or','if','in','on','at','to','of','as',
    'is','am','are','was','were','be','been','being','do','does','did','done',
    'has','have','had','having','can','could','will','would','shall','should',
    'may','might','must','this','that','these','those','here','there','then',
    'than','when','where','what','which','who','whom','whose','why','how',
    'with','from','they','them','their','theirs','your','yours','our','ours',
    'his','her','hers','its','him','she','he','we','us','you','i','me','my',
    'into','onto','over','under','about','after','before','again','some','any',
    'all','one','two','three','more','most','some','such','also','even','still',
    'just','only','very','really','now','out','off','up','down','too','said',
    'says','say','go','goes','went','gone','get','gets','got','make','made',
    'makes','take','took','takes','give','gave','gives','know','knew','knows',
    'want','wants','tell','told','tells','look','looks','looked','use','used',
    'uses','need','needs','find','found','come','came','comes','keep','kept',
    'put','puts','let','lets','seem','seems','feel','felt','feels','try','tried',
    'leave','left','call','called','calls','little','big','small','good','bad',
    'old','new','first','last','long','great','high','low','right','wrong','same',
    'next','many','much','other','others','because','through','around','again',
    'always','never','sometimes','often','usually','today','yesterday','tomorrow',
  ]);

  // In-memory throttle bookkeeping (resets on reload).
  const lastWordBump = new Map();   // lower → ms
  let   lastAnyBump  = 0;

  // Wait for lesson.js to populate WCLesson — same dance as sidebar.js.
  document.addEventListener('DOMContentLoaded', () => setTimeout(initWhenReady, 0));
  if (document.readyState !== 'loading') setTimeout(initWhenReady, 0);

  let lessonState = null;

  function initWhenReady() {
    if (!window.WCLesson || !window.WCLesson.me || !window.WCLesson.lesson) {
      setTimeout(initWhenReady, 100);
      return;
    }
    lessonState = window.WCLesson;
    // Class can disable the entire encounter system via a feature flag
    // (e.g., quiet reading time or strict-curriculum teachers). When
    // hidden, we simply never wire the listener — coin reward + level
    // progression still happen via the word popup's I-know-it action.
    if (lessonState.classFlags && lessonState.classFlags.hideEncounters) return;
    // Preview mode: no encounters, no quizzes, no DB writes. The
    // teacher should see the lesson chrome cleanly without random
    // animals popping up.
    if (lessonState.isPreview) return;
    window.addEventListener('wc:level-up', onLevelUp);
  }

  // ----------------------------------------------------------------
  //  Level-up handler — the heart of the encounter system.
  // ----------------------------------------------------------------
  async function onLevelUp(ev) {
    const detail = ev.detail || {};
    const word   = detail.word;
    if (!word) return;
    if (window.WCEncounter?.busy) return;   // ignore clicks during an active encounter

    // Per-device "quiet reading" toggle — lives in the lesson page
    // head-tools row. We read it fresh on every event so flipping
    // the button takes effect on the very next word the student
    // marks (no need to reload the page).
    if (localStorage.getItem('wc.hideEncounters.v1') === '1') return;

    const now = Date.now();

    // throttle 1: per-word
    const lastForThisWord = lastWordBump.get(word) || 0;
    if (now - lastForThisWord < PER_WORD_THROTTLE_MS) return;

    // throttle 2: global
    if (now - lastAnyBump < GLOBAL_THROTTLE_MS) return;

    lastWordBump.set(word, now);
    lastAnyBump = now;

    // Coin reward always — independent of whether the dice roll a
    // quiz. Marking a word always earns the small reward.
    bumpCoins(1);

    // We still bump the per-lesson counter (for class analytics &
    // sidebar progress events) but do NOT key the encounter on it
    // anymore. The trigger is now purely probability-based so quizzes
    // feel surprising, not earned by grinding.
    window.WCDB.encounters.bump(lessonState.me.id, lessonState.lesson.id).catch(() => {});

    // Probability gate — 60% chance per qualifying color-change.
    if (Math.random() >= TRIGGER_PROBABILITY) return;

    try { await runEncounter(detail); }
    catch (e) { console.error('encounter run', e); }
  }

  // ----------------------------------------------------------------
  //  Encounter — pick animal, run quiz, branch on outcome.
  // ----------------------------------------------------------------
  async function runEncounter(triggerDetail) {
    window.WCEncounter = window.WCEncounter || {};
    window.WCEncounter.busy = true;

    // Reset counter so the next streak starts from zero (analytics).
    await window.WCDB.encounters.reset(lessonState.me.id, lessonState.lesson.id);
    window.dispatchEvent(new CustomEvent('wc:counter-changed',
      { detail: { count: 0, threshold: 0, remain: 0 } }));

    const lvl       = lessonState.me.encounter_level || 1;
    const spec      = window.WCLevels.spec(lvl);
    const setName   = pickAnimalSet(lessonState.lesson.animal_set, lvl);
    const animalIdx = lvl - 1;  // 1..10 maps to index 0..9

    // Pick the quiz subject. If the student tapped a meaty content
    // word, use that. Otherwise (they tapped "was" / "is" / "the")
    // substitute the hardest word visible on the current page so the
    // vocabulary questions actually test something.
    const quizWord  = pickQuizWord(triggerDetail.word);
    const sentence  = findSentenceFor(quizWord) || lessonState.lesson.body.slice(0, 200);
    const passage   = readVisiblePassage() || lessonState.lesson.body.slice(0, 1200);

    try {
      const outcome = await window.WCQuiz.run({
        animalSet:   setName,
        animalIndex: animalIdx,
        level:       lvl,
        questionCount: spec.questions,
        word:        quizWord,
        sentence,
        passage,
      });
      await onEncounterEnd(outcome, setName, animalIdx, lvl);
    } finally {
      window.WCEncounter.busy = false;
    }
  }

  // ----------------------------------------------------------------
  //  Subject-word picker
  //
  //  Returns the triggering word if it's worth quizzing on; otherwise
  //  the longest non-stopword visible on the current page that the
  //  student hasn't mastered yet (level < 5). Falls back to the
  //  triggering word if the page has nothing better.
  // ----------------------------------------------------------------
  function pickQuizWord(triggerWord) {
    const w = (triggerWord || '').toLowerCase();
    if (w && w.length > 4 && !STOPWORDS.has(w)) return triggerWord;

    const candidates = collectPageWords();
    if (!candidates.length) return triggerWord;
    // Longest first; among ties, prefer ones the student hasn't
    // marked "known" (level 5). Words they've marked 1-4 are also
    // good — they're learning them and a quiz reinforces them.
    const levels = lessonState.wordLevels || new Map();
    candidates.sort((a, b) => {
      const knownA = levels.get(a.lower) === 5 ? 1 : 0;
      const knownB = levels.get(b.lower) === 5 ? 1 : 0;
      if (knownA !== knownB) return knownA - knownB;   // unknown first
      return b.lower.length - a.lower.length;          // longer first
    });
    return candidates[0].original;
  }

  // Scan the visible page DOM for distinct content words. Returns
  // [{ lower, original }]. Deduplicates by lowercase lemma.
  function collectPageWords() {
    const seen = new Set();
    const out = [];
    document.querySelectorAll('#lessonBody .w:not(.punct)').forEach(el => {
      const lower = (el.dataset.word || '').toLowerCase();
      const orig  = el.textContent.trim();
      if (!lower || seen.has(lower)) return;
      if (lower.length <= 4) return;        // skip short words
      if (STOPWORDS.has(lower)) return;     // skip stopwords
      seen.add(lower);
      out.push({ lower, original: orig });
    });
    return out;
  }

  // Concatenate visible sentences from the current page for the
  // comprehension prompt. Falls back to lesson.body if the DOM walk
  // turns up empty (shouldn't happen during a normal encounter).
  function readVisiblePassage() {
    const parts = [];
    document.querySelectorAll('#lessonBody .wc-sentence').forEach(s => {
      const t = (s.dataset.text || s.textContent || '').trim();
      if (t) parts.push(t);
    });
    return parts.join(' ').slice(0, 1500);
  }

  function findSentenceFor(word) {
    if (!word || !lessonState?.lesson?.body) return '';
    const body = lessonState.lesson.body;
    // Naive sentence split — same regex feel as lesson.js but standalone.
    const re = /[^.!?]+[.!?]+["'’)\]]*/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      const s = m[0];
      // word-boundary search (case-insensitive)
      const wre = new RegExp("\\b" + word.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "\\b", "i");
      if (wre.test(s)) return s.trim();
    }
    return body.slice(0, 200).trim();
  }

  function pickAnimalSet(lessonAnimalSet, level) {
    if (lessonAnimalSet === 'mixed') {
      // 'mixed' deterministically rotates by level so the student
      // collects across all 3 sets as they climb.
      const names = window.WCAssets.allSetNames;
      return names[(level - 1) % names.length];
    }
    return lessonAnimalSet;
  }

  // ----------------------------------------------------------------
  //  Outcome — catch (level up + pet + coins) or fail (level down).
  // ----------------------------------------------------------------
  async function onEncounterEnd(outcome, setName, animalIdx, level) {
    if (outcome === 'caught') {
      // pet row
      try {
        await window.WCDB.pets.catch_(lessonState.me.id, setName, animalIdx, level);
      } catch (e) { console.warn('pets.catch_', e); }
      // coins
      await bumpCoins(50 * level);
      // encounter_level → up (cap 10)
      const next = Math.min(window.WCLevels.MAX, level + 1);
      await setEncounterLevel(next);
    } else if (outcome === 'failed') {
      // encounter_level → down (floor 1)
      const next = Math.max(window.WCLevels.MIN, level - 1);
      await setEncounterLevel(next);
    }
    // either way, sidebar progress panel should refresh — it reads
    // the live counter (already reset) and encounter_level.
    window.dispatchEvent(new CustomEvent('wc:encounter-end', {
      detail: { outcome, setName, animalIdx, level },
    }));
  }

  // ----------------------------------------------------------------
  //  Persistent user updates (coins, encounter_level).
  // ----------------------------------------------------------------
  async function bumpCoins(delta) {
    if (!delta) return;
    const before = lessonState.me.money || 0;
    const after  = Math.max(0, before + delta);
    lessonState.me.money = after;
    // Optimistic UI update.
    const el = document.getElementById('userMoney');
    if (el) el.textContent = String(after);
    try {
      await window.WCDB.users.update(lessonState.me.id, { money: after });
      // refresh cached session so other tabs (profile etc.) see it
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw); u.money = after;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch (e) { console.warn('money update failed', e); }
  }

  async function setEncounterLevel(next) {
    if (next === lessonState.me.encounter_level) return;
    lessonState.me.encounter_level = next;
    try {
      await window.WCDB.users.update(lessonState.me.id, { encounter_level: next });
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw); u.encounter_level = next;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch (e) { console.warn('encounter_level update failed', e); }
  }

  window.WCEncounter = window.WCEncounter || {};
  window.WCEncounter.bumpCoins = bumpCoins;
})();
