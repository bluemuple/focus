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
    const actions = host.querySelector('.wc-enc-actions');
    actions.innerHTML = '';
    const ok = document.createElement('button');
    ok.className = 'wc-btn lg';
    ok.textContent = 'Yay! Back to reading';
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

  window.WCQuiz = { run };
})();
