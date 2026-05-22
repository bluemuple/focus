// =============================================================
//  WordCatch — animal encounter system
//
//  Two inputs from lesson.js:
//    wc:level-up      — a word was marked. Earns +1 coin and feeds
//                       the "words studied" splash stat. Does NOT
//                       trigger an encounter.
//    wc:page-advanced — the student turned forward onto a new page
//                       (or scrolled into one; for comics each
//                       panel image is one page). THIS is the
//                       encounter trigger: every N pages an animal
//                       quiz appears — at the page boundary, a
//                       natural pause, so the reading flow is never
//                       cut mid-sentence (SDT: protect flow).
//
//  N (pages per quiz) is teacher-set in Settings → stored on the
//  class hide_features JSONB as `quizEveryNPages` (default 1).
//
//  Throttle rationale (wc:level-up coins only)
//    - per-word (60s): re-marking the same word can't farm coins.
//    - global (5s): a curiosity-burst of clicks counts once.
//
//  Reward rationale
//    - +1 coin per qualifying word mark (the cheap reward).
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
  // Cooldown after an encounter ends. Failing is more demoralising
  // than catching, so we give a longer reset after a fail — the
  // student wants to keep reading without another animal pouncing.
  // Catches keep the cooldown short so the reward loop stays snappy.
  const COOLDOWN_AFTER_CATCH_MS = 30 * 1000;   // 30s
  const COOLDOWN_AFTER_FAIL_MS  = 90 * 1000;   // 90s
  // 'Skipped' = student dismissed the encounter with the ✕ button to
  // keep reading. We still apply a cooldown so the next word they
  // mark doesn't immediately re-pop another animal — that'd defeat
  // the purpose of the dismiss. 60s ≈ catch cooldown × 2 reads as
  // "I'm reading right now, leave me alone for a bit."
  const COOLDOWN_AFTER_SKIP_MS  = 60 * 1000;   // 60s
  // The encounter trigger is page-based (every N page turns, set by
  // the teacher in Settings → quizEveryNPages). The cooldowns above
  // still apply on top — breathing room so a fail isn't immediately
  // followed by another animal on the very next page.
  let cooldownUntil = 0;   // ms timestamp; before this, encounters skip.

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
    // Two listeners:
    //   wc:level-up      → small +1-coin reward (word-mark)
    //   wc:page-advanced → the encounter trigger (page boundary)
    window.addEventListener('wc:level-up', onLevelUp);
    window.addEventListener('wc:page-advanced', onPageAdvanced);
  }

  // Live "quiet reading" gate — reads the 🐾 flag from lesson.js so
  // toggling the chip (or the per-lesson / class default) takes
  // effect immediately. Falls back to localStorage for the brief
  // window before lesson.js installs WCLesson.
  function encountersHidden() {
    if (window.WCLesson && typeof window.WCLesson.encountersHidden === 'function') {
      return !!window.WCLesson.encountersHidden();
    }
    return localStorage.getItem('wc.hideEncounters.v1') === '1';
  }

  // Stats accumulated since the last encounter — shown on the
  // pre-quiz splash so the interruption reads as a celebration of
  // what the student just did (SDT: informational, not controlling).
  let pagesSinceEncounter = 0;
  let wordsSinceEncounter = 0;
  let coinsSinceEncounter = 0;

  // Pages between quizzes — teacher-set in Settings, stored on the
  // class's hide_features JSONB. Default 1: a quiz on every page
  // turn (for comic lessons one panel image counts as one page).
  // Live SDT reward intensity (1.0 → 0.25), or 1.0 before WCLesson
  // installs its getter / when the class has no fade preset.
  function rewardIntensity() {
    const v = lessonState && lessonState.rewardIntensity;
    return (typeof v === 'number' && isFinite(v) && v > 0) ? v : 1;
  }

  function quizEveryNPages() {
    const f = lessonState && lessonState.classFlags;
    const n = f ? Number(f.quizEveryNPages) : NaN;
    const baseN = (Number.isFinite(n) && n >= 1) ? Math.floor(n) : 1;
    // Reward fade — as cumulative reading grows the intensity drops
    // and quizzes get proportionally rarer (intensity 0.25 → 4× N).
    return Math.max(baseN, Math.round(baseN / rewardIntensity()));
  }

  // ----------------------------------------------------------------
  //  Word-mark handler — the small, frequent reward.
  //
  //  Marking a word earns +1 coin and counts toward the splash's
  //  "words studied" stat. It no longer triggers encounters — those
  //  fire on page turns (onPageAdvanced) so a quiz never breaks the
  //  reading flow mid-sentence.
  // ----------------------------------------------------------------
  async function onLevelUp(ev) {
    const detail = ev.detail || {};
    const word   = detail.word;
    if (!word) return;
    if (window.WCEncounter?.busy) return;   // ignore clicks during an active encounter
    if (encountersHidden()) return;         // quiet reading

    const now = Date.now();
    // throttle 1: per-word — re-marking the same word can't farm coins
    const lastForThisWord = lastWordBump.get(word) || 0;
    if (now - lastForThisWord < PER_WORD_THROTTLE_MS) return;
    // throttle 2: global — a curiosity-burst of clicks counts once
    if (now - lastAnyBump < GLOBAL_THROTTLE_MS) return;
    lastWordBump.set(word, now);
    lastAnyBump = now;

    // Small reward, faded by reward intensity — at full intensity
    // every word mark earns a coin, later only some do (and it stays
    // unpredictable, which SDT prefers over a fixed schedule). The
    // "words studied" stat is NOT faded — it is competence feedback.
    if (Math.random() < rewardIntensity()) {
      bumpCoins(1);
      coinsSinceEncounter += 1;
    }
    wordsSinceEncounter += 1;

    // Bump the per-lesson counter for class analytics + sidebar
    // progress events (the encounter no longer keys off it).
    window.WCDB.encounters.bump(lessonState.me.id, lessonState.lesson.id).catch(() => {});
  }

  // ----------------------------------------------------------------
  //  Page-advance handler — the encounter trigger.
  //
  //  lesson.js fires wc:page-advanced whenever the student turns
  //  forward onto a new page (or scrolls into one). Every N pages an
  //  animal quiz appears — at the page boundary, a natural pause, so
  //  the reading flow is never cut mid-thought.
  // ----------------------------------------------------------------
  async function onPageAdvanced() {
    if (window.WCEncounter?.busy) return;        // already in an encounter
    pagesSinceEncounter += 1;
    if (encountersHidden()) return;              // quiet reading
    if (Date.now() < cooldownUntil) return;      // breathing room after one
    if (pagesSinceEncounter < quizEveryNPages()) return;

    // Snapshot the "since last quiz" stats for the splash, then zero
    // them so the next streak starts fresh.
    const readStats = {
      pages: pagesSinceEncounter,
      words: wordsSinceEncounter,
      coins: coinsSinceEncounter,
    };
    pagesSinceEncounter = 0;
    wordsSinceEncounter = 0;
    coinsSinceEncounter = 0;

    try { await runEncounter({}, readStats); }
    catch (e) { console.error('encounter run', e); }
  }

  // ----------------------------------------------------------------
  //  Encounter — pick animal, run quiz, branch on outcome.
  // ----------------------------------------------------------------
  async function runEncounter(triggerDetail, readStats) {
    window.WCEncounter = window.WCEncounter || {};
    window.WCEncounter.busy = true;

    // Reset counter so the next streak starts from zero (analytics).
    await window.WCDB.encounters.reset(lessonState.me.id, lessonState.lesson.id);
    window.dispatchEvent(new CustomEvent('wc:counter-changed',
      { detail: { count: 0, threshold: 0, remain: 0 } }));

    // The student's current ceiling level. We use this as both the
    // quiz difficulty AND the upper bound on which animal can show up.
    const ceiling   = lessonState.me.encounter_level || 1;
    // Roll for which animal actually appears. 70% of the time we show
    // the ceiling-level animal (the next one to catch), 30% of the
    // time we pick a UNIFORMLY-random LOWER level so the student can
    // collect duplicates of earlier animals. At Lv 1 there's no
    // "lower" pool so it always shows Lv 1.
    let encounterLvl = ceiling;
    if (ceiling > 1 && Math.random() < 0.3) {
      // 1 .. ceiling-1 inclusive
      encounterLvl = 1 + Math.floor(Math.random() * (ceiling - 1));
    }
    const lvl       = encounterLvl;
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
        // Competence feedback for the pre-quiz splash (D).
        readStats:   readStats || null,
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
    // `level` here is the LEVEL OF THE ANIMAL the student just faced
    // — which may be lower than their ceiling (30% bonus picks). The
    // ceiling only moves when the student catches/fails an animal AT
    // their current ceiling. Lower-level animals are pure bonus
    // collectibles: catch = pet + coins, fail = no progression hit.
    const ceiling = lessonState.me.encounter_level || 1;
    const isCeilingEncounter = (level >= ceiling);
    if (outcome === 'caught') {
      // pet row — always insert, so duplicates of the same animal
      // pile up in the collection.
      try {
        await window.WCDB.pets.catch_(lessonState.me.id, setName, animalIdx, level);
      } catch (e) { console.warn('pets.catch_', e); }
      // Coins scale with the animal's level (a Lv 1 mouse caught as
      // a bonus pays 50 coins, a ceiling Lv 5 catch pays 250).
      await bumpCoins(50 * level);
      // Ceiling only bumps when the student caught the animal that
      // matched their ceiling. Bonus catches give pet + coins but
      // don't push them to the next tier.
      if (isCeilingEncounter) {
        const next = Math.min(window.WCLevels.MAX, ceiling + 1);
        await setEncounterLevel(next);
      }
      // Short breathing room after a catch — keeps the loop snappy
      // for a student on a hot streak.
      cooldownUntil = Date.now() + COOLDOWN_AFTER_CATCH_MS;
    } else if (outcome === 'failed') {
      // Ceiling only drops on a ceiling fail. Failing a bonus Lv 1
      // animal at ceiling Lv 5 isn't fair grounds to demote them.
      if (isCeilingEncounter) {
        const next = Math.max(window.WCLevels.MIN, ceiling - 1);
        await setEncounterLevel(next);
      }
      // Longer cooldown after a fail — getting questions wrong then
      // immediately seeing another animal feels punishing. Give the
      // student 90 seconds to read freely and recover.
      cooldownUntil = Date.now() + COOLDOWN_AFTER_FAIL_MS;
    } else if (outcome === 'skipped') {
      // Student tapped ✕ — no pet, no coins, no ceiling change. Just
      // pause the encounter system for a minute so the next marked
      // word doesn't immediately re-pop another animal.
      cooldownUntil = Date.now() + COOLDOWN_AFTER_SKIP_MS;
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
