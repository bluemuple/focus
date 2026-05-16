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
  // `probability` = probability that ANY qualifying word-color change
  // at this encounter_level actually spawns a quiz. Lower at low
  // levels so a beginner can read without animals constantly
  // interrupting; ramps up as they climb so a Lv-10 reader who *wants*
  // more challenge gets it. Numbers are 0..1 (multiplied by 100 in the
  // UI). encounter.js reads this on every wc:level-up event.
  const LEVELS = [
    // index 0 unused (encounter_level is 1-based)
    null,
    { level:  1, threshold:  5, questions: 2,  probability: 0.20, types: ['mcq-meaning'],                              timeLimitSec: null },
    { level:  2, threshold:  9, questions: 3,  probability: 0.25, types: ['mcq-meaning','mcq-context'],                 timeLimitSec: null },
    { level:  3, threshold: 13, questions: 3,  probability: 0.30, types: ['mcq-meaning','mcq-pronunciation'],           timeLimitSec: null },
    { level:  4, threshold: 17, questions: 4,  probability: 0.35, types: ['mcq-meaning','mcq-context','mcq-pronunciation'], timeLimitSec: null },
    { level:  5, threshold: 21, questions: 5,  probability: 0.40, types: ['mcq-meaning','mcq-context','mcq-grammar'],   timeLimitSec: null },
    { level:  6, threshold: 25, questions: 6,  probability: 0.45, types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer'], timeLimitSec: null },
    { level:  7, threshold: 29, questions: 7,  probability: 0.50, types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer'], timeLimitSec: null },
    { level:  8, threshold: 33, questions: 8,  probability: 0.55, types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer'], timeLimitSec: 90 },
    { level:  9, threshold: 37, questions: 9,  probability: 0.60, types: ['mcq-meaning','mcq-context','mcq-grammar','short-answer','inference'], timeLimitSec: 90 },
    { level: 10, threshold: 41, questions: 10, probability: 0.65, types: ['short-answer','inference'],                  timeLimitSec: 75 },
  ];
  const MIN = 1, MAX = LEVELS.length - 1;

  function clamp(lvl) { return Math.max(MIN, Math.min(MAX, lvl|0 || MIN)); }
  function spec(lvl)  { return LEVELS[clamp(lvl)]; }
  function threshold(lvl) { return spec(lvl).threshold; }
  function probability(lvl) { return spec(lvl).probability; }
  // Read-only copy of the table for UI consumers (sidebar's
  // "Animal chance by level" panel). Index 0 is null on purpose so
  // callers can do `all[lvl]` with a 1-based level.
  function all() { return LEVELS.slice(); }

  window.WCLevels = { spec, threshold, probability, all, MIN, MAX };
})();
