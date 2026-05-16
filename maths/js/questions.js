// 50-question bank for the Maths Game (Yesterday Me vs. Today Me / Me vs. the Class)
// 5 difficulty levels: 10 questions each.
//   L1 (2 pts), L2 (4 pts), L3 (6 pts), L4 (8 pts), L5 (10 pts)
// type: 'mc' (4 options), 'sa' (short answer)
// For 'sa', `answer` is the canonical lower-case string. `accept` is an array
// of additional accepted strings (already lower-cased + stripped of spaces).
window.LEVEL_POINTS = { 1:2, 2:4, 3:6, 4:8, 5:10 };

window.QUESTIONS = [
  // -------------------- LEVEL 1 (10 × 2 pts) --------------------
  { id:'L1q01', level:1, type:'mc', text:'What is this shape?', shape:'square',
    options:['Square','Triangle','Circle','Hexagon'], answer:0 },
  { id:'L1q02', level:1, type:'mc', text:'What is this shape?', shape:'triangle',
    options:['Square','Triangle','Pentagon','Rectangle'], answer:1 },
  { id:'L1q03', level:1, type:'mc', text:'What is this shape?', shape:'circle',
    options:['Pentagon','Hexagon','Circle','Triangle'], answer:2 },
  { id:'L1q04', level:1, type:'mc', text:'How many sides does a triangle have?',
    options:['2','3','4','5'], answer:1 },
  { id:'L1q05', level:1, type:'mc', text:'How many sides does a square have?',
    options:['3','4','5','6'], answer:1 },
  { id:'L1q06', level:1, type:'mc', text:'What is this shape?', shape:'rectangle',
    options:['Square','Rectangle','Pentagon','Triangle'], answer:1 },
  { id:'L1q07', level:1, type:'mc', text:'How many corners does a triangle have?',
    shape:'triangle', options:['2','3','4','6'], answer:1 },
  { id:'L1q08', level:1, type:'mc', text:'Which shape has NO straight sides?',
    options:['Square','Circle','Triangle','Pentagon'], answer:1 },
  { id:'L1q09', level:1, type:'sa', text:'Type the name of this shape.', shape:'square',
    answer:'square', accept:[] },
  { id:'L1q10', level:1, type:'mc', text:'What is this shape?', shape:'triangleDown',
    options:['Square','Triangle','Hexagon','Circle'], answer:1 },

  // -------------------- LEVEL 2 (10 × 4 pts) --------------------
  { id:'L2q01', level:2, type:'mc', text:'What is this shape?', shape:'regPentagon',
    options:['Triangle','Pentagon','Hexagon','Octagon'], answer:1 },
  { id:'L2q02', level:2, type:'mc', text:'How many sides does a pentagon have?',
    shape:'regPentagon', options:['4','5','6','8'], answer:1 },
  { id:'L2q03', level:2, type:'mc', text:'What is this shape?', shape:'regHexagon',
    options:['Pentagon','Hexagon','Octagon','Triangle'], answer:1 },
  { id:'L2q04', level:2, type:'mc', text:'How many sides does a hexagon have?',
    shape:'regHexagon', options:['5','6','7','8'], answer:1 },
  { id:'L2q05', level:2, type:'mc', text:'What is this shape?', shape:'regOctagon',
    options:['Hexagon','Octagon','Pentagon','Square'], answer:1 },
  { id:'L2q06', level:2, type:'mc', text:'How many sides does an octagon have?',
    shape:'regOctagon', options:['6','7','8','10'], answer:2 },
  { id:'L2q07', level:2, type:'sa', text:'Type the name of this shape.',
    shape:'regPentagon', answer:'pentagon', accept:['regular pentagon','5-sided shape'] },
  { id:'L2q08', level:2, type:'sa', text:'Type the name of this shape.',
    shape:'regHexagon', answer:'hexagon', accept:['regular hexagon','6-sided shape'] },
  { id:'L2q09', level:2, type:'mc', text:'Which shape has 4 sides?',
    options:['Triangle','Square','Pentagon','Hexagon'], answer:1 },
  { id:'L2q10', level:2, type:'mc', text:'How many right angles does a square have?',
    shape:'square', options:['2','3','4','0'], answer:2 },

  // -------------------- LEVEL 3 (10 × 6 pts) --------------------
  { id:'L3q01', level:3, type:'mc', text:'A shape with all sides equal AND all angles equal is called a...',
    options:['Regular shape','Irregular shape','Parallelogram','Quadrilateral'], answer:0 },
  { id:'L3q02', level:3, type:'mc', text:'How many pairs of parallel sides does a rectangle have?',
    shape:'rectangle', options:['0','1','2','3'], answer:2 },
  { id:'L3q03', level:3, type:'mc', text:'Which sentence about a square is TRUE?',
    shape:'square',
    options:['It has 4 equal sides and 4 equal angles','It has 4 equal sides but different angles','It has only 2 equal sides','It has 3 sides'], answer:0 },
  { id:'L3q04', level:3, type:'mc', text:'A shape has 4 sides and 4 right angles, but the sides are NOT all equal. What is it?',
    shape:'rectangle',
    options:['Square','Rectangle','Trapezium','Parallelogram'], answer:1 },
  { id:'L3q05', level:3, type:'mc', text:'How many pairs of parallel sides does a trapezium have?',
    shape:'trapezium', options:['0','1','2','3'], answer:1 },
  { id:'L3q06', level:3, type:'sa', text:'Type the name of this shape.', shape:'regHexagon',
    answer:'hexagon', accept:['regular hexagon'] },
  { id:'L3q07', level:3, type:'sa', text:'How many right angles does a rectangle have? (type a number)',
    shape:'rectangle', answer:'4', accept:['four'] },
  { id:'L3q08', level:3, type:'mc', text:'Which shape has only 1 pair of parallel sides?',
    options:['Square','Rectangle','Trapezium','Parallelogram'], answer:2 },
  { id:'L3q09', level:3, type:'mc', text:'Is a rectangle a regular shape?',
    shape:'rectangle',
    options:['Yes — all sides are equal','Yes — all angles are equal','No — the sides are not all equal','No — it has no parallel sides'], answer:2 },
  { id:'L3q10', level:3, type:'sa', text:'How many sides does a hexagon have? (type a number)',
    shape:'regHexagon', answer:'6', accept:['six'] },

  // -------------------- LEVEL 4 (10 × 8 pts) --------------------
  { id:'L4q01', level:4, type:'mc', text:'Look at this shape. Is it regular or irregular?',
    shape:'irregHexagonBook',
    options:['Regular','Irregular','Both','Neither'], answer:1 },
  { id:'L4q02', level:4, type:'mc', text:'How many sides does this arrow shape have? Count carefully!',
    shape:'chevronLeftArrow', options:['5','6','7','8'], answer:2 },
  { id:'L4q03', level:4, type:'mc', text:'This pentagon has 5 sides but the angles are different. Is it regular?',
    shape:'irregPentagonHouse',
    options:['Yes — it has 5 sides','No — sides and angles are not all equal','Only if it has right angles','Yes — pentagons are always regular'], answer:1 },
  { id:'L4q04', level:4, type:'mc', text:'A shape has 2 pairs of parallel sides but NO right angles. What is it?',
    shape:'parallelogram',
    options:['Rectangle','Square','Parallelogram','Trapezium'], answer:2 },
  { id:'L4q05', level:4, type:'sa', text:'How many sides does this shape have? (type a number)',
    shape:'irregHexagonBook', answer:'6', accept:['six'] },
  { id:'L4q06', level:4, type:'sa', text:'Name a 4-sided shape with EXACTLY 1 pair of parallel sides.',
    answer:'trapezium', accept:['trapezoid'] },
  { id:'L4q07', level:4, type:'mc', text:'Look at this L-shape. Does it have any right angles?',
    shape:'lShape',
    options:['Yes — 6 right angles','Yes — only 4 right angles','No — only acute angles','No — only obtuse angles'], answer:0 },
  { id:'L4q08', level:4, type:'mc', text:'A pentagon has 5 EQUAL sides but the angles are different. Is it regular?',
    options:['Yes — its sides are equal','No — the angles are not all equal','Yes — pentagons are always regular','No — it must be a square to be regular'], answer:1 },
  { id:'L4q09', level:4, type:'sa', text:'A 4-sided shape is also called a __ . (one word)',
    answer:'quadrilateral', accept:['quad'] },
  { id:'L4q10', level:4, type:'mc', text:'What is this shape called?', shape:'chevronRight',
    options:['Regular hexagon','Irregular hexagon','Regular pentagon','Octagon'], answer:1 },

  // -------------------- LEVEL 5 (10 × 10 pts) --------------------
  { id:'L5q01', level:5, type:'sa', text:'What is the special name for a regular triangle?',
    shape:'triangle', answer:'equilateral triangle', accept:['equilateral'] },
  { id:'L5q02', level:5, type:'mc', text:'Which statement is TRUE?',
    options:['All rectangles are regular','A regular pentagon has 5 equal sides AND 5 equal angles','A trapezium has 2 pairs of parallel sides','All quadrilaterals are squares'], answer:1 },
  { id:'L5q03', level:5, type:'sa', text:'A polygon where all sides AND all angles are equal is called a __ shape.',
    answer:'regular', accept:[] },
  { id:'L5q04', level:5, type:'mc', text:'Choose the most correct name for this shape.',
    shape:'irregHexagonBook',
    options:['Regular hexagon','Irregular hexagon','Pentagon','Octagon'], answer:1 },
  { id:'L5q05', level:5, type:'sa', text:'A 4-sided shape with 4 equal sides and 4 right angles is a __ . (one word)',
    shape:'square', answer:'square', accept:[] },
  { id:'L5q06', level:5, type:'mc', text:'A regular octagon has how many EQUAL ANGLES?',
    shape:'regOctagon', options:['6','7','8','10'], answer:2 },
  { id:'L5q07', level:5, type:'mc', text:'Look at this parallelogram. Why is it NOT a rectangle?',
    shape:'parallelogram',
    options:['Its sides are not all equal','It has parallel sides','Its angles are not right angles','It has only 3 sides'], answer:2 },
  { id:'L5q08', level:5, type:'sa', text:'A 4-sided shape with EXACTLY 1 pair of parallel sides is a __ .',
    shape:'trapezium', answer:'trapezium', accept:['trapezoid'] },
  { id:'L5q09', level:5, type:'mc', text:'Why is this hexagon called IRREGULAR?',
    shape:'irregHexagonBook',
    options:['It has more than 6 sides','Its sides and/or angles are not all equal','It has fewer than 6 sides','It is rotated upside down'], answer:1 },
  { id:'L5q10', level:5, type:'mc', text:'Which property is shared by BOTH a rectangle AND a square?',
    options:['All sides are equal','4 right angles','Only 1 pair of parallel sides','No parallel sides'], answer:1 },
];

// Helpers
window.QUESTIONS_BY_LEVEL = (() => {
  const byLevel = {1:[],2:[],3:[],4:[],5:[]};
  window.QUESTIONS.forEach(q => byLevel[q.level].push(q));
  return byLevel;
})();

// Normalize a short-answer string for comparison
window.normaliseAnswer = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g,' ');

// Check whether a short-answer response is correct
window.checkSA = (q, given) => {
  const g = window.normaliseAnswer(given);
  if (!g) return false;
  if (g === window.normaliseAnswer(q.answer)) return true;
  if (Array.isArray(q.accept)) {
    for (const a of q.accept) {
      if (g === window.normaliseAnswer(a)) return true;
    }
  }
  return false;
};
