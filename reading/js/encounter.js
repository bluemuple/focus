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

    const now = Date.now();

    // throttle 1: per-word
    const lastForThisWord = lastWordBump.get(word) || 0;
    if (now - lastForThisWord < PER_WORD_THROTTLE_MS) return;

    // throttle 2: global
    if (now - lastAnyBump < GLOBAL_THROTTLE_MS) return;

    lastWordBump.set(word, now);
    lastAnyBump = now;

    // Reward + counter bump (run in parallel — independent writes).
    const [bumped] = await Promise.all([
      window.WCDB.encounters.bump(lessonState.me.id, lessonState.lesson.id).catch(e => {
        console.warn('encounter bump', e); return null;
      }),
      bumpCoins(1),
    ]);
    if (!bumped) return;

    const lvl    = lessonState.me.encounter_level || 1;
    const spec   = window.WCLevels.spec(lvl);
    const count  = bumped.count_value;
    const remain = Math.max(0, spec.threshold - count);

    // Update progress in sidebar (it has its own re-render path on
    // wordLevels change, but the bar reads the server counter and
    // the wordLevels change has just resolved — so this nudge keeps
    // the bar moving without a roundtrip).
    window.dispatchEvent(new CustomEvent('wc:counter-changed', {
      detail: { count, threshold: spec.threshold, remain },
    }));

    // Trigger? Counter hits or passes the threshold → encounter.
    if (count >= spec.threshold) {
      try { await runEncounter(detail); }
      catch (e) { console.error('encounter run', e); }
    }
  }

  // ----------------------------------------------------------------
  //  Encounter — pick animal, run quiz, branch on outcome.
  // ----------------------------------------------------------------
  async function runEncounter(triggerDetail) {
    window.WCEncounter = window.WCEncounter || {};
    window.WCEncounter.busy = true;

    // Reset counter first so consecutive clicks don't re-fire during
    // the quiz (we already gated re-entry above, but reset is needed
    // anyway for the *next* round).
    await window.WCDB.encounters.reset(lessonState.me.id, lessonState.lesson.id);
    window.dispatchEvent(new CustomEvent('wc:counter-changed',
      { detail: { count: 0, threshold: 0, remain: 0 } }));

    const lvl       = lessonState.me.encounter_level || 1;
    const spec      = window.WCLevels.spec(lvl);
    const setName   = pickAnimalSet(lessonState.lesson.animal_set, lvl);
    const animalIdx = lvl - 1;  // 1..10 maps to index 0..9

    // Find the sentence that contains the triggering word — gives
    // GPT context for question generation.
    const sentence  = findSentenceFor(triggerDetail.word) || lessonState.lesson.body.slice(0, 200);

    try {
      const outcome = await window.WCQuiz.run({
        animalSet:   setName,
        animalIndex: animalIdx,
        level:       lvl,
        questionCount: spec.questions,
        word:        triggerDetail.word,
        sentence,
      });
      await onEncounterEnd(outcome, setName, animalIdx, lvl);
    } finally {
      window.WCEncounter.busy = false;
    }
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
