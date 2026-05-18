// =============================================================
//  Back to Basic — five-stage subtraction diagnosis test with
//  remediation loops on stages 1–4.
//
//  STAGES (the cognitive chain for "7 − 3"):
//    1) Recognise symbols          eyes see 7, −, 3
//    2) Understand the meaning     "take away" / "what's left"
//    3) Hold the quantity          fingers, dots, ten-frame
//    4) Choose a strategy          count back / facts / fingers
//    5) Working memory             hold the steps in your head
//
//  Initial test (5 questions) per stage. Pass rules:
//    - first 2 both correct → advance early
//    - else after 5 questions: ≥ 3 correct → advance, else fail
//
//  Remediation loop (stages 1–4 only). Triggered on a fail:
//    - 1 lead-in question → concept explanation page
//    - 6 more questions (total 7)
//    - need ≥ 6 / 7 correct AND student confirms "Ready?" → advance
//    - else stay on the stage; can retry remediation
//
//  Passing stage 5 → "Now you're ready..." final message.
//  All scores (initial + remediation) saved to wc_users.basic_stage.
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);
  const me = window.WCAuth && window.WCAuth.session();
  if (!me) { window.location.href = './index.html'; return; }

  // Choices are listed in DEFINITION ORDER with the correct one at
  // `answer` index. shuffleQuestion() randomises the display order
  // each time the question is rendered, so over a stage A/B/C/D end
  // up roughly even regardless of how I wrote the data.
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
        { q: 'In  <span class="num">5</span> <span class="op">−</span> <span class="num">2</span> <span class="op">=</span> <span class="num">?</span>, what does the "=" mean?',
          choices: ['plus', 'is the same as', 'minus', 'and'],
          answer: 1,
          why: 'The "=" sign means "is the same as". Both sides of "=" have the same value.' },
      ],
      remediation: {
        concept:
          'The <strong>−</strong> sign means <strong>take away</strong> (subtract). ' +
          'It is different from <strong>+</strong> (add), <strong>×</strong> (times), and <strong>=</strong> (is the same as).<br><br>' +
          'When you read a subtraction question, name each part:<br>' +
          '• the first number (how many you start with)<br>' +
          '• the <strong>−</strong> sign (take away)<br>' +
          '• the second number (how many you take away)<br>' +
          '• the <strong>=</strong> sign (is the same as)',
        questions: [
          { q: 'What does this sign mean?  <span class="op">+</span>',
            choices: ['add', 'subtract', 'times', 'divide'],
            answer: 0,
            why: 'The "+" sign means add — put more together.' },
          { q: 'What does this sign mean?  <span class="op">×</span>',
            choices: ['subtract', 'times', 'equals', 'add'],
            answer: 1,
            why: 'The "×" sign means times (multiply).' },
          { q: 'Which sign means "take away"?',
            choices: ['+', '−', '×', '='],
            answer: 1,
            why: 'The "−" sign always means take away (subtract).' },
          { q: 'Read this number out loud:  <span class="num">8</span>',
            choices: ['six', 'seven', 'eight', 'nine'],
            answer: 2,
            why: 'The numeral 8 is read as "eight".' },
          { q: 'Read this number out loud:  <span class="num">4</span>',
            choices: ['two', 'three', 'four', 'five'],
            answer: 2,
            why: 'The numeral 4 is read as "four".' },
          { q: 'Which sentence uses the minus sign correctly?',
            choices: ['5 = 5 + 5', '5 − 2 = 3', '5 × 5 = 25', '5 + 5 = 10'],
            answer: 1,
            why: '"5 − 2 = 3" is subtraction. The others are equals, times, and add.' },
          { q: '"<span class="num">9</span> <span class="op">−</span> <span class="num">3</span>" tells you to…',
            choices: ['put 9 and 3 together', 'take 3 away from 9', 'count to 9 then to 3', 'do nothing'],
            answer: 1,
            why: 'The "−" tells you to take the second number AWAY from the first.' },
        ],
      },
    },

    {
      id: 2,
      name: 'Understand the meaning',
      blurb: 'Picture the take-away story in your head.',
      questions: [
        { q: 'You have 🍎🍎🍎🍎🍎 (<span class="num">5</span> apples). You eat <span class="num">2</span>. How many are left?',
          choices: ['7', '3', '5', '2'],
          answer: 1,
          why: 'Start with 5 apples, take 2 away (eaten). 5 − 2 = 3 left.' },
        { q: 'Which story matches <span class="num">6</span> <span class="op">−</span> <span class="num">4</span>?',
          choices: [
            'You have 6 books and get 4 more.',
            'You have 6 cookies and eat 4.',
            'You count to 64.',
            'You see 6 and 4 next to each other.',
          ],
          answer: 1,
          why: '"6 − 4" means starting with 6 and taking 4 away. Eating 4 of the 6 cookies fits.' },
        { q: 'In <span class="num">8</span> <span class="op">−</span> <span class="num">3</span> <span class="op">=</span> <span class="num">5</span>, what does the 5 stand for?',
          choices: ['what we started with', 'what we took away', 'what is left', 'a sign'],
          answer: 2,
          why: 'After taking 3 away from 8, the 5 is what is LEFT — the answer.' },
        { q: 'You have <span class="num">10</span> marbles and LOSE <span class="num">4</span>. Which sign do you need?',
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
          why: 'Giving 2 stickers away is a "take away" — that\'s subtraction.' },
      ],
      remediation: {
        concept:
          'Subtraction tells a <strong>take-away story</strong>. ' +
          'You start with a number, REMOVE some, then count what is LEFT.<br><br>' +
          'Words that mean take away:<br>' +
          '• eat, lose, give away, drop, break, leave, pop<br>' +
          '• "how many are left?" / "how many do you have now?"<br><br>' +
          'When you see <strong>10 − 4</strong>, read it as: ' +
          '<em>"I had 10. Take away 4. How many are left?"</em>',
        questions: [
          { q: 'You had <span class="num">8</span> stickers and gave <span class="num">3</span> away. Which sign do you use?',
            choices: ['+', '−', '×', '='],
            answer: 1,
            why: '"Gave away" is take away — use the minus sign: 8 − 3.' },
          { q: '"<span class="num">10</span> take away <span class="num">6</span>" is the same as…',
            choices: ['10 + 6', '10 − 6', '10 × 6', '6 − 10'],
            answer: 1,
            why: '"Take away" is what the "−" sign means. So 10 take away 6 = 10 − 6.' },
          { q: 'You eat <span class="num">4</span> of <span class="num">7</span> cookies. How many cookies are LEFT?',
            choices: ['11', '4', '3', '7'],
            answer: 2,
            why: '7 − 4 = 3 cookies left after eating 4.' },
          { q: '<span class="num">9</span> birds in a tree. <span class="num">3</span> fly away. How many stay?',
            choices: ['12', '3', '9', '6'],
            answer: 3,
            why: '9 − 3 = 6 birds still in the tree.' },
          { q: 'What does "what is left" mean in subtraction?',
            choices: ['the answer (the remaining amount)', 'the starting number', 'the sign', 'the bigger number'],
            answer: 0,
            why: '"What is left" = the answer = how many are still there after taking some away.' },
          { q: 'You START with more and END with less. You probably did…',
            choices: ['addition', 'subtraction', 'multiplication', 'counting up'],
            answer: 1,
            why: 'When the amount goes DOWN, it\'s subtraction — something was taken away.' },
          { q: 'Pick the take-away story:',
            choices: [
              'I have 4 dogs and 2 cats. Total = 6 pets.',
              'I had 7 sweets and shared 3 with friends. I have 4 left.',
              'I went to the shop and back.',
              'There are 8 boys and 5 girls in our class.',
            ],
            answer: 1,
            why: 'Sharing 3 sweets is "giving 3 away" — that\'s subtraction. 7 − 3 = 4.' },
        ],
      },
    },

    {
      id: 3,
      name: 'Hold the quantity in your head',
      blurb: 'Build the amount before you take any away.',
      questions: [
        { q: 'Which group has exactly <span class="num">7</span> dots?',
          choices: ['• • • • •', '• • • • • •', '• • • • • • •', '• • • • • • • •'],
          answer: 2,
          why: 'Count: 1, 2, 3, 4, 5, 6, 7 — seven dots in the third group.' },
        { q: 'How many fingers do you hold up to show <span class="num">5</span>?',
          choices: ['3', '4', '5', '10'],
          answer: 2,
          why: 'One whole hand has 5 fingers — that is exactly 5.' },
        { q: 'Which number is BIGGER?',
          choices: ['6', '9', 'They are the same', 'Neither'],
          answer: 1,
          why: '9 is bigger than 6. Count up from 6: 7, 8, 9 — three more.' },
        { q: 'A ten-frame has <span class="num">10</span> spots. If <span class="num">8</span> are filled, how many spots are EMPTY?',
          choices: ['1', '2', '3', '8'],
          answer: 1,
          why: '10 spots minus 8 filled = 2 empty.' },
        { q: 'Which set has more — 🐶🐶🐶🐶 or 🐱🐱🐱🐱🐱🐱?',
          choices: ['Dogs', 'Cats', 'Same', 'Can\'t tell'],
          answer: 1,
          why: '4 dogs vs 6 cats — there are more cats.' },
      ],
      remediation: {
        concept:
          'Before you can subtract, you need to <strong>feel how big the number is</strong>.<br><br>' +
          '• Show it with <strong>fingers</strong>: 7 fingers up.<br>' +
          '• Picture it with <strong>dots</strong>: ●●●●●●●<br>' +
          '• Use a <strong>ten-frame</strong> (5 + 5 = 10):<br>' +
          '<span style="font-family: monospace; font-size: 18px;">[ ●●●●● ]<br>[ ●●     ]</span>  = 7<br><br>' +
          'Knowing a number is not the same as <em>feeling</em> the amount. Always picture the quantity first!',
        questions: [
          { q: 'Show <span class="num">6</span> with fingers. How many fingers up?',
            choices: ['4', '5', '6', '10'],
            answer: 2,
            why: 'Six means SIX fingers up — one whole hand (5) plus 1 more.' },
          { q: 'Count the dots: ●●●●●●●●●',
            choices: ['7', '8', '9', '10'],
            answer: 2,
            why: 'Nine dots — count them one by one: 1, 2, 3, 4, 5, 6, 7, 8, 9.' },
          { q: 'A ten-frame has <span class="num">10</span> spots. <span class="num">7</span> are filled. How many empty?',
            choices: ['7', '3', '4', '10'],
            answer: 1,
            why: '10 − 7 = 3 empty spots.' },
          { q: 'Which is BIGGER, <span class="num">8</span> or <span class="num">5</span>?',
            choices: ['5', '8', 'same', 'can\'t tell'],
            answer: 1,
            why: '8 is bigger. Count up: 5, 6, 7, 8 — three more.' },
          { q: 'Which number is BETWEEN <span class="num">4</span> and <span class="num">6</span>?',
            choices: ['3', '5', '7', '10'],
            answer: 1,
            why: '5 sits in the middle: 4, 5, 6.' },
          { q: 'Pick the SMALLEST number: <span class="num">3</span>, <span class="num">7</span>, <span class="num">1</span>, <span class="num">9</span>.',
            choices: ['3', '7', '1', '9'],
            answer: 2,
            why: '1 is the smallest of the four numbers.' },
          { q: 'How many butterflies?  🦋🦋🦋🦋',
            choices: ['2', '3', '4', '5'],
            answer: 2,
            why: 'Count them: 1, 2, 3, 4 — four butterflies.' },
        ],
      },
    },

    {
      id: 4,
      name: 'Choose a strategy',
      blurb: 'Count back, use fingers, or use a number fact.',
      questions: [
        { q: 'To find <span class="num">9</span> <span class="op">−</span> <span class="num">4</span>, you start at 9 and count back. Which list shows the right counting-back?',
          choices: ['9, 8, 7', '8, 7, 6, 5', '5, 4, 3, 2', '9, 10, 11, 12'],
          answer: 1,
          why: 'Count back FOUR times from 9: 8, 7, 6, 5. The last number, 5, is the answer.' },
        { q: 'If <span class="num">3</span> <span class="op">+</span> <span class="num">4</span> <span class="op">=</span> <span class="num">7</span>, then <span class="num">7</span> <span class="op">−</span> <span class="num">3</span> is…',
          choices: ['10', '4', '5', '3'],
          answer: 1,
          why: 'Addition and subtraction are linked. Since 3 + 4 = 7, taking 3 away from 7 leaves 4.' },
        { q: '<span class="num">6</span> <span class="op">−</span> <span class="num">2</span> = ?  (use fingers or count back)',
          choices: ['8', '4', '3', '5'],
          answer: 1,
          why: 'Six fingers up, fold down 2 — four fingers left. So 6 − 2 = 4.' },
        { q: 'To work out <span class="num">8</span> <span class="op">−</span> <span class="num">6</span> quickly, you remember <span class="num">6</span> <span class="op">+</span> <span class="num">2</span> <span class="op">=</span> <span class="num">8</span>. So <span class="num">8</span> <span class="op">−</span> <span class="num">6</span> = …',
          choices: ['6', '2', '14', '4'],
          answer: 1,
          why: 'If 6 plus 2 makes 8, then taking 6 away from 8 leaves 2. Same number fact, both directions.' },
        { q: '<span class="num">5</span> <span class="op">−</span> <span class="num">5</span> = ?',
          choices: ['10', '0', '5', '1'],
          answer: 1,
          why: 'If you take ALL of them away, nothing is left. Any number minus itself is 0.' },
      ],
      remediation: {
        concept:
          'Three ways to subtract small numbers:<br><br>' +
          '<strong>1. Count back.</strong> Start at the bigger number, count back the smaller number of times.<br>' +
          'e.g. 9 − 4 → 8, 7, 6, 5 → answer 5.<br><br>' +
          '<strong>2. Use your fingers.</strong> Put up the bigger number, fold down the smaller number, count what is left.<br><br>' +
          '<strong>3. Use a number fact.</strong> If you remember 3 + 4 = 7, then you also know 7 − 3 = 4 and 7 − 4 = 3.<br><br>' +
          'Special rules: any number − 0 = the same number. Any number − itself = 0.',
        questions: [
          { q: 'Count back from <span class="num">8</span> one time. What number do you say?',
            choices: ['9', '7', '8', '6'],
            answer: 1,
            why: 'One back from 8 is 7.' },
          { q: 'Count back from <span class="num">10</span> two times. What number do you say last?',
            choices: ['9', '8', '7', '12'],
            answer: 1,
            why: '10 → 9 → 8. Two steps back from 10 is 8.' },
          { q: 'For <span class="num">9</span> <span class="op">−</span> <span class="num">5</span>, what do you say counting back?',
            choices: ['9, 8, 7, 6, 5', '8, 7, 6, 5, 4', '10, 9, 8, 7, 6', '4, 3, 2, 1, 0'],
            answer: 1,
            why: 'Count back FIVE steps from 9: 8, 7, 6, 5, 4. Answer = 4.' },
          { q: 'Use the fact: <span class="num">4</span> <span class="op">+</span> <span class="num">5</span> <span class="op">=</span> <span class="num">9</span>. So <span class="num">9</span> <span class="op">−</span> <span class="num">4</span> = ?',
            choices: ['5', '13', '4', '9'],
            answer: 0,
            why: 'Same number fact, other way: if 4 + 5 = 9, then 9 − 4 = 5.' },
          { q: 'Use the fact: <span class="num">6</span> <span class="op">+</span> <span class="num">2</span> <span class="op">=</span> <span class="num">8</span>. So <span class="num">8</span> <span class="op">−</span> <span class="num">6</span> = ?',
            choices: ['8', '14', '2', '6'],
            answer: 2,
            why: 'If 6 + 2 = 8, then 8 − 6 = 2.' },
          { q: '<span class="num">7</span> <span class="op">−</span> <span class="num">0</span> = ?',
            choices: ['0', '1', '7', '70'],
            answer: 2,
            why: 'Taking nothing away leaves the same amount. 7 − 0 = 7.' },
          { q: '<span class="num">4</span> <span class="op">−</span> <span class="num">4</span> = ?',
            choices: ['8', '4', '0', '1'],
            answer: 2,
            why: 'Take all of them away, nothing left. Any number minus itself = 0.' },
        ],
      },
    },

    {
      id: 5,
      name: 'Use your working memory',
      blurb: 'Hold the steps in your mind without forgetting.',
      questions: [
        { q: 'You count back from <span class="num">8</span> by 3 steps: 7, 6, 5. So <span class="num">8</span> <span class="op">−</span> <span class="num">3</span> = ?',
          choices: ['7', '5', '4', '6'],
          answer: 1,
          why: 'The LAST number you say after counting the right number of steps is the answer.' },
        { q: 'For <span class="num">10</span> <span class="op">−</span> <span class="num">7</span>, how many times must you count back?',
          choices: ['3', '7', '10', '4'],
          answer: 1,
          why: 'You count back SEVEN times. (Tip: counting UP from 7 to 10 is faster — only 3 steps.)' },
        { q: 'You started at <span class="num">9</span>. You counted back four times: 8, 7, 6, 5. What is <span class="num">9</span> <span class="op">−</span> <span class="num">4</span>?',
          choices: ['4', '5', '6', '3'],
          answer: 1,
          why: 'After 4 steps back from 9, you landed on 5. So 9 − 4 = 5.' },
        { q: 'Doing <span class="num">9</span> <span class="op">−</span> <span class="num">5</span> in your head you say "8, 7, 6, 5, 4". The answer is the LAST number. What is it?',
          choices: ['5', '4', '9', '3'],
          answer: 1,
          why: 'The last number you said was 4. That\'s the answer.' },
        { q: 'While doing <span class="num">6</span> <span class="op">−</span> <span class="num">2</span> you say "5, 4". What\'s the answer?',
          choices: ['5', '4', '6', '2'],
          answer: 1,
          why: 'You counted back 2 times: 5, 4. The last one is the answer. 6 − 2 = 4.' },
      ],
      // No remediation on stage 5 — passing this stage triggers the
      // "ready for mental subtraction" message instead.
    },
  ];

  // ---- Per-student state -----------------------------------------
  //   currentStage:   1..5
  //   results:        { "1": {initial: {correct,total, passed},
  //                            remediation: {correct,total, passed}} }
  //   completed:      true once stage 5 is passed
  //   phase:          which phase the student is in (for resume)
  let state = {
    currentStage: 1,
    results: {},
    completed: false,
  };

  // ---- Local session state ---------------------------------------
  let phase = 'initial';   // 'initial' | 'rem-q1' | 'rem-concept' | 'rem-rest' | 'rem-confirm' | 'summary'
  let qIndex = 0;
  let correctCount = 0;
  let answered = false;
  let currentDisplayQ = null;   // the shuffled question being displayed
  // Daily coin gate — flipped on at the start of a remediation
  // session when the student hasn't already earned BTB coins today.
  // Stops repeat-farming: only the FIRST remediation session of the
  // day pays out, no matter how many sessions the student does.
  let coinsEnabledThisSession = false;
  const todayStr = () => new Date().toISOString().slice(0, 10);

  // ---- Boot -------------------------------------------------------
  (async function init() {
    try {
      const fresh = await window.WCDB.users.byId(me.id);
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

  // ---- Shuffle answer position so distribution is roughly even ---
  // Rebuilds the choices array in random order and recomputes the
  // new correct index. Called every time a question is rendered.
  function shuffleQuestion(q) {
    const n = q.choices.length;
    const idxs = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    const newChoices = idxs.map(i => q.choices[i]);
    const newAnswer  = idxs.indexOf(q.answer);
    return { ...q, choices: newChoices, answer: newAnswer };
  }

  function startStage(stageId) {
    state.currentStage = stageId;
    phase = 'initial';
    qIndex = 0;
    correctCount = 0;
    renderQuestion();
  }

  function startRemediation() {
    phase = 'rem-q1';
    qIndex = 0;
    correctCount = 0;
    // Decide once per session whether THIS session's correct
    // answers will pay coins. Re-checked from the persisted
    // lastCoinDate so it survives reloads.
    const lastDate = state.lastCoinDate && state.lastCoinDate.btb;
    coinsEnabledThisSession = (lastDate !== todayStr());
    renderQuestion();
  }

  function isRemediation() {
    return phase === 'rem-q1' || phase === 'rem-rest';
  }

  function questionPool() {
    const stage = currentStageObj();
    if (!stage) return [];
    return isRemediation() ? (stage.remediation && stage.remediation.questions) || [] : stage.questions;
  }

  // ---- Render: question -----------------------------------------
  function renderQuestion() {
    const stage = currentStageObj();
    if (!stage) { renderAllDone(); return; }
    const pool = questionPool();
    const total = pool.length;
    if (qIndex >= total) { afterAllQuestions(); return; }

    answered = false;
    const baseQ = pool[qIndex];
    currentDisplayQ = shuffleQuestion(baseQ);

    const remediationTag = isRemediation()
      ? `<span class="btb-rem-tag">REMEDIATION</span>`
      : '';
    $('stageInfo').innerHTML = `Stage ${stage.id} — ${stage.name} ${remediationTag}`;
    $('qInfo').textContent   = `Question ${qIndex + 1} / ${total}`;
    $('barFill').style.width = ((qIndex / total) * 100) + '%';

    const card = $('card');
    card.innerHTML = `
      <div class="btb-stage-label">${isRemediation() ? `Stage ${stage.id} · Extra practice` : `Stage ${stage.id}`}</div>
      <div class="btb-stage-name">${stage.blurb}</div>
      <div class="btb-q">${currentDisplayQ.q}</div>
      <div class="btb-choices">
        ${currentDisplayQ.choices.map((c, i) =>
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
    const q = currentDisplayQ;
    const isOk = (i === q.answer);
    if (isOk) correctCount++;

    document.querySelectorAll('.btb-choice').forEach((b, idx) => {
      b.disabled = true;
      if (idx === q.answer) b.classList.add('correct');
      else if (idx === i)   b.classList.add('wrong');
    });

    const fb = $('feedback');
    fb.classList.add('show', isOk ? 'ok' : 'err');
    // Coin reward: every CORRECT answer in remediation is worth 2
    // coins — but ONLY in the FIRST remediation session of the day
    // (the daily-limit gate set in startRemediation). Repeat
    // sessions same day get the cheer but no money — encourages
    // study without enabling coin farming.
    let coinChip = '';
    if (isOk && isRemediation() && coinsEnabledThisSession) {
      bumpCoins(2);
      // Mark the date on the FIRST coin earn so reloading the page
      // mid-session can't reset the cap.
      state.lastCoinDate = state.lastCoinDate || {};
      state.lastCoinDate.btb = todayStr();
      coinChip = ' <span style="display:inline-block; background:#fff5cc; color:#6b4f00; ' +
                 'border:1px solid #e8c970; padding:2px 8px; border-radius:999px; ' +
                 'font-weight:800; margin-left:6px;">+2 💰</span>';
    }
    $('fbTitle').innerHTML = isOk
      ? `Great work! ✓${coinChip}`
      : 'Almost — here is why';
    // In remediation, append an "ask your teacher" hint on wrong
    // answers so the student knows it's OK to get unstuck.
    const teacherHint = (!isOk && isRemediation())
      ? '<br><br><em style="color:#6b7280;">Still confused? Ask your teacher for help! 👋</em>'
      : '';
    $('fbBody').innerHTML = q.why + teacherHint;
    $('nextBtn').disabled = false;
  }

  // ---- Coin bump (shared pattern with encounter.js bumpCoins) ----
  // Adds `delta` coins to wc_users.money and refreshes the cached
  // session so the header counter on /home / /lesson stays in sync
  // with the cloud row.
  async function bumpCoins(delta) {
    if (!delta || !me.id || String(me.id).startsWith('guest-')) return;
    const before = me.money || 0;
    const after  = Math.max(0, before + delta);
    me.money = after;
    try {
      await window.WCDB.users.update(me.id, { money: after });
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw); u.money = after;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch (e) { console.warn('money bump failed', e); }
  }

  function onNext() {
    qIndex++;
    if (phase === 'initial') {
      // Early-advance rule: first 2 both correct → pass.
      if (qIndex === 2 && correctCount === 2) {
        finishInitial(true);
        return;
      }
      if (qIndex >= 5) {
        finishInitial(correctCount >= 3);
        return;
      }
      renderQuestion();
      return;
    }
    if (phase === 'rem-q1') {
      // Just finished the lead-in remediation question → show the
      // concept page before continuing.
      phase = 'rem-concept';
      renderConcept();
      return;
    }
    if (phase === 'rem-rest') {
      const total = questionPool().length;
      if (qIndex >= total) {
        finishRemediation();
        return;
      }
      renderQuestion();
      return;
    }
  }

  // ---- Render: concept page -------------------------------------
  function renderConcept() {
    const stage = currentStageObj();
    const txt = (stage.remediation && stage.remediation.concept) || '';
    $('barFill').style.width = '50%';
    $('qInfo').textContent = 'Concept check';
    const card = $('card');
    card.innerHTML = `
      <div class="btb-stage-label">Stage ${stage.id} · Concept</div>
      <div class="btb-stage-name">${stage.name}</div>
      <div class="btb-concept">${txt}</div>
      <div class="btb-actions">
        <button class="btb-next" id="conceptNext">Try a few more →</button>
      </div>
    `;
    $('conceptNext').addEventListener('click', () => {
      phase = 'rem-rest';
      renderQuestion();
    });
  }

  // ---- Stage flow ------------------------------------------------
  function finishInitial(passed) {
    const stage = currentStageObj();
    state.results = state.results || {};
    state.results[String(stage.id)] = state.results[String(stage.id)] || {};
    state.results[String(stage.id)].initial = {
      correct: correctCount,
      total:   qIndex,
      passed:  passed,
    };
    if (passed) {
      advanceOrComplete();
      saveProgress();
      renderInitialSummary(true);
    } else {
      // Stages 1–4 have remediation. Stage 5 just stays (no remediation).
      const hasRem = !!(stage.remediation && stage.remediation.questions);
      saveProgress();
      renderInitialSummary(false, hasRem);
    }
  }

  function finishRemediation() {
    const stage = currentStageObj();
    const total = questionPool().length;
    state.results[String(stage.id)] = state.results[String(stage.id)] || {};
    state.results[String(stage.id)].remediation = {
      correct: correctCount,
      total:   total,
      passed:  correctCount >= 6,
    };
    saveProgress();
    if (correctCount >= 6) {
      phase = 'rem-confirm';
      renderConfirm();
    } else {
      renderRemSummary(false);
    }
  }

  function advanceOrComplete() {
    const stage = currentStageObj();
    if (stage.id >= STAGES.length) {
      state.completed = true;
    } else {
      state.currentStage = stage.id + 1;
    }
  }

  // ---- Render: initial summary ----------------------------------
  function renderInitialSummary(passed, hasRem) {
    const stage = currentStageObj();
    $('stageInfo').textContent = `Stage ${stage.id} — ${stage.name}`;
    $('qInfo').textContent     = '';
    $('barFill').style.width   = '100%';
    if (state.completed) { renderAllDone(); return; }

    const cardCls = passed ? 'ok' : 'stay';
    let action;
    if (passed) {
      action = `<button class="btb-next" id="continueBtn">Start stage ${state.currentStage} →</button>`;
    } else if (hasRem) {
      action = `<button class="btb-next" id="continueBtn">Let's try extra practice →</button>`;
    } else {
      action = `<button class="btb-next" id="continueBtn">Try this stage again →</button>`;
    }
    $('card').innerHTML = `
      <div class="btb-summary">
        <h2>${passed ? 'Stage passed! 🎉' : 'Not quite yet'}</h2>
        <div class="big-score">
          <span class="num">${correctCount}</span>
          <span class="total"> / ${qIndex}</span>
        </div>
        <div class="verdict ${cardCls}">${
          passed
            ? `You passed stage ${stage.id}. Moving on to stage ${state.currentStage}.`
            : (hasRem
              ? `Let's do some extra practice on stage ${stage.id}.`
              : `Let's stay on stage ${stage.id} and try again.`)
        }</div>
        ${action}
      </div>
    `;
    $('continueBtn').addEventListener('click', () => {
      if (passed) { startStage(state.currentStage); }
      else if (hasRem) { startRemediation(); }
      else { startStage(state.currentStage); }
    });
  }

  // ---- Render: remediation summary + confirmation ----------------
  function renderRemSummary(passed) {
    const stage = currentStageObj();
    const total = questionPool().length;
    $('stageInfo').textContent = `Stage ${stage.id} — ${stage.name}`;
    $('qInfo').textContent     = '';
    $('barFill').style.width   = '100%';
    $('card').innerHTML = `
      <div class="btb-summary">
        <h2>${passed ? 'Great practice! 🎉' : 'Almost there!'}</h2>
        <div class="big-score">
          <span class="num">${correctCount}</span>
          <span class="total"> / ${total}</span>
        </div>
        <div class="verdict ${passed ? 'ok' : 'stay'}">${
          passed
            ? `You got ${correctCount} out of ${total}.`
            : `You need at least 6 out of 7 to be ready to move on. Let's try once more.`
        }</div>
        <button class="btb-next" id="continueBtn">Try the practice again →</button>
      </div>
    `;
    $('continueBtn').addEventListener('click', () => startRemediation());
  }

  function renderConfirm() {
    const stage = currentStageObj();
    const total = questionPool().length;
    $('stageInfo').textContent = `Stage ${stage.id} — ${stage.name}`;
    $('qInfo').textContent     = '';
    $('barFill').style.width   = '100%';
    $('card').innerHTML = `
      <div class="btb-summary">
        <h2>🌟 Nice work!</h2>
        <div class="big-score">
          <span class="num">${correctCount}</span>
          <span class="total"> / ${total}</span>
        </div>
        <div class="verdict ok">You got most of them right!</div>
        <p style="font-size:18px; font-weight:700; margin: 20px 0 14px;">
          Are you ready to move on to stage ${stage.id + 1}?
        </p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button class="btb-next" id="confirmYes">Yes, I'm ready!</button>
          <button class="btb-restart" id="confirmNo">Not yet — practice more</button>
        </div>
      </div>
    `;
    $('confirmYes').addEventListener('click', () => {
      advanceOrComplete();
      saveProgress();
      if (state.completed) renderAllDone();
      else                  startStage(state.currentStage);
    });
    $('confirmNo').addEventListener('click', () => startRemediation());
  }

  // ---- All done --------------------------------------------------
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

  // ---- Persistence ----------------------------------------------
  async function saveProgress() {
    if (!me.id || String(me.id).startsWith('guest-')) return;
    try {
      await window.WCDB.users.update(me.id, { basic_stage: state });
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw); u.basic_stage = state;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch (e) { console.warn('basic_stage save failed', e); }
  }
})();
