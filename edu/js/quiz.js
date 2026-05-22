// =============================================================
//  WordCatch — encounter modal + quiz UI
//
//  Sequence:
//    1. SHOW silhouette + "Quiz time!" splash → student taps "Start"
//    2. Fetch questions from quiz-gpt edge function
//    3. Render MCQs one at a time. Track wrong answers.
//    4. Score ≥ pass threshold (80% Lv 1-5, 90% Lv 6-10) → CAUGHT.
//       Otherwise → GOT AWAY.
//    5. Reveal animal (colour sprite) on success, fade silhouette
//       running off on fail.
//
//  Returns 'caught' | 'failed' to encounter.js, which handles the
//  level-up/down + pet write + coin reward.
//
//  Exposes window.WCQuiz.run(opts).
// =============================================================

(() => {
  let host = null;
  let outcomeResolve = null;

  function ensureHost() {
    if (host) return host;
    host = document.createElement('div');
    host.id = 'wcEncounter';
    host.className = 'wc-encounter-backdrop wc-hidden';
    host.innerHTML = `
      <div class="wc-encounter" role="dialog" aria-modal="true">
        <!-- Dismiss button — top-right corner. Lets the student keep
             reading without taking the quiz. Resolves the encounter
             promise with 'skipped' so encounter.js applies a short
             cooldown (no animal caught, no ceiling change). -->
        <button class="wc-enc-close" id="wcEncClose" type="button"
                aria-label="Close — keep reading" title="Close — keep reading">✕</button>
        <div class="wc-enc-stage">
          <img class="wc-enc-sprite" src="" alt="" />
          <div class="wc-enc-burst wc-hidden">✨</div>
        </div>
        <h2 class="wc-enc-title"></h2>
        <p class="wc-enc-sub"></p>
        <div class="wc-enc-actions"></div>
        <div class="wc-enc-quiz wc-hidden">
          <div class="wc-quiz-progress"></div>
          <div class="wc-quiz-prompt"></div>
          <div class="wc-quiz-choices"></div>
          <div class="wc-quiz-feedback wc-hidden"></div>
        </div>
        <!-- Reward wheel — spun after catching an animal. -->
        <div class="wc-enc-wheel wc-hidden">
          <div class="wc-wheel-pointer" aria-hidden="true"></div>
          <canvas class="wc-wheel-canvas" width="260" height="260"></canvas>
        </div>
      </div>
    `;
    document.body.appendChild(host);
    // Wire the dismiss once, on first ensureHost call. Click closes
    // the modal and resolves with 'skipped'.
    const closeBtn = host.querySelector('#wcEncClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hide();
        finishWith('skipped');
      });
    }
    return host;
  }

  function show() { host.classList.remove('wc-hidden'); }
  function hide() { host.classList.add('wc-hidden'); }

  // ----------------------------------------------------------------
  //  Main entry — run a full encounter and resolve with the outcome.
  // ----------------------------------------------------------------
  function run(opts) {
    ensureHost();
    return new Promise((resolve) => {
      outcomeResolve = resolve;
      const { animalSet, animalIndex, level, questionCount, word, sentence, passage } = opts;
      stageSplash(animalSet, animalIndex, level, async () => {
        // Kor Bar mode → the Korean quiz (cloze / word ↔ meaning),
        // built client-side from the lesson's Korean data.
        if (isKorBar()) {
          showKorBuilding();
          let kq = [];
          try { kq = await buildKorMcqQuestions(questionCount); }
          catch (e) { console.warn('kor quiz build failed', e); }
          if (!kq.length) {
            revealCaught(animalSet, animalIndex, level, '— 퀴즈를 만들 수 없어요 —');
            return;
          }
          runKorQuiz(kq, animalSet, animalIndex, level);
          return;
        }
        let questions = [];
        try {
          questions = await fetchQuestions({ word, sentence, passage, level, count: questionCount });
        } catch (e) {
          console.warn('quiz fetch failed', e);
        }
        if (!questions.length) {
          // No questions → award a freebie (rare; better than nothing).
          revealCaught(animalSet, animalIndex, level, '— quiz unavailable —');
          return;
        }
        runQuiz(questions, animalSet, animalIndex, level);
      });
    });
  }

  // ----------------------------------------------------------------
  //  Stage 1 — silhouette splash with "Start" button
  // ----------------------------------------------------------------
  function stageSplash(animalSet, animalIndex, level, onStart) {
    // Reset modal regions from any previous encounter (e.g. the wheel).
    host.querySelector('.wc-enc-wheel').classList.add('wc-hidden');
    host.querySelector('.wc-enc-stage').classList.remove('wc-hidden');
    const sprite = window.WCAssets.spriteFor(animalSet, animalIndex, true);
    host.querySelector('.wc-enc-sprite').src = sprite;
    host.querySelector('.wc-enc-sprite').className = 'wc-enc-sprite wobble';
    host.querySelector('.wc-enc-burst').classList.add('wc-hidden');
    host.querySelector('.wc-enc-title').textContent = 'Something appeared!';
    host.querySelector('.wc-enc-sub').textContent =
      `It’s a level ${level} mystery animal. Answer ${level === 1 ? 'two questions' : 'a few questions'} to catch it!`;
    host.querySelector('.wc-enc-quiz').classList.add('wc-hidden');

    const actions = host.querySelector('.wc-enc-actions');
    actions.innerHTML = '';
    const start = document.createElement('button');
    start.className = 'wc-btn lg';
    start.textContent = 'Start the quiz! 🎯';
    start.onclick = () => {
      actions.innerHTML = '';
      onStart();
    };
    actions.appendChild(start);
    show();
  }

  async function fetchQuestions({ word, sentence, passage, level, count }) {
    const URL  = (window.WC_SUPABASE && window.WC_SUPABASE.url)  || '';
    const ANON = (window.WC_SUPABASE && window.WC_SUPABASE.anon) || '';
    if (!URL) throw new Error('Supabase not configured');
    const r = await fetch(URL.replace(/\/+$/, '') + '/functions/v1/quiz-gpt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON,
        Authorization: 'Bearer ' + ANON,
      },
      body: JSON.stringify({ word, sentence, passage, level, count }),
    });
    if (!r.ok) throw new Error('quiz-gpt ' + r.status);
    const j = await r.json();
    return Array.isArray(j.questions) ? j.questions : [];
  }

  // ----------------------------------------------------------------
  //  Stage 2 — quiz state machine
  // ----------------------------------------------------------------
  function runQuiz(questions, animalSet, animalIndex, level) {
    const quizWrap = host.querySelector('.wc-enc-quiz');
    quizWrap.classList.remove('wc-hidden');
    host.querySelector('.wc-enc-actions').innerHTML = '';
    host.querySelector('.wc-enc-title').textContent = '';
    host.querySelector('.wc-enc-sub').textContent   = '';

    let idx = 0;
    let correctCount = 0;

    function renderQ() {
      const q = questions[idx];
      host.querySelector('.wc-quiz-progress').textContent =
        `Question ${idx + 1} of ${questions.length}`;
      host.querySelector('.wc-quiz-prompt').textContent = q.prompt;

      const choicesEl = host.querySelector('.wc-quiz-choices');
      choicesEl.innerHTML = '';
      const order = shuffleIndices(q.choices.length);
      order.forEach(origIdx => {
        const btn = document.createElement('button');
        btn.className = 'wc-quiz-choice';
        btn.textContent = q.choices[origIdx];
        btn.onclick = () => onChoice(origIdx, q.correct_index, btn);
        choicesEl.appendChild(btn);
      });
      host.querySelector('.wc-quiz-feedback').classList.add('wc-hidden');
    }

    function onChoice(picked, correct, btn) {
      const choicesEl = host.querySelector('.wc-quiz-choices');
      // disable further input
      [...choicesEl.children].forEach(c => c.disabled = true);
      btn.classList.add(picked === correct ? 'right' : 'wrong');
      // highlight the right one if user got it wrong
      if (picked !== correct) {
        [...choicesEl.children].forEach(c => {
          if (c.textContent === questions[idx].choices[correct]) c.classList.add('right');
        });
      } else {
        correctCount++;
      }
      const fb = host.querySelector('.wc-quiz-feedback');
      fb.textContent = picked === correct ? 'Nice! ✅' : 'Not quite — that one’s noted! 🌱';
      fb.className = 'wc-quiz-feedback ' + (picked === correct ? 'good' : 'soft');
      fb.classList.remove('wc-hidden');

      setTimeout(() => {
        idx++;
        if (idx < questions.length) renderQ();
        else finish();
      }, 900);
    }

    function finish() {
      quizWrap.classList.add('wc-hidden');
      const passNeeded = level <= 5 ? 0.8 : 0.9;   // 80% / 90%
      const ratio = correctCount / questions.length;
      if (ratio >= passNeeded) {
        revealCaught(animalSet, animalIndex, level, `You got ${correctCount} of ${questions.length}!`);
      } else {
        revealFailed(animalSet, animalIndex, level, `You got ${correctCount} of ${questions.length}. Almost!`);
      }
    }

    renderQ();
  }

  // ----------------------------------------------------------------
  //  Stage 3 — outcome reveal
  // ----------------------------------------------------------------
  function revealCaught(animalSet, animalIndex, level, sub) {
    const realSprite  = window.WCAssets.spriteFor(animalSet, animalIndex, false);
    const label       = window.WCAssets.labelFor(animalSet, animalIndex);
    const reward      = 50 * level;
    const sprite = host.querySelector('.wc-enc-sprite');
    sprite.src = realSprite;
    sprite.className = 'wc-enc-sprite reveal';
    host.querySelector('.wc-enc-burst').classList.remove('wc-hidden');
    host.querySelector('.wc-enc-title').textContent = `Caught a ${label}! 🎉`;
    host.querySelector('.wc-enc-sub').textContent   = `${sub} +${reward} coins · level up!`;
    // Catching earns a spin of the reward wheel (screen-time minutes).
    const actions = host.querySelector('.wc-enc-actions');
    actions.innerHTML = '';
    const spin = document.createElement('button');
    spin.className = 'wc-btn lg';
    spin.textContent = '🎡 돌림판 돌리기!';
    spin.onclick = () => runRewardWheel();
    actions.appendChild(spin);
  }

  // ----------------------------------------------------------------
  //  Reward wheel — spun after a catch. 5-10 minutes of screen time
  //  or 꽝 (nothing). A winning spin writes an 'earn' time entry.
  // ----------------------------------------------------------------
  const WHEEL_SEGS = [
    { label: '5분',  min: 5,  color: '#ff8a3d' },
    { label: '6분',  min: 6,  color: '#5cb8ff' },
    { label: '7분',  min: 7,  color: '#6db33a' },
    { label: '8분',  min: 8,  color: '#f0a35e' },
    { label: '9분',  min: 9,  color: '#9b6ef0' },
    { label: '10분', min: 10, color: '#e8527a' },
    { label: '꽝',   min: 0,  color: '#9aa3ad' },
  ];

  function drawWheel(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, cx = W / 2, cy = W / 2, r = W / 2 - 6;
    const n = WHEEL_SEGS.length;
    const seg = (Math.PI * 2) / n;
    ctx.clearRect(0, 0, W, W);
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * seg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a0 + seg);
      ctx.closePath();
      ctx.fillStyle = WHEEL_SEGS[i].color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(WHEEL_SEGS[i].label, r - 14, 0);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  function runRewardWheel() {
    const wheelEl = host.querySelector('.wc-enc-wheel');
    const canvas  = host.querySelector('.wc-wheel-canvas');
    host.querySelector('.wc-enc-stage').classList.add('wc-hidden');
    host.querySelector('.wc-enc-quiz').classList.add('wc-hidden');
    wheelEl.classList.remove('wc-hidden');
    host.querySelector('.wc-enc-title').textContent = '돌림판 찬스! 🎡';
    host.querySelector('.wc-enc-sub').textContent   = '돌림판을 돌려 시간을 받으세요.';
    drawWheel(canvas);
    canvas.style.transition = 'none';
    canvas.style.transform  = 'rotate(0deg)';

    const actions = host.querySelector('.wc-enc-actions');
    actions.innerHTML = '';
    const go = document.createElement('button');
    go.className = 'wc-btn lg';
    go.textContent = '돌리기!';
    go.onclick = () => {
      go.disabled = true;
      const n      = WHEEL_SEGS.length;
      const i      = Math.floor(Math.random() * n);
      const segDeg = 360 / n;
      const jitter = (Math.random() - 0.5) * segDeg * 0.7;
      const finalDeg = 360 * 5 - (i + 0.5) * segDeg + jitter;
      void canvas.offsetWidth;   // commit the reset before transitioning
      canvas.style.transition = 'transform 4s cubic-bezier(.17,.67,.32,1)';
      canvas.style.transform  = `rotate(${finalDeg}deg)`;
      let done = false;
      const onEnd = () => {
        if (done) return;
        done = true;
        canvas.removeEventListener('transitionend', onEnd);
        onWheelResult(WHEEL_SEGS[i]);
      };
      canvas.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 4300);   // fallback if transitionend never fires
    };
    actions.appendChild(go);
  }

  async function onWheelResult(seg) {
    const titleEl = host.querySelector('.wc-enc-title');
    const subEl   = host.querySelector('.wc-enc-sub');
    if (seg.min > 0) {
      titleEl.textContent = `⏰ ${seg.min}분 획득! 🎉`;
      subEl.textContent   = '모은 시간은 홈 화면에서 확인할 수 있어요.';
      try {
        const uid = window.WCLesson && window.WCLesson.me && window.WCLesson.me.id;
        if (uid) await window.WCDB.time.add(uid, 'earn', seg.min, '동물 포획 보상');
      } catch (e) { console.warn('time earn write failed', e); }
    } else {
      titleEl.textContent = '꽝! 😅';
      subEl.textContent   = '아쉬워요 — 다음에 또 도전해요!';
    }
    const actions = host.querySelector('.wc-enc-actions');
    actions.innerHTML = '';
    const ok = document.createElement('button');
    ok.className = 'wc-btn lg';
    ok.textContent = '읽기로 돌아가기';
    ok.onclick = () => { hide(); finishWith('caught'); };
    actions.appendChild(ok);
  }

  function revealFailed(animalSet, animalIndex, level, sub) {
    const sprite = host.querySelector('.wc-enc-sprite');
    sprite.className = 'wc-enc-sprite runaway';
    host.querySelector('.wc-enc-burst').classList.add('wc-hidden');
    host.querySelector('.wc-enc-title').textContent = 'It got away! 💨';
    host.querySelector('.wc-enc-sub').textContent   = `${sub} Next time you'll meet a smaller animal.`;
    const actions = host.querySelector('.wc-enc-actions');
    actions.innerHTML = '';
    const ok = document.createElement('button');
    ok.className = 'wc-btn lg ghost';
    ok.textContent = 'Try again later';
    ok.onclick = () => { hide(); finishWith('failed'); };
    actions.appendChild(ok);
  }

  function finishWith(outcome) {
    if (outcomeResolve) { outcomeResolve(outcome); outcomeResolve = null; }
  }

  // ----------------------------------------------------------------
  //  Helpers
  // ----------------------------------------------------------------
  function shuffleIndices(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ================================================================
  //  KOREAN QUIZ  (Kor Bar mode)
  //
  //  Replaces the English MCQ quiz when the student has "Kor Bar"
  //  selected. Questions are built CLIENT-SIDE from the lesson
  //  sentences up to the last word the student tapped (the scope
  //  WCLesson.quizSentences exposes), using wc-korbar-gpt for the
  //  Korean word meanings + sentence translations.
  //
  //  Step-1 question types (≈ even thirds):
  //    cloze — an original sentence with one word blanked
  //    w2k   — English word → pick the Korean meaning
  //    k2w   — Korean meaning → pick the English word
  //  (Unscramble + comprehension questions arrive in a later step.)
  // ================================================================
  function isKorBar() {
    return document.body.classList.contains('wc-bar-kor');
  }

  // Words a young reader has long mastered — dull quiz subjects.
  const KQ_STOP = new Set((
    'the and but for nor yet so or if in on at to of as is am are was were be been ' +
    'being do does did has have had can could will would shall should may might must ' +
    'this that these those here there then than when where what which who whom whose ' +
    'why how with from they them their your our his her its him she we us you into ' +
    'onto over under about after before again some any all one two more most such ' +
    'also even still just only very really now out off up down too said says say'
  ).split(/\s+/));

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function shuffleInPlace(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // "Building the quiz" placeholder shown while the GPT calls run.
  function showKorBuilding() {
    const quizWrap = host.querySelector('.wc-enc-quiz');
    quizWrap.classList.remove('wc-hidden');
    host.querySelector('.wc-enc-actions').innerHTML = '';
    host.querySelector('.wc-enc-title').textContent = '';
    host.querySelector('.wc-enc-sub').textContent   = '';
    host.querySelector('.wc-quiz-progress').textContent = '';
    host.querySelector('.wc-quiz-prompt').innerHTML =
      '<div class="wc-kq-instr">퀴즈 만드는 중… ✏️</div>';
    host.querySelector('.wc-quiz-choices').innerHTML = '';
    host.querySelector('.wc-quiz-feedback').classList.add('wc-hidden');
  }

  // Build a pool of { en, lower, ko } content words from the scope.
  async function buildKorWordPool(sentences) {
    const seen = new Set();
    const cands = [];
    sentences.forEach(s => {
      (String(s).match(/[A-Za-z][A-Za-z'’-]*/g) || []).forEach(tok => {
        const lo = tok.toLowerCase().replace(/[’]/g, "'");
        if (lo.length < 4 || KQ_STOP.has(lo) || seen.has(lo)) return;
        seen.add(lo);
        cands.push({ en: tok, lower: lo, sentence: s });
      });
    });
    shuffleInPlace(cands);
    const pool = [];
    for (const c of cands.slice(0, 9)) {
      try {
        const info = await window.WCKorBar.fetchWord(c.en, c.sentence);
        if (info && info.ko) pool.push({ en: c.en, lower: c.lower, ko: info.ko });
      } catch {}
      if (pool.length >= 7) break;
    }
    return pool;
  }

  // English word → Korean meaning (w2k) or the reverse (k2w).
  function buildKorWordMeaning(pool, subtype) {
    if (pool.length < 4) return null;
    const order    = shuffleIndices(pool.length);
    const correct  = pool[order[0]];
    const distract = [pool[order[1]], pool[order[2]], pool[order[3]]];
    if (subtype === 'w2k') {
      return { type: 'mcq', subtype: 'w2k', promptWord: correct.en,
               choices: [correct.ko, ...distract.map(d => d.ko)], correctIndex: 0 };
    }
    return { type: 'mcq', subtype: 'k2w', promptWord: correct.ko,
             choices: [correct.en, ...distract.map(d => d.en)], correctIndex: 0 };
  }

  // An original sentence with one content word blanked out.
  async function buildKorCloze(sentences, usedSents) {
    const allContent = [];
    sentences.forEach(s => (String(s).match(/[A-Za-z][A-Za-z'’-]*/g) || []).forEach(w => {
      if (w.length >= 4 && !KQ_STOP.has(w.toLowerCase())) allContent.push(w);
    }));
    const pool = sentences.filter(s => !usedSents.has(s));
    shuffleInPlace(pool);
    for (const sent of pool) {
      const words   = String(sent).match(/[A-Za-z][A-Za-z'’-]*/g) || [];
      const content = words.filter(w => w.length >= 4 && !KQ_STOP.has(w.toLowerCase()));
      if (!content.length) continue;
      usedSents.add(sent);
      const answer  = content[Math.floor(Math.random() * content.length)];
      const blanked = sent.replace(new RegExp('\\b' + escapeRe(answer) + '\\b'), '____');
      if (blanked === sent) continue;
      // 3 distractors — other content words, none equal to the answer.
      const seen = new Set([answer.toLowerCase()]);
      const distract = [];
      for (const w of shuffleInPlace(allContent.slice())) {
        const lo = w.toLowerCase();
        if (seen.has(lo)) continue;
        seen.add(lo);
        distract.push(w);
        if (distract.length >= 3) break;
      }
      if (distract.length < 3) continue;
      let ko = '';
      try { const t = await window.WCKorBar.translate(sent); ko = (t && t.ko) || ''; } catch {}
      return { type: 'mcq', subtype: 'cloze', promptEn: blanked, ko,
               choices: [answer, ...distract], correctIndex: 0 };
    }
    return null;
  }

  async function buildKorMcqQuestions(count) {
    const L = window.WCLesson;
    let sentences = (L && L.quizSentences) || [];
    sentences = sentences.filter(s =>
      (String(s).match(/[A-Za-z]+/g) || []).length >= 4);
    if (!sentences.length) return [];

    const n         = Math.max(2, count || 2);
    const pool      = await buildKorWordPool(sentences);
    const usedSents = new Set();

    // Plan an even type mix, then shuffle the order.
    const plan = [];
    for (let i = 0; i < n; i++) plan.push(['cloze', 'w2k', 'k2w', 'unscramble', 'comp'][i % 5]);
    shuffleInPlace(plan);

    // Comprehension questions come from GPT as a batch — fetch once.
    let compQs = [];
    if (plan.includes('comp')) {
      try {
        const passage = sentences.join(' ').slice(0, 1500);
        const data = await window.WCKorBar.fetchComprehension(passage);
        if (data && Array.isArray(data.questions)) compQs = data.questions.slice();
      } catch {}
    }

    const questions = [];
    for (const t of plan) {
      let q = null;
      if (t === 'cloze')           q = await buildKorCloze(sentences, usedSents);
      else if (t === 'unscramble') q = await buildKorUnscramble(sentences, usedSents);
      else if (t === 'comp')       q = buildKorComp(compQs);
      else                         q = buildKorWordMeaning(pool, t);
      // Fallbacks so a thin lesson still fills the quiz.
      if (!q && pool.length >= 4) q = buildKorWordMeaning(pool, Math.random() < 0.5 ? 'w2k' : 'k2w');
      if (!q)                     q = await buildKorCloze(sentences, usedSents);
      if (q) questions.push(q);
    }
    return questions;
  }

  // Comprehension — pull the next valid question from the GPT batch.
  function buildKorComp(compQs) {
    while (compQs && compQs.length) {
      const c = compQs.shift();
      if (c && c.prompt && Array.isArray(c.choices) && c.choices.length === 4
          && Number.isInteger(c.correctIndex)
          && c.correctIndex >= 0 && c.correctIndex < 4) {
        return {
          type: 'mcq', subtype: 'comp',
          prompt: String(c.prompt),
          choices: c.choices.map(String),
          correctIndex: c.correctIndex,
        };
      }
    }
    return null;
  }

  // Unscramble — show a sentence's Korean meaning, then its words
  // (whitespace tokens, punctuation kept attached) scrambled into
  // big buttons the student arranges back into order.
  async function buildKorUnscramble(sentences, usedSents) {
    const pool = sentences.filter(s => !usedSents.has(s));
    shuffleInPlace(pool);
    for (const sent of pool) {
      const toks = String(sent).trim().split(/\s+/).filter(Boolean);
      if (toks.length < 3 || toks.length > 9) continue;   // keep it doable
      usedSents.add(sent);
      let ko = '';
      try { const t = await window.WCKorBar.translate(sent); ko = (t && t.ko) || ''; } catch {}
      return { type: 'unscramble', tokens: toks, ko };
    }
    return null;
  }

  // FLIP — smoothly move a set of elements to new DOM positions.
  // Capture each rect, run `mutate()`, then transition every element
  // from its old position to the new one.
  function flipAnimate(els, mutate) {
    const list = [...new Set(els)];
    const firsts = list.map(el => el.getBoundingClientRect());
    mutate();
    list.forEach((el, i) => {
      const last = el.getBoundingClientRect();
      const dx = firsts[i].left - last.left;
      const dy = firsts[i].top  - last.top;
      if (!dx && !dy) return;
      el.style.transition = 'none';
      el.style.transform  = `translate(${dx}px, ${dy}px)`;
    });
    requestAnimationFrame(() => {
      list.forEach(el => {
        el.style.transition = 'transform .26s ease';
        el.style.transform  = '';
      });
    });
  }

  function runKorQuiz(questions, animalSet, animalIndex, level) {
    const quizWrap = host.querySelector('.wc-enc-quiz');
    quizWrap.classList.remove('wc-hidden');
    host.querySelector('.wc-enc-actions').innerHTML = '';
    host.querySelector('.wc-enc-title').textContent = '';
    host.querySelector('.wc-enc-sub').textContent   = '';
    let idx = 0, correctCount = 0;

    // Show feedback, then advance to the next question (or finish).
    function recordResult(correct) {
      if (correct) correctCount++;
      const fb = host.querySelector('.wc-quiz-feedback');
      fb.textContent = correct ? '정답이에요! ✅' : '아쉬워요 — 다시 기억해봐요 🌱';
      fb.className = 'wc-quiz-feedback ' + (correct ? 'good' : 'soft');
      fb.classList.remove('wc-hidden');
      setTimeout(() => {
        idx++;
        if (idx < questions.length) renderQ();
        else finish();
      }, 1050);
    }

    function renderQ() {
      host.querySelector('.wc-quiz-progress').textContent =
        `${idx + 1} / ${questions.length}`;
      host.querySelector('.wc-quiz-feedback').classList.add('wc-hidden');
      const q = questions[idx];
      if (q.type === 'unscramble') renderUnscramble(q);
      else                         renderMcq(q);
    }

    // ── multiple-choice question (cloze / w2k / k2w) ──────────────
    function renderMcq(q) {
      const promptEl = host.querySelector('.wc-quiz-prompt');
      if (q.subtype === 'cloze') {
        promptEl.innerHTML = `
          <div class="wc-kq-instr">빈칸에 들어갈 말을 고르세요</div>
          <div class="wc-kq-sentence">${escapeHtml(q.promptEn)}</div>
          ${q.ko ? `
            <button class="wc-kq-trans-btn" type="button">한글 해석 보기</button>
            <div class="wc-kq-trans wc-hidden">${escapeHtml(q.ko)}</div>
          ` : ''}
        `;
        const tb = promptEl.querySelector('.wc-kq-trans-btn');
        if (tb) tb.onclick = () => {
          const t = promptEl.querySelector('.wc-kq-trans');
          if (t) t.classList.toggle('wc-hidden');
          tb.classList.toggle('active');
        };
      } else if (q.subtype === 'comp') {
        promptEl.innerHTML =
          `<div class="wc-kq-instr">글을 읽고 물음에 답하세요</div>
           <div class="wc-kq-sentence">${escapeHtml(q.prompt)}</div>`;
      } else if (q.subtype === 'w2k') {
        promptEl.innerHTML =
          `<div class="wc-kq-instr">이 단어의 뜻은?</div>
           <div class="wc-kq-word">${escapeHtml(q.promptWord)}</div>`;
      } else {
        promptEl.innerHTML =
          `<div class="wc-kq-instr">이 뜻에 맞는 영어 단어는?</div>
           <div class="wc-kq-word wc-kq-word-ko">${escapeHtml(q.promptWord)}</div>`;
      }
      const choicesEl = host.querySelector('.wc-quiz-choices');
      choicesEl.className = 'wc-quiz-choices';
      choicesEl.innerHTML = '';
      const order = shuffleIndices(q.choices.length);
      order.forEach(origIdx => {
        const btn = document.createElement('button');
        btn.className = 'wc-quiz-choice';
        btn.textContent = q.choices[origIdx];
        btn.onclick = () => onChoice(origIdx, q.correctIndex, btn);
        choicesEl.appendChild(btn);
      });
    }

    function onChoice(picked, correct, btn) {
      const choicesEl = host.querySelector('.wc-quiz-choices');
      [...choicesEl.children].forEach(c => c.disabled = true);
      btn.classList.add(picked === correct ? 'right' : 'wrong');
      if (picked !== correct) {
        [...choicesEl.children].forEach(c => {
          if (c.textContent === questions[idx].choices[correct]) c.classList.add('right');
        });
      }
      recordResult(picked === correct);
    }

    // ── unscramble — arrange the scrambled word buttons ───────────
    function renderUnscramble(q) {
      host.querySelector('.wc-quiz-prompt').innerHTML = `
        <div class="wc-kq-instr">한글 뜻을 보고 영어 문장을 순서대로 맞춰보세요</div>
        <div class="wc-kq-sentence wc-kq-word-ko">${escapeHtml(q.ko || '(뜻을 불러오지 못했어요)')}</div>
      `;
      const area = host.querySelector('.wc-quiz-choices');
      area.className = 'wc-quiz-choices wc-us-area';
      area.innerHTML = `<div class="wc-us-pool" id="wcUsPool"></div>
                        <div class="wc-us-answer" id="wcUsAnswer"></div>`;
      const poolEl   = area.querySelector('#wcUsPool');
      const answerEl = area.querySelector('#wcUsAnswer');
      const n = q.tokens.length;

      // Scramble — reshuffle until it's not already in order.
      let order = shuffleIndices(n);
      for (let g = 0; g < 8 && order.every((v, i) => v === i); g++) order = shuffleIndices(n);

      order.forEach(tokIdx => {
        const slot = document.createElement('span');
        slot.className = 'wc-us-slot';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wc-us-tok';
        btn.textContent = q.tokens[tokIdx];
        btn.dataset.i = String(tokIdx);
        btn._homeSlot = slot;
        btn.onclick = () => onTok(btn);
        slot.appendChild(btn);
        poolEl.appendChild(slot);
      });
      // Freeze each slot's size so the pool never reflows when its
      // button leaves — the "original spot" stays put for the return.
      requestAnimationFrame(() => {
        poolEl.querySelectorAll('.wc-us-slot').forEach(s => {
          const b = s.firstElementChild;
          if (!b) return;
          const r = b.getBoundingClientRect();
          s.style.width  = r.width  + 'px';
          s.style.height = r.height + 'px';
        });
      });

      function onTok(btn) {
        if (btn.disabled) return;
        const tracked = [btn, ...answerEl.querySelectorAll('.wc-us-tok')];
        if (btn.parentElement === answerEl) {
          // back to its home slot in the pool
          flipAnimate(tracked, () => {
            btn.classList.remove('in-answer');
            btn._homeSlot.appendChild(btn);
          });
        } else {
          // down into the answer row
          flipAnimate(tracked, () => {
            btn.classList.add('in-answer');
            answerEl.appendChild(btn);
          });
          checkComplete();
        }
      }

      function checkComplete() {
        const placed = [...answerEl.querySelectorAll('.wc-us-tok')];
        if (placed.length !== n) return;
        const ok = placed.every((b, i) => parseInt(b.dataset.i, 10) === i);
        if (ok) {
          poolEl.querySelectorAll('.wc-us-tok').forEach(b => b.disabled = true);
          placed.forEach(b => { b.disabled = true; b.classList.add('right'); });
          recordResult(true);
        } else {
          const fb = host.querySelector('.wc-quiz-feedback');
          fb.textContent = '순서가 달라요 — 다시 배열해 보세요! 🔁';
          fb.className = 'wc-quiz-feedback soft';
          fb.classList.remove('wc-hidden');
          // Every button glides home so the student starts the line fresh.
          flipAnimate(placed, () => {
            placed.forEach(b => { b.classList.remove('in-answer'); b._homeSlot.appendChild(b); });
          });
          setTimeout(() => {
            const f = host.querySelector('.wc-quiz-feedback');
            if (f) f.classList.add('wc-hidden');
          }, 1700);
        }
      }
    }

    function finish() {
      quizWrap.classList.add('wc-hidden');
      const passNeeded = level <= 5 ? 0.8 : 0.9;
      const ratio = correctCount / questions.length;
      if (ratio >= passNeeded) {
        revealCaught(animalSet, animalIndex, level,
          `${questions.length}문제 중 ${correctCount}개 맞혔어요!`);
      } else {
        revealFailed(animalSet, animalIndex, level,
          `${questions.length}문제 중 ${correctCount}개. 아쉬워요!`);
      }
    }

    renderQ();
  }

  window.WCQuiz = { run };
})();
