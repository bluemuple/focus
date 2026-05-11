// =============================================================
//  WordCatch — encounter level definitions
//
//  Maps encounter_level (1..10) → click threshold + quiz config.
//  Phase 4 only needs the threshold (for the sidebar's progress
//  bar). Phase 5 will read quiz/spec from the same table to
//  build the catch challenge.
//
//  Design: cubic-ish ramp from 5 (Lv 1) to 41 (Lv 10) — the
//  ramp is steep enough that kids feel each tier is a real
//  step up, but gentle enough that an average 4-Year reader
//  reaches Lv 10 in a couple of months of class use.
// =============================================================
(() => {
  const LEVELS = [
    // index 0 unused (encounter_level is 1-based)
    null,
    { level:  1, threshold:  5, questions: 2,  types: ['mcq-meaning'],                              timeLimitSec: null },
    { level:  2, threshold:  9, questions: 3,  types: ['mcq-meaning','mcq-context'],                 timeLimitSec: null },
    { level:  3, threshold: 13, questions: 3,  types: ['mcq-meaning','mcq-pronunciation'],           timeLimitSec: null },
    { level:  4, threshold: 17, questions: 4,  types: ['mcq-meaning','mcq-context','mcq-pronunciation'], timeLimitSec: null },
    { level:  5, threshold: 21, questions: 5,  types: ['mcq-meaning','mcq-context','mcq-grammar'],   timeLimitSec: null },
    { level:  6, threshold: 25, questions: 6,  types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer'], timeLimitSec: null },
    { level:  7, threshold: 29, questions: 7,  types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer'], timeLimitSec: null },
    { level:  8, threshold: 33, questions: 8,  types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer'], timeLimitSec: 90 },
    { level:  9, threshold: 37, questions: 9,  types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer','inference'], timeLimitSec: 90 },
    { level: 10, threshold: 41, questions: 10, types: ['short-answer','inference'],                  timeLimitSec: 75 },
  ];
  const MIN = 1, MAX = LEVELS.length - 1;

  function clamp(lvl) { return Math.max(MIN, Math.min(MAX, lvl|0 || MIN)); }
  function spec(lvl)  { return LEVELS[clamp(lvl)]; }
  function threshold(lvl) { return spec(lvl).threshold; }

  window.WCLevels = { spec, threshold, MIN, MAX };
})();
