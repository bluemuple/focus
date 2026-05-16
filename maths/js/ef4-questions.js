// Equivalent Fractions Day 5 — Question banks
// Day 5 focus: COMPARE a fraction with a decimal using <, > or =.
//   Strategy: convert ONE form so both look the same, then compare.
//     • 0.4 vs 4/10 → both = 4/10  ⇒  =
//     • 1/2 vs 0.4 → 1/2 = 5/10 = 0.5  ⇒  >
//     • 3/10 vs 0.2 → 3/10 = 0.3  ⇒  >
// Practice = 24 (4 levels), Game = 30 (5 levels — L5 ordering & complex equivalences).

window.EF4_LEVEL_POINTS      = { 1:2, 2:4, 3:6, 4:8 };
window.EF4_MAX_LEVEL         = 4;
window.EF4_GAME_LEVEL_POINTS = { 1:2, 2:4, 3:6, 4:8, 5:10 };
window.EF4_GAME_MAX_LEVEL    = 5;

// Reuse EF1's visual helpers (pies / bars / two-bars)
window.EF4_renderVisual = (v) => (window.EF1_renderVisual ? window.EF1_renderVisual(v) : '');

function _ef4Norm(s) { return (s || '').toString().trim().toLowerCase().replace(/\s+/g, ''); }
window.EF4_checkSA = function (q, given) {
  const g = _ef4Norm(given);
  if (!g) return false;
  if (g === _ef4Norm(q.answer)) return true;
  if (Array.isArray(q.accept)) for (const a of q.accept) if (g === _ef4Norm(a)) return true;
  return false;
};

// ============================================================
// PRACTICE BANK — 24 questions, Day 5 progression
//   L1: compare values in the SAME form (decimals vs decimals / tenths vs tenths)
//   L2: tenths fraction ↔ decimal, then compare
//   L3: common fractions (1/2, 1/5, 1/4) → tenths → compare with a decimal
//   L4: mixed application + simple word problems
// ============================================================
window.EF4_PRACTICE_QUESTIONS = [
  // ---------- L1 (6) — same-form compare ----------
  { id:'P1q01', level:1, type:'mc', text:'Compare:  0.6 ___ 0.3',
    options:['<','>','='], answer:1,
    explain:'0.6 is more than 0.3 — six tenths vs three tenths.' },
  { id:'P1q02', level:1, type:'mc', text:'Compare:  0.2 ___ 0.7',
    options:['<','>','='], answer:0,
    explain:'0.2 is less than 0.7.' },
  { id:'P1q03', level:1, type:'mc', text:'Compare:  5/10 ___ 5/10',
    options:['<','>','='], answer:2,
    explain:'Same fraction — equal.' },
  { id:'P1q04', level:1, type:'mc', text:'Which is bigger?',
    options:['0.5','0.4','They are equal','Can\'t tell'], answer:0,
    explain:'0.5 is more than 0.4 — both are tenths.' },
  { id:'P1q05', level:1, type:'mc', text:'Compare:  7/10 ___ 3/10',
    options:['<','>','='], answer:1,
    explain:'7 tenths is more than 3 tenths.' },
  { id:'P1q06', level:1, type:'mc', text:'Which is smaller?',
    options:['0.4','0.9','They are equal','Can\'t tell'], answer:0,
    explain:'0.4 is less than 0.9.' },

  // ---------- L2 (6) — tenths fraction ↔ decimal + compare ----------
  { id:'P2q01', level:2, type:'mc', text:'Compare:  0.4 ___ 4/10',
    options:['<','>','='], answer:2,
    explain:'0.4 = 4/10. They are EQUAL.' },
  { id:'P2q02', level:2, type:'mc', text:'Compare:  3/10 ___ 0.2',
    options:['<','>','='], answer:1,
    explain:'3/10 = 0.3, which is more than 0.2.' },
  { id:'P2q03', level:2, type:'mc', text:'Compare:  0.7 ___ 5/10',
    options:['<','>','='], answer:1,
    explain:'5/10 = 0.5. So 0.7 > 0.5.' },
  { id:'P2q04', level:2, type:'mc', text:'Compare:  6/10 ___ 0.6',
    options:['<','>','='], answer:2,
    explain:'6/10 = 0.6. Equal.' },
  { id:'P2q05', level:2, type:'mc', text:'Which is bigger:  0.4 or 3/10?',
    options:['0.4','3/10','They are equal','Can\'t tell'], answer:0,
    explain:'3/10 = 0.3, so 0.4 > 3/10.' },
  { id:'P2q06', level:2, type:'mc', text:'Compare:  0.8 ___ 9/10',
    options:['<','>','='], answer:0,
    explain:'9/10 = 0.9. So 0.8 < 0.9.' },

  // ---------- L3 (6) — common fractions → tenths → compare ----------
  { id:'P3q01', level:3, type:'mc', text:'Compare:  1/2 ___ 0.5',
    options:['<','>','='], answer:2,
    explain:'1/2 = 5/10 = 0.5. They are equal.' },
  { id:'P3q02', level:3, type:'mc', text:'Compare:  1/2 ___ 0.4',
    options:['<','>','='], answer:1,
    explain:'1/2 = 0.5, so 1/2 > 0.4.' },
  { id:'P3q03', level:3, type:'mc', text:'Compare:  0.6 ___ 1/2',
    options:['<','>','='], answer:1,
    explain:'1/2 = 0.5. 0.6 > 0.5.' },
  { id:'P3q04', level:3, type:'mc', text:'Compare:  1/5 ___ 0.2',
    options:['<','>','='], answer:2,
    explain:'1/5 × 2/2 = 2/10 = 0.2. Equal!' },
  { id:'P3q05', level:3, type:'mc', text:'Compare:  0.3 ___ 1/2',
    options:['<','>','='], answer:0,
    explain:'1/2 = 0.5. So 0.3 < 0.5.' },
  { id:'P3q06', level:3, type:'mc', text:'Which symbol?  1/2 ___ 0.7',
    options:['<','>','='], answer:0,
    explain:'1/2 = 0.5, less than 0.7.' },

  // ---------- L4 (6) — mixed application + word problems ----------
  { id:'P4q01', level:4, type:'mc',
    text:'Mia ate 1/2 of a cake. Sam ate 0.4 of the same cake. Who ate more?',
    options:['Mia','Sam','They ate the same','Cannot tell'], answer:0,
    explain:'1/2 = 0.5, so Mia ate 0.5 > 0.4.' },
  { id:'P4q02', level:4, type:'mc', text:'Compare:  0.5 ___ 5/10',
    options:['<','>','='], answer:2,
    explain:'5/10 = 0.5 — equal!' },
  { id:'P4q03', level:4, type:'mc',
    text:'Tane ran 0.6 km. His sister ran 1/2 km. Who ran further?',
    options:['Tane','His sister','Same distance','Cannot tell'], answer:0,
    explain:'1/2 km = 0.5 km. 0.6 > 0.5, so Tane.' },
  { id:'P4q04', level:4, type:'mc',
    text:'Which has more?  7/10 of a pizza or 0.7 of a pizza',
    options:['7/10','0.7','They are equal','Cannot tell'], answer:2,
    explain:'7/10 = 0.7 — same amount.' },
  { id:'P4q05', level:4, type:'mc', text:'Compare:  0.3 ___ 4/10',
    options:['<','>','='], answer:0,
    explain:'4/10 = 0.4. 0.3 < 0.4.' },
  { id:'P4q06', level:4, type:'mc', text:'Compare:  1/2 ___ 0.6',
    options:['<','>','='], answer:0,
    explain:'1/2 = 0.5. So 1/2 < 0.6.' },
];

// ============================================================
// GAME BANK — 30 questions, 5 levels
//   L1: same-form compare       (6)
//   L2: tenths fraction ↔ decimal (7)
//   L3: 1/2 / 1/5 / 1/4 → tenths (7)
//   L4: mixed real-world         (5)
//   L5: ordering & complex equivalences — high-level (5)
// ============================================================
window.EF4_GAME_QUESTIONS = [
  // ----- L1 (6) — same-form -----
  { id:'G1q01', level:1, type:'mc', text:'Compare:  0.7 ___ 0.5',
    options:['<','>','='], answer:1 },
  { id:'G1q02', level:1, type:'mc', text:'Compare:  5/10 ___ 3/10',
    options:['<','>','='], answer:1 },
  { id:'G1q03', level:1, type:'mc', text:'Which is bigger?',
    options:['0.8','0.3','They are equal','Can\'t tell'], answer:0 },
  { id:'G1q04', level:1, type:'mc', text:'Compare:  9/10 ___ 9/10',
    options:['<','>','='], answer:2 },
  { id:'G1q05', level:1, type:'mc', text:'Compare:  0.2 ___ 0.9',
    options:['<','>','='], answer:0 },
  { id:'G1q06', level:1, type:'mc', text:'Which is smaller?',
    options:['4/10','1/10','They are equal','Can\'t tell'], answer:1 },

  // ----- L2 (7) — tenths convert + compare -----
  { id:'G2q01', level:2, type:'mc', text:'Compare:  0.4 ___ 4/10',
    options:['<','>','='], answer:2 },
  { id:'G2q02', level:2, type:'mc', text:'Compare:  7/10 ___ 0.5',
    options:['<','>','='], answer:1 },
  { id:'G2q03', level:2, type:'mc', text:'Compare:  0.6 ___ 3/10',
    options:['<','>','='], answer:1 },
  { id:'G2q04', level:2, type:'mc', text:'Compare:  8/10 ___ 0.8',
    options:['<','>','='], answer:2 },
  { id:'G2q05', level:2, type:'mc', text:'Compare:  0.2 ___ 5/10',
    options:['<','>','='], answer:0 },
  { id:'G2q06', level:2, type:'mc', text:'Which is bigger?',
    options:['0.9','7/10','They are equal','Can\'t tell'], answer:0 },
  { id:'G2q07', level:2, type:'mc', text:'Compare:  0.5 ___ 6/10',
    options:['<','>','='], answer:0 },

  // ----- L3 (7) — 1/2, 1/5, 1/4 → tenths -----
  { id:'G3q01', level:3, type:'mc', text:'Compare:  1/2 ___ 0.5',
    options:['<','>','='], answer:2 },
  { id:'G3q02', level:3, type:'mc', text:'Compare:  1/2 ___ 0.6',
    options:['<','>','='], answer:0 },
  { id:'G3q03', level:3, type:'mc', text:'Compare:  0.4 ___ 1/2',
    options:['<','>','='], answer:0 },
  { id:'G3q04', level:3, type:'mc', text:'Compare:  1/5 ___ 0.2',
    options:['<','>','='], answer:2 },
  { id:'G3q05', level:3, type:'mc', text:'Compare:  1/2 ___ 0.3',
    options:['<','>','='], answer:1 },
  { id:'G3q06', level:3, type:'mc', text:'Compare:  0.7 ___ 1/2',
    options:['<','>','='], answer:1 },
  { id:'G3q07', level:3, type:'mc', text:'Which is bigger:  1/2 or 0.4?',
    options:['1/2','0.4','They are equal','Can\'t tell'], answer:0 },

  // ----- L4 (5) — mixed real-world -----
  { id:'G4q01', level:4, type:'mc',
    text:'Lila ate 1/2 of a chocolate bar. Te Aroha ate 0.3. Who ate more?',
    options:['Lila','Te Aroha','Same','Cannot tell'], answer:0 },
  { id:'G4q02', level:4, type:'mc', text:'Compare:  6/10 ___ 0.7',
    options:['<','>','='], answer:0 },
  { id:'G4q03', level:4, type:'mc', text:'Which is the same as 0.5?',
    options:['1/5','1/2','1/4','5/100'], answer:1 },
  { id:'G4q04', level:4, type:'mc', text:'Compare:  0.6 ___ 5/10',
    options:['<','>','='], answer:1 },
  { id:'G4q05', level:4, type:'mc',
    text:'One jug is 8/10 full. Another is 0.6 full. Which has more?',
    options:['8/10 jug','0.6 jug','Same','Cannot tell'], answer:0 },

  // ----- L5 (5) — ordering & complex equivalences (high-level) -----
  { id:'G5q01', level:5, type:'mc',
    text:'Order from LEAST to GREATEST:  0.3,  1/2,  1/5',
    options:['1/5, 0.3, 1/2','0.3, 1/5, 1/2','1/2, 0.3, 1/5','1/5, 1/2, 0.3'], answer:0 },
  { id:'G5q02', level:5, type:'mc', text:'Compare:  8/12 ___ 4/6',
    options:['<','>','='], answer:2 },
  { id:'G5q03', level:5, type:'mc', text:'Compare:  5/10 ___ 3/4',
    options:['<','>','='], answer:0 },
  { id:'G5q04', level:5, type:'mc',
    text:'Which is biggest:  0.4,  1/2,  3/10?',
    options:['0.4','1/2','3/10','All equal'], answer:1 },
  { id:'G5q05', level:5, type:'mc', text:'Compare:  0.5 ___ 1/4',
    options:['<','>','='], answer:1 },
];

window.EF4_PRACTICE_BY_LEVEL = (() => { const m={1:[],2:[],3:[],4:[]}; for (const q of window.EF4_PRACTICE_QUESTIONS) m[q.level].push(q); return m; })();
window.EF4_GAME_BY_LEVEL     = (() => { const m={1:[],2:[],3:[],4:[],5:[]}; for (const q of window.EF4_GAME_QUESTIONS)     m[q.level].push(q); return m; })();
