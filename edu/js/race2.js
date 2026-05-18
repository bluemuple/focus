// =============================================================
//  Race 2 — Subtraction Mental Methods 2
//
//  Six levels mirroring Practice 2's progression, but typed-input
//  only (no chip decomposition — race is about speed). Same Speed
//  picker as Race 1 with the Extreme tier.
//
//    1 — ones − ones (recap)
//    2 — 2-digit − 1-digit no borrow (e.g. 28 − 2)
//    3 — subtract-to-ten (26 − 8)
//    4 — subtract-to-ten harder (54 − 7)
//    5 — 10s & 1s (35 − 13)
//    6 — 3-digit (124 − 13, 389 − 57) or extended facts (70 − 50)
//
//  Score formula = Race 1's:
//    correctPts = correct × 10
//    timeBonus  = max(0, 100 − avgTime × 1.5)
//    total      = correctPts + timeBonus
//    (Extreme tier: × 1.5)
//
//  Persists race_state under wc_users.smm2_race_state so it
//  doesn't collide with SMM1's leaderboard.
// =============================================================

(() => {
  const $ = (id) => document.getElementById(id);
  const me = window.WCAuth && window.WCAuth.session();
  if (!me) { window.location.href = './index.html'; return; }

  const SPEEDS = {
    1: { beg: [36, 70], int: [10, 35], adv: [1, 9],  ext: [1, 5]  },
    2: { beg: [40, 76], int: [12, 39], adv: [1, 11], ext: [1, 6]  },
    3: { beg: [48, 88], int: [16, 47], adv: [1, 15], ext: [1, 8]  },
    4: { beg: [52, 94], int: [18, 51], adv: [1, 17], ext: [1, 9]  },
    5: { beg: [52, 94], int: [18, 51], adv: [1, 17], ext: [1, 9]  },
    6: { beg: [60,108], int: [22, 59], adv: [1, 21], ext: [1, 11] },
  };
  const SPEED_LABELS = { beg: 'Beginner', int: 'Intermediate', adv: 'Advanced', ext: 'Extreme' };
  const EXTREME_BONUS = 1.5;
  const QUESTIONS_PER_RACE = 6;

  let level = 1;
  let raceState = { level: 1, runs: [], best: {}, total: 0 };
  let pickedSpeed = 'int';

  let qIdx = 0;
  let correctCount = 0;
  let timeTotal = 0;
  let limitPerQ  = 30;
  let qStartTs = 0;
  let timerInt = null;
  let currentQ = null;
  let coinsEnabledThisRace = false;
  const todayStr = () => new Date().toISOString().slice(0, 10);

  (async function init() {
    try {
      const fresh = await window.WCDB.users.byId(me.id);
      const rs = (fresh && fresh.smm2_race_state && typeof fresh.smm2_race_state === 'object') ? fresh.smm2_race_state : {};
      raceState = Object.assign(raceState, rs);
      level = Math.max(1, Math.min(6, raceState.level || 1));
    } catch (e) { console.warn('smm2 race_state load failed', e); }
    renderPicker();
    renderBoards();
  })();

  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  function genQuestion(lv) {
    if (lv === 1) {
      const a = rand(4, 9); const b = rand(1, a);
      return { a, b, answer: a - b };
    }
    if (lv === 2) {
      // 2-digit − 1-digit no borrow
      const tens = rand(1, 9); const ones = rand(2, 9); const sub = rand(1, ones);
      const a = tens * 10 + ones;
      return { a, b: sub, answer: a - sub };
    }
    if (lv === 3 || lv === 4) {
      // Subtract-to-ten: a's ones < b ≤ 9, so we cross the ten
      const min = (lv === 3) ? 13 : 23;
      const max = (lv === 3) ? 49 : 99;
      while (true) {
        const a = rand(min, max);
        const aOnes = a % 10;
        if (aOnes >= 1 && aOnes <= 8) {
          const b = rand(aOnes + 1, 9);
          return { a, b, answer: a - b };
        }
      }
    }
    if (lv === 5) {
      // 10s & 1s no borrow
      const aT = rand(2, 9), aO = rand(1, 9);
      const bT = rand(1, Math.max(1, aT - 1));
      const bO = rand(0, aO);
      const a = aT * 10 + aO;
      const b = bT * 10 + bO;
      return { a, b, answer: a - b };
    }
    // lv 6 — 3-digit or extended fact
    if (Math.random() < 0.5) {
      const seedA = rand(2, 9);
      const seedB = rand(1, seedA - 1);
      const scale = [10, 100][rand(0, 1)];
      return { a: seedA * scale, b: seedB * scale, answer: (seedA - seedB) * scale };
    } else {
      const aH = rand(1, 4);
      const aT = rand(2, 9), aO = rand(2, 9);
      const bT = rand(1, Math.max(1, aT));
      const bO = rand(0, aO);
      const a = aH * 100 + aT * 10 + aO;
      const b = bT * 10 + bO;
      return { a, b, answer: a - b };
    }
  }

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
        limitPerQ = SPEEDS[level][pickedSpeed][1];
        startRace();
      });
    });
  }

  function startRace() {
    qIdx = 0; correctCount = 0; timeTotal = 0;
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
    if (remain <= 0) submitAnswer(/*timedOut*/ true);
  }
  function submitAnswer(timedOut) {
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
    const elapsedSec = Math.min(limitPerQ, (Date.now() - qStartTs) / 1000);
    timeTotal += elapsedSec;
    const v = timedOut ? NaN : parseInt(($('ansInput')||{}).value, 10);
    if (v === currentQ.answer) correctCount++;
    nextQuestion();
  }

  function calcScore(correct, avgTimeSec, speed) {
    const correctPts = correct * 10;
    const timeBonus  = Math.max(0, Math.round(100 - avgTimeSec * 1.5));
    let total = correctPts + timeBonus;
    if (speed === 'ext') total = Math.round(total * EXTREME_BONUS);
    return { correctPts, timeBonus, total };
  }
  async function finishRace() {
    const avgTime = timeTotal / QUESTIONS_PER_RACE;
    const { correctPts, timeBonus, total } = calcScore(correctCount, avgTime, pickedSpeed);
    const prevBest = (raceState.best && raceState.best[level]) || 0;
    const gain = Math.max(0, total - prevBest);
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
    } catch (e) { console.warn('race2 coin bump failed', e); }
  }
  async function saveRaceState() {
    if (!me.id || String(me.id).startsWith('guest-')) return;
    try {
      await window.WCDB.users.update(me.id, { smm2_race_state: raceState });
      const raw = localStorage.getItem('wc.session.v1');
      if (raw) {
        const u = JSON.parse(raw); u.smm2_race_state = raceState;
        localStorage.setItem('wc.session.v1', JSON.stringify(u));
      }
    } catch (e) { console.warn('smm2_race_state save failed', e); }
  }

  function renderSummary({ correctPts, timeBonus, total, avgTime, gain, coinsEarned, rawCoins, dailyLimitReached }) {
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

  async function renderBoards() {
    const host = $('boards');
    host.innerHTML = '<div class="rc-board"><p>Loading…</p></div>';
    let classmates = [];
    try {
      if (me.class_id) {
        classmates = await window.WCDB.users.listStudents(me.class_id);
        const ids = classmates.map(c => c.id);
        const full = await window.WCDB.users.byIds(ids);
        const byId = new Map(full.map(u => [u.id, u]));
        classmates = classmates.map(c => Object.assign({}, c, byId.get(c.id) || {}));
      } else {
        classmates = [Object.assign({}, me)];
      }
    } catch (e) {
      host.innerHTML = '<div class="rc-board"><p>Couldn\'t load leaderboards.</p></div>';
      return;
    }
    const rows = classmates.map(u => {
      const rs = (u.smm2_race_state && typeof u.smm2_race_state === 'object') ? u.smm2_race_state : {};
      const best = Math.max(0, ...Object.values(rs.best || {0:0}));
      return {
        id: u.id,
        name: u.real_name || '—',
        best,
        gain: rs.lastGain || 0,
      };
    });
    const byImprover = [...rows].sort((a, b) => b.gain - a.gain).slice(0, 10);
    const byTop      = [...rows].sort((a, b) => b.best - a.best).slice(0, 10);
    host.innerHTML = `
      <div class="rc-board">
        <h3>🚀 Biggest Improvers (most score gained)</h3>
        ${renderBoardTable(byImprover, 'gain')}
      </div>
      <div class="rc-board">
        <h3>🏆 Top Scorers (best race ever)</h3>
        ${renderBoardTable(byTop, 'best')}
      </div>
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
