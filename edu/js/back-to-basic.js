// =============================================================
//  Back to Basic — six-stage subtraction diagnosis test.
//
//  STAGES (model of what happens in a learner's brain when they
//  see "7 − 3", from "Concrete → Pictorial → Abstract"):
//    1) Recognise symbols          eyes see 7, −, 3
//    2) Understand the meaning     "take away" / "what's left"
//    3) Hold the quantity          7 dots, fingers, ten-frame
//    4) Choose a strategy          count back, fingers, facts
//    5) Working memory             keep the steps in your head
//    6) Final answer               read it / say it / write it
//
//  Each stage has 5 questions. Pass rules:
//    - If the FIRST 2 questions are both correct → advance early
//    - Otherwise finish all 5; advance if ≥ 3 of 5 are correct,
//      stay if ≥ 3 of 5 are wrong.
//
//  Progress is saved per-student to wc_users.basic_stage (JSONB).
//  Teachers see it in the Maths Insights tab on the dashboard.
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);
  const me = window.WCAuth && window.WCAuth.session();
  if (!me) { window.location.href = './index.html'; return; }

  // ---- Stage definitions -----------------------------------------
  const STAGES = [
    {
      id: 1,
      name: 'Recognise the symbols',
      blurb: 'See the numbers and the take-away sign.',
      questions: [
        { q: 'What does this sign mean?  <span class="op">−</span>',
          choices: ['Plus (add)', 'Minus (take away)', 'Equals', 'Times'],
          answer: 1,
          why: 'The "−" sign means MINUS. It tells us to take some away from a bigger number.' },
        { q: 'Which one is the subtraction sign?',
          choices: ['+', '×', '−', '='],
          answer: 2,
          why: 'The "−" is the minus / subtraction sign. The others are plus, times, and equals.' },
        { q: 'Read this number out loud:  <span class="num">7</span>',
          choices: ['five', 'six', 'seven', 'eight'],
          answer: 2,
          why: 'The numeral 7 is read as "seven".' },
        { q: '"Take away" is another way to say…',
          choices: ['add', 'subtract', 'multiply', 'measure'],
          answer: 1,
          why: '"Take away" and "subtract" mean the same thing — remove some from a group.' },
        { q: 'In "5 <span class="op">−</span> 2 <span class="op">=</span> ?", the "=" means…',
          choices: ['plus', 'is the same as', 'minus', 'and'],
          answer: 1,
          why: 'The "=" sign means "is the same as". Both sides of "=" have the same value.' },
      ],
    },
    {
      id: 2,
      name: 'Understand the meaning',
      blurb: 'Picture the take-away story in your head.',
      questions: [
        { q: 'You have 🍎🍎🍎🍎🍎 (5 apples). You eat 2. How many are left?',
          choices: ['7', '3', '5', '2'],
          answer: 1,
          why: 'Start with 5 apples, take 2 away (eaten). 5 − 2 = 3 left.' },
        { q: 'Which story matches "6 <span class="op">−</span> 4"?',
          choices: [
            'You have 6 books and get 4 more.',
            'You have 6 cookies and eat 4.',
            'You count to 64.',
            'You see 6 and 4 next to each other.',
          ],
          answer: 1,
          why: '"6 − 4" means starting with 6 and taking 4 away. Eating 4 of the 6 cookies fits.' },
        { q: 'In "8 <span class="op">−</span> 3 <span class="op">=</span> 5", what does the 5 stand for?',
          choices: ['what we started with', 'what we took away', 'what is left', 'a sign'],
          answer: 2,
          why: 'After taking 3 away from 8, the 5 is what is LEFT — the answer.' },
        { q: 'If you have 10 marbles and you LOSE 4, which sign do you need?',
          choices: ['+', '−', '×', '÷'],
          answer: 1,
          why: '"Lose" means take away, so we use the minus sign: 10 − 4.' },
        { q: 'Pick the take-away story.',
          choices: [
            'I had 3 cats. Two more came. Now I have 5.',
            'I had 5 stickers. I gave 2 away. Now I have 3.',
            'I have 2 hands and 5 fingers on each.',
            'I count 5 birds in a tree.',
          ],
          answer: 1,
          why: 'Giving 2 stickers away is a "take away" — that\'s subtraction. The others are adding or counting.' },
      ],
    },
    {
      id: 3,
      name: 'Hold the quantity in your head',
      blurb: 'Build the amount before you take any away.',
      questions: [
        { q: 'Which group has exactly 7 dots?',
          choices: ['• • • • •', '• • • • • •', '• • • • • • •', '• • • • • • • •'],
          answer: 2,
          why: 'Count the dots: 1, 2, 3, 4, 5, 6, 7. Seven dots in the third group.' },
        { q: 'How many fingers do you hold up to show 5?',
          choices: ['3', '4', '5', '10'],
          answer: 2,
          why: 'One whole hand has 5 fingers — that is exactly 5.' },
        { q: 'Which number is BIGGER?',
          choices: ['6', '9', 'They are the same', 'Neither'],
          answer: 1,
          why: '9 is bigger than 6. You can check by counting up: 7, 8, 9 — three more than 6.' },
        { q: 'A ten-frame has 10 spots. If 8 are filled with dots, how many spots are EMPTY?',
          choices: ['1', '2', '3', '8'],
          answer: 1,
          why: '10 spots total minus 8 filled = 2 empty.' },
        { q: 'Which set has more — 🐶🐶🐶🐶 or 🐱🐱🐱🐱🐱🐱?',
          choices: ['Dogs', 'Cats', 'Same', 'Can\'t tell'],
          answer: 1,
          why: '4 dogs vs 6 cats — there are more cats.' },
      ],
    },
    {
      id: 4,
      name: 'Choose a strategy',
      blurb: 'Count back, use fingers, or use a number fact.',
      questions: [
        { q: 'To find 9 <span class="op">−</span> 4, you start at 9 and count back. Which list shows the right counting-back?',
          choices: ['9, 8, 7', '8, 7, 6, 5', '5, 4, 3, 2', '9, 10, 11, 12'],
          answer: 1,
          why: 'Count back FOUR times from 9: 8, 7, 6, 5. The last number, 5, is the answer.' },
        { q: 'If 3 + 4 = 7, then 7 <span class="op">−</span> 3 is…',
          choices: ['10', '4', '5', '3'],
          answer: 1,
          why: 'Addition and subtraction are linked. Since 3 + 4 = 7, taking 3 away from 7 leaves 4.' },
        { q: '6 <span class="op">−</span> 2 = ?  (use fingers or count back)',
          choices: ['8', '4', '3', '5'],
          answer: 1,
          why: 'Six fingers up, fold down 2 — four fingers left. So 6 − 2 = 4.' },
        { q: 'To work out 8 <span class="op">−</span> 6 quickly, you remember 6 + 2 = 8. So 8 <span class="op">−</span> 6 = …',
          choices: ['6', '2', '14', '4'],
          answer: 1,
          why: 'If 6 plus 2 makes 8, then taking 6 away from 8 leaves 2. Same number fact, both directions.' },
        { q: '5 <span class="op">−</span> 5 = ?',
          choices: ['10', '0', '5', '1'],
          answer: 1,
          why: 'If you take ALL of them away, nothing is left. Any number minus itself is 0.' },
      ],
    },
    {
      id: 5,
      name: 'Use your working memory',
      blurb: 'Hold the steps in your mind without forgetting.',
      questions: [
        { q: 'You count back from 8 by 3 steps: 7, 6, 5. So 8 <span class="op">−</span> 3 = ?',
          choices: ['7', '5', '4', '6'],
          answer: 1,
          why: 'The LAST number you say after counting back the right number of steps is the answer. 5 is correct.' },
        { q: 'For 10 <span class="op">−</span> 7, how many times must you count back?',
          choices: ['3', '7', '10', '4'],
          answer: 1,
          why: 'You count back SEVEN times. (Tip: it\'s easier to count UP from 7 to 10 — that\'s 3.)' },
        { q: 'You started at 9. You counted back four times: 8, 7, 6, 5. What is 9 <span class="op">−</span> 4?',
          choices: ['4', '5', '6', '3'],
          answer: 1,
          why: 'After 4 steps back from 9, you landed on 5. So 9 − 4 = 5.' },
        { q: 'Doing 9 <span class="op">−</span> 5 in your head you say "8, 7, 6, 5, 4". The answer is the LAST number you said. What is it?',
          choices: ['5', '4', '9', '3'],
          answer: 1,
          why: 'The last number you said was 4. That\'s the answer.' },
        { q: 'While doing 6 <span class="op">−</span> 2 you say "5, 4". What\'s the answer?',
          choices: ['5', '4', '6', '2'],
          answer: 1,
          why: 'You counted back 2 times: 5, 4. The last one is the answer. 6 − 2 = 4.' },
      ],
    },
    {
      id: 6,
      name: 'Write your final answer',
      blurb: 'Say it, check it, write it down.',
      questions: [
        { q: '7 <span class="op">−</span> 4 = ?',
          choices: ['11', '3', '4', '2'],
          answer: 1,
          why: 'Count back from 7: 6, 5, 4 — three steps. So 7 − 4 = 3.' },
        { q: '9 <span class="op">−</span> 6 = ?',
          choices: ['3', '4', '15', '5'],
          answer: 0,
          why: 'Count back from 9: 8, 7, 6, 5, 4, 3 — six steps. So 9 − 6 = 3.' },
        { q: '10 <span class="op">−</span> 8 = ?',
          choices: ['1', '2', '18', '3'],
          answer: 1,
          why: '10 = 8 + 2, so 10 − 8 = 2.' },
        { q: '8 <span class="op">−</span> 0 = ?',
          choices: ['0', '8', '1', '7'],
          answer: 1,
          why: 'Taking away nothing leaves the same amount. 8 − 0 = 8.' },
        { q: '6 <span class="op">−</span> 6 = ?',
          choices: ['6', '0', '12', '1'],
          answer: 1,
          why: 'Take all 6 away and nothing remains. 6 − 6 = 0.' },
      ],
    },
  ];

  // ---- Per-student state -----------------------------------------
  // Loaded from / saved to wc_users.basic_stage. Default = stage 1.
  let state = {
    currentStage: 1,
    results: {},       // {"1": {correct, total}, ...}
    completed: false,
  };

  // ---- Local session state ---------------------------------------
  let qIndex = 0;          // 0..4 within the current stage's 5 Qs
  let correctCount = 0;
  let picked = -1;
  let answered = false;

  // ---- Boot -------------------------------------------------------
  (async function init() {
    try {
      const rows = await window.WCDB.users.byIds
        ? await window.WCDB.users.byIds([me.id])
        : null;
      const fresh = rows && rows[0];
      if (fresh && fresh.basic_stage && typeof fresh.basic_stage === 'object') {
        state = Object.assign(state, fresh.basic_stage);
      }
    } catch (e) { console.warn('basic_stage load failed', e); }
    if (state.completed) renderAllDone();
    else                  startStage(state.currentStage);
  })();

  function currentStageObj() {
    return STAGES.find(s => s.id === state.currentStage);
  }

  function startStage(stageId) {
    state.currentStage = stageId;
    qIndex = 0;
    correctCount = 0;
    renderQuestion();
  }

  function renderQuestion() {
    const stage = currentStageObj();
    if (!stage) { renderAllDone(); return; }
    picked = -1;
    answered = false;

    $('stageInfo').textContent = `Stage ${stage.id} — ${stage.name}`;
    $('qInfo').textContent     = `Question ${qIndex + 1} / ${stage.questions.length}`;
    $('barFill').style.width   = (((qIndex) / stage.questions.length) * 100) + '%';

    const q = stage.questions[qIndex];
    const card = $('card');
    card.innerHTML = `
      <div class="btb-stage-label">Stage ${stage.id}</div>
      <div class="btb-stage-name">${stage.blurb}</div>
      <div class="btb-q">${q.q}</div>
      <div class="btb-choices">
        ${q.choices.map((c, i) =>
          `<button class="btb-choice" data-i="${i}">
             <span class="btb-choice-label">${'ABCD'[i]}</span>${c}
           </button>`
        ).join('')}
      </div>
      <div class="btb-feedback" id="feedback">
        <h4 id="fbTitle"></h4>
        <p id="fbBody"></p>
      </div>
      <div class="btb-actions">
        <button class="btb-next" id="nextBtn" disabled>Next →</button>
      </div>
    `;
    card.querySelectorAll('.btb-choice').forEach(b => {
      b.addEventListener('click', () => pickChoice(parseInt(b.dataset.i, 10)));
    });
    $('nextBtn').addEventListener('click', onNext);
  }

  function pickChoice(i) {
    if (answered) return;
    answered = true;
    picked = i;
    const stage = currentStageObj();
    const q = stage.questions[qIndex];
    const isOk = (i === q.answer);
    if (isOk) correctCount++;

    document.querySelectorAll('.btb-choice').forEach((b, idx) => {
      b.disabled = true;
      if (idx === q.answer) b.classList.add('correct');
      else if (idx === picked) b.classList.add('wrong');
    });

    const fb = $('feedback');
    fb.classList.add('show', isOk ? 'ok' : 'err');
    $('fbTitle').textContent = isOk ? 'Great work! ✓' : 'Almost — here is why';
    $('fbBody').innerHTML = q.why;
    $('nextBtn').disabled = false;
  }

  function onNext() {
    const stage = currentStageObj();
    qIndex++;

    // Early-advance rule: first 2 questions both correct → pass.
    if (qIndex === 2 && correctCount === 2) {
      finishStage(true, /*early*/ true);
      return;
    }
    if (qIndex >= stage.questions.length) {
      // Standard end: 3+ correct = pass, else stay.
      const passed = correctCount >= 3;
      finishStage(passed, false);
      return;
    }
    renderQuestion();
  }

  function finishStage(passed, early) {
    const stage = currentStageObj();
    // Save score (use the count of answered questions as "total").
    const totalAnswered = qIndex;
    state.results = state.results || {};
    state.results[String(stage.id)] = {
      correct: correctCount,
      total:   totalAnswered,
    };
    if (passed) {
      // Move on; if this was the LAST stage, mark all done.
      if (stage.id >= STAGES.length) {
        state.completed = true;
      } else {
        state.currentStage = stage.id + 1;
      }
    }
    saveProgress();
    renderSummary(passed, early, totalAnswered);
  }

  async function saveProgress() {
    if (!me.id || String(me.id).startsWith('guest-')) return;
    try {
      await window.WCDB.users.update(me.id, { basic_stage: state });
      // Refresh cached session so the teacher dashboard sees fresh data.
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw); u.basic_stage = state;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch (e) { console.warn('basic_stage save failed', e); }
  }

  function renderSummary(passed, early, totalAnswered) {
    const stage = currentStageObj();
    $('stageInfo').textContent = `Stage ${stage.id} — ${stage.name}`;
    $('qInfo').textContent     = '';
    $('barFill').style.width   = '100%';

    if (state.completed) {
      renderAllDone();
      return;
    }
    const verdict = passed
      ? (early
        ? `You nailed the first 2! Moving on to stage ${stage.id + 1 || stage.id}.`
        : `You passed stage ${stage.id}. Moving on to stage ${stage.id + 1 || stage.id}.`)
      : `Let's stay on stage ${stage.id} and try again.`;
    const cardCls = passed ? 'ok' : 'stay';
    $('card').innerHTML = `
      <div class="btb-summary">
        <h2>${passed ? 'Stage passed! 🎉' : 'Try once more!'}</h2>
        <div class="big-score">
          <span class="num">${correctCount}</span>
          <span class="total"> / ${totalAnswered}</span>
        </div>
        <div class="verdict ${cardCls}">${verdict}</div>
        <button class="btb-next" id="continueBtn">${passed ? `Start stage ${state.currentStage} →` : 'Try this stage again →'}</button>
      </div>
    `;
    $('continueBtn').addEventListener('click', () => {
      startStage(state.currentStage);
    });
  }

  function renderAllDone() {
    $('stageInfo').textContent = 'All stages cleared';
    $('qInfo').textContent     = '';
    $('barFill').style.width   = '100%';
    $('card').innerHTML = `
      <div class="btb-summary">
        <h2>🏆 Brilliant work!</h2>
        <div class="all-done">Now you're ready to solve the mental subtraction questions.</div>
        <p style="color:#6b7280; font-size:14px;">Per-stage scores are saved for your teacher.</p>
        <button class="btb-restart" id="restartBtn">Start over from stage 1</button>
      </div>
    `;
    $('restartBtn').addEventListener('click', () => {
      state = { currentStage: 1, results: {}, completed: false };
      saveProgress();
      startStage(1);
    });
  }
})();
