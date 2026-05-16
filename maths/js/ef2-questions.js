// Equivalent Fractions Day 2 — Question banks
// Day 2 focus: VISUAL + NUMERICAL methods. The numerical method is the heart
// of Day 2 — multiply OR divide top AND bottom by the SAME number.
// Practice = 24 questions (4 levels), Game = 30 questions (5 levels).

window.EF2_LEVEL_POINTS      = { 1:2, 2:4, 3:6, 4:8 };
window.EF2_MAX_LEVEL         = 4;
window.EF2_GAME_LEVEL_POINTS = { 1:2, 2:4, 3:6, 4:8, 5:10 };
window.EF2_GAME_MAX_LEVEL    = 5;

// Reuse EF1's visual helpers (pies / bars / two-bars). Loaded with EF1 script.
window.EF2_renderVisual = (v) => (window.EF1_renderVisual ? window.EF1_renderVisual(v) : '');

function _ef2Norm(s) { return (s || '').toString().trim().toLowerCase().replace(/\s+/g, ''); }
window.EF2_checkSA = function (q, given) {
  const g = _ef2Norm(given);
  if (!g) return false;
  if (g === _ef2Norm(q.answer)) return true;
  if (Array.isArray(q.accept)) for (const a of q.accept) if (g === _ef2Norm(a)) return true;
  return false;
};

// ============================================================
// PRACTICE BANK — 24 questions, Day 2 progression
// ============================================================
window.EF2_PRACTICE_QUESTIONS = [
  // ---------- L1 (6) — recognising the method ----------
  { id:'P1q01', level:1, type:'mc',
    text:'To make equivalent fractions, multiply OR divide the top AND the bottom by …',
    options:['the same number','any number','only zero','only by one'], answer:0,
    explain:'Multiply or divide TOP and BOTTOM by the SAME number — that is the rule.' },
  { id:'P1q02', level:1, type:'mc',
    text:'What does 2/2 equal as a whole number?',
    options:['0','1','2','4'], answer:1,
    explain:'2/2 = 1. Any same/same fraction equals 1, so multiplying by it does not change the size.' },
  { id:'P1q03', level:1, type:'mc',
    text:'1/2 × 2/2 = ?',
    options:['1/2','2/4','2/2','1/4'], answer:1,
    explain:'1/2 × 2/2 = 2/4. Multiply tops together (1×2=2) and bottoms together (2×2=4).' },
  { id:'P1q04', level:1, type:'mc',
    text:'Why is multiplying by 3/3 ok? It does not change the …',
    options:['size of the fraction','top number','bottom number','colour'], answer:0,
    explain:'3/3 = 1, and multiplying by 1 keeps the fraction the same size — just with new numbers.' },
  { id:'P1q05', level:1, type:'mc',
    text:'1/4 × 3/3 = ?',
    options:['3/4','3/12','4/12','1/12'], answer:1,
    explain:'1/4 × 3/3 = (1×3)/(4×3) = 3/12.' },
  { id:'P1q06', level:1, type:'mc',
    text:'Which is a way to find an equivalent fraction?',
    options:['Add 1 to top and bottom','Multiply top AND bottom by the same number','Multiply only the top','Subtract the same from each'], answer:1,
    explain:'Same number on TOP and BOTTOM — that is the rule. Adding does not work.' },

  // ---------- L2 (6) — multiplying ----------
  { id:'P2q01', level:2, type:'mc', text:'Fill in:  1/2 = ?/4',
    options:['1','2','3','4'], answer:1,
    explain:'1/2 × 2/2 = 2/4.' },
  { id:'P2q02', level:2, type:'mc', text:'Fill in:  1/3 = ?/9',
    options:['1','2','3','9'], answer:2,
    explain:'1/3 × 3/3 = 3/9.' },
  { id:'P2q03', level:2, type:'mc', text:'Fill in:  2/3 = ?/12  (multiply by 4/4)',
    options:['4','6','8','12'], answer:2,
    explain:'2/3 × 4/4 = 8/12.' },
  { id:'P2q04', level:2, type:'mc',
    text:'Look at the two bars. Are they equivalent?', visual:{kind:'twoBars', n1:1, d1:2, n2:2, d2:4},
    options:['Yes — same length shaded','No, different sizes','Only if bigger','Cannot tell'], answer:0,
    explain:'1/2 and 2/4 cover the same length — equivalent.' },
  { id:'P2q05', level:2, type:'sa',
    text:'Solve  1/2 × 4/4 = ?/?  (write like 4/8)',
    answer:'4/8',
    explain:'(1×4)/(2×4) = 4/8.' },
  { id:'P2q06', level:2, type:'mc',
    text:'To go from 2/3 to 4/6, multiply top AND bottom by …',
    options:['2/2','3/3','4/4','5/5'], answer:0,
    explain:'2×2 = 4 (top), 3×2 = 6 (bottom). So we multiplied by 2/2.' },

  // ---------- L3 (6) — dividing / simplifying ----------
  { id:'P3q01', level:3, type:'mc',
    text:'To simplify 4/6 to 2/3, divide top AND bottom by …',
    options:['1','2','3','4'], answer:1,
    explain:'4÷2=2 (top), 6÷2=3 (bottom). Divide by 2/2.' },
  { id:'P3q02', level:3, type:'sa',
    text:'Solve  6/8 ÷ 2/2 = ?/?  (write like 3/4)',
    answer:'3/4',
    explain:'(6÷2)/(8÷2) = 3/4.' },
  { id:'P3q03', level:3, type:'mc',
    text:'Fill in (after dividing top and bottom by 4):  4/8 = ?/2',
    options:['1','2','3','4'], answer:0,
    explain:'4÷4=1, 8÷4=2. So 4/8 = 1/2.' },
  { id:'P3q04', level:3, type:'mc',
    text:'Which is the SIMPLEST form of 4/8?',
    options:['4/8','2/4','1/2','1/4'], answer:2,
    explain:'4/8 ÷ 4/4 = 1/2. The simplest form is 1/2.' },
  { id:'P3q05', level:3, type:'sa', text:'Simplify 6/9 (divide top and bottom by 3). Write like 2/3.',
    answer:'2/3',
    explain:'6÷3=2, 9÷3=3. So 6/9 = 2/3.' },
  { id:'P3q06', level:3, type:'mc',
    text:'Which is the simplified form of 8/12?',
    options:['4/6','2/3','1/2','4/3'], answer:1,
    explain:'8÷4=2, 12÷4=3. So 8/12 = 2/3.' },

  // ---------- L4 (6) — mixed application ----------
  { id:'P4q01', level:4, type:'mc', text:'Complete:  3/4 = 6/?',
    options:['6','8','10','12'], answer:1,
    explain:'3×2=6 (top), so 4×2=8 (bottom). 3/4 = 6/8.' },
  { id:'P4q02', level:4, type:'mc', text:'Complete:  9/12 = ?/4',
    options:['1','2','3','4'], answer:2,
    explain:'9÷3=3, 12÷3=4. So 9/12 = 3/4.' },
  { id:'P4q03', level:4, type:'sa', text:'Make a fraction equal to 1/2 by multiplying both by 6. (Write like 6/12.)',
    answer:'6/12',
    explain:'1/2 × 6/6 = 6/12.' },
  { id:'P4q04', level:4, type:'mc', text:'Which is equivalent to 1/2?',
    options:['4/6','4/8','3/9','2/6'], answer:1,
    explain:'4/8 ÷ 4/4 = 1/2. The others are not.' },
  { id:'P4q05', level:4, type:'mc', text:'The fastest way to make 2/5 equal to 8/20 is to multiply by …',
    options:['2/2','3/3','4/4','5/5'], answer:2,
    explain:'2×4=8 (top), 5×4=20 (bottom). So multiply by 4/4.' },
  { id:'P4q06', level:4, type:'sa', text:'Simplify 10/20. (Write like 1/2.)',
    answer:'1/2',
    explain:'10÷10=1, 20÷10=2. So 10/20 = 1/2.' },
];

// ============================================================
// GAME BANK — 30 questions, 5 levels
// ============================================================
window.EF2_GAME_QUESTIONS = [
  // ----- L1 (6) — basics -----
  { id:'G1q01', level:1, type:'mc', text:'What does multiplying by 2/2 do to a fraction?',
    options:['Doubles it','Keeps it the same size','Halves it','Adds two'], answer:1 },
  { id:'G1q02', level:1, type:'mc', text:'2/2 equals what whole number?',
    options:['0','1','2','4'], answer:1 },
  { id:'G1q03', level:1, type:'mc', text:'To make equivalent fractions you must do the same to …',
    options:['Just the top','Just the bottom','BOTH the top and bottom','Neither'], answer:2 },
  { id:'G1q04', level:1, type:'mc', text:'Equivalent fractions are the same _____.',
    options:['size','colour','number','shape'], answer:0 },
  { id:'G1q05', level:1, type:'mc', text:'1/2 × 2/2 = ?',
    options:['1/2','2/4','2/2','3/4'], answer:1 },
  { id:'G1q06', level:1, type:'mc', text:'Which method finds equivalent fractions using fraction tiles?',
    options:['Visual','Numerical','Guessing','Reading'], answer:0 },

  // ----- L2 (7) — multiplying -----
  { id:'G2q01', level:2, type:'mc', text:'Fill in:  1/2 = ?/6',
    options:['1','2','3','4'], answer:2 },
  { id:'G2q02', level:2, type:'mc', text:'Fill in:  1/4 = 2/?',
    options:['4','6','8','10'], answer:2 },
  { id:'G2q03', level:2, type:'mc', text:'Fill in:  1/3 = ?/9',
    options:['1','2','3','9'], answer:2 },
  { id:'G2q04', level:2, type:'mc', text:'1/4 × 3/3 = ?',
    options:['3/4','3/12','4/12','1/12'], answer:1 },
  { id:'G2q05', level:2, type:'mc', text:'2/3 × 2/2 = ?',
    options:['2/3','4/6','4/3','2/6'], answer:1 },
  { id:'G2q06', level:2, type:'sa', text:'Solve  1/2 × 4/4 = ?/?  (write like 4/8)',
    answer:'4/8' },
  { id:'G2q07', level:2, type:'mc', text:'To go from 1/2 to 5/10, multiply top AND bottom by …',
    options:['2/2','3/3','4/4','5/5'], answer:3 },

  // ----- L3 (7) — dividing / simplifying -----
  { id:'G3q01', level:3, type:'mc', text:'To simplify 6/8 to 3/4, divide top and bottom by …',
    options:['1','2','3','4'], answer:1 },
  { id:'G3q02', level:3, type:'sa', text:'Solve  6/8 ÷ 2/2 = ?/?  (write like 3/4)',
    answer:'3/4' },
  { id:'G3q03', level:3, type:'mc', text:'Simplify 4/8 to its simplest form.',
    options:['4/8','2/4','1/2','1/4'], answer:2 },
  { id:'G3q04', level:3, type:'sa', text:'Simplify 6/9 (divide both by 3). Write like 2/3.',
    answer:'2/3' },
  { id:'G3q05', level:3, type:'mc', text:'Simplify 8/12.',
    options:['4/6','2/3','1/2','4/3'], answer:1 },
  { id:'G3q06', level:3, type:'sa', text:'Simplify 10/15 (divide both by 5). Write like 2/3.',
    answer:'2/3' },
  { id:'G3q07', level:3, type:'mc', text:'After dividing top and bottom by 4: 4/8 = ?/2',
    options:['1','2','3','4'], answer:0 },

  // ----- L4 (5) — mixed application -----
  { id:'G4q01', level:4, type:'mc', text:'Complete:  3/4 = 6/?',
    options:['6','8','10','12'], answer:1 },
  { id:'G4q02', level:4, type:'mc', text:'Complete:  9/12 = ?/4',
    options:['1','2','3','4'], answer:2 },
  { id:'G4q03', level:4, type:'sa', text:'Make a fraction equal to 1/2 using 6/6. (Write like 6/12.)',
    answer:'6/12' },
  { id:'G4q04', level:4, type:'mc', text:'Which is NOT equivalent to 1/2?',
    options:['4/8','3/6','5/10','3/9'], answer:3 },
  { id:'G4q05', level:4, type:'mc', text:'Which method works BOTH ways (up and down)?',
    options:['Visual only','Multiply only','Numerical (× or ÷ same/same)','Adding'], answer:2 },

  // ----- L5 (5) — high-level applications -----
  { id:'G5q01', level:5, type:'sa', text:'Simplify 12/18 (divide both by 6). Write like 2/3.',
    answer:'2/3' },
  { id:'G5q02', level:5, type:'mc', text:'Which is in simplest form?',
    options:['4/6','9/12','3/4','6/8'], answer:2 },
  { id:'G5q03', level:5, type:'sa', text:'1/2 × 7/7 = ?/?  (write like 7/14)',
    answer:'7/14' },
  { id:'G5q04', level:5, type:'mc', text:'Complete:  ?/8 = 9/24',
    options:['1','2','3','4'], answer:2 },
  { id:'G5q05', level:5, type:'sa', text:'Simplify 15/25 (divide both by 5). Write like 3/5.',
    answer:'3/5' },
];

window.EF2_PRACTICE_BY_LEVEL = (() => { const m={1:[],2:[],3:[],4:[]}; for (const q of window.EF2_PRACTICE_QUESTIONS) m[q.level].push(q); return m; })();
window.EF2_GAME_BY_LEVEL     = (() => { const m={1:[],2:[],3:[],4:[],5:[]}; for (const q of window.EF2_GAME_QUESTIONS)     m[q.level].push(q); return m; })();
