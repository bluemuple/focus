// =============================================================
//  Race — Subtraction Mental Methods 1
//
//  Levels 1–6 (same difficulty model as Practice).
//  Before each race the student picks one of THREE speeds:
//    Beg / Inter / Adv  → time-limit-per-question ranges.
//  A race is 6 questions. Score =
//    correctCount × 10  +  timeBonus(avgTimeSec)
//
//  Two leaderboards are shown beside the picker and at the end:
//    • Biggest Improvers — best single-run score − previous best
//    • Top Scorers       — best single-run score, ever
//  Top 3 rows highlighted with red outline.
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);
  const me = window.WCAuth && window.WCAuth.session();
  if (!me) { window.location.href = './index.html'; return; }

  // ---- Constants -------------------------------------------------
  // Per-level time-limit ranges. Picking a speed sets the time limit
  // PER QUESTION to the upper bound of that range. Extreme is HALF
  // of Advanced's upper bound (rounded up) — the scariest tier.
  const SPEEDS = {
    1: { beg: [36, 70], int: [10, 35], adv: [1, 9],  ext: [1, 5]  },
    2: { beg: [40, 76], int: [12, 39], adv: [1, 11], ext: [1, 6]  },
    3: { beg: [44, 82], int: [14, 43], adv: [1, 13], ext: [1, 7]  },
    4: { beg: [48, 88], int: [16, 47], adv: [1, 15], ext: [1, 8]  },
    5: { beg: [52, 94], int: [18, 51], adv: [1, 17], ext: [1, 9]  },
    6: { beg: [56,100], int: [20, 55], adv: [1, 19], ext: [1, 10] },
  };
  const SPEED_LABELS = {
    beg: 'Beginner', int: 'Intermediate', adv: 'Advanced', ext: 'Extreme',
  };
  // Extreme tier multiplier on the FINAL score (and therefore the
  // coin payout). Time-bonus already rises naturally with the
  // shorter per-question limit; this flat ×1.5 on top is the
  // "courage tax" reward for picking the hardest tier.
  const EXTREME_BONUS = 1.5;
  const QUESTIONS_PER_RACE = 6;

  // ---- State -----------------------------------------------------
  let level = 1;
  let raceState = { level: 1, runs: [], best: {}, total: 0 };
  let pickedSpeed = 'int';

  // Per-race ephemerals
  let qIdx = 0;
  let correctCount = 0;
  let timeTotal = 0;
  let limitPerQ  = 30;
  let qStartTs = 0;
  let timerInt = null;
  let currentQ = null;
  // Decided at race START — only the day's FIRST race pays coins.
  // Subsequent races same day still save the score / leaderboard
  // entry but the coin payout is 0.
  let coinsEnabledThisRace = false;
  const todayStr = () => new Date().toISOString().slice(0, 10);

  // ---- Boot -------------------------------------------------------
  (async function init() {
    try {
      const fresh = await window.WCDB.users.byId(me.id);
      const rs = (fresh && fresh.race_state && typeof fresh.race_state === 'object') ? fresh.race_state : {};
      raceState = Object.assign(raceState, rs);
      level = Math.max(1, Math.min(6, raceState.level || 1));
    } catch (e) { console.warn('race_state load failed', e); }
    renderPicker();
    renderBoards();
  })();

  // ---- Question generation (same as Practice's no-borrow rules) --
  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  function genQuestion(lv) {
    if (lv <= 2) {
      const a = rand(2, 9); const b = rand(1, a);
      return { a, b, answer: a - b };
    }
    if (lv <= 4) {
      const tens = rand(1, 9); const ones = rand(1, 9); const sub = rand(1, ones);
      const a = tens * 10 + ones;
      return { a, b: sub, answer: a - sub };
    }
    // lv 5, 6
    const aT = rand(2, 9), aO = rand(1, 9);
    const bT = rand(1, aT), bO = rand(0, aO);
    const a = aT * 10 + aO; const b = bT * 10 + bO;
    return { a, b, answer: a - b };
  }

  // ---- Picker (level + speed) ------------------------------------
  function renderPicker() {
    const card = $('card');
    const speeds = SPEEDS[level];
    card.innerHTML = `
      <div class="rc-picker">
        <h2>Pick a level + speed</h2>
        <p>Each race = 6 questions. Quicker answers earn a bigger time bonus.</p>
        <div>
          <strong style="font-size:14px; color:#6b7280;">Level:</strong>
          <div class="rc-levels">
            ${[1,2,3,4,5,6].map(L =>
              `<button class="rc-level ${L === level ? 'active' : ''}" data-l="${L}">L${L}</button>`
            ).join('')}
          </div>
        </div>
        <div class="rc-speed-grid">
          ${['ext','adv','int','beg'].map(s => {
            const r = speeds[s];
            const sub = (s === 'ext')
              ? `${r[1]}s per Q · ×1.5 score`
              : `${r[0]}–${r[1]}s per Q`;
            return `<button class="rc-speed ${s}" data-s="${s}">
                      <span class="lbl">${SPEED_LABELS[s]}</span>
                      <span class="rng">${sub}</span>
                    </button>`;
          }).join('')}
        </div>
      </div>
    `;
    document.querySelectorAll('.rc-level').forEach(b => {
      b.addEventListener('click', () => {
        level = parseInt(b.dataset.l, 10);
        raceState.level = level;
        renderPicker();
      });
    });
    document.querySelectorAll('.rc-speed').forEach(b => {
      b.addEventListener('click', () => {
        pickedSpeed = b.dataset.s;
        limitPerQ = SPEEDS[level][pickedSpeed][1];     // upper bound = time limit
        startRace();
      });
    });
  }

  // ---- Race --------------------------------------------------------
  function startRace() {
    qIdx = 0; correctCount = 0; timeTotal = 0;
    // Lock in the day-1 coin gate at the start of the race so the
    // summary screen knows whether to display a payout or a
    // "come back tomorrow" note.
    const lastDate = raceState.lastCoinDate && raceState.lastCoinDate.race;
    coinsEnabledThisRace = (lastDate !== todayStr());
    nextQuestion();
  }
  function nextQuestion() {
    if (qIdx >= QUESTIONS_PER_RACE) { finishRace(); return; }
    qIdx++;
    currentQ = genQuestion(level);
    qStartTs = Date.now();
    renderQuestion();
    if (timerInt) clearInterval(timerInt);
    timerInt = setInterval(tickTimer, 100);
  }
  function renderQuestion() {
    const card = $('card');
    card.innerHTML = `
      <div style="text-align:right; font-size:13px; color:#6b7280; margin-bottom:4px;">
        Q ${qIdx} / ${QUESTIONS_PER_RACE} · Level ${level} · ${SPEED_LABELS[pickedSpeed]}
      </div>
      <div class="rc-timer">
        <span id="tLabel">${limitPerQ}s</span>
        <div class="bar"><div class="fill" id="tFill"></div></div>
      </div>
      <div class="rc-q"><span>${currentQ.a}</span> − <span>${currentQ.b}</span> = ?</div>
      <input type="number" id="ansInput" class="rc-input" inputmode="numeric" autofocus>
      <div class="rc-actions">
        <button class="rc-btn" id="submitBtn">Submit</button>
      </div>
    `;
    setTimeout(() => $('ansInput').focus(), 30);
    $('submitBtn').addEventListener('click', submitAnswer);
    $('ansInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') submitAnswer();
    });
  }
  function tickTimer() {
    const elapsed = (Date.now() - qStartTs) / 1000;
    const remain  = Math.max(0, limitPerQ - elapsed);
    const fill = $('tFill'); const lbl = $('tLabel');
    if (fill) fill.style.width = (remain / limitPerQ * 100) + '%';
    if (lbl)  lbl.textContent  = remain.toFixed(1) + 's';
    if (remain <= 0) {
      // Time up → record as wrong, advance
      submitAnswer(/*timedOut*/ true);
    }
  }
  function submitAnswer(timedOut) {
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
    const elapsedSec = Math.min(limitPerQ, (Date.now() - qStartTs) / 1000);
    timeTotal += elapsedSec;
    const v = timedOut ? NaN : parseInt(($('ansInput')||{}).value, 10);
    if (v === currentQ.answer) correctCount++;
    nextQuestion();
  }

  // ---- Score + persistence ---------------------------------------
  function calcScore(correct, avgTimeSec, speed) {
    const correctPts = correct * 10;
    // Time bonus: faster → more. Bounded 0 to ~100.
    const timeBonus  = Math.max(0, Math.round(100 - avgTimeSec * 1.5));
    let total = correctPts + timeBonus;
    // Extreme tier: 1.5x multiplier on the raw total. Reflects in
    // both leaderboard score AND coins (coins = total/10).
    if (speed === 'ext') total = Math.round(total * EXTREME_BONUS);
    return { correctPts, timeBonus, total };
  }
  async function finishRace() {
    const avgTime = timeTotal / QUESTIONS_PER_RACE;
    const { correctPts, timeBonus, total } = calcScore(correctCount, avgTime, pickedSpeed);
    const prevBest = (raceState.best && raceState.best[level]) || 0;
    const gain = Math.max(0, total - prevBest);
    // Coin payout = score / 10 (rounded) BUT only on the day's
    // first race. Repeat races still update the leaderboard.
    const rawCoins    = Math.round(total / 10);
    const coinsEarned = coinsEnabledThisRace ? rawCoins : 0;
    if (coinsEnabledThisRace) {
      raceState.lastCoinDate = raceState.lastCoinDate || {};
      raceState.lastCoinDate.race = todayStr();
    }
    raceState.runs = raceState.runs || [];
    raceState.runs.push({
      level, speed: pickedSpeed, correct: correctCount,
      avgTime: +avgTime.toFixed(1), score: total, gain,
      coins: coinsEarned,
      ts: new Date().toISOString(),
    });
    if (raceState.runs.length > 30) raceState.runs = raceState.runs.slice(-30);
    raceState.best = raceState.best || {};
    raceState.best[level] = Math.max(prevBest, total);
    raceState.total = (raceState.total || 0) + total;
    raceState.level = level;
    raceState.lastGain = gain;
    raceState.lastScore = total;
    await Promise.all([
      saveRaceState(),
      bumpCoins(coinsEarned),
    ]);
    renderSummary({
      correctPts, timeBonus, total, avgTime, gain,
      coinsEarned, rawCoins,
      dailyLimitReached: !coinsEnabledThisRace,
    });
    renderBoards();
  }
  // Adds `delta` coins to wc_users.money + refreshes cached session
  // so the header counter on /home / /lesson updates next view.
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
    } catch (e) { console.warn('race coin bump failed', e); }
  }
  async function saveRaceState() {
    if (!me.id || String(me.id).startsWith('guest-')) return;
    try {
      await window.WCDB.users.update(me.id, { race_state: raceState });
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw); u.race_state = raceState;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch (e) { console.warn('race_state save failed', e); }
  }

  function renderSummary({ correctPts, timeBonus, total, avgTime, gain, coinsEarned, rawCoins, dailyLimitReached }) {
    // Coin chip varies with the daily-limit state:
    //   first race of the day  → yellow chip showing payout
    //   later races same day   → grey chip saying coins already
    //                            earned (so the student understands
    //                            why their balance didn't move)
    const coinChip = dailyLimitReached
      ? `<div style="display:inline-block; margin: 6px 0 14px; padding: 8px 18px;
                    background:#f3f4f6; color:#6b7280; border:1.5px solid #d1d5db;
                    border-radius: 999px; font-size: 15px; font-weight: 700;">
           💰 Daily race coins already earned today (would have been +${rawCoins}).
           Come back tomorrow for more!
         </div>`
      : `<div style="display:inline-block; margin: 6px 0 14px; padding: 8px 18px;
                    background:#fff5cc; color:#6b4f00; border:1.5px solid #e8c970;
                    border-radius: 999px; font-size: 20px; font-weight: 800;">
           💰 +${coinsEarned} coin${coinsEarned === 1 ? '' : 's'} earned!
         </div>`;
    $('card').innerHTML = `
      <div class="rc-summary">
        <h2 style="margin:0;">🏁 Race finished!</h2>
        <div class="rc-score-big">${total}<span class="pts">pts</span></div>
        ${coinChip}
        <div class="rc-meta-grid">
          <div class="rc-meta-cell"><div class="lbl">Correct</div><div class="val">${correctCount}/${QUESTIONS_PER_RACE}</div></div>
          <div class="rc-meta-cell"><div class="lbl">Avg time</div><div class="val">${avgTime.toFixed(1)}s</div></div>
          <div class="rc-meta-cell"><div class="lbl">Gain</div><div class="val">+${gain}</div></div>
        </div>
        <div style="font-size:13px; color:#6b7280; margin: 6px 0 0;">
          Score breakdown: ${correctPts} (correct) + ${timeBonus} (time bonus)${
            pickedSpeed === 'ext'
              ? ` = ${correctPts + timeBonus} × 1.5 (Extreme) = <strong style="color:#7c3aed;">${total}</strong>`
              : ` = ${total}`
          }
        </div>
        <div class="rc-actions">
          <button class="rc-btn" id="againBtn">Race again →</button>
          <a class="rc-btn secondary" href="./home.html">Home</a>
        </div>
      </div>
    `;
    $('againBtn').addEventListener('click', () => renderPicker());
  }

  // ---- Leaderboards ------------------------------------------------
  // Layout — 4-column × 2-row grid:
  //   Row 1: Biggest Improvers | Top L1 | Top L2 | Top L3
  //   Row 2: Top L4 | Top L5 | Top L6 | (empty)
  // Each per-level board ranks by THAT level's best-ever single-run
  // score (race_state.best[lv]). The improvers board ranks by the
  // last race's gain across all levels.
  async function renderBoards() {
    const host = $('boards');
    host.innerHTML = '<div class="rc-board"><p>Loading…</p></div>';
    let classmates = [];
    try {
      if (me.class_id) {
        classmates = await window.WCDB.users.listStudents(me.class_id);
        const ids = classmates.map(c => c.id);
        const full = await window.WCDB.users.byIds(ids);
        // Merge basic info with race_state
        const byId = new Map(full.map(u => [u.id, u]));
        classmates = classmates.map(c => Object.assign({}, c, byId.get(c.id) || {}));
      } else {
        classmates = [Object.assign({}, me)];
      }
    } catch (e) {
      host.innerHTML = '<div class="rc-board"><p>Couldn\'t load leaderboards.</p></div>';
      return;
    }
    // Per-row pre-computation. For each student we keep `gain` (the
    // last-race delta the improvers board needs) AND `bestByLevel`
    // (a 1..6 → score map driving the per-level boards).
    const rows = classmates.map(u => {
      const rs = (u.race_state && typeof u.race_state === 'object') ? u.race_state : {};
      const best = (rs.best && typeof rs.best === 'object') ? rs.best : {};
      return {
        id:   u.id,
        name: u.real_name || '—',
        gain: rs.lastGain || 0,
        bestByLevel: best,
      };
    });

    const byImprover = [...rows].sort((a, b) => b.gain - a.gain).slice(0, 10);
    function topAtLevel(lv) {
      return [...rows]
        .map(r => ({ id: r.id, name: r.name, score: Number(r.bestByLevel[lv]) || 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    }
    const levelBoards = [1, 2, 3, 4, 5, 6].map(lv => ({ lv, rows: topAtLevel(lv) }));

    host.innerHTML = `
      <div class="rc-board">
        <h3>🚀 Biggest Improvers</h3>
        ${renderBoardTable(byImprover, 'gain')}
      </div>
      ${levelBoards.map(({ lv, rows }) => `
        <div class="rc-board compact">
          <h3>🏆 Top Scorers · Level ${lv}</h3>
          ${renderBoardTable(rows, 'score')}
        </div>
      `).join('')}
    `;
  }
  function renderBoardTable(rows, scoreKey) {
    if (!rows.length || rows.every(r => !r[scoreKey])) {
      return '<p style="color:#6b7280; font-size:14px;">No scores yet — be the first to race!</p>';
    }
    const body = rows.map((r, i) => {
      const podiumCls = i < 3 ? `podium-${i + 1}` : '';
      const me_ = (r.id === me.id) ? ' style="background: #eff6ff;"' : '';
      return `<tr class="${podiumCls}"${me_}>
                <td class="rank">${i + 1}</td>
                <td class="name">${escapeHtml(r.name)}${r.id === me.id ? ' <span style="color:#3b82f6;">(you)</span>' : ''}</td>
                <td class="score">${r[scoreKey] || 0}</td>
              </tr>`;
    }).join('');
    return `<table>
              <thead><tr><th>#</th><th>Student</th><th style="text-align:right;">Score</th></tr></thead>
              <tbody>${body}</tbody>
            </table>`;
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }
})();
