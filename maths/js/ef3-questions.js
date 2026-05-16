// Equivalent Fractions Day 3 — Question banks
// Day 3 focus: TENTHS AND DECIMALS as fractions.
//   • Read & write tenths (0.1, 0.2, … 1.0)
//   • Convert tenths fractions ↔ decimals  (3/10 ↔ 0.3)
//   • Link to Days 1-2: 1/2 = 5/10 = 0.5, 1/5 = 2/10 = 0.2 etc.
//   • Compare a fraction with a decimal using <, > or =  (Day 5 lead-in)
// Practice = 24 questions (4 levels), Game = 30 questions (5 levels).

window.EF3_LEVEL_POINTS      = { 1:2, 2:4, 3:6, 4:8 };
window.EF3_MAX_LEVEL         = 4;
window.EF3_GAME_LEVEL_POINTS = { 1:2, 2:4, 3:6, 4:8, 5:10 };
window.EF3_GAME_MAX_LEVEL    = 5;

// Reuse EF1's visual helpers (pies / bars / two-bars). Loaded with EF1 script.
window.EF3_renderVisual = (v) => (window.EF1_renderVisual ? window.EF1_renderVisual(v) : '');

function _ef3Norm(s) { return (s || '').toString().trim().toLowerCase().replace(/\s+/g, ''); }
window.EF3_checkSA = function (q, given) {
  const g = _ef3Norm(given);
  if (!g) return false;
  if (g === _ef3Norm(q.answer)) return true;
  if (Array.isArray(q.accept)) for (const a of q.accept) if (g === _ef3Norm(a)) return true;
  return false;
};

// ============================================================
// PRACTICE BANK — 24 questions, Day 3 progression
//   L1: read tenths (decimal ↔ words)
//   L2: fractions → decimals (tenths)
//   L3: decimals → fractions (tenths)
//   L4: mixed application + link to Days 1-2 equivalences
// ============================================================
window.EF3_PRACTICE_QUESTIONS = [
  // ---------- L1 (6) — reading tenths ----------
  { id:'P1q01', level:1, type:'mc',
    text:'How do we say 0.1?',
    options:['one tenth','one hundredth','one','ten'], answer:0,
    explain:'0.1 is one tenth — one out of ten equal pieces.' },
  { id:'P1q02', level:1, type:'mc',
    text:'What is 0.5 in words?',
    options:['five hundredths','five tenths','five','half a hundred'], answer:1,
    explain:'0.5 = five tenths. The first digit after the point is the tenths place.' },
  { id:'P1q03', level:1, type:'mc',
    text:'1/10 as a decimal is …',
    options:['0.01','0.1','1.0','10'], answer:1,
    explain:'One tenth is 0.1. The 1 sits in the tenths place.' },
  { id:'P1q04', level:1, type:'mc',
    text:'Which digit in 0.7 is in the tenths place?',
    options:['0','7','the dot','none'], answer:1,
    explain:'In 0.7 the 7 is right after the decimal point — that is the tenths place.' },
  { id:'P1q05', level:1, type:'sa',
    text:'Write "three tenths" as a decimal.',
    answer:'0.3', accept:['.3'],
    explain:'Three tenths = 3/10 = 0.3.' },
  { id:'P1q06', level:1, type:'mc',
    text:'0.1 + 0.1 + 0.1 = ?',
    options:['0.1','0.2','0.3','0.4'], answer:2,
    explain:'Three lots of one tenth = three tenths = 0.3.' },

  // ---------- L2 (6) — fractions → decimals (tenths) ----------
  { id:'P2q01', level:2, type:'mc', text:'3/10 as a decimal is …',
    options:['0.03','0.3','3.0','30'], answer:1,
    explain:'3/10 = 0.3. Three tenths.' },
  { id:'P2q02', level:2, type:'mc', text:'7/10 as a decimal is …',
    options:['0.07','0.7','7.0','7/100'], answer:1,
    explain:'7/10 = 0.7. Seven tenths.' },
  { id:'P2q03', level:2, type:'mc', text:'5/10 as a decimal is …',
    options:['0.5','0.05','5.0','0.50 only'], answer:0,
    explain:'5/10 = 0.5. Five tenths.' },
  { id:'P2q04', level:2, type:'sa', text:'Write 6/10 as a decimal.',
    answer:'0.6', accept:['.6'],
    explain:'6/10 = six tenths = 0.6.' },
  { id:'P2q05', level:2, type:'mc', text:'10/10 as a decimal is …',
    options:['0.1','1.0','10.0','0.10'], answer:1,
    explain:'10/10 makes one whole = 1.0.' },
  { id:'P2q06', level:2, type:'sa', text:'Write 9/10 as a decimal.',
    answer:'0.9', accept:['.9'],
    explain:'9/10 = nine tenths = 0.9.' },

  // ---------- L3 (6) — decimals → fractions (tenths) ----------
  { id:'P3q01', level:3, type:'mc', text:'0.4 as a fraction is …',
    options:['1/4','4/100','4/10','4'], answer:2,
    explain:'0.4 = four tenths = 4/10.' },
  { id:'P3q02', level:3, type:'mc', text:'0.3 = ?/10',
    options:['1','2','3','30'], answer:2,
    explain:'0.3 is three tenths, so it is 3/10.' },
  { id:'P3q03', level:3, type:'sa', text:'Write 0.9 as a fraction with 10 on the bottom.',
    answer:'9/10',
    explain:'0.9 = nine tenths = 9/10.' },
  { id:'P3q04', level:3, type:'mc', text:'0.8 = ?/10',
    options:['8','80','1','10'], answer:0,
    explain:'0.8 is eight tenths, so 8/10.' },
  { id:'P3q05', level:3, type:'mc', text:'Which decimal is the same as 6/10?',
    options:['0.06','0.6','6.0','0.16'], answer:1,
    explain:'6/10 means six tenths — that is 0.6.' },
  { id:'P3q06', level:3, type:'sa', text:'Write 0.2 as a fraction over 10.',
    answer:'2/10',
    explain:'0.2 = two tenths = 2/10.' },

  // ---------- L4 (6) — mixed application + Day 1-2 link ----------
  { id:'P4q01', level:4, type:'mc', text:'1/2 = ?/10',
    options:['2','3','5','10'], answer:2,
    explain:'1/2 × 5/5 = 5/10. (Days 1-2 trick: multiply top AND bottom by the same number.)' },
  { id:'P4q02', level:4, type:'mc', text:'1/2 as a decimal is …',
    options:['0.2','0.5','0.1','0.05'], answer:1,
    explain:'1/2 = 5/10 = 0.5.' },
  { id:'P4q03', level:4, type:'sa', text:'Write 0.5 as a fraction over 10.',
    answer:'5/10',
    explain:'0.5 = five tenths = 5/10. And 5/10 = 1/2.' },
  { id:'P4q04', level:4, type:'mc', text:'Which fraction equals 0.5?',
    options:['1/5','2/5','1/2','1/4'], answer:2,
    explain:'0.5 = 5/10 = 1/2.' },
  { id:'P4q05', level:4, type:'mc', text:'Compare:  0.5 ___ 1/2',
    options:['<','>','=','can\'t tell'], answer:2,
    explain:'0.5 = 5/10 = 1/2. They are equal.' },
  { id:'P4q06', level:4, type:'sa', text:'1/5 = ?/10 (multiply top and bottom by 2). Write like 2/10.',
    answer:'2/10',
    explain:'1/5 × 2/2 = 2/10. So 1/5 = 2/10 = 0.2.' },
];

// ============================================================
// GAME BANK — 30 questions, 5 levels
//   L1: read tenths        (6)
//   L2: fractions → decimals (7)
//   L3: decimals → fractions (7)
//   L4: equivalence with 1/2 etc. (5)
//   L5: compare fraction vs decimal (<, >, =) — Day 5 lead-in (5)
// ============================================================
window.EF3_GAME_QUESTIONS = [
  // ----- L1 (6) — reading tenths -----
  { id:'G1q01', level:1, type:'mc', text:'How do we say 0.1?',
    options:['one tenth','one hundredth','one','ten'], answer:0 },
  { id:'G1q02', level:1, type:'mc', text:'How do we say 0.7?',
    options:['seven hundredths','seven','seven tenths','seventy'], answer:2 },
  { id:'G1q03', level:1, type:'mc', text:'Which digit is in the tenths place in 0.6?',
    options:['0','6','the dot','none'], answer:1 },
  { id:'G1q04', level:1, type:'sa', text:'Write "two tenths" as a decimal.',
    answer:'0.2', accept:['.2'] },
  { id:'G1q05', level:1, type:'mc', text:'0.1 + 0.1 = ?',
    options:['0.1','0.2','0.11','0.02'], answer:1 },
  { id:'G1q06', level:1, type:'mc', text:'How many tenths are there from 0 to 1?',
    options:['1','5','10','100'], answer:2 },

  // ----- L2 (7) — fractions → decimals -----
  { id:'G2q01', level:2, type:'mc', text:'4/10 as a decimal is …',
    options:['0.04','0.4','4.0','4/100'], answer:1 },
  { id:'G2q02', level:2, type:'mc', text:'7/10 as a decimal is …',
    options:['0.07','0.7','7.0','7/100'], answer:1 },
  { id:'G2q03', level:2, type:'sa', text:'Write 3/10 as a decimal.',
    answer:'0.3', accept:['.3'] },
  { id:'G2q04', level:2, type:'mc', text:'9/10 as a decimal is …',
    options:['0.9','0.09','9.0','0.99'], answer:0 },
  { id:'G2q05', level:2, type:'sa', text:'Write 6/10 as a decimal.',
    answer:'0.6', accept:['.6'] },
  { id:'G2q06', level:2, type:'mc', text:'10/10 as a decimal is …',
    options:['0.1','1.0','10.0','0.10'], answer:1 },
  { id:'G2q07', level:2, type:'sa', text:'Write 8/10 as a decimal.',
    answer:'0.8', accept:['.8'] },

  // ----- L3 (7) — decimals → fractions -----
  { id:'G3q01', level:3, type:'mc', text:'0.4 as a tenths fraction is …',
    options:['1/4','4/100','4/10','40'], answer:2 },
  { id:'G3q02', level:3, type:'sa', text:'Write 0.9 as a fraction over 10.',
    answer:'9/10' },
  { id:'G3q03', level:3, type:'mc', text:'0.3 = ?/10',
    options:['1','2','3','30'], answer:2 },
  { id:'G3q04', level:3, type:'sa', text:'Write 0.7 as a fraction over 10.',
    answer:'7/10' },
  { id:'G3q05', level:3, type:'mc', text:'Which decimal equals 6/10?',
    options:['0.06','0.6','6.0','0.16'], answer:1 },
  { id:'G3q06', level:3, type:'sa', text:'Write 0.2 as a fraction over 10.',
    answer:'2/10' },
  { id:'G3q07', level:3, type:'mc', text:'Which is 0.8?',
    options:['8/100','8/10','80/10','0/8'], answer:1 },

  // ----- L4 (5) — link to Days 1-2 equivalences -----
  { id:'G4q01', level:4, type:'mc', text:'1/2 = ?/10',
    options:['2','3','5','10'], answer:2 },
  { id:'G4q02', level:4, type:'mc', text:'1/2 as a decimal is …',
    options:['0.2','0.5','0.1','0.05'], answer:1 },
  { id:'G4q03', level:4, type:'sa', text:'Write 0.5 as a fraction over 10.',
    answer:'5/10' },
  { id:'G4q04', level:4, type:'mc', text:'Which fraction equals 0.5?',
    options:['1/5','2/5','1/2','1/4'], answer:2 },
  { id:'G4q05', level:4, type:'sa', text:'1/5 = ?/10 (write like 2/10).',
    answer:'2/10' },

  // ----- L5 (5) — compare fraction vs decimal (Day 5 high-level) -----
  { id:'G5q01', level:5, type:'mc', text:'Compare:  0.5 ___ 1/2',
    options:['<','>','='], answer:2 },
  { id:'G5q02', level:5, type:'mc', text:'Compare:  0.4 ___ 1/2',
    options:['<','>','='], answer:0 },
  { id:'G5q03', level:5, type:'mc', text:'Compare:  7/10 ___ 0.6',
    options:['<','>','='], answer:1 },
  { id:'G5q04', level:5, type:'mc', text:'Compare:  3/10 ___ 0.2',
    options:['<','>','='], answer:1 },
  { id:'G5q05', level:5, type:'mc', text:'Which is bigger?',
    options:['0.4','1/2','0.3','2/10'], answer:1 },
];

window.EF3_PRACTICE_BY_LEVEL = (() => { const m={1:[],2:[],3:[],4:[]}; for (const q of window.EF3_PRACTICE_QUESTIONS) m[q.level].push(q); return m; })();
window.EF3_GAME_BY_LEVEL     = (() => { const m={1:[],2:[],3:[],4:[],5:[]}; for (const q of window.EF3_GAME_QUESTIONS)     m[q.level].push(q); return m; })();
