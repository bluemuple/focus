// =============================================================
//  WordCatch — catcher-level + animal-level definitions
//
//  TWO related level systems:
//
//  1. CATCHER LEVEL (XP-based, 1..28) — the student's overall
//     progression. Driven entirely by experience points: marking a
//     word, getting a quiz right, catching an animal all ADD XP;
//     nothing ever subtracts. Levels go up only. The curve is
//     quadratic so the first few levels come quickly (built-in
//     hooking phase) and Lv 28 is a real long-term goal.
//
//  2. ANIMAL LEVEL (1..10) — the level of the animal currently being
//     presented. Drives the quiz config (question count, time limit,
//     question types) and the per-catch coin payout. encounter.js
//     uses `animalLevelFor(catcherLevel)` to pick which animal tier
//     to present (capped at 10 — beyond catcher level 10 the student
//     keeps facing top-tier animals).
//
//  Year-5-elementary friendly XP scale:
//    word mark = 1 XP, catch animal = 30 XP, failed quiz = 5 XP.
//    With ~5 encounters per ~30-minute session this lands ~Lv 5
//    after one session, Lv 10 in a couple of weeks, Lv 28 over months.
// =============================================================
(() => {
  // Animal-level specs (1..10) — quiz config + legacy fields.
  const ANIMAL_LEVELS = [
    // index 0 unused (animal level is 1-based)
    null,
    { level:  1, threshold:  5, questions: 2,  probability: 0.20, types: ['mcq-meaning'],                                                                  timeLimitSec: null },
    { level:  2, threshold:  9, questions: 3,  probability: 0.25, types: ['mcq-meaning','mcq-context'],                                                    timeLimitSec: null },
    { level:  3, threshold: 13, questions: 3,  probability: 0.30, types: ['mcq-meaning','mcq-pronunciation'],                                              timeLimitSec: null },
    { level:  4, threshold: 17, questions: 4,  probability: 0.35, types: ['mcq-meaning','mcq-context','mcq-pronunciation'],                                timeLimitSec: null },
    { level:  5, threshold: 21, questions: 5,  probability: 0.40, types: ['mcq-meaning','mcq-context','mcq-grammar'],                                      timeLimitSec: null },
    { level:  6, threshold: 25, questions: 6,  probability: 0.45, types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer'],                       timeLimitSec: null },
    { level:  7, threshold: 29, questions: 7,  probability: 0.50, types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer'],                       timeLimitSec: null },
    { level:  8, threshold: 33, questions: 8,  probability: 0.55, types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer'],                       timeLimitSec: 90  },
    { level:  9, threshold: 37, questions: 9,  probability: 0.60, types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer','inference'],           timeLimitSec: 90  },
    { level: 10, threshold: 41, questions: 10, probability: 0.65, types: ['short-answer','inference'],                                                     timeLimitSec: 75  },
  ];
  const ANIMAL_MIN = 1, ANIMAL_MAX = ANIMAL_LEVELS.length - 1;

  // ---- Catcher level (XP-based, 1..28) ---------------------------
  const XP_MAX_LEVEL = 28;
  // Cumulative XP needed to BE at level L. Quadratic — first few
  // levels are quick (8 XP to L 2, 32 to L 3) and the gap widens
  // (5832 XP to L 28 → months of consistent reading).
  function xpAtLevel(L) {
    L = Math.max(1, Math.min(XP_MAX_LEVEL, L | 0));
    return Math.round(8 * Math.pow(L - 1, 2));
  }
  function levelForXp(xp) {
    xp = Math.max(0, xp | 0);
    for (let L = 1; L < XP_MAX_LEVEL; L++) {
      if (xpAtLevel(L + 1) > xp) return L;
    }
    return XP_MAX_LEVEL;
  }
  // Used by the profile XP gauge — how far through this level the
  // student is, in absolute XP and as a 0..100 percentage.
  function xpToNext(xp) {
    xp = Math.max(0, xp | 0);
    const L     = levelForXp(xp);
    const base  = xpAtLevel(L);
    const next  = xpAtLevel(L + 1);
    const inLv  = xp - base;
    const need  = next - base;
    const maxed = L >= XP_MAX_LEVEL;
    return {
      level:       L,
      xpInLevel:   inLv,
      xpNeeded:    maxed ? 0 : need,
      progressPct: maxed ? 100 : Math.max(0, Math.min(100, Math.round((inLv / need) * 100))),
      max:         maxed,
    };
  }
  // Maps a catcher level (1..28) to the animal tier presented in the
  // encounter (1..10). Catcher levels past 10 keep facing Lv-10
  // animals — the climax of the collection.
  function animalLevelFor(catcherLevel) {
    return Math.max(ANIMAL_MIN, Math.min(ANIMAL_MAX, catcherLevel | 0));
  }

  // ---- Animal-level helpers (legacy API used by encounter / quiz) -
  function clampAnimal(lvl) {
    return Math.max(ANIMAL_MIN, Math.min(ANIMAL_MAX, lvl | 0 || ANIMAL_MIN));
  }
  function spec(lvl)        { return ANIMAL_LEVELS[clampAnimal(lvl)]; }
  function threshold(lvl)   { return spec(lvl).threshold; }
  function probability(lvl) { return spec(lvl).probability; }
  function all()            { return ANIMAL_LEVELS.slice(); }

  window.WCLevels = {
    // Animal level (1..10) — clamps + quiz spec.
    MIN: ANIMAL_MIN, MAX: ANIMAL_MAX,
    spec, threshold, probability, all,
    // Catcher level (1..28, XP-driven) — used by profile gauge,
    // encounter animal pick, and any UI that shows progression.
    XP_MAX_LEVEL,
    xpAtLevel, levelForXp, xpToNext, animalLevelFor,
  };
})();
