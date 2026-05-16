// Equivalent Fractions Day 1 — Question banks
// Two banks exposed:
//   window.EF1_PRACTICE_QUESTIONS — 24 questions, 4 levels (6 each), for the practice
//   window.EF1_GAME_QUESTIONS     — 30 questions, 4 levels, for Game 1 / Game 2
// Both share the same difficulty scheme: L1=2pts, L2=4pts, L3=6pts, L4=8pts.
//
// Visuals are tiny inline SVG fraction models rendered by helpers below.
// Question types: 'mc' (4 options) and 'sa' (short answer).

// Practice uses 4 levels (Day 1 only). Game uses 5 levels — the 5th is reserved
// for Day 2 mastery questions (numerical method).
window.EF1_LEVEL_POINTS      = { 1:2, 2:4, 3:6, 4:8 };
window.EF1_MAX_LEVEL         = 4;
window.EF1_GAME_LEVEL_POINTS = { 1:2, 2:4, 3:6, 4:8, 5:10 };
window.EF1_GAME_MAX_LEVEL    = 5;

// ---- Visual helpers -----------------------------------------------------
function _ef1Pie(num, den, color = '#3aa0dc') {
  const cx = 100, cy = 100, r = 80;
  let out = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="max-width:200px; height:auto;">`;
  if (den === 1) {
    out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${num >= 1 ? color : 'white'}" stroke="#1d1d1d" stroke-width="3"/></svg>`;
    return out;
  }
  for (let i = 0; i < den; i++) {
    const a1 = (i / den) * Math.PI * 2 - Math.PI / 2;
    const a2 = ((i + 1) / den) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const large = (1 / den) > 0.5 ? 1 : 0;
    const fill = i < num ? color : 'white';
    out += `<path d="M ${cx},${cy} L ${x1.toFixed(2)},${y1.toFixed(2)} A ${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${fill}" stroke="#1d1d1d" stroke-width="2"/>`;
  }
  out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1d1d1d" stroke-width="3"/></svg>`;
  return out;
}
function _ef1Bar(num, den, color = '#3aa0dc') {
  const w = 280, h = 60;
  const segW = w / den;
  let out = `<svg viewBox="0 0 280 60" xmlns="http://www.w3.org/2000/svg" style="max-width:280px; height:auto;">`;
  for (let i = 0; i < den; i++) {
    const x = i * segW;
    const fill = i < num ? color : 'white';
    out += `<rect x="${x.toFixed(2)}" y="0" width="${segW.toFixed(2)}" height="${h}" fill="${fill}" stroke="#1d1d1d" stroke-width="2"/>`;
  }
  out += `<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#1d1d1d" stroke-width="3"/></svg>`;
  return out;
}
// Two stacked bars (for "are these equivalent?" comparisons)
function _ef1TwoBars(n1, d1, n2, d2) {
  const w = 280, h = 50, gap = 14;
  const top = (n, d, y) => {
    const segW = w / d;
    let s = '';
    for (let i = 0; i < d; i++) {
      const x = i * segW;
      const fill = i < n ? '#3aa0dc' : 'white';
      s += `<rect x="${x.toFixed(2)}" y="${y}" width="${segW.toFixed(2)}" height="${h}" fill="${fill}" stroke="#1d1d1d" stroke-width="2"/>`;
    }
    s += `<rect x="0" y="${y}" width="${w}" height="${h}" fill="none" stroke="#1d1d1d" stroke-width="3"/>`;
    return s;
  };
  return `<svg viewBox="0 0 280 ${h*2+gap}" xmlns="http://www.w3.org/2000/svg" style="max-width:280px; height:auto;">
    ${top(n1, d1, 0)}${top(n2, d2, h+gap)}
  </svg>`;
}
window.EF1_VISUALS = { pie: _ef1Pie, bar: _ef1Bar, twoBars: _ef1TwoBars };

// ---- Render visual from a `visual` field on a question ------------------
window.EF1_renderVisual = function (v) {
  if (!v || !v.kind) return '';
  if (v.kind === 'pie')     return _ef1Pie(v.n, v.d);
  if (v.kind === 'bar')     return _ef1Bar(v.n, v.d);
  if (v.kind === 'twoBars') return _ef1TwoBars(v.n1, v.d1, v.n2, v.d2);
  return '';
};

// ---- Short-answer normaliser (also accepts "1/2" or "1 / 2") ------------
function _ef1Norm(s) {
  return (s || '').toString().trim().toLowerCase().replace(/\s+/g, '');
}
window.EF1_checkSA = function (q, given) {
  const g = _ef1Norm(given);
  if (!g) return false;
  if (g === _ef1Norm(q.answer)) return true;
  if (Array.isArray(q.accept)) for (const a of q.accept) if (g === _ef1Norm(a)) return true;
  return false;
};

// ============================================================
//  PRACTICE BANK — 24 questions, 4 levels, Day 1 focus
//    L1: read fractions / vocabulary
//    L2: visual recognition + simple equivalence
//    L3: numeric equivalence
//    L4: master Day 1 (multiple equivalents)
// ============================================================
window.EF1_PRACTICE_QUESTIONS = [
  // ----- LEVEL 1 (read fractions & basic vocab) -----
  { id:'P1q01', level:1, type:'mc',
    text:'How do you read 1/2?',
    options:['one half','one third','two halves','one quarter'], answer:0,
    explain:'1/2 means one out of two equal parts. We say "one half".' },
  { id:'P1q02', level:1, type:'mc',
    text:'How do you read 1/3?',
    options:['one half','one third','one quarter','three ones'], answer:1,
    explain:'1/3 means one out of three equal parts. We say "one third".' },
  { id:'P1q03', level:1, type:'mc',
    text:'How do you read 1/4?',
    options:['one fourth','one quarter','one third','one half'], answer:1,
    explain:'1/4 is "one quarter" (also called "one fourth"). One out of four equal parts.' },
  { id:'P1q04', level:1, type:'mc',
    text:'How do you read 3/4?',
    options:['three quarters','three halves','three thirds','three eighths'], answer:0,
    explain:'3/4 means three out of four equal parts: "three quarters".' },
  { id:'P1q05', level:1, type:'mc',
    text:'Equivalent fractions are the same _____ with different names.',
    options:['size','colour','shape','number'], answer:0,
    explain:'Equivalent fractions are the SAME SIZE but written with different numbers.' },
  { id:'P1q06', level:1, type:'mc',
    text:'In the fraction 2/4, what does the top number 2 tell you?',
    options:['How many parts altogether','How many parts you have','The size of each part','Nothing'], answer:1,
    explain:'The top number (numerator) tells you how many equal parts you HAVE. The bottom shows how many parts the whole is split into.' },

  // ----- LEVEL 2 (visual recognition & simple equivalence) -----
  { id:'P2q01', level:2, type:'mc',
    text:'What fraction is shaded?', visual:{kind:'pie', n:1, d:2},
    options:['1/2','1/3','1/4','2/3'], answer:0,
    explain:'One of the two equal parts is shaded. That is 1/2.' },
  { id:'P2q02', level:2, type:'mc',
    text:'What fraction is shaded?', visual:{kind:'bar', n:2, d:4},
    options:['1/2','2/4','1/4','3/4'], answer:1,
    explain:'Two of the four equal parts are shaded. That is 2/4. (Also equal to 1/2!)' },
  { id:'P2q03', level:2, type:'mc',
    text:'What fraction is shaded?', visual:{kind:'pie', n:1, d:4},
    options:['1/2','1/3','1/4','2/4'], answer:2,
    explain:'One quarter is shaded. That is 1/4.' },
  { id:'P2q04', level:2, type:'mc',
    text:'Look at the two bars. Are they equivalent?', visual:{kind:'twoBars', n1:1, d1:2, n2:2, d2:4},
    options:['Yes — same length is shaded','No — different fractions','Only sometimes','Cannot tell'], answer:0,
    explain:'1/2 and 2/4 cover the same length. They are equivalent.' },
  { id:'P2q05', level:2, type:'mc',
    text:'Which fraction is equal to 1/2?',
    options:['1/3','2/4','3/4','1/4'], answer:1,
    explain:'2/4 is equivalent to 1/2 (both are half).' },
  { id:'P2q06', level:2, type:'mc',
    text:'What fraction is shaded?', visual:{kind:'bar', n:3, d:6},
    options:['1/2','1/3','3/6','both A and C'], answer:3,
    explain:'3 out of 6 equal parts are shaded. That is 3/6, which is the same size as 1/2.' },

  // ----- LEVEL 3 (numeric equivalence) -----
  { id:'P3q01', level:3, type:'mc',
    text:'Which fraction is equivalent to 1/4?',
    options:['1/2','2/4','2/8','3/8'], answer:2,
    explain:'1/4 = 2/8 (multiply top and bottom by 2).' },
  { id:'P3q02', level:3, type:'mc',
    text:'Which fraction is equivalent to 3/4?',
    options:['6/8','3/8','4/8','5/8'], answer:0,
    explain:'3/4 = 6/8 (multiply top and bottom by 2).' },
  { id:'P3q03', level:3, type:'mc',
    text:'Which fraction is equivalent to 1/3?',
    options:['1/6','2/6','3/6','4/6'], answer:1,
    explain:'1/3 = 2/6 (multiply top and bottom by 2).' },
  { id:'P3q04', level:3, type:'mc',
    text:'Fill in: 1/2 = ?/4',
    options:['1','2','3','4'], answer:1,
    explain:'1/2 = 2/4. The top went up by 1, so the bottom went up by 2.' },
  { id:'P3q05', level:3, type:'mc',
    text:'Fill in: 1/3 = ?/6',
    options:['1','2','3','4'], answer:1,
    explain:'1/3 = 2/6. Multiply top and bottom by 2.' },
  { id:'P3q06', level:3, type:'mc',
    text:'Which is NOT equivalent to 1/2?',
    options:['2/4','3/6','5/10','3/4'], answer:3,
    explain:'3/4 is bigger than 1/2. The other three are all equal to 1/2.' },

  // ----- LEVEL 4 (Day 1 mastery — multiple equivalents) -----
  { id:'P4q01', level:4, type:'sa',
    text:'Type a fraction equal to 1/2 (write like 2/4).',
    answer:'2/4', accept:['3/6','4/8','5/10','6/12'],
    explain:'Any fraction where the bottom is twice the top is equal to 1/2: 2/4, 3/6, 4/8, 5/10…' },
  { id:'P4q02', level:4, type:'sa',
    text:'Complete: 2/4 = 1/?',
    answer:'2',
    explain:'2/4 = 1/2 (divide top and bottom by 2).' },
  { id:'P4q03', level:4, type:'mc',
    text:'Pick ALL fractions equivalent to 1/4. (Choose the option that lists every equivalent.)',
    options:['2/8 only','2/8 and 3/12','2/8 and 4/8','3/12 and 4/8'], answer:1,
    explain:'1/4 = 2/8 = 3/12. 4/8 is 1/2, NOT 1/4.' },
  { id:'P4q04', level:4, type:'sa',
    text:'Type the missing number: 3/4 = 6/?',
    answer:'8',
    explain:'3/4 = 6/8 (multiply top and bottom by 2).' },
  { id:'P4q05', level:4, type:'mc',
    text:'Look at the two bars carefully.', visual:{kind:'twoBars', n1:1, d1:3, n2:2, d2:6},
    options:['Equivalent — same length shaded','Not equivalent','Only the top is half','Cannot tell from the picture'], answer:0,
    explain:'1/3 and 2/6 cover the same length. They are equivalent.' },
  { id:'P4q06', level:4, type:'sa',
    text:'Fill in: 4/8 = ?/2',
    answer:'1',
    explain:'4/8 = 1/2 (divide top and bottom by 4).' },
];

// ============================================================
//  GAME BANK — 30 questions, 4 levels (~7 / 8 / 8 / 7)
//  Same questions reused for Game 1 and Game 2.
// ============================================================
window.EF1_GAME_QUESTIONS = [
  // ----- L1 (7) -----
  { id:'G1q01', level:1, type:'mc', text:'How do you read 1/2?',
    options:['one half','one third','one quarter','two halves'], answer:0 },
  { id:'G1q02', level:1, type:'mc', text:'How do you read 1/3?',
    options:['one half','one third','one quarter','three ones'], answer:1 },
  { id:'G1q03', level:1, type:'mc', text:'How do you read 1/4?',
    options:['one half','one third','one quarter','one eighth'], answer:2 },
  { id:'G1q04', level:1, type:'mc', text:'How do you read 2/3?',
    options:['two halves','two thirds','two quarters','one third'], answer:1 },
  { id:'G1q05', level:1, type:'mc', text:'How do you read 3/4?',
    options:['three halves','three thirds','three quarters','three eighths'], answer:2 },
  { id:'G1q06', level:1, type:'mc', text:'In the fraction 3/5, what is 5 called?',
    options:['the top','the denominator','the numerator','the equivalent'], answer:1 },
  { id:'G1q07', level:1, type:'mc', text:'What does the BOTTOM number of a fraction tell you?',
    options:['How many parts are shaded','How many equal parts the whole is split into','Nothing important','How big the fraction is'], answer:1 },

  // ----- L2 (8) -----
  { id:'G2q01', level:2, type:'mc', text:'What fraction is shaded?', visual:{kind:'pie', n:1, d:2},
    options:['1/2','1/4','2/3','1/3'], answer:0 },
  { id:'G2q02', level:2, type:'mc', text:'What fraction is shaded?', visual:{kind:'bar', n:2, d:4},
    options:['1/2','2/4','1/4','3/4'], answer:1 },
  { id:'G2q03', level:2, type:'mc', text:'What fraction is shaded?', visual:{kind:'pie', n:1, d:3},
    options:['1/2','1/3','1/4','2/3'], answer:1 },
  { id:'G2q04', level:2, type:'mc', text:'What fraction is shaded?', visual:{kind:'bar', n:3, d:4},
    options:['1/4','3/4','3/8','4/3'], answer:1 },
  { id:'G2q05', level:2, type:'mc', text:'Which is equivalent to 1/2?',
    options:['1/3','2/4','3/4','1/4'], answer:1 },
  { id:'G2q06', level:2, type:'mc', text:'Which is equivalent to 1/4?',
    options:['1/2','2/8','3/4','3/8'], answer:1 },
  { id:'G2q07', level:2, type:'mc', text:'Are 1/2 and 2/4 equivalent fractions?',
    options:['Yes — same size, different names','No — different sizes','Only on Tuesdays','Cannot decide'], answer:0 },
  { id:'G2q08', level:2, type:'mc', text:'What does this picture show?', visual:{kind:'pie', n:2, d:4},
    options:['1/4','2/4','3/4','4/4'], answer:1 },

  // ----- L3 (8) -----
  { id:'G3q01', level:3, type:'mc', text:'Which is equivalent to 3/4?',
    options:['3/8','6/8','4/8','5/8'], answer:1 },
  { id:'G3q02', level:3, type:'mc', text:'Which is equivalent to 2/3?',
    options:['2/6','4/6','3/6','5/6'], answer:1 },
  { id:'G3q03', level:3, type:'mc', text:'Fill in: 1/2 = ?/6',
    options:['1','2','3','4'], answer:2 },
  { id:'G3q04', level:3, type:'mc', text:'Fill in: 1/4 = 2/?',
    options:['4','6','8','10'], answer:2 },
  { id:'G3q05', level:3, type:'mc', text:'Fill in: 1/3 = ?/9',
    options:['1','2','3','9'], answer:2 },
  { id:'G3q06', level:3, type:'mc', text:'Which fraction is NOT equivalent to 1/2?',
    options:['2/4','3/6','4/8','3/4'], answer:3 },
  { id:'G3q07', level:3, type:'mc', text:'Which fraction is NOT equivalent to 1/3?',
    options:['2/6','3/9','4/12','3/6'], answer:3 },
  { id:'G3q08', level:3, type:'mc', text:'Are these equivalent?', visual:{kind:'twoBars', n1:1, d1:2, n2:3, d2:6},
    options:['Yes — same length shaded','No — different lengths','Sometimes','Only when red'], answer:0 },

  // ----- L4 (7) -----
  { id:'G4q01', level:4, type:'sa', text:'Type a fraction equal to 1/2 (write like 2/4).',
    answer:'2/4', accept:['3/6','4/8','5/10','6/12'] },
  { id:'G4q02', level:4, type:'sa', text:'Type a fraction equal to 1/3 (write like 2/6).',
    answer:'2/6', accept:['3/9','4/12'] },
  { id:'G4q03', level:4, type:'sa', text:'Complete: 6/8 = 3/?',
    answer:'4' },
  { id:'G4q04', level:4, type:'sa', text:'Complete: 2/6 = 1/?',
    answer:'3' },
  { id:'G4q05', level:4, type:'mc', text:'Which fraction is BIGGER than 1/2?',
    options:['2/4','3/6','3/4','5/10'], answer:2 },
  { id:'G4q06', level:4, type:'mc', text:'I have 8 slices. I eat 2. What fraction did I eat (in simplest equivalent)?',
    options:['2/8','1/4','1/2','3/4'], answer:1 },
  { id:'G4q07', level:4, type:'mc', text:'Pick the equivalent of 4/12.',
    options:['1/3','1/4','2/3','1/2'], answer:0 },

  // ----- L5 (10) — Day 2: NUMERICAL method (×/÷ same on top & bottom) -----
  { id:'G5q01', level:5, type:'mc',
    text:'To make 1/2 equal to 2/4, multiply the top AND bottom by what number?',
    options:['2','3','4','5'], answer:0 },
  { id:'G5q02', level:5, type:'mc',
    text:'To simplify 6/8 to 3/4, we DIVIDE the top and bottom by what?',
    options:['2','3','4','6'], answer:0 },
  { id:'G5q03', level:5, type:'sa',
    text:'Solve  1/2 × 3/3 = ?  (write like 3/6)',
    answer:'3/6' },
  { id:'G5q04', level:5, type:'sa',
    text:'Simplify by dividing top and bottom by 2:  4/6 = ?  (write like 2/3)',
    answer:'2/3' },
  { id:'G5q05', level:5, type:'mc',
    text:'To make 2/3 equal to 6/9, multiply top AND bottom by what?',
    options:['2','3','6','9'], answer:1 },
  { id:'G5q06', level:5, type:'mc',
    text:'Why is multiplying a fraction by 2/2 (or 3/3, or any same/same) okay?',
    options:['It changes the fraction','Same on top and bottom equals 1, so the size stays the same','It always makes the fraction bigger','It always simplifies the fraction'],
    answer:1 },
  { id:'G5q07', level:5, type:'mc',
    text:'Complete:  3/4 = ?/12',
    options:['6','8','9','12'], answer:2 },
  { id:'G5q08', level:5, type:'sa',
    text:'Complete (divide top and bottom by 4):  8/12 = ?/3',
    answer:'2' },
  { id:'G5q09', level:5, type:'mc',
    text:'Which is the FASTEST way to make 1/2 equal to 5/10?',
    options:['Add 4 to top and 8 to bottom','Multiply top and bottom by 5','Multiply top by 5 only','Subtract from each'],
    answer:1 },
  { id:'G5q10', level:5, type:'sa',
    text:'Simplify 10/15 by dividing top and bottom by 5. (write like 2/3)',
    answer:'2/3' },
];

// Per-level quick lookup
window.EF1_PRACTICE_BY_LEVEL = (() => { const m = {1:[],2:[],3:[],4:[]}; for (const q of window.EF1_PRACTICE_QUESTIONS) m[q.level].push(q); return m; })();
window.EF1_GAME_BY_LEVEL     = (() => { const m = {1:[],2:[],3:[],4:[],5:[]}; for (const q of window.EF1_GAME_QUESTIONS) m[q.level].push(q); return m; })();
