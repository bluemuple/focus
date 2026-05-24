// =============================================================
//  WordCatch — teacher dashboard controller
//
//  Tabs:
//    1. Students   — manage roster, regenerate codes
//    2. Lessons    — create / list lessons
//    3. Insights   — class-wide word level distribution + per-student
//    4. Messages   — visualization inbox, reply with animal gift
//    5. Settings   — per-class feature toggles
//
//  Class picker (top, sticky) drives everything: switching class
//  refetches students + lessons + messages for that class.
//
//  No per-action shouting back to the server — each tab refetches
//  on switch (cheap, keeps state simple, the class size is small).
// =============================================================

(() => {
  const me = window.WCAuth.requireTeacher('./index.html');
  if (!me) return;
  const $ = (id) => document.getElementById(id);

  $('teacherName').textContent = me.real_name;
  $('logoutBtn').addEventListener('click', e => {
    e.preventDefault();
    window.WCAuth.logout();
    location.href = './index.html';
  });

  // ---------- shared state ----------
  let myClasses     = [];   // wc_classes rows for THIS teacher
  let currentClass  = null; // wc_classes row
  let students      = [];   // including login_code (re-fetched per class switch)
  let lessons       = [];
  let messages      = [];
  let currentTab    = 'students';

  // ---------- bootstrap ----------
  (async function init() {
    await reloadClasses();
    wireTabs();
    if (currentClass) await refreshAll();

    // Deep-link from the lesson preview's "✏️ Edit" button. If the
    // URL carries ?edit=<lesson-id>, switch to the right class +
    // Lessons tab and drop the form straight into edit mode.
    const editId = new URLSearchParams(location.search).get('edit');
    if (editId) {
      try {
        const target = await window.WCDB.lessons.byId(editId);
        if (target) {
          // If the lesson belongs to a class other than the currently-
          // selected one, switch classes first.
          if (target.class_id && (!currentClass || target.class_id !== currentClass.id)) {
            const cls = myClasses.find(c => c.id === target.class_id);
            if (cls) {
              currentClass = cls;
              $('classSelect').value = cls.id;
              await refreshAll();
            }
          }
          // Activate the Lessons tab.
          currentTab = 'lessons';
          document.querySelectorAll('[data-tab]').forEach(b =>
            b.classList.toggle('active', b.dataset.tab === 'lessons'));
          renderTab('lessons');
          // Now load the lesson into the edit form.
          startEditing(editId);
        }
      } catch (e) { console.warn('?edit deep link failed', e); }
    }
  })();

  // ============================================================
  //  CLASS PICKER (header strip)
  // ============================================================
  async function reloadClasses() {
    const all = await window.WCDB.classes.list().catch(() => []);
    myClasses = all.filter(c => c.teacher_id === me.id);
    const sel = $('classSelect');
    sel.innerHTML = '';
    if (!myClasses.length) {
      sel.innerHTML = '<option value="">— no class yet —</option>';
      currentClass = null;
      return;
    }
    myClasses.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      sel.appendChild(o);
    });
    if (!currentClass || !myClasses.find(c => c.id === currentClass.id)) {
      currentClass = myClasses[0];
    }
    sel.value = currentClass.id;
  }
  document.addEventListener('change', async (e) => {
    if (e.target.id !== 'classSelect') return;
    currentClass = myClasses.find(c => c.id === e.target.value) || null;
    // Switching classes mid-edit is confusing — abandon any in-flight
    // lesson edit so the form returns to "Create new" mode for the
    // newly-selected class.
    if (editingLessonId) cancelEditing();
    await refreshAll();
  });

  $('newClassBtn').addEventListener('click', async () => {
    const name = $('newClassName').value.trim();
    if (!name) return;
    await window.WCDB.classes.create(name, me.id);
    $('newClassName').value = '';
    await reloadClasses();
    await refreshAll();
  });

  async function refreshAll() {
    if (!currentClass) {
      students = []; lessons = []; messages = [];
    } else {
      students = await fetchStudents(currentClass.id);
      // Teacher dashboard needs to see hidden lessons too so they
      // can toggle them back on.
      lessons  = await window.WCDB.lessons.listForClassAll(currentClass.id).catch(() => []);
      messages = lessons.length
        ? await window.WCDB.viz.forLessons(lessons.map(L => L.id)).catch(() => [])
        : [];
    }
    renderTab(currentTab);
  }

  async function fetchStudents(classId) {
    // Full row — we used to select only a hand-picked subset, which
    // bit us during "View as student" because the impersonation path
    // requires role + class_id to be present (otherwise
    // requireStudent() fails on home.html and we bounce in a redirect
    // loop). Selecting * is cheap (rows are tiny) and future-proofs
    // any other page that wants to read columns we forgot to list.
    const URL  = window.WC_SUPABASE.url;
    const ANON = window.WC_SUPABASE.anon;
    const r = await fetch(`${URL}/rest/v1/wc_users?select=*`
      + `&class_id=eq.${encodeURIComponent(classId)}&role=eq.student&order=real_name.asc`, {
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
    });
    if (!r.ok) return [];
    return r.json();
  }

  // ============================================================
  //  TABS
  // ============================================================
  function wireTabs() {
    document.querySelectorAll('[data-tab]').forEach(b => {
      b.addEventListener('click', () => {
        currentTab = b.dataset.tab;
        document.querySelectorAll('[data-tab]').forEach(x =>
          x.classList.toggle('active', x === b));
        renderTab(currentTab);
      });
    });
  }
  function renderTab(name) {
    document.querySelectorAll('.wc-tab-panel').forEach(p =>
      p.classList.toggle('wc-hidden', p.id !== 'tab-' + name));
    if (name === 'students') renderStudents();
    if (name === 'lessons')  renderLessons();
    if (name === 'insights') renderInsights();
    if (name === 'mathsinsights') renderMathsInsights();
    if (name === 'messages') renderMessages();
    if (name === 'animals')  renderAnimalsTab();
    if (name === 'settings') renderSettings();
  }

  // ============================================================
  //  TAB — MATHS INSIGHTS  (Back to Basic per-student progress)
  //
  //  Pulls the basic_stage JSONB column for every student in the
  //  current class and renders a table:
  //    Name | Current stage | S1 | S2 | S3 | S4 | S5 | S6
  //  Each Sn cell shows "X/Y" (correct/total) or "✓" if passed,
  //  blank if not yet attempted. "Completed" badge if they hit the
  //  end of the test.
  // ============================================================
  const BTB_STAGE_NAMES = [
    'Recognise',
    'Meaning',
    'Quantity',
    'Strategy',
    'Memory',
  ];
  // Each stage cell shows BOTH the initial-test score and the
  // remediation-test score (if attempted). Helps the teacher see
  // whether the student walked straight through or needed extra
  // practice to clear a stage.
  function btbCellHtml(r) {
    // r = { initial: {correct,total,passed}, remediation: {correct,total,passed} }
    if (!r || (!r.initial && !r.remediation)) {
      return `<td style="padding:6px; text-align:center; color:#cbd5e1;">—</td>`;
    }
    const parts = [];
    if (r.initial && r.initial.total) {
      const passed = r.initial.passed;
      const bg = passed ? '#dcfce7' : '#fef3c7';
      const fg = passed ? '#15803d' : '#b45309';
      parts.push(`<span style="display:inline-block; background:${bg}; color:${fg};
                               padding:2px 7px; border-radius:6px; font-weight:700; font-size:12px;">
                    ${r.initial.correct}/${r.initial.total}${passed ? ' ✓' : ''}
                  </span>`);
    }
    if (r.remediation && r.remediation.total) {
      const passed = r.remediation.passed;
      const bg = passed ? '#dbeafe' : '#fef3c7';
      const fg = passed ? '#1d4ed8' : '#b45309';
      parts.push(`<span title="Remediation score" style="display:inline-block; background:${bg}; color:${fg};
                               padding:2px 7px; border-radius:6px; font-weight:700; font-size:12px; margin-top:3px;">
                    R ${r.remediation.correct}/${r.remediation.total}${passed ? ' ✓' : ''}
                  </span>`);
    }
    return `<td style="padding:6px; text-align:center; line-height:1.4;">
              <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                ${parts.join('')}
              </div>
            </td>`;
  }
  async function renderMathsInsights() {
    const wrap = $('mathsInsightsBody');
    if (!wrap) return;
    wrap.innerHTML = '<p class="wc-muted">Loading…</p>';
    let rows = [];
    try {
      const ids = (students || []).map(s => s.id);
      const fresh = await window.WCDB.users.byIds(ids);
      rows = (fresh || []).sort((a, b) => (a.real_name || '').localeCompare(b.real_name || ''));
    } catch (e) {
      wrap.innerHTML = '<p class="wc-muted">Couldn\'t load — try again.</p>';
      return;
    }
    if (!rows.length) {
      wrap.innerHTML = '<p class="wc-muted">No students in this class yet.</p>';
      return;
    }
    // The table is wrapped in a "collapsible" container — click
    // the title row to fold the table away. Saves the open/closed
    // state in localStorage so teachers don't have to re-collapse.
    const collapsedKey = 'wc.tbl.btb.collapsed';
    const startCollapsed = localStorage.getItem(collapsedKey) === '1';
    const tableHtml = `
      <table style="width:100%; border-collapse: collapse; font-size:14px;">
        <thead>
          <tr style="text-align:left; border-bottom:2px solid #e5e7eb;">
            <th style="padding:8px 6px;">Student</th>
            <th style="padding:8px 6px;">Now on</th>
            ${BTB_STAGE_NAMES.map((n, i) =>
              `<th style="padding:8px 6px; text-align:center;">S${i + 1}<br><span style="font-size:11px; color:#6b7280; font-weight:500;">${n}</span></th>`
            ).join('')}
            <th style="padding:8px 6px;">Status</th>
          </tr>
        </thead>
        <tbody>
        ${rows.map(s => {
          const bs = (s.basic_stage && typeof s.basic_stage === 'object') ? s.basic_stage : {};
          const cur = bs.currentStage || 1;
          const results = bs.results || {};
          const done = !!bs.completed;
          const cellHtml = BTB_STAGE_NAMES.map((_, i) => btbCellHtml(results[String(i + 1)])).join('');
          const status = done
            ? '<span style="color:#15803d; font-weight:700;">All done 🏆</span>'
            : `<span style="color:#6b7280;">Stage ${cur}</span>`;
          return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 6px; font-weight:600;">${escapeHtml(s.real_name || '—')}</td>
              <td style="padding:8px 6px;">Stage ${cur}</td>
              ${cellHtml}
              <td style="padding:8px 6px;">${status}</td>
            </tr>`;
        }).join('')}
        </tbody>
      </table>
      <p class="wc-muted" style="font-size:12px; margin-top:10px;">
        Green chip = initial test passed. Blue "R" chip = remediation
        practice passed. Amber = needs more practice.
      </p>`;
    // Two more tables live in this same tab — Practice progress
    // and Race rankings. Each is in its own collapsible card so the
    // teacher can fold away the ones they're not looking at.
    const practiceHtml = renderPracticeTableHtml(rows);
    const raceHtml     = renderRaceRankingsHtml(rows);

    wrap.innerHTML = `
      ${renderCollapsibleSection('wc.tbl.btb.collapsed',
          'Back to Basic — student progress', tableHtml)}
      ${renderCollapsibleSection('wc.tbl.practice.collapsed',
          'Practice — student progress',     practiceHtml)}
      ${renderCollapsibleSection('wc.tbl.race.collapsed',
          'Race — class rankings',           raceHtml)}
    `;
    // Wire every collapse toggle in the panel (one per card).
    wrap.querySelectorAll('.wc-collapse').forEach(box => {
      const key    = box.dataset.key;
      const toggle = box.querySelector('.wc-collapse-toggle');
      const body   = box.querySelector('.wc-collapse-body');
      const caret  = box.querySelector('.wc-collapse-caret');
      if (!toggle || !body) return;
      toggle.addEventListener('click', () => {
        const isHidden = body.hasAttribute('hidden');
        if (isHidden) {
          body.removeAttribute('hidden');
          toggle.setAttribute('aria-expanded', 'true');
          if (caret) caret.textContent = '▼';
          try { if (key) localStorage.removeItem(key); } catch {}
        } else {
          body.setAttribute('hidden', '');
          toggle.setAttribute('aria-expanded', 'false');
          if (caret) caret.textContent = '▶';
          try { if (key) localStorage.setItem(key, '1'); } catch {}
        }
      });
    });
  }

  // Shared collapsible-section wrapper used by all three Maths
  // Insights tables. Remembers its open/closed state in localStorage
  // under `key`, defaulting to OPEN on first visit.
  function renderCollapsibleSection(key, title, innerHtml) {
    const collapsed = (() => {
      try { return localStorage.getItem(key) === '1'; } catch { return false; }
    })();
    return `
      <div class="wc-collapse" data-key="${key}" style="margin-bottom:14px;">
        <button type="button" class="wc-collapse-toggle" aria-expanded="${collapsed ? 'false' : 'true'}">
          <span class="wc-collapse-caret">${collapsed ? '▶' : '▼'}</span>
          <span>${title}</span>
        </button>
        <div class="wc-collapse-body" ${collapsed ? 'hidden' : ''}>
          ${innerHtml}
        </div>
      </div>`;
  }

  // ============================================================
  //  PRACTICE — per-student progress
  //
  //  Pulls each student's practice_state JSONB column and shows:
  //    • Current level (1–6) — sets the next-question difficulty
  //    • Cumulative score    — sum of (correct × 10) across all
  //      sessions; this is also what gates the Race button (≥80).
  //    • Last per-level scoreboard (correct / total) — read from
  //      `scores[level]` so the teacher can see how the last
  //      mini-session went.
  //    • Race-unlocked badge (cumulative ≥ 80).
  // ============================================================
  function renderPracticeTableHtml(rows) {
    if (!rows.length) {
      return '<p class="wc-muted">No students in this class yet.</p>';
    }
    // Sort by cumulative DESC so the strongest practiser sits at
    // the top — easiest signal for the teacher to find who's
    // ready for the Race vs. who needs a nudge.
    const sorted = rows.slice().sort((a, b) => {
      const ac = (a.practice_state && a.practice_state.cumulative) || 0;
      const bc = (b.practice_state && b.practice_state.cumulative) || 0;
      return bc - ac;
    });
    const body = sorted.map(s => {
      const ps  = (s.practice_state && typeof s.practice_state === 'object') ? s.practice_state : {};
      const lvl = Math.max(1, Math.min(6, ps.level || 0));
      const cum = ps.cumulative || 0;
      const last = ps.scores && ps.scores[String(lvl)];
      const lastStr = (last && last.total)
        ? `${last.correct}/${last.total}`
        : '<span style="color:#cbd5e1;">—</span>';
      const lvlChip = ps.level
        ? `<span style="display:inline-block; background:#fef3c7; color:#92400e;
                        padding:3px 9px; border-radius:999px; font-weight:800; font-size:12px;">
             L${lvl}
           </span>`
        : `<span style="color:#cbd5e1;">—</span>`;
      const raceReady = cum >= 80;
      const status = raceReady
        ? `<span style="color:#15803d; font-weight:700;">Race ready 🏁</span>`
        : `<span style="color:#6b7280;">${80 - cum} pts to Race</span>`;
      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:8px 6px; font-weight:600;">${escapeHtml(s.real_name || '—')}</td>
          <td style="padding:8px 6px; text-align:center;">${lvlChip}</td>
          <td style="padding:8px 6px; text-align:right; font-weight:700; color:#1f2937;">${cum}</td>
          <td style="padding:8px 6px; text-align:center;">${lastStr}</td>
          <td style="padding:8px 6px;">${status}</td>
        </tr>`;
    }).join('');
    return `
      <table style="width:100%; border-collapse: collapse; font-size:14px;">
        <thead>
          <tr style="text-align:left; border-bottom:2px solid #e5e7eb;">
            <th style="padding:8px 6px;">Student</th>
            <th style="padding:8px 6px; text-align:center;">Current level</th>
            <th style="padding:8px 6px; text-align:right;">Cumulative</th>
            <th style="padding:8px 6px; text-align:center;">Last set</th>
            <th style="padding:8px 6px;">Status</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <p class="wc-muted" style="font-size:12px; margin-top:10px;">
        Levels 1–6 step up automatically after 3 correct in a row
        (or 4-of-5 in a level). Race unlocks at 80 cumulative pts.
      </p>`;
  }

  // ============================================================
  //  RACE — class rankings
  //
  //  Reads every student's race_state and shows a leaderboard:
  //    Rank · Student · Best score · Level of best run ·
  //    Last gain · Total races · Avg-time on best run.
  //  Sorted by best score DESC. Top 3 podium-highlighted.
  // ============================================================
  function renderRaceRankingsHtml(rows) {
    if (!rows.length) {
      return '<p class="wc-muted">No students in this class yet.</p>';
    }
    // Build a flat per-student summary, scanning the runs[] log to
    // find the BEST single run for the "level of best" + avg-time
    // columns (race_state.best is keyed by level so we can't pull
    // the run record out of it directly).
    const summaries = rows.map(s => {
      const rs = (s.race_state && typeof s.race_state === 'object') ? s.race_state : {};
      const runs = Array.isArray(rs.runs) ? rs.runs : [];
      const bestObj = (rs.best && typeof rs.best === 'object') ? rs.best : {};
      const bestScore = Math.max(0, ...Object.values(bestObj), 0);
      // Find the actual best run (for level / avg-time)
      let bestRun = null;
      for (const r of runs) {
        if (!r || typeof r.score !== 'number') continue;
        if (!bestRun || r.score > bestRun.score) bestRun = r;
      }
      return {
        id:        s.id,
        name:      s.real_name || '—',
        bestScore,
        bestRun,
        lastGain:  rs.lastGain || 0,
        runCount:  runs.length,
      };
    });
    // Anyone with no races at all sinks to the bottom (sorted by
    // name) so the teacher still sees them but they don't clutter
    // the top of the leaderboard.
    const ranked = summaries
      .filter(r => r.bestScore > 0)
      .sort((a, b) => b.bestScore - a.bestScore);
    const idle   = summaries
      .filter(r => r.bestScore === 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!ranked.length && !idle.length) {
      return '<p class="wc-muted">No students in this class yet.</p>';
    }
    const podiumBg = ['#fff7d6', '#f3f4f6', '#fde9d0'];
    const rankedRows = ranked.map((r, i) => {
      const bg = (i < 3) ? `background:${podiumBg[i]};` : '';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const lvl   = r.bestRun ? `L${r.bestRun.level}` : '—';
      const avg   = r.bestRun ? `${r.bestRun.avgTime.toFixed(1)}s` : '—';
      const gain  = r.lastGain
        ? `<span style="color:#15803d; font-weight:700;">+${r.lastGain}</span>`
        : `<span style="color:#cbd5e1;">—</span>`;
      return `
        <tr style="border-bottom:1px solid #f1f5f9; ${bg}">
          <td style="padding:8px 6px; font-weight:800; text-align:center; width:40px;">${i + 1}${medal ? ' ' + medal : ''}</td>
          <td style="padding:8px 6px; font-weight:600;">${escapeHtml(r.name)}</td>
          <td style="padding:8px 6px; text-align:right; font-weight:800; color:#1f2937;">${r.bestScore}</td>
          <td style="padding:8px 6px; text-align:center;">${lvl}</td>
          <td style="padding:8px 6px; text-align:center;">${avg}</td>
          <td style="padding:8px 6px; text-align:right;">${gain}</td>
          <td style="padding:8px 6px; text-align:right; color:#6b7280;">${r.runCount}</td>
        </tr>`;
    }).join('');
    const idleRows = idle.map(r => `
      <tr style="border-bottom:1px solid #f1f5f9; color:#9ca3af;">
        <td style="padding:8px 6px; text-align:center;">—</td>
        <td style="padding:8px 6px; font-weight:600;">${escapeHtml(r.name)}</td>
        <td style="padding:8px 6px; text-align:right;">—</td>
        <td style="padding:8px 6px; text-align:center;">—</td>
        <td style="padding:8px 6px; text-align:center;">—</td>
        <td style="padding:8px 6px; text-align:right;">—</td>
        <td style="padding:8px 6px; text-align:right;">0</td>
      </tr>`).join('');
    return `
      <table style="width:100%; border-collapse: collapse; font-size:14px;">
        <thead>
          <tr style="text-align:left; border-bottom:2px solid #e5e7eb;">
            <th style="padding:8px 6px; text-align:center;">#</th>
            <th style="padding:8px 6px;">Student</th>
            <th style="padding:8px 6px; text-align:right;">Best score</th>
            <th style="padding:8px 6px; text-align:center;">Level</th>
            <th style="padding:8px 6px; text-align:center;">Avg time</th>
            <th style="padding:8px 6px; text-align:right;">Last gain</th>
            <th style="padding:8px 6px; text-align:right;">Races</th>
          </tr>
        </thead>
        <tbody>${rankedRows}${idleRows}</tbody>
      </table>
      <p class="wc-muted" style="font-size:12px; margin-top:10px;">
        Best score = highest single-run score ever. Level / Avg time
        come from that best run. Last gain = how much the most-recent
        race beat their previous best by.
      </p>`;
  }

  // ============================================================
  //  TAB — ANIMALS (embeds /animals/admin.html via iframe)
  // ============================================================
  let _animalsFrameLoaded = false;
  function renderAnimalsTab() {
    const frame = $('animalsFrame');
    if (frame && !_animalsFrameLoaded) {
      frame.src = '../animals/admin.html';
      _animalsFrameLoaded = true;
    }
    const prewarm = $('animalsPrewarmBtn');
    if (prewarm && !prewarm._wired) {
      prewarm._wired = true;
      prewarm.addEventListener('click', () => {
        // Re-point the embedded iframe to admin.html with a hash
        // marker the embedded page reads on load to auto-trigger
        // Prewarm. If the iframe is already loaded, nudge it via
        // src reset so the handler runs again.
        if (frame) {
          frame.src = '../animals/admin.html#prewarm';
          _animalsFrameLoaded = true;
        }
      });
    }
  }

  // ============================================================
  //  TAB 1 — STUDENTS
  // ============================================================
  function renderStudents() {
    const list = $('studentList');
    list.innerHTML = '';
    if (!currentClass) {
      $('studentEmpty').classList.remove('wc-hidden');
      $('studentEmpty').textContent = 'Create a class first.';
      return;
    }
    if (!students.length) {
      $('studentEmpty').classList.remove('wc-hidden');
      $('studentEmpty').textContent = 'No students yet — add one below.';
      return;
    }
    $('studentEmpty').classList.add('wc-hidden');
    // Reward-fade visibility — show each student's cumulative pages
    // read, plus their current reward intensity when fade is active.
    const sFlags  = (currentClass && currentClass.hide_features) || {};
    const fadeOn  = ['slow', 'normal', 'fast'].includes(sFlags.rewardFade);
    students.forEach(s => {
      const row = document.createElement('div');
      row.className = 'wc-list-item';
      const seen = s.last_seen_at ? new Date(s.last_seen_at).toLocaleDateString('en-NZ') : 'never';
      const pagesRead = s.total_pages_read || 0;
      const intensityChip = fadeOn
        ? ` · 🌱 강도 ${window.WCDB.rewardIntensity(pagesRead, sFlags).toFixed(2)}`
        : '';
      row.innerHTML = `
        <div>
          <div class="title">${escapeHtml(s.real_name)}</div>
          <div class="meta">
            ${escapeHtml(s.gender || '—')}
            · code <strong style="letter-spacing:3px;font-family:monospace;">${s.login_code || '—'}</strong>
            · 💰 ${s.money || 0}
            · ⭐ Lv ${s.encounter_level || 1}
            · 📖 ${pagesRead}p${intensityChip}
            · seen ${seen}
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="wc-btn ghost" data-impersonate="${s.id}" title="See this student's lesson view">👁 View as</button>
          <button class="wc-btn ghost" data-regen="${s.id}">New code</button>
          <button class="wc-btn ghost" data-reset-colors="${s.id}"
                  title="Clear every word-color mark this student has made">
            🧹 Reset colors
          </button>
        </div>
      `;
      list.appendChild(row);
    });
    // Wipe a student's word-state table. We confirm before deleting
    // because there's no per-row undo — once the rows are gone, the
    // student's level marks are lost. The button is disabled mid-
    // request so a double-click doesn't fire twice.
    list.querySelectorAll('[data-reset-colors]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.resetColors;
        const s  = students.find(st => st.id === id);
        const name = s ? s.real_name : 'this student';
        if (!confirm(`Reset all word colors for ${name}?\n\nEvery word they've marked will be cleared and they'll start fresh.`)) return;
        const oldLabel = b.textContent;
        b.disabled = true;
        b.textContent = 'Resetting…';
        try {
          await window.WCDB.wordStates.deleteAllForUser(id);
          b.textContent = '✓ Reset';
          setTimeout(() => { b.textContent = oldLabel; b.disabled = false; }, 1500);
        } catch (e) {
          alert('Could not reset: ' + (e.message || e));
          b.disabled = false;
          b.textContent = oldLabel;
        }
      });
    });
    list.querySelectorAll('[data-regen]').forEach(b => {
      b.addEventListener('click', async () => {
        const existing = new Set(students.map(s => s.login_code).filter(Boolean));
        const code = generateCode(existing);
        await window.WCDB.users.update(b.dataset.regen, { login_code: code });
        await refreshAll();
      });
    });
    // "View as" — teacher takes the student's seat without logging
    // out. The current teacher session is stashed; a yellow banner
    // appears site-wide with "↩ Switch back to teacher".
    list.querySelectorAll('[data-impersonate]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.impersonate;
        const student = students.find(s => s.id === id);
        if (!student) return;
        if (!student.login_code) {
          alert('This student has no login code yet — give them one first.');
          return;
        }
        window.WCAuth.impersonate(student);
        location.href = './home.html';
      });
    });
  }

  $('addStudentBtn').addEventListener('click', async () => {
    const msg = $('addStudentMsg');
    msg.classList.add('wc-hidden');
    if (!currentClass) {
      msg.textContent = 'Create a class first.';
      msg.className = 'wc-alert error'; msg.classList.remove('wc-hidden'); return;
    }
    const name = $('newStudentName').value.trim();
    const gender = $('newStudentGender').value;
    if (!name) {
      msg.textContent = 'Please enter a name.';
      msg.className = 'wc-alert error'; msg.classList.remove('wc-hidden'); return;
    }
    // Collect ALL existing codes (across the whole site) so we never
    // accidentally pick one already in use by a student in another class.
    const allCodedRows = await fetch(window.WC_SUPABASE.url
      + '/rest/v1/wc_users?select=login_code', {
        headers: { apikey: window.WC_SUPABASE.anon, Authorization: 'Bearer ' + window.WC_SUPABASE.anon },
      }).then(r => r.json()).catch(() => []);
    const existing = new Set(allCodedRows.map(r => r.login_code).filter(Boolean));
    const code = generateCode(existing);
    try {
      await window.WCDB.users.create({
        role: 'student', real_name: name, gender, class_id: currentClass.id, login_code: code,
      });
      msg.textContent = `Added ${name}. Code: ${code} — write this down for them!`;
      msg.className = 'wc-alert ok'; msg.classList.remove('wc-hidden');
      $('newStudentName').value = '';
      await refreshAll();
    } catch (e) {
      msg.textContent = e.message || 'Could not add student.';
      msg.className = 'wc-alert error'; msg.classList.remove('wc-hidden');
    }
  });

  // ----------------------------------------------------------------
  //  CACHE PREWARM
  //
  //  Pre-fetches every sentence's chunks + every (word, sentence)
  //  word-info BEFORE any student opens the lesson. After this
  //  finishes, the first student to read the lesson sees no GPT
  //  latency — both wc_word_info_cache and chunk_gpt_cache are
  //  fully populated.
  //
  //  Runs in parallel batches of 5 to avoid hammering the edge fns
  //  with hundreds of simultaneous requests. Reports live progress
  //  on the triggering button so the teacher can watch it land.
  // ----------------------------------------------------------------
  async function prewarmLesson(lessonId, btn) {
    const L = lessons.find(x => x.id === lessonId);
    if (!L) return;
    if (btn.dataset.busy === '1') return;   // ignore double-clicks
    btn.dataset.busy = '1';
    const origLabel = btn.textContent;

    const sentences = extractPrewarmSentences(L.body || '');
    const wordPairs = extractPrewarmWordPairs(sentences);
    const total = sentences.length + wordPairs.length;
    if (total === 0) {
      btn.textContent = '∅ Empty';
      setTimeout(() => { btn.textContent = origLabel; btn.dataset.busy = ''; }, 1500);
      return;
    }

    let done = 0;
    const updateLabel = () => {
      btn.textContent = `🔥 ${done}/${total}`;
    };
    updateLabel();

    const URL  = window.WC_SUPABASE.url.replace(/\/+$/, '');
    const ANON = window.WC_SUPABASE.anon;
    const baseHeaders = {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: 'Bearer ' + ANON,
    };

    // Chunk-gpt fan-out — one POST per unique sentence.
    await runInBatches(sentences, 5, async (sentence) => {
      try {
        await fetch(URL + '/functions/v1/chunk-gpt', {
          method: 'POST', headers: baseHeaders,
          body: JSON.stringify({ sentence }),
        });
      } catch {}
      done++; updateLabel();
    });

    // Word-info fan-out — one POST per (word, sentence) pair.
    await runInBatches(wordPairs, 5, async (pair) => {
      try {
        await fetch(URL + '/functions/v1/wc-word-info-gpt', {
          method: 'POST', headers: baseHeaders,
          body: JSON.stringify({ word: pair.word, sentence: pair.sentence }),
        });
      } catch {}
      done++; updateLabel();
    });

    btn.textContent = '✓ Prewarmed';
    // Remember the body hash so the lesson list can show a ✓ chip
    // next to 🔥 on the next render. The hash invalidates the mark
    // automatically the moment the teacher edits the body (different
    // hash → no ✓), so a stale mark can't mislead.
    try {
      localStorage.setItem('wc.prewarm.text.' + lessonId, bodyHash(L.body));
    } catch {}
    setTimeout(() => {
      btn.textContent = origLabel;
      btn.dataset.busy = '';
      renderLessons();   // surface the new ✓ chip
    }, 2500);
  }

  // ----------------------------------------------------------------
  //  AUDIO PREWARM — populate `wc_tts_cache` with every sentence's
  //  Google TTS MP3. After this finishes, ▶ playback for the lesson
  //  is instant — the edge function reads from the DB cache instead
  //  of paying for a Google TTS round-trip per sentence.
  //
  //  Concurrency is lower (2 in-flight) than the GPT prewarm because
  //  Google TTS has tighter rate limits on per-second character spend.
  // ----------------------------------------------------------------
  async function prewarmAudio(lessonId, btn) {
    const L = lessons.find(x => x.id === lessonId);
    if (!L) return;
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    const origLabel = btn.textContent;

    const sentences = extractPrewarmSentences(L.body || '');
    if (!sentences.length) {
      btn.textContent = '∅ Empty';
      setTimeout(() => { btn.textContent = origLabel; btn.dataset.busy = ''; }, 1500);
      return;
    }

    let done = 0;
    const updateLabel = () => { btn.textContent = `🎵 ${done}/${sentences.length}`; };
    updateLabel();

    const URL  = window.WC_SUPABASE.url.replace(/\/+$/, '');
    const ANON = window.WC_SUPABASE.anon;
    const headers = {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: 'Bearer ' + ANON,
    };

    await runInBatches(sentences, 2, async (sentence) => {
      try {
        await fetch(URL + '/functions/v1/wc-tts-google', {
          method: 'POST', headers,
          body: JSON.stringify({
            text:  sentence,
            voice: 'en-AU-Neural2-A',
            rate:  1.0,
          }),
        });
      } catch {}
      done++; updateLabel();
    });

    btn.textContent = '✓ Audio ready';
    try {
      localStorage.setItem('wc.prewarm.audio.' + lessonId, bodyHash(L.body));
    } catch {}
    setTimeout(() => {
      btn.textContent = origLabel;
      btn.dataset.busy = '';
      renderLessons();   // surface the new ✓ chip
    }, 2500);
  }

  // ----------------------------------------------------------------
  //  CHUNK-AUDIO PREWARM — populate wc_tts_cache with every CHUNK's
  //  TTS clip. The sentence-level 🎵 prewarm doesn't help here:
  //  chunk-on-tap audio (the speak that fires when a student clicks
  //  a word with "Play chunk" enabled) passes the CHUNK text — e.g.
  //  "scared of" — not the full sentence, so the cache key is
  //  different. Without this prewarm, every first-tap on a word is
  //  a Google TTS round-trip.
  //
  //  Two passes:
  //    1. Fan out chunk-gpt for every sentence to discover the chunk
  //       boundaries (chunk-gpt's own cache makes re-runs free after
  //       the first 🔥 prewarm). Collect a dedup'd set of chunk
  //       texts across the whole lesson.
  //    2. Fan out wc-tts-google for each unique chunk text, batch
  //       size 2 to respect Google TTS rate limits.
  // ----------------------------------------------------------------
  async function prewarmChunkAudio(lessonId, btn) {
    const L = lessons.find(x => x.id === lessonId);
    if (!L) return;
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    const origLabel = btn.textContent;

    const sentences = extractPrewarmSentences(L.body || '');
    if (!sentences.length) {
      btn.textContent = '∅ Empty';
      setTimeout(() => { btn.textContent = origLabel; btn.dataset.busy = ''; }, 1500);
      return;
    }

    const URL  = window.WC_SUPABASE.url.replace(/\/+$/, '');
    const ANON = window.WC_SUPABASE.anon;
    const headers = {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: 'Bearer ' + ANON,
    };

    // ── Pass 1: gather unique chunk texts.
    btn.textContent = '🎶 Reading chunks…';
    const chunkTexts = new Set();
    await runInBatches(sentences, 5, async (sentence) => {
      try {
        const r = await fetch(URL + '/functions/v1/chunk-gpt', {
          method: 'POST', headers,
          body: JSON.stringify({ sentence }),
        });
        if (!r.ok) return;
        const j = await r.json();
        const chunks = Array.isArray(j.chunks) ? j.chunks : [];
        chunks.forEach(c => {
          const t = String(c && c.text || '').trim();
          if (t) chunkTexts.add(t);
        });
      } catch {}
    });

    const chunkList = [...chunkTexts];
    if (!chunkList.length) {
      btn.textContent = '∅ No chunks';
      setTimeout(() => { btn.textContent = origLabel; btn.dataset.busy = ''; }, 1500);
      return;
    }

    // ── Pass 2: TTS each chunk so wc_tts_cache covers it.
    let done = 0;
    const updateLabel = () => { btn.textContent = `🎶 ${done}/${chunkList.length}`; };
    updateLabel();
    await runInBatches(chunkList, 2, async (text) => {
      try {
        await fetch(URL + '/functions/v1/wc-tts-google', {
          method: 'POST', headers,
          body: JSON.stringify({
            text,
            voice: 'en-AU-Neural2-A',
            rate:  1.0,
          }),
        });
      } catch {}
      done++; updateLabel();
    });

    btn.textContent = '✓ Chunks ready';
    try {
      localStorage.setItem('wc.prewarm.chunkaudio.' + lessonId, bodyHash(L.body));
    } catch {}
    setTimeout(() => {
      btn.textContent = origLabel;
      btn.dataset.busy = '';
      renderLessons();
    }, 2500);
  }

  // ----------------------------------------------------------------
  //  KOR-BAR PREWARM — pre-fetch the Korean sidebar content (the
  //  word / chunk card shown when a student has "Kor Bar" selected
  //  on the lesson page). Mirrors the 🔥 prewarm but targets the
  //  Korean endpoint: chunk-level Korean per sentence + a Korean
  //  word card per (word, sentence) pair.
  //
  //  The `wc-korbar-gpt` edge function ships together with the Kor
  //  Bar sidebar itself (a later phase). Until it is deployed every
  //  request 404s, so `ok` stays 0 and we show "Not ready" instead
  //  of a misleading ✓ — and skip the localStorage cache mark. Once
  //  the function exists this button works with no further change.
  // ----------------------------------------------------------------
  async function prewarmKorBar(lessonId, btn) {
    const L = lessons.find(x => x.id === lessonId);
    if (!L) return;
    if (btn.dataset.busy === '1') return;   // ignore double-clicks
    btn.dataset.busy = '1';
    const origLabel = btn.textContent;

    const sentences = extractPrewarmSentences(L.body || '');
    const wordPairs = extractPrewarmWordPairs(sentences);
    const total = wordPairs.length;
    if (total === 0) {
      btn.textContent = '∅ Empty';
      setTimeout(() => { btn.textContent = origLabel; btn.dataset.busy = ''; }, 1500);
      return;
    }

    let done = 0, ok = 0;
    const updateLabel = () => { btn.textContent = `🇰🇷 ${done}/${total}`; };
    updateLabel();

    const URL  = window.WC_SUPABASE.url.replace(/\/+$/, '');
    const ANON = window.WC_SUPABASE.anon;
    const headers = {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: 'Bearer ' + ANON,
    };
    const FN = URL + '/functions/v1/wc-korbar-gpt';

    // Word-level Korean card — one POST per (word, sentence) pair.
    // (Chunk Korean is fetched lazily on the lesson page — the chunk
    // boundaries aren't known here without a chunk-gpt pass.)
    await runInBatches(wordPairs, 5, async (pair) => {
      try {
        const r = await fetch(FN, {
          method: 'POST', headers,
          body: JSON.stringify({ kind: 'word', word: pair.word, sentence: pair.sentence }),
        });
        if (r.ok) ok++;
      } catch {}
      done++; updateLabel();
    });

    if (ok > 0) {
      btn.textContent = '✓ Kor ready';
      try {
        localStorage.setItem('wc.prewarm.korbar.' + lessonId, bodyHash(L.body));
      } catch {}
    } else {
      // wc-korbar-gpt not deployed yet — don't fake a ✓.
      btn.textContent = '⚠ Not ready';
    }
    setTimeout(() => {
      btn.textContent = origLabel;
      btn.dataset.busy = '';
      renderLessons();
    }, 2800);
  }

  // ----------------------------------------------------------------
  //  QUIZ PREWARM (📝) — pre-build the Korean animal-encounter quiz.
  //
  //  The quiz (quiz.js → buildKorMcqQuestions) needs, per sentence,
  //  a Korean translation (cloze + unscramble question types) and,
  //  for the comprehension type, one GPT batch over the passage.
  //  Word meanings are already covered by the 🇰🇷 Kor Bar prewarm;
  //  this button warms the translation + comprehension caches so the
  //  first encounter quiz pops up instantly.
  //
  //  Comic lessons keep their dialogue in speech bubbles, not in
  //  `body` — quizBodyKey / extractQuizSentences fold those in so a
  //  comic lesson is prewarmed (and cache-tracked) correctly too.
  // ----------------------------------------------------------------
  function quizBodyKey(L) {
    // Hash source for the ✓ cache pip — body PLUS every bubble's
    // text, so editing comic dialogue invalidates the cache mark.
    let extra = '';
    if (L && Array.isArray(L.images)) {
      L.images.forEach(im => {
        if (im && Array.isArray(im.bubbles)) {
          im.bubbles.forEach(b => {
            if (b && typeof b.text === 'string') extra += '' + b.text;
          });
        }
      });
    }
    return String((L && L.body) || '') + extra;
  }
  function extractQuizSentences(L) {
    const out = extractPrewarmSentences((L && L.body) || '');
    // Comic dialogue lives in image speech bubbles. Split each
    // bubble crudely into sentences — best-effort: a cache miss just
    // means the student waits a beat, never a broken quiz.
    if (L && Array.isArray(L.images)) {
      L.images.forEach(im => {
        if (im && Array.isArray(im.bubbles)) {
          im.bubbles.forEach(b => {
            const t = (b && typeof b.text === 'string') ? b.text.trim() : '';
            if (!t) return;
            t.split(/(?<=[.!?])\s+/).forEach(s => {
              const c = s.trim();
              if (c) out.push(c);
            });
          });
        }
      });
    }
    return Array.from(new Set(out));
  }
  async function prewarmQuiz(lessonId, btn) {
    const L = lessons.find(x => x.id === lessonId);
    if (!L) return;
    if (btn.dataset.busy === '1') return;   // ignore double-clicks
    btn.dataset.busy = '1';
    const origLabel = btn.textContent;

    // Cloze / unscramble need a sentence with ≥4 words; those are
    // the ones whose translation is worth warming.
    const longish = extractQuizSentences(L)
      .filter(s => (s.match(/[A-Za-z]+/g) || []).length >= 4);
    if (longish.length === 0) {
      btn.textContent = '∅ Empty';
      setTimeout(() => { btn.textContent = origLabel; btn.dataset.busy = ''; }, 1500);
      return;
    }

    const total = longish.length + 1;   // +1 for the comprehension call
    let done = 0, ok = 0;
    const updateLabel = () => { btn.textContent = `📝 ${done}/${total}`; };
    updateLabel();

    const URL  = window.WC_SUPABASE.url.replace(/\/+$/, '');
    const ANON = window.WC_SUPABASE.anon;
    const headers = {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: 'Bearer ' + ANON,
    };
    const FN = URL + '/functions/v1/wc-korbar-gpt';

    // Per-sentence Korean translation.
    await runInBatches(longish, 5, async (sent) => {
      try {
        const r = await fetch(FN, {
          method: 'POST', headers,
          body: JSON.stringify({ kind: 'translate', sentence: sent }),
        });
        if (r.ok) ok++;
      } catch {}
      done++; updateLabel();
    });
    // One comprehension batch over the whole-lesson passage (matches
    // the quiz's scope once a student has read the full lesson).
    try {
      const passage = longish.join(' ').slice(0, 1500);
      const r = await fetch(FN, {
        method: 'POST', headers,
        body: JSON.stringify({ kind: 'comprehension', passage }),
      });
      if (r.ok) ok++;
    } catch {}
    done++; updateLabel();

    if (ok > 0) {
      btn.textContent = '✓ Quiz ready';
      try {
        localStorage.setItem('wc.prewarm.quiz.' + lessonId, bodyHash(quizBodyKey(L)));
      } catch {}
    } else {
      // wc-korbar-gpt not deployed yet — don't fake a ✓.
      btn.textContent = '⚠ Not ready';
    }
    setTimeout(() => {
      btn.textContent = origLabel;
      btn.dataset.busy = '';
      renderLessons();
    }, 2800);
  }

  // Cache-status helpers — used by renderLessons() to draw the ✓
  // pip next to the 🔥 / 🎵 buttons whenever the lesson's CURRENT
  // body matches the body that was prewarmed. Hash is a fast djb2
  // variant — overkill collision-wise for a few-thousand-char body,
  // and short enough not to bloat localStorage.
  function bodyHash(body) {
    let h = 5381;
    const s = String(body || '');
    for (let i = 0; i < s.length; i++) {
      h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
  }
  function isPrewarmCached(lessonId, body, kind /* 'text' | 'audio' */) {
    try {
      const stored = localStorage.getItem('wc.prewarm.' + kind + '.' + lessonId);
      return !!stored && stored === bodyHash(body);
    } catch {
      return false;
    }
  }

  // Pull a unique list of sentences out of the lesson body. Mirrors
  // what `tokeniseBody` does on the lesson page so the wc_tts_cache
  // entries we create here actually match the text playAllFromCurrent
  // will later send to wc-tts-google. Three input shapes handled:
  //   1. Markdown body — strip the toolbar markers (# / ** / __ /
  //      {color:…} / ---) so the underlying prose remains.
  //   2. HTML body — walk text nodes separately (not textContent of
  //      the wrapper), which keeps adjacent `<p>` siblings from
  //      being fused into a single fake sentence.
  //   3. Plain text — use the body as-is.
  // Image markers are stripped in all paths. Both terminated
  // sentences AND no-terminator tails are emitted (the lesson
  // renderer treats both as sentences).
  function extractPrewarmSentences(body) {
    let raw = body || '';

    const hasMarkdownMarker =
      /^#{1,3}\s/m.test(raw)
      || /\*\*[\s\S]+?\*\*/.test(raw)
      || /__[\s\S]+?__/.test(raw)
      || /\{color:[^}]+\}[\s\S]+?\{\/color\}/.test(raw)
      || /^---+\s*$/m.test(raw);

    let lines = [];
    if (hasMarkdownMarker) {
      // Strip markdown markers and keep the prose.
      raw = raw
        .replace(/^#{1,3}\s+/gm, '')
        .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
        .replace(/__([\s\S]+?)__/g, '$1')
        .replace(/\{color:[^}]+\}([\s\S]+?)\{\/color\}/g, '$1')
        .replace(/^---+\s*$/gm, '');
      lines = raw.split(/\n+/);
    } else if (/<[a-z]/i.test(raw)) {
      // HTML — walk each text node so paragraph boundaries are kept.
      const tmp = document.createElement('div');
      tmp.innerHTML = raw;
      const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.textContent;
        if (t && t.trim()) lines.push(t);
      }
    } else {
      lines = raw.split(/\n+/);
    }

    const sentRe = /[^.!?]+[.!?]+["'’)\]]*/g;
    const seen = new Set();
    const out  = [];
    const remember = (s) => {
      const trimmed = (s || '').replace(/\[\[IMG:\d+\]\]/g, ' ').trim();
      if (trimmed.length < 4) return;
      const key = trimmed.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) return;
      seen.add(key);
      out.push(trimmed);
    };

    for (const line of lines) {
      const text = line.replace(/\[\[IMG:\d+\]\]/g, ' ');
      if (!text.trim()) continue;
      sentRe.lastIndex = 0;
      let m, lastEnd = 0;
      while ((m = sentRe.exec(text)) !== null) {
        remember(m[0]);
        lastEnd = m.index + m[0].length;
      }
      // No-terminator tail (e.g. titles, last fragment) becomes a
      // "sentence" too — the renderer does the same.
      if (lastEnd < text.length) remember(text.slice(lastEnd));
    }
    return out;
  }

  // For each sentence, yield (word, sentence) pairs — the same
  // shape word-info-gpt expects. We dedupe across the whole body so
  // a common word like "the" only gets one fetch in total.
  function extractPrewarmWordPairs(sentences) {
    const wre = /[A-Za-z][A-Za-z'’\-]*[A-Za-z]|[A-Za-z]/g;
    const seen = new Set();
    const out  = [];
    sentences.forEach(sent => {
      let m;
      while ((m = wre.exec(sent)) !== null) {
        const w = m[0];
        const lower = w.toLowerCase().replace(/[’]/g, "'");
        // Dedupe key = lower + sentence hash so each (word, sentence)
        // pair only fires once. Sense disambiguation needs the
        // sentence context.
        const key = lower + '::' + sent;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ word: w, sentence: sent });
      }
    });
    return out;
  }

  // Tiny concurrency limiter — keeps at most `limit` tasks in flight.
  async function runInBatches(items, limit, worker) {
    const queue = items.slice();
    const runners = Array.from({ length: limit }, async () => {
      while (queue.length) {
        const item = queue.shift();
        await worker(item);
      }
    });
    await Promise.all(runners);
  }

  function generateCode(existing) {
    const banned = new Set(['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321']);
    for (let i = 0; i < 200; i++) {
      const s = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      if (!banned.has(s) && !existing.has(s)) return s;
    }
    throw new Error('Could not generate a unique code — too many students.');
  }

  // ----------------------------------------------------------------
  //  Print login cards — opens a new tab with a print-ready A4 sheet
  //  laid out 2 columns × 5 rows (10 cards per page). Teachers print
  //  it, cut on the dashed lines, and hand each student their card.
  //
  //  Pop-ups can be blocked; we fail loud with a helpful message.
  //  Cards include the site URL so students don't have to ask twice.
  // ----------------------------------------------------------------
  $('printCardsBtn').addEventListener('click', () => {
    if (!currentClass) { alert('Pick or create a class first.'); return; }
    const cardable = students.filter(s => s.login_code);
    if (!cardable.length) {
      alert('No students with login codes yet. Add a student first.');
      return;
    }
    const skipped = students.length - cardable.length;
    if (skipped > 0 &&
        !confirm(`${skipped} student${skipped===1?'':'s'} ${skipped===1?'has':'have'} no login code yet and will be skipped. Print the rest?`)) {
      return;
    }
    openPrintWindow(cardable, currentClass);
  });

  function openPrintWindow(studentList, klass) {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Pop-ups are blocked. Allow pop-ups for this page and try again.');
      return;
    }
    win.document.write(buildPrintHTML(studentList, klass));
    win.document.close();
    win.focus();
  }

  function buildPrintHTML(studentList, klass) {
    // Where students go to sign in — derive from this page's URL so
    // it works on localhost, a dev server, or a production deploy
    // without hardcoding anything.
    const signInURL = location.origin
      + location.pathname.replace(/teacher\.html.*$/, 'index.html');

    // Chunk into groups of 8. We render exactly 8 slots per page,
    // padding the final page with empty placeholders so the cut
    // lines stay aligned and the grid doesn't visually "shrink".
    // 8-up (2×4) gives each card noticeably more room than 10-up,
    // making the 4-digit code easier for younger students to read.
    const PAGE_SIZE = 8;
    const pages = [];
    for (let i = 0; i < studentList.length; i += PAGE_SIZE) {
      pages.push(studentList.slice(i, i + PAGE_SIZE));
    }

    const css = `
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background: #f4f1ea;
        color: #2A2A33;
      }
      .topbar {
        position: sticky; top: 0; z-index: 10;
        background: #fff; border-bottom: 1px solid #ddd;
        padding: 14px 20px;
        display: flex; align-items: center; gap: 16px;
        flex-wrap: wrap;
      }
      .topbar h1 { margin: 0; font-size: 18px; }
      .topbar button {
        appearance: none; cursor: pointer;
        background: #F77F4E; color: #fff;
        border: none; border-radius: 8px;
        font: inherit; font-weight: 700;
        padding: 10px 16px;
      }
      .topbar small { color: #777; }
      .stage { padding: 24px 0; }

      @page { size: A4 portrait; margin: 8mm; }

      .sheet {
        width: 194mm;
        height: 281mm;
        margin: 0 auto 18px;
        background: #fff;
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: repeat(4, 1fr);
        gap: 5mm;
        padding: 0;
        box-shadow: 0 6px 24px rgba(0,0,0,.08);
        page-break-after: always;
      }
      .sheet:last-child { page-break-after: auto; }

      .card {
        border: 1.4px dashed #b9b3a3;
        border-radius: 6px;
        padding: 5mm 6mm;
        display: flex; flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
      }
      .card.empty {
        border-style: dotted;
        opacity: .25;
      }

      .card .brand {
        font-size: 12pt;
        font-weight: 800;
        color: #F77F4E;
        letter-spacing: -.3px;
      }
      .card .brand span { color: #4FB3D9; }

      .card .greet {
        font-size: 14pt;
        margin-top: 2mm;
        line-height: 1.25;
      }
      .card .greet .emoji { margin-right: 1mm; }

      .card .codelabel {
        font-size: 8.5pt;
        text-transform: uppercase;
        letter-spacing: 1pt;
        color: #888;
        margin-top: 3mm;
      }
      .card .code {
        font-family: "SF Mono", Menlo, Consolas, monospace;
        font-size: 30pt;
        font-weight: 700;
        letter-spacing: 6pt;
        line-height: 1;
        text-align: center;
        background: #FFF3E5;
        border: 1.5px solid #F4C8A2;
        border-radius: 6px;
        padding: 3mm 0;
        margin-top: 1mm;
      }

      .card .foot {
        margin-top: 3mm;
        font-size: 8.5pt;
        color: #666;
        line-height: 1.35;
      }
      .card .foot .url {
        font-family: "SF Mono", Menlo, monospace;
        font-size: 8.5pt;
        color: #2A2A33;
        word-break: break-all;
      }
      .card .foot .klass {
        margin-top: 1mm;
        color: #999;
      }

      @media screen {
        .stage { padding-top: 18px; }
      }
      @media print {
        .topbar { display: none; }
        body { background: #fff; }
        .sheet { box-shadow: none; margin: 0 auto; }
        .stage { padding: 0; }
      }
    `;

    function renderCard(s) {
      const genderEmoji = ({ girl:'👧', boy:'👦', other:'🙂' })[s.gender] || '🙂';
      const codeStr = String(s.login_code || '').split('').join(' ');
      return `
        <div class="card">
          <div>
            <div class="brand">A<span>ko</span></div>
            <div class="greet"><span class="emoji">${genderEmoji}</span>Kia ora, <strong>${escapeHtml(s.real_name)}</strong>!</div>
          </div>
          <div>
            <div class="codelabel">Your code</div>
            <div class="code">${codeStr}</div>
          </div>
          <div class="foot">
            Sign in at:<br>
            <span class="url">${escapeHtml(signInURL)}</span>
            <div class="klass">Class: ${escapeHtml(klass.name)}</div>
          </div>
        </div>
      `;
    }

    function renderSheet(group) {
      const cells = group.map(renderCard);
      // pad with empty placeholders to 10 slots
      for (let i = group.length; i < PAGE_SIZE; i++) {
        cells.push('<div class="card empty"></div>');
      }
      return `<div class="sheet">${cells.join('')}</div>`;
    }

    return `<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<title>Login cards — ${escapeHtml(klass.name)}</title>
<style>${css}</style>
</head>
<body>
  <div class="topbar">
    <h1>Login cards — ${escapeHtml(klass.name)} (${studentList.length})</h1>
    <button onclick="window.print()">🖨 Print these cards</button>
    <small>Tip: cut along the dashed lines and hand each student their card.</small>
  </div>
  <div class="stage">
    ${pages.map(renderSheet).join('')}
  </div>
</body>
</html>`;
  }

  // ============================================================
  //  TAB 2 — LESSONS
  // ============================================================
  function renderLessons() {
    const list = $('lessonList');
    list.innerHTML = '';
    if (!lessons.length) {
      list.innerHTML = '<p class="wc-muted wc-center">No lessons yet.</p>';
      return;
    }
    lessons.forEach(L => {
      const todaySent = countGiftsToday(L.id);
      const imgCount = Array.isArray(L.images) ? L.images.length : 0;
      const editing = editingLessonId === L.id;
      const isHidden = !!L.hidden;
      const row = document.createElement('div');
      row.className = 'wc-list-item' + (editing ? ' wc-editing' : '');
      if (isHidden) row.style.opacity = '0.55';
      // Title is the preview link — clicking it opens the lesson in
      // a new tab as a student would see it. Avoids a separate
      // Preview button, which was crowding the action row.
      const previewHref = './lesson.html?id=' + encodeURIComponent(L.id) + '&preview=1';
      const coverThumb = L.cover_image_url
        ? `<img src="${escapeHtml(L.cover_image_url)}" alt=""
             style="width:36px;height:48px;object-fit:contain;
                    border:1px solid var(--line,#d1d5db);border-radius:4px;
                    background:#f8fafc;vertical-align:middle;margin-right:8px;" />`
        : '';
      row.innerHTML = `
        <div style="display:flex;align-items:center;">
          ${coverThumb}
          <div>
          <div class="title">
            <a href="${previewHref}" target="_blank" rel="noopener"
               title="Open this lesson in a new tab, as a student would see it"
               style="color:inherit; text-decoration:none; border-bottom:1px dashed currentColor;">${escapeHtml(L.title)}</a>
            ${editing  ? ' <span class="wc-muted" style="font-size:13px;">(editing)</span>' : ''}
            ${isHidden ? ' <span style="font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:999px;margin-left:6px;">Hidden</span>' : ''}
          </div>
          <div class="meta">
            ${escapeHtml(L.animal_set)} ·
            🎁 ${todaySent} / ${L.gift_limit_per_day} sent today
            ${imgCount ? ' · 📷 ' + imgCount : ''}
            ${L.cover_image_url ? ' · 📕 cover' : ''}
            · ${new Date(L.created_at).toLocaleDateString('en-NZ')}
          </div>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="wc-btn ghost" data-edit="${L.id}"
                  title="Open this lesson in the edit form below">✏️ Edit</button>
          <button class="wc-btn ghost" data-toggle-hidden="${L.id}"
                  title="${isHidden ? 'Show this lesson to students again' : 'Hide this lesson from students'}">
            ${isHidden ? '👁 Show' : '🙈 Hide'}
          </button>
          <button class="wc-btn ghost icon-only${isPrewarmCached(L.id, L.body, 'text')  ? ' is-cached' : ''}"
                  data-prewarm="${L.id}"
                  title="Prewarm: pre-fetch sentence chunks + word-info data so the first student doesn't wait. ✓ = cached for this body — re-click to refresh after edits.">🔥</button>
          <button class="wc-btn ghost icon-only${isPrewarmCached(L.id, L.body, 'audio') ? ' is-cached' : ''}"
                  data-prewarmaudio="${L.id}"
                  title="Sentence audio: cache TTS for every full sentence (used by ▶ Play and the auto-advance reader). ✓ = cached for this body.">🎵</button>
          <button class="wc-btn ghost icon-only${isPrewarmCached(L.id, L.body, 'chunkaudio') ? ' is-cached' : ''}"
                  data-prewarmchunkaudio="${L.id}"
                  title="Chunk audio: cache TTS for each chunk (the short clip that plays when a student taps a word with Play chunk on). Different cache key than 🎵 — needed separately. ✓ = cached for this body.">🎶</button>
          <button class="wc-btn ghost icon-only${isPrewarmCached(L.id, L.body, 'korbar') ? ' is-cached' : ''}"
                  data-prewarmkorbar="${L.id}"
                  title="Kor Bar: pre-fetch the Korean sidebar content shown when a student picks 'Kor Bar' on the lesson page. ✓ = cached for this body. (Needs the wc-korbar-gpt function deployed; shows 'Not ready' until then.)">🇰🇷</button>
          <button class="wc-btn ghost icon-only${isPrewarmCached(L.id, quizBodyKey(L), 'quiz') ? ' is-cached' : ''}"
                  data-prewarmquiz="${L.id}"
                  title="문제 만들기: pre-build the Korean quiz data — sentence translations + a comprehension batch — so the first animal-encounter quiz appears with no wait. Covers comic speech-bubble dialogue too. ✓ = cached for this lesson. (Needs the wc-korbar-gpt function deployed.)">📝</button>
          <!-- Per-lesson default toggles. Each click flips the
               column on wc_lessons; the lesson page reads these to
               set the INITIAL state of its 🔊/🐾 chips. Compact
               icon-only buttons keep the action row from wrapping. -->
          <button class="wc-btn ghost icon-only wc-mini-toggle${(L.default_play_chunk !== false) ? ' on' : ''}"
                  data-toggle-chunkdefault="${L.id}"
                  title="Default for 'Play chunk' chip on student side. Click to flip.">${(L.default_play_chunk !== false) ? '🔊' : '🔇'}</button>
          <button class="wc-btn ghost icon-only wc-mini-toggle${(L.default_animals === true) ? ' on' : ''}"
                  data-toggle-animalsdefault="${L.id}"
                  title="Default for 'Animals' chip on student side. Click to flip.">${(L.default_animals === true) ? '🐾' : '🚫'}</button>
          <button class="wc-btn ghost wc-btn-danger icon-only" data-delete-row="${L.id}"
                  title="Permanently delete this lesson — cannot be undone">🗑</button>
        </div>
      `;
      list.appendChild(row);
    });
    list.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', () => startEditing(b.dataset.edit));
    });
    list.querySelectorAll('[data-toggle-hidden]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.toggleHidden;
        const L  = lessons.find(x => x.id === id);
        if (!L) return;
        const next = !L.hidden;
        // Optimistic: flip the local row first so the button label
        // updates instantly even before the PATCH round-trips.
        L.hidden = next;
        b.disabled = true;
        try {
          await window.WCDB.lessons.update(id, { hidden: next });
          await refreshAll();
        } catch (e) {
          L.hidden = !next;  // rollback
          alert('Could not change visibility: ' + (e.message || e));
        } finally {
          b.disabled = false;
        }
      });
    });
    list.querySelectorAll('[data-prewarm]').forEach(b => {
      b.addEventListener('click', () => prewarmLesson(b.dataset.prewarm, b));
    });
    list.querySelectorAll('[data-prewarmaudio]').forEach(b => {
      b.addEventListener('click', () => prewarmAudio(b.dataset.prewarmaudio, b));
    });
    list.querySelectorAll('[data-prewarmchunkaudio]').forEach(b => {
      b.addEventListener('click', () => prewarmChunkAudio(b.dataset.prewarmchunkaudio, b));
    });
    list.querySelectorAll('[data-prewarmkorbar]').forEach(b => {
      b.addEventListener('click', () => prewarmKorBar(b.dataset.prewarmkorbar, b));
    });
    list.querySelectorAll('[data-prewarmquiz]').forEach(b => {
      b.addEventListener('click', () => prewarmQuiz(b.dataset.prewarmquiz, b));
    });
    list.querySelectorAll('[data-toggle-chunkdefault]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.toggleChunkdefault;
        const L  = lessons.find(x => x.id === id);
        if (!L) return;
        // Treat missing/NULL as TRUE (Play chunk ON) so flipping
        // toggles cleanly: true → false → true → ...
        const next = !(L.default_play_chunk !== false);
        b.disabled = true;
        try {
          await window.WCDB.lessons.update(id, { default_play_chunk: next });
          L.default_play_chunk = next;        // optimistic local update
          renderLessons();
        } catch (e) {
          alert('Could not save: ' + (e.message || e));
        } finally {
          b.disabled = false;
        }
      });
    });
    list.querySelectorAll('[data-toggle-animalsdefault]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.toggleAnimalsdefault;
        const L  = lessons.find(x => x.id === id);
        if (!L) return;
        // Missing/NULL treated as FALSE (Animals off) — flip toggles.
        const next = !(L.default_animals === true);
        b.disabled = true;
        try {
          await window.WCDB.lessons.update(id, { default_animals: next });
          L.default_animals = next;
          renderLessons();
        } catch (e) {
          alert('Could not save: ' + (e.message || e));
        } finally {
          b.disabled = false;
        }
      });
    });
    list.querySelectorAll('[data-delete-row]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.deleteRow;
        const L = lessons.find(x => x.id === id);
        if (!L) return;
        if (!confirm(`Delete "${L.title}"? This can't be undone.`)) return;
        try {
          await window.WCDB.lessons.delete(id);
          if (editingLessonId === id) cancelEditing();
          await refreshAll();
        } catch (e) {
          alert('Could not delete: ' + (e.message || e));
        }
      });
    });
  }

  // ----------------------------------------------------------------
  //  EDIT MODE — load an existing lesson into the create form so the
  //  teacher can amend title/body/animal-set/gift-quota/images and
  //  PATCH the same row instead of creating a new one.
  // ----------------------------------------------------------------
  // ---- Lesson mode tabs (일반 글 / 만화 / 팝송) ----------------
  //  The chosen mode is saved on wc_lessons.mode; the lesson page
  //  renders the body area accordingly. Comic mode reuses the
  //  existing image / speech-bubble tools; song mode's mp3 + lyric
  //  tooling arrives in a later phase.
  let lessonMode = 'text';
  const LESSON_MODE_HINTS = {
    text:  '일반 글 — 문단 텍스트를 읽고 단어를 학습합니다. (지금까지의 방식)',
    comic: '만화 — 컷 이미지를 올리고 (이미지 추가 → Comic panel) 말풍선마다 텍스트를 넣습니다.',
    song:  '팝송 — 가사와 mp3를 올립니다. (mp3 자동 정렬·구간 재생은 다음 단계에서 추가됩니다.)',
  };
  function setLessonMode(mode) {
    lessonMode = (mode === 'comic' || mode === 'song') ? mode : 'text';
    document.querySelectorAll('#lessonModeTabs .wc-mode-tab').forEach(t => {
      const on = t.dataset.mode === lessonMode;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const hint = $('lessonModeHint');
    if (hint) hint.textContent = LESSON_MODE_HINTS[lessonMode] || '';
    // The "스크롤로 이어 보기" option only makes sense for comic
    // lessons — hide it for text / song.
    const scrollField = $('comicScrollField');
    if (scrollField) scrollField.classList.toggle('wc-hidden', lessonMode !== 'comic');
  }
  // ── Live lesson preview ──────────────────────────────────────────────
  // Renders a paginated miniature view inside #lessonPreviewPane.
  // Pages are split by VISUAL OVERFLOW: content is added chunk-by-chunk
  // into a hidden measuring div; when scrollHeight exceeds the body's
  // clientHeight a new page begins. This means the page count and split
  // points are exact for the current font size, not an approximation.
  // A−/A+ change font size AND re-paginate automatically.
  let _previewDebounce = null;
  let lpMiniPages      = [];  // pre-rendered HTML strings, one per page
  let lpMiniCurPage    = 0;   // 0-indexed
  let lpMiniFz         = 9;   // font-size px — starts at minimum so the pane shows the most content

  // Build pages by rendering each atomic chunk (text line or image) into
  // an off-screen div that mirrors .wc-lp-body exactly, splitting whenever
  // the content would exceed the visible body height.
  // Explicit --- markers are treated as forced page breaks.
  // Returns an array of pre-rendered HTML strings.
  function computeMiniPagesByHeight(rawBody, images) {
    const bodyEl = document.getElementById('lpBody');
    if (!bodyEl) return [''];
    const maxH   = bodyEl.clientHeight;  // visible height incl. padding
    const innerW = bodyEl.clientWidth;   // full width  incl. padding
    if (!maxH || !innerW) return [''];

    // Off-screen clone — must match .wc-lp-body padding/font/line-height.
    const m = document.createElement('div');
    m.style.cssText =
      'position:absolute;left:-9999px;top:0;' +
      `width:${innerW}px;` +
      `font-size:${lpMiniFz}px;` +
      'line-height:1.6;' +
      'padding:10px 12px;' +
      'box-sizing:border-box;' +
      'overflow-wrap:break-word;word-wrap:break-word;';
    document.body.appendChild(m);

    const CLEAR = '<div style="clear:both"></div>';
    const pages = [];

    // Split at --- first (forced page breaks), then overflow within each segment.
    rawBody.split(/\n\s*---\s*(?:\n|$)/).forEach(seg => {
      const segtrim = seg.trim();
      if (!segtrim) return;

      // Convert the segment into atomic HTML chunks.
      // tl/tr images go BEFORE text so they float-anchor to the text top.
      // bl/br images use position:absolute (bottom corner of the pane) so
      // they are appended last and don't affect scrollHeight measurements.
      const topFloatChunks = [];  // tl/tr — floated, rendered before text
      const textChunks     = [];  // text lines + cc/cs/panel images
      const bottomChunks   = [];  // bl/br — absolute-bottom, rendered last

      segtrim.split(/(\[\[IMG:\d+\]\])/).forEach(part => {
        const im = part.match(/^\[\[IMG:(\d+)\]\]$/);
        if (im) {
          const img    = images && images[parseInt(im[1], 10)];
          const src    = img && escapeHtml(img.url || img.data_url || '');
          const corner = (img && img.corner) || '';
          if (src) {
            const html = `<img src="${src}" style="${lpvImgStyleMini(corner, img.scale)}" alt="">`;
            if (/^(?:tl|tr)$/.test(corner))      topFloatChunks.push(html);
            else if (/^(?:bl|br)$/.test(corner)) bottomChunks.push(html);
            else                                  textChunks.push(html);
          }
        } else {
          part.split('\n').forEach(line => {
            if (line.trim()) textChunks.push(lpvRenderLine(line));
          });
        }
      });

      // bl/br are position:absolute — they don't affect scrollHeight so
      // appending them last never triggers a false overflow-split.
      const chunks = [...topFloatChunks, ...textChunks, ...bottomChunks];

      // Add chunks one by one; overflow → push current page, start a new one.
      let curHtml = '';
      for (const chunk of chunks) {
        const testHtml = curHtml + chunk;
        m.innerHTML = testHtml + CLEAR;
        if (m.scrollHeight > maxH && curHtml !== '') {
          // Current chunk would overflow — commit what we have, start fresh.
          pages.push(curHtml + CLEAR);
          curHtml = chunk;
        } else {
          curHtml = testHtml;
        }
      }
      if (curHtml) pages.push(curHtml + CLEAR);
    });

    document.body.removeChild(m);
    return pages.length ? pages : [''];
  }

  // Render lpMiniCurPage into #lpBody and sync nav button states.
  // Pages are pre-rendered HTML — set innerHTML directly.
  function renderMiniPage() {
    const bodyEl  = document.getElementById('lpBody');
    const countEl = document.getElementById('lpMiniCount');
    const prevBtn = document.getElementById('lpMiniPrev');
    const nextBtn = document.getElementById('lpMiniNext');
    if (!bodyEl) return;

    const empty = !lpMiniPages.length || (lpMiniPages.length === 1 && !lpMiniPages[0]);
    if (empty) {
      bodyEl.innerHTML = '<p class="wc-lp-empty">레슨 내용이<br>여기 표시됩니다</p>';
      bodyEl.style.fontSize = '';
      if (countEl) countEl.textContent = '';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }
    bodyEl.style.fontSize = lpMiniFz + 'px';
    bodyEl.innerHTML = lpMiniPages[lpMiniCurPage] || '';
    if (countEl) countEl.textContent = `${lpMiniCurPage + 1} / ${lpMiniPages.length}`;
    if (prevBtn) prevBtn.disabled = lpMiniCurPage === 0;
    if (nextBtn) nextBtn.disabled = lpMiniCurPage >= lpMiniPages.length - 1;
  }

  function refreshLessonPreview(immediate) {
    if (!immediate) {
      clearTimeout(_previewDebounce);
      _previewDebounce = setTimeout(() => refreshLessonPreview(true), 200);
      return;
    }
    const pane = document.getElementById('lessonPreviewPane');
    if (!pane) return;

    const title   = ($('lessonTitle').value || '').trim() || '제목 없음';
    const rawBody = ($('lessonBody').value || '').trim();

    const badge = document.getElementById('lpModeBadge');
    if (badge) badge.textContent =
      lessonMode === 'comic' ? '💬' : lessonMode === 'song' ? '🎵' : '📄';

    const titleEl = document.getElementById('lpTitle');
    if (titleEl) titleEl.textContent = title;

    // Re-compute by visual overflow; always start at page 1 after an edit.
    lpMiniCurPage = 0;
    lpMiniPages   = rawBody
      ? computeMiniPagesByHeight(rawBody, lessonImages)
      : [''];
    renderMiniPage();
  }

  (function wireLessonModeTabs() {
    const tabs = document.getElementById('lessonModeTabs');
    if (!tabs) return;
    tabs.addEventListener('click', (e) => {
      const t = e.target.closest('.wc-mode-tab');
      if (t && t.dataset.mode) {
        setLessonMode(t.dataset.mode);
        refreshLessonPreview(true);
      }
    });
    setLessonMode('text');
  })();

  // Wire title + body live-update for the preview.
  (function wireLessonPreviewInputs() {
    const titleIn = $('lessonTitle');
    const bodyIn  = $('lessonBody');
    if (titleIn) titleIn.addEventListener('input', () => refreshLessonPreview(true));
    if (bodyIn)  bodyIn .addEventListener('input', () => refreshLessonPreview());
  })();

  // Wire prev/next page nav and A−/A+ font-size controls.
  // A−/A+ re-paginate because overflow point changes with font size.
  (function wireMiniPreviewNav() {
    const prev  = $('lpMiniPrev');
    const next  = $('lpMiniNext');
    const fzDec = $('lpMiniFzDec');
    const fzInc = $('lpMiniFzInc');
    if (prev) prev.addEventListener('click', () => {
      if (lpMiniCurPage > 0) { lpMiniCurPage--; renderMiniPage(); }
    });
    if (next) next.addEventListener('click', () => {
      if (lpMiniCurPage < lpMiniPages.length - 1) { lpMiniCurPage++; renderMiniPage(); }
    });
    // A−: −1 px, min 9 px  |  A+: +1 px, max 18 px. Re-paginate each time.
    if (fzDec) fzDec.addEventListener('click', () => {
      if (lpMiniFz <= 9) return;
      lpMiniFz--;
      const raw = ($('lessonBody').value || '').trim();
      lpMiniCurPage = 0;
      lpMiniPages   = raw ? computeMiniPagesByHeight(raw, lessonImages) : [''];
      renderMiniPage();
    });
    if (fzInc) fzInc.addEventListener('click', () => {
      if (lpMiniFz >= 18) return;
      lpMiniFz++;
      const raw = ($('lessonBody').value || '').trim();
      lpMiniCurPage = 0;
      lpMiniPages   = raw ? computeMiniPagesByHeight(raw, lessonImages) : [''];
      renderMiniPage();
    });
  })();

  // ── Mini preview pane drag-to-resize ─────────────────────────────────
  // Bottom edge: drag down/up to change pane height (max 2 × initial).
  // Left  edge: drag left/right to change pane width  (max 1.5 × initial).
  // Resizing re-paginates in real time (RAF-throttled) so the page count
  // and word wrapping update as the teacher drags.
  (function wireMiniPreviewResize() {
    const pane = document.getElementById('lessonPreviewPane');
    if (!pane) return;

    const INIT_W = 360, INIT_H = 170;          // match CSS defaults
    const MAX_W  = Math.round(INIT_W * 1.5);   // 540 px
    const MAX_H  = Math.round(INIT_H * 2);     // 340 px
    const MIN_W  = 180,  MIN_H = 80;
    const EDGE   = 8;   // hit-area thickness (px) near each edge

    let dir = null;              // null | 'h' | 'w' | 'both'
    let startX, startY, startW, startH;
    let _raf = null;

    // RAF-throttled repagination — reads the NEW pane dimensions after resize.
    function repaginate() {
      if (_raf) cancelAnimationFrame(_raf);
      _raf = requestAnimationFrame(() => {
        lpMiniCurPage = 0;
        const raw = ($('lessonBody').value || '').trim();
        lpMiniPages   = raw ? computeMiniPagesByHeight(raw, lessonImages) : [''];
        renderMiniPage();
        _raf = null;
      });
    }

    // Change cursor when hovering near the bottom or left edge.
    pane.addEventListener('mousemove', e => {
      if (dir) return;
      const r = pane.getBoundingClientRect();
      const nb = e.clientY >= r.bottom - EDGE;
      const nl = e.clientX <= r.left   + EDGE;
      pane.style.cursor = (nb && nl) ? 'sw-resize' : nb ? 's-resize' : nl ? 'w-resize' : '';
    });
    pane.addEventListener('mouseleave', () => { if (!dir) pane.style.cursor = ''; });

    // Begin drag on mousedown near an edge.
    pane.addEventListener('mousedown', e => {
      const r = pane.getBoundingClientRect();
      const nb = e.clientY >= r.bottom - EDGE;
      const nl = e.clientX <= r.left   + EDGE;
      if (!nb && !nl) return;
      e.preventDefault();
      dir    = (nb && nl) ? 'both' : nb ? 'h' : 'w';
      startX = e.clientX; startY = e.clientY;
      startW = pane.offsetWidth; startH = pane.offsetHeight;
      document.body.style.cursor     = pane.style.cursor;
      document.body.style.userSelect = 'none';
    });

    // Apply resize deltas on mousemove.
    document.addEventListener('mousemove', e => {
      if (!dir) return;
      if (dir === 'h' || dir === 'both') {
        // Drag down → taller.
        const h = Math.min(MAX_H, Math.max(MIN_H, startH + (e.clientY - startY)));
        pane.style.height = h + 'px';
      }
      if (dir === 'w' || dir === 'both') {
        // Drag left → wider (left edge moves left, right edge stays).
        const w = Math.min(MAX_W, Math.max(MIN_W, startW + (startX - e.clientX)));
        pane.style.width = w + 'px';
      }
      repaginate();
    });

    // End drag.
    document.addEventListener('mouseup', () => {
      if (!dir) return;
      dir = null;
      pane.style.cursor          = '';
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      repaginate();
    });
  })();

  // ── Full-size lesson preview modal ────────────────────────────────────
  // Opens when the teacher clicks "👁 페이지 미리보기". Parses the body
  // into pages (split by ---), renders each page at lesson-page font/
  // line-height with images at their real corner floats. Prev/next nav.

  // Compact image style for the 260 px side-pane preview — same layout
  // intent as lpvImgStyle but uses %-widths suited to the narrow pane.
  function lpvImgStyleMini(corner, scale) {
    const sc = Number.isFinite(scale) ? scale : 1.0;
    const w  = (30 * sc).toFixed(1);
    const sh = 'box-shadow:0 1px 4px rgba(0,0,0,.10);border-radius:4px;height:auto;';
    switch (corner) {
      case 'tl':
        return `float:left;width:${w}%;max-width:80px;margin:5px 8px 6px 0;${sh}`;
      case 'bl':
        // Absolute-positioned so it anchors to the bottom-left of the
        // preview body without being clipped by overflow:hidden.
        return `position:absolute;bottom:5px;left:6px;width:${w}%;max-width:80px;${sh}`;
      case 'tr':
        return `float:right;width:${w}%;max-width:80px;margin:5px 0 6px 8px;${sh}`;
      case 'br':
        // Absolute-positioned so it anchors to the bottom-right of the
        // preview body without being clipped by overflow:hidden.
        return `position:absolute;bottom:5px;right:6px;width:${w}%;max-width:80px;${sh}`;
      case 'cc':
        return `display:block;margin:6px auto;width:60%;max-width:120px;${sh}`;
      case 'cs':
        return `display:block;margin:4px auto;max-width:${Math.round(50 * sc)}px;${sh}`;
      case 'panel':
        return `display:block;width:90%;margin:4px auto 6px;border:2px solid #1a1a1a;border-radius:3px;${sh}`;
      default:
        return `float:right;width:${w}%;max-width:80px;margin:0 0 6px 8px;${sh}`;
    }
  }

  function lpvImgStyle(corner, scale) {
    const sc = Number.isFinite(scale) ? scale : 1.0;
    const base = (22 * sc).toFixed(1);
    const minW = Math.round(120 * sc);
    const maxW = Math.round(220 * sc);
    const shadow = 'box-shadow:0 2px 8px rgba(0,0,0,.10);border-radius:8px;height:auto;';
    switch (corner) {
      case 'tl': case 'bl':
        return `float:left;width:${base}%;min-width:${minW}px;max-width:${maxW}px;margin:0 18px 10px 0;${shadow}`;
      case 'tr': case 'br':
        return `float:right;width:${base}%;min-width:${minW}px;max-width:${maxW}px;margin:0 0 10px 18px;${shadow}`;
      case 'cc':
        return `display:block;margin:14px auto;max-width:50%;${shadow}`;
      case 'cs':
        return `display:block;margin:10px auto;max-width:${Math.round(140*sc)}px;${shadow}`;
      case 'panel':
        return `display:block;width:${Math.min(100,88*sc).toFixed(1)}%;margin:16px auto 8px;border:3px solid #1a1a1a;border-radius:6px;${shadow}`;
      default:
        return `float:right;width:${base}%;min-width:${minW}px;max-width:${maxW}px;margin:0 0 10px 18px;${shadow}`;
    }
  }

  function lpvRenderLine(line) {
    const esc = s => escapeHtml(s);
    // display:flow-root on every <p> establishes a BFC so the block is
    // pushed *beside* a preceding float instead of trying to indent its
    // line-boxes (the same fix applied to .wc-lesson-text p on the
    // lesson page).  Without this, text falls below the float image in
    // the narrow preview pane.
    let text = line, st = 'margin:.3em 0;display:flow-root;';
    if (/^# /.test(text))   { text = text.slice(2);  st = 'font-size:1.4em;font-weight:800;margin:.5em 0;display:flow-root;'; }
    else if (/^## /.test(text))  { text = text.slice(3);  st = 'font-size:1.15em;font-weight:700;margin:.4em 0;display:flow-root;'; }
    else if (/^### /.test(text)) { text = text.slice(4);  st = 'font-size:1em;font-weight:600;margin:.3em 0;display:flow-root;'; }
    text = esc(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g,     '<u>$1</u>')
      .replace(/\{color:(#[0-9a-fA-F]{3,6})\}(.*?)\{\/color\}/g,
               '<span style="color:$1">$2</span>');
    return `<p style="${st}">${text}</p>`;
  }

  function lpvRenderPage(pageText, images) {
    // Float images (tl/bl/tr/br) are placed BEFORE text so they anchor
    // to the top of the adjacent text block.  Center images (cc/cs/panel)
    // stay in source order.
    const parts = pageText.split(/(\[\[IMG:\d+\]\])/);
    let floatHtml = '', contentHtml = '';
    parts.forEach(part => {
      const m = part.match(/^\[\[IMG:(\d+)\]\]$/);
      if (m) {
        const im = images && images[parseInt(m[1], 10)];
        const src = im && escapeHtml(im.url || im.data_url || '');
        if (src) {
          const style   = lpvImgStyle(im.corner, im.scale);
          const isFloat = /^(?:tl|bl|tr|br)$/.test(im.corner || '');
          if (isFloat) floatHtml   += `<img src="${src}" style="${style}" alt="">`;
          else         contentHtml += `<img src="${src}" style="${style}" alt="">`;
        }
        return;
      }
      part.split('\n').forEach(line => {
        if (line.trim()) contentHtml += lpvRenderLine(line);
      });
    });
    return floatHtml + contentHtml + '<div style="clear:both;"></div>';
  }

  // Same as lpvRenderPage but uses lpvImgStyleMini for the narrow side-pane.
  // tl/tr floats go BEFORE text (top-anchor); bl/br use position:absolute
  // (bottom corner) and are appended AFTER text so they don't push content down.
  function lpvRenderPageMini(pageText, images) {
    const parts = pageText.split(/(\[\[IMG:\d+\]\])/);
    let topFloatHtml = '';   // tl/tr — float:left/right, before text
    let contentHtml  = '';   // text paragraphs + cc/cs/panel images
    let bottomHtml   = '';   // bl/br — position:absolute, after text
    parts.forEach(part => {
      const m = part.match(/^\[\[IMG:(\d+)\]\]$/);
      if (m) {
        const im     = images && images[parseInt(m[1], 10)];
        const src    = im && escapeHtml(im.url || im.data_url || '');
        const corner = (im && im.corner) || '';
        if (src) {
          const style = lpvImgStyleMini(corner, im.scale);
          const tag   = `<img src="${src}" style="${style}" alt="">`;
          if (/^(?:tl|tr)$/.test(corner))      topFloatHtml += tag;
          else if (/^(?:bl|br)$/.test(corner)) bottomHtml   += tag;
          else                                  contentHtml  += tag;
        }
        return;
      }
      part.split('\n').forEach(line => {
        if (line.trim()) contentHtml += lpvRenderLine(line);
      });
    });
    return topFloatHtml + contentHtml + '<div style="clear:both;"></div>' + bottomHtml;
  }

  function openLessonPreviewModal() {
    const body   = ($('lessonBody').value  || '').trim();
    const title  = ($('lessonTitle').value || '').trim() || '(제목 없음)';
    const imgs   = lessonImages || [];
    const mode   = lessonMode;
    const badge  = mode === 'comic' ? '💬' : mode === 'song' ? '🎵' : '📄';

    // Pages = body split on standalone --- lines, then FURTHER auto-paginated
    // by sentence count (max 6 sentences per page — mirrors lesson.js so the
    // teacher sees the same number of pages the student will navigate through).
    const MAX_SENTS = 6;
    const lpvPages = [];
    body.split(/\n\s*---\s*(?:\n|$)/).map(s => s.trim()).filter(Boolean)
      .forEach(seg => {
        const lines = seg.split('\n');
        let curLines = [];
        let sentCount = 0;
        lines.forEach(line => {
          curLines.push(line);
          // Count sentence-ending punctuation; ignore headings and IMG markers.
          const clean = line.replace(/\[\[IMG:\d+\]\]/g, '').replace(/^#{1,6}\s.*/, '');
          sentCount += (clean.match(/[.!?]+/g) || []).length;
          if (sentCount >= MAX_SENTS) {
            const pg = curLines.join('\n').trim();
            if (pg) lpvPages.push(pg);
            curLines  = [];
            sentCount = 0;
          }
        });
        const tail = curLines.join('\n').trim();
        if (tail) lpvPages.push(tail);
      });
    if (!lpvPages.length) lpvPages.push('');
    let cur = 0;

    // Build overlay DOM.
    const overlay = document.createElement('div');
    overlay.id = 'wcLpvOverlay';
    overlay.className = 'wc-lpv-overlay';
    overlay.innerHTML =
      `<div class="wc-lpv-card">
         <div class="wc-lpv-head">
           <span class="wc-lpv-mode">${badge}</span>
           <span class="wc-lpv-title">${escapeHtml(title)}</span>
           <div class="wc-lpv-ctrls">
             <button class="wc-lpv-ctrl" id="lpvFzDec" title="글자 작게">A−</button>
             <button class="wc-lpv-ctrl" id="lpvFzInc" title="글자 크게">A+</button>
             <button class="wc-lpv-ctrl" id="lpvLhDec" title="행간 좁게">↕−</button>
             <button class="wc-lpv-ctrl" id="lpvLhInc" title="행간 넓게">↕+</button>
           </div>
           <button class="wc-lpv-close" id="lpvClose" title="닫기">✕</button>
         </div>
         <div class="wc-lpv-body" id="lpvPageBody"></div>
         <div class="wc-lpv-nav">
           <button class="wc-lpv-nav-btn" id="lpvPrev">&#8592;</button>
           <span class="wc-lpv-page-count" id="lpvCount"></span>
           <button class="wc-lpv-nav-btn" id="lpvNext">&#8594;</button>
         </div>
       </div>`;
    document.body.appendChild(overlay);

    // Font-size and line-height state for this modal instance.
    let lpvFz = 20;   // px — matches .wc-lpv-body default
    let lpvLh = 2.4;  // unitless — matches .wc-lpv-body default
    function applyLpvBodyStyle() {
      const b = document.getElementById('lpvPageBody');
      if (b) { b.style.fontSize = lpvFz + 'px'; b.style.lineHeight = String(lpvLh); }
    }

    function render(idx) {
      cur = idx;
      const bodyEl = document.getElementById('lpvPageBody');
      if (bodyEl) bodyEl.innerHTML = lpvRenderPage(lpvPages[idx] || '', imgs);
      applyLpvBodyStyle();
      const countEl = document.getElementById('lpvCount');
      if (countEl) countEl.textContent = `${idx + 1} / ${lpvPages.length}`;
      const prev = document.getElementById('lpvPrev');
      const next = document.getElementById('lpvNext');
      if (prev) prev.disabled = idx <= 0;
      if (next) next.disabled = idx >= lpvPages.length - 1;
    }
    render(0);

    document.getElementById('lpvClose').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('lpvPrev').addEventListener('click', () => { if (cur > 0) render(cur - 1); });
    document.getElementById('lpvNext').addEventListener('click', () => { if (cur < lpvPages.length - 1) render(cur + 1); });

    // A− / A+ — font size step 2px, range 14–32px.
    document.getElementById('lpvFzDec').addEventListener('click', () => {
      lpvFz = Math.max(14, lpvFz - 2); applyLpvBodyStyle();
    });
    document.getElementById('lpvFzInc').addEventListener('click', () => {
      lpvFz = Math.min(32, lpvFz + 2); applyLpvBodyStyle();
    });
    // ↕− / ↕+ — line-height step 0.2, range 1.4–3.6.
    document.getElementById('lpvLhDec').addEventListener('click', () => {
      lpvLh = Math.max(1.4, +(lpvLh - 0.2).toFixed(1)); applyLpvBodyStyle();
    });
    document.getElementById('lpvLhInc').addEventListener('click', () => {
      lpvLh = Math.min(3.6, +(lpvLh + 0.2).toFixed(1)); applyLpvBodyStyle();
    });

    // Keyboard nav.
    const onKey = e => {
      if (!document.getElementById('wcLpvOverlay')) { document.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
      if (e.key === 'ArrowRight' && cur < lpvPages.length - 1) render(cur + 1);
      if (e.key === 'ArrowLeft'  && cur > 0) render(cur - 1);
    };
    document.addEventListener('keydown', onKey);
  }

  (function wireLessonPreviewBtn() {
    const btn = $('lessonPreviewBtn');
    if (btn) btn.addEventListener('click', openLessonPreviewModal);
  })();

  function startEditing(lessonId) {
    const L = lessons.find(x => x.id === lessonId);
    if (!L) return;
    editingLessonId = L.id;
    // The Create-a-lesson card is collapsed by default — expand it
    // so the teacher sees the populated form instead of just the
    // section header.
    const card = $('createLessonCard');
    if (card) card.open = true;
    $('lessonTitle').value      = L.title || '';
    // Old plain-text bodies still load fine — assigning to innerHTML
    // just puts the text inside the editor. New HTML bodies render
    // with their formatting intact.
    $('lessonBody').value       = L.body  || '';
    $('lessonAnimalSet').value  = L.animal_set || 'animals';
    $('lessonGiftLimit').value  = L.gift_limit_per_day || 3;
    $('lessonHeadingsNewPage').checked = !!L.headings_start_new_page;
    // Continuous-scroll default for comic lessons. Comic lessons
    // scroll by default, so the box is CHECKED unless the teacher
    // explicitly turned it off (default_scroll === false). Older
    // comic lessons (NULL, pre-migration) stay checked.
    $('lessonComicScroll').checked = L.default_scroll !== false;
    setLessonMode(L.mode || 'text');
    lessonAudioUrl       = L.audio_url || null;
    lessonAudioFile      = null;
    lessonAudioObjectUrl = null;
    lessonAudioSegments  = Array.isArray(L.audio_segments)
      ? L.audio_segments.map(s => ({ ...s })) : [];
    refreshAudioUi();
    // Cover image — load the saved URL into the preview. A teacher
    // editing a lesson sees the existing cover; picking a new file
    // supersedes it (the change handler nulls lessonCoverUrl).
    lessonCoverUrl       = L.cover_image_url || null;
    lessonCoverFile      = null;
    if (lessonCoverObjectUrl) { try { URL.revokeObjectURL(lessonCoverObjectUrl); } catch {} }
    lessonCoverObjectUrl = null;
    const coverFi = $('addCoverFile');
    if (coverFi) coverFi.value = '';
    refreshCoverUi();
    lessonImages = Array.isArray(L.images) ? L.images.map(im => ({ ...im })) : [];
    renderImagesPreview();
    lessonWordImages = Array.isArray(L.word_images)
      ? L.word_images.map(wi => ({ ...wi })) : [];
    renderWordImageRows();
    lessonWordNotes = Array.isArray(L.word_notes)
      ? L.word_notes.map(wn => ({ ...wn })) : [];
    renderWordNoteRows();
    updateFormMode();
    // Scroll the form into view so the teacher sees the fields populate.
    $('lessonTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('lessonTitle').focus();
    // Re-render the list so the row gets the "(editing)" badge highlight.
    renderLessons();
    refreshLessonPreview(true);
  }

  function cancelEditing() {
    editingLessonId = null;
    $('lessonTitle').value = '';
    $('lessonBody').value = '';
    $('lessonAnimalSet').value = 'animals';
    $('lessonGiftLimit').value = 3;
    $('lessonHeadingsNewPage').checked = false;
    $('lessonComicScroll').checked = true;   // comic lessons scroll by default
    setLessonMode('text');
    resetLessonAudio();
    resetLessonCover();
    resetImages();
    updateFormMode();
    // Return the form card to its default collapsed state.
    const card = $('createLessonCard');
    if (card) card.open = false;
    renderLessons();
    refreshLessonPreview(true);
  }

  function updateFormMode() {
    const btn      = $('addLessonBtn');
    const cancel   = $('cancelEditBtn');
    const del      = $('deleteLessonBtn');
    const notice   = $('lessonEditNotice');
    if (editingLessonId) {
      btn.textContent = 'Save changes';
      cancel.classList.remove('wc-hidden');
      del   .classList.remove('wc-hidden');
      notice.classList.remove('wc-hidden');
    } else {
      btn.textContent = 'Create lesson';
      cancel.classList.add('wc-hidden');
      del   .classList.add('wc-hidden');
      notice.classList.add('wc-hidden');
    }
  }

  $('cancelEditBtn').addEventListener('click', cancelEditing);

  $('deleteLessonBtn').addEventListener('click', async () => {
    if (!editingLessonId) return;
    const L = lessons.find(x => x.id === editingLessonId);
    const title = L ? L.title : 'this lesson';
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
    try {
      await window.WCDB.lessons.delete(editingLessonId);
      cancelEditing();
      await refreshAll();
    } catch (e) {
      alert('Could not delete: ' + (e.message || e));
    }
  });
  function countGiftsToday(lessonId) {
    const today = new Date().toISOString().slice(0, 10);
    return messages.filter(m =>
      m.lesson_id === lessonId
      && m.responded_at && m.responded_at.slice(0,10) === today
      && m.gift_animal_set != null
    ).length;
  }

  // ----------------------------------------------------------------
  //  IMAGE UPLOAD for the lesson body
  //
  //  Flow: teacher clicks in the body textarea to place the cursor →
  //  presses "📷 Add image" OR Cmd+V (paste image from clipboard) →
  //  a small modal asks which CORNER of the white card the image
  //  should sit in. We downscale to max 800px on long edge + re-
  //  encode as JPEG 75% (typical result: 30-90 KB) so we can stash
  //  it inline as a data-URL on the lesson row without needing a
  //  separate Storage bucket. A marker `[[IMG:N]]` is inserted at
  //  the cursor so the lesson renderer knows where each image
  //  anchors in the body.
  // ----------------------------------------------------------------
  let lessonImages = [];      // accumulates while teacher composes a lesson
  let pendingInsertPos = null;  // cursor position at the moment of image trigger
  let editingLessonId = null;   // null = creating new; UUID = editing existing
  // Word-image pairs: [{ word: 'kiwi', data_url: 'data:image/jpeg…' }, …]
  // Empty rows (word === '' AND data_url === '') are stripped before save.
  let lessonWordImages = [];
  // Last-clicked word-image row — paste handler targets this row's
  // image slot when the user pastes from the clipboard.
  let activeWordImageRow = null;
  // Word-meaning pairs: [{ word: 'kororā', note: 'A little blue penguin …' }]
  // Shown in the sidebar BELOW the auto-fetched GPT definition when the
  // student taps a word that appears in the body. Empty rows (no word
  // OR no note) are stripped at save time.
  let lessonWordNotes = [];

  // Textarea-based body. `pendingInsertPos` is the caret index (or
  // selection-start) so toolbar buttons restore the cursor after the
  // button click steals focus. Markdown syntax (#, **, __, {color}, ---)
  // is wrapped/inserted around the current selection; on the lesson
  // page it gets parsed to HTML before tokenisation.
  function rememberCursor() {
    const ta = $('lessonBody');
    pendingInsertPos = ta.selectionStart;
  }
  $('lessonBody').addEventListener('click',   rememberCursor);
  $('lessonBody').addEventListener('keyup',   rememberCursor);
  $('lessonBody').addEventListener('blur',    rememberCursor);

  // ----------------------------------------------------------------
  //  MARKDOWN TOOLBAR (H1/H2/H3/Body/Bold/Underline/Colour)
  //
  //  Each button manipulates the textarea's selection directly,
  //  wrapping it with markdown syntax. On the lesson page that
  //  syntax is parsed back into HTML before tokenisation.
  //
  //    H1/H2/H3 → "# "/"## "/"### " prefix on the current line
  //    Body     → strip any "# / ## / ###" prefix
  //    B        → wrap selection in **…**
  //    U        → wrap in __…__
  //    Colour   → wrap in {color:#hex}…{/color}
  //    Page break → blank line + "---" + blank line
  // ----------------------------------------------------------------

  // Wrap whatever's currently selected in `before`…`after`. If nothing
  // is selected, drop the wrappers at the caret and place the cursor
  // between them so the teacher can type inside immediately.
  function wrapMd(before, after) {
    const ta = $('lessonBody');
    ta.focus();
    const start = (pendingInsertPos != null && ta.selectionStart === ta.selectionEnd)
      ? pendingInsertPos : ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = ta.value.slice(start, end);
    const inserted = before + sel + after;
    ta.value = ta.value.slice(0, start) + inserted + ta.value.slice(end);
    if (sel) {
      ta.selectionStart = start + before.length;
      ta.selectionEnd   = end   + before.length;
    } else {
      ta.selectionStart = ta.selectionEnd = start + before.length;
    }
    pendingInsertPos = ta.selectionStart;
  }

  // Replace the current line's heading-prefix (#, ##, ###) with the
  // supplied prefix. Empty prefix = strip heading marker.
  function setLineHeading(prefix) {
    const ta = $('lessonBody');
    ta.focus();
    const pos = ta.selectionStart;
    const v   = ta.value;
    let lineStart = pos;
    while (lineStart > 0 && v[lineStart - 1] !== '\n') lineStart--;
    let lineEnd = pos;
    while (lineEnd < v.length && v[lineEnd] !== '\n') lineEnd++;
    const line = v.slice(lineStart, lineEnd);
    const stripped = line.replace(/^#{1,3}\s*/, '');
    const newLine = prefix + stripped;
    ta.value = v.slice(0, lineStart) + newLine + v.slice(lineEnd);
    const newCaret = lineStart + prefix.length + Math.max(0, pos - lineStart - (line.length - stripped.length));
    ta.setSelectionRange(newCaret, newCaret);
    pendingInsertPos = newCaret;
  }

  // Apply a toolbar button command. mousedown handler so the
  // textarea's selection isn't blurred away before we read it.
  document.querySelectorAll('.wc-rt-toolbar [data-rt-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      const cmd = btn.dataset.rtCmd;
      const arg = btn.dataset.rtArg;
      switch (cmd) {
        case 'formatBlock':
          if (arg === 'h1') setLineHeading('# ');
          else if (arg === 'h2') setLineHeading('## ');
          else if (arg === 'h3') setLineHeading('### ');
          else                  setLineHeading('');      // Body
          break;
        case 'bold':       wrapMd('**', '**');           break;
        case 'underline':  wrapMd('__', '__');           break;
        case 'removeFormat': {
          // Strip markdown markers from the current selection so the
          // teacher can wipe formatting without retyping the words.
          const ta = $('lessonBody');
          const s = ta.selectionStart, e2 = ta.selectionEnd;
          if (s === e2) break;
          const raw = ta.value.slice(s, e2);
          const clean = raw
            .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
            .replace(/__([\s\S]*?)__/g, '$1')
            .replace(/\{color:[^}]+\}([\s\S]*?)\{\/color\}/g, '$1')
            .replace(/^#{1,3}\s*/gm, '');
          ta.value = ta.value.slice(0, s) + clean + ta.value.slice(e2);
          ta.setSelectionRange(s, s + clean.length);
          pendingInsertPos = ta.selectionStart;
          break;
        }
      }
    });
  });

  // Colour picker — wraps selection in {color:#hex}…{/color}.
  const colorInput = document.getElementById('rtColorInput');
  if (colorInput) {
    colorInput.addEventListener('mousedown', () => rememberCursor());
    colorInput.addEventListener('input', () => {
      wrapMd('{color:' + colorInput.value + '}', '{/color}');
    });
  }

  // ── Page break ── inserts a markdown horizontal rule (`---` on its
  // own line, blank lines either side). The lesson renderer converts
  // this to <hr class="wc-page-break"> during markdown → HTML, which
  // splits the body into pages.
  const pageBreakBtn = document.getElementById('addPageBreakBtn');
  if (pageBreakBtn) {
    pageBreakBtn.addEventListener('mousedown', e => {
      e.preventDefault();
      const ta = $('lessonBody');
      ta.focus();
      const pos = pendingInsertPos != null ? pendingInsertPos : ta.selectionStart;
      const before = ta.value.slice(0, pos);
      const after  = ta.value.slice(pos);
      // Make sure we sit on its own line — pad with newlines if the
      // surroundings don't already provide them.
      const nl1 = before.endsWith('\n') ? '' : '\n';
      const nl2 = after.startsWith('\n') ? '' : '\n';
      const insert = nl1 + '---' + nl2;
      ta.value = before + insert + after;
      const np = pos + insert.length;
      ta.setSelectionRange(np, np);
      pendingInsertPos = np;
    });
  }

  $('addImageBtn').addEventListener('click', () => {
    rememberCursor();
    $('addImageFile').click();
  });
  $('addImageFile').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // Single file → keep the original flow (handleImageFile shows the
    // corner picker per-file; preserves any paste/single-add quirks).
    if (files.length === 1) {
      await handleImageFile(files[0]);
      e.target.value = '';
      return;
    }
    // Multiple files → sort alphabetically by filename (case-insensitive),
    // ask the corner picker ONCE, then insert every file in order using
    // the same corner. The teacher confirms the position one time and the
    // batch lands in sorted order.
    files.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    rememberCursor();
    pickCorner(async (corner) => {
      for (const file of files) {
        try {
          const dataUrl = await downscaleImage(file);
          if (dataUrl) insertImage(corner, dataUrl);
        } catch (err) {
          console.warn('[bulk-image]', file.name, err && err.message);
        }
      }
    });
    e.target.value = '';
  });
  // Paste — works anywhere on the page; we only consume when there's
  // actually an image in the clipboard. Plain-text paste keeps default
  // textarea behaviour.
  document.addEventListener('paste', async (e) => {
    // Body textarea — image paste inserts a [[IMG:N]] marker at the
    // caret; plain-text paste uses the textarea's native behaviour.
    if (document.activeElement !== $('lessonBody')) return;
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        e.preventDefault();
        const file = it.getAsFile();
        if (file) await handleImageFile(file);
        return;
      }
    }
    // Plain text — let the textarea handle it natively.
  });

  async function handleImageFile(file) {
    rememberCursor();
    const dataUrl = await downscaleImage(file).catch(err => {
      alert('Could not process image: ' + (err.message || err));
      return null;
    });
    if (!dataUrl) return;
    pickCorner(corner => insertImage(corner, dataUrl));
  }

  // GLOBAL upload guard: every image that goes into the database
  // passes through this function. The site never stores the raw
  // file the teacher selected — it's redrawn on a canvas at ≤ 800 px
  // on the long edge and re-encoded as JPEG 75 %. Typical result
  // 30-90 KB regardless of input (a 5 MB camera shot becomes ~60 KB).
  // All three image-upload paths (body images, word images, body
  // paste) route through here.
  async function downscaleImage(file, maxDim = 800, quality = 0.75) {
    const buf = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload  = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('read failed'));
      fr.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload  = () => resolve(im);
      im.onerror = () => reject(new Error('decode failed'));
      im.src = buf;
    });
    const longEdge = Math.max(img.width, img.height);
    const scale = longEdge > maxDim ? maxDim / longEdge : 1;
    const w = Math.round(img.width  * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }

  // Modal: "Where should this image sit?". 5 options (4 corners +
  // center). `current` highlights the active choice so editing an
  // existing image shows where it sits right now. The teacher must
  // click Confirm to apply — that way an accidental misclick on a
  // corner doesn't immediately re-position the picture.
  function pickCorner(onPick, current) {
    // Wipe any previous instance so we always start with a fresh
    // modal (state from a prior call doesn't leak).
    const old = document.getElementById('cornerPickerHost');
    if (old) old.remove();

    const host = document.createElement('div');
    host.id = 'cornerPickerHost';
    host.className = 'wc-popup-backdrop';
    host.innerHTML = `
      <div class="wc-popup" style="max-width: 380px;">
        <button class="wc-popup-close" aria-label="Close">×</button>
        <h3 style="margin: 0 0 12px;">Where should this image sit?</h3>
        <div class="wc-corner-grid">
          <button data-corner="tl"><span>↖</span> Top-left</button>
          <button data-corner="tr"><span>↗</span> Top-right</button>
          <button data-corner="bl"><span>↙</span> Bottom-left</button>
          <button data-corner="br"><span>↘</span> Bottom-right</button>
          <button data-corner="cc"><span>＋</span> Center (centred on its own line)</button>
          <button data-corner="cs"><span>▫</span> Small center (small, own line — no text beside)</button>
          <button data-corner="panel"><span>🗔</span> Comic panel (full-width box — dialogue goes underneath)</button>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:16px;">
          <button class="wc-btn ghost"  id="cpCancel"  type="button">Cancel</button>
          <button class="wc-btn"        id="cpConfirm" type="button" disabled>Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(host);

    let picked = current || null;
    const confirmBtn = host.querySelector('#cpConfirm');
    const buttons    = host.querySelectorAll('[data-corner]');
    function highlight() {
      buttons.forEach(b => b.classList.toggle('selected', b.dataset.corner === picked));
      confirmBtn.disabled = !picked;
    }
    highlight();

    buttons.forEach(b => {
      b.addEventListener('click', () => {
        picked = b.dataset.corner;
        highlight();
      });
    });
    const cancel = () => host.remove();
    host.querySelector('.wc-popup-close').addEventListener('click', cancel);
    host.querySelector('#cpCancel').addEventListener('click', cancel);
    host.addEventListener('click', e => { if (e.target === host) cancel(); });
    confirmBtn.addEventListener('click', () => {
      if (!picked) return;
      host.remove();
      onPick(picked);
    });
  }

  function insertImage(corner, dataUrl) {
    const idx = lessonImages.length;
    // `scale` defaults to 1.0 (= the CSS-defined 22% width). The chip
    // preview's −/+ buttons adjust this in 0.05 increments, and the
    // lesson renderer multiplies the base width by this scale.
    lessonImages.push({ corner, data_url: dataUrl, scale: 1.0 });
    const marker = `[[IMG:${idx}]]`;

    const ta = $('lessonBody');
    const pos = pendingInsertPos != null ? pendingInsertPos : ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const after  = ta.value.slice(pos);
    // Sprinkle whitespace so the marker doesn't glue to adjacent
    // words (would break sentence tokenisation downstream).
    const sep1 = before && !/\s$/.test(before) ? ' ' : '';
    const sep2 = after  && !/^\s/.test(after)  ? ' ' : '';
    ta.value = before + sep1 + marker + sep2 + after;
    const newPos = before.length + sep1.length + marker.length + sep2.length;
    ta.setSelectionRange(newPos, newPos);
    ta.focus();
    pendingInsertPos = newPos;
    renderImagesPreview();
  }

  function renderImagesPreview() {
    const wrap = $('lessonImagesPreview');
    if (!wrap) return;
    if (!lessonImages.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = lessonImages.map((im, i) => {
      // Ensure legacy entries (pre-scale) get a default scale of 1.0
      // so the −/+ buttons display "100%" instead of "NaN%".
      if (!Number.isFinite(im.scale)) im.scale = 1.0;
      const pct = Math.round(im.scale * 100);
      const bubbleCount = Array.isArray(im.bubbles) ? im.bubbles.length : 0;
      // Comic-panel images get a "Bubbles" button — opens the editor
      // where the teacher boxes each speech bubble + types its text.
      const bubbleBtn = im.corner === 'panel'
        ? `<button data-bubbles="${i}" class="wc-btn ghost" title="Add speech-bubble text overlays">🗨 Bubbles${bubbleCount ? ` (${bubbleCount})` : ''}</button>`
        : '';
      const bubbleMeta = (im.corner === 'panel' && bubbleCount)
        ? ` · ${bubbleCount} bubble${bubbleCount > 1 ? 's' : ''}`
        : '';
      return `
        <div class="wc-img-chip">
          <img src="${im.url || im.data_url}" alt="image ${i}"/>
          <div class="wc-img-chip-meta">
            <strong>[[IMG:${i}]]</strong>
            <span class="wc-muted">${cornerLabel(im.corner)} · ${pct}%${bubbleMeta}</span>
          </div>
          <div class="wc-img-chip-actions">
            <button data-size="-"   data-i="${i}" class="wc-btn ghost" title="Shrink 5%">−</button>
            <button data-size="+"   data-i="${i}" class="wc-btn ghost" title="Grow 5%">+</button>
            <button data-corner-edit="${i}" class="wc-btn ghost" title="Change where this image sits">📍 Position</button>
            ${bubbleBtn}
            <button data-rm="${i}"  class="wc-btn ghost">Remove</button>
          </div>
        </div>
      `;
    }).join('');
    wrap.querySelectorAll('[data-rm]').forEach(b => {
      b.addEventListener('click', () => removeImage(parseInt(b.dataset.rm, 10)));
    });
    wrap.querySelectorAll('[data-size]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.i, 10);
        const dir = b.dataset.size === '+' ? 1 : -1;
        adjustImageSize(i, dir);
      });
    });
    wrap.querySelectorAll('[data-corner-edit]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.cornerEdit, 10);
        const im = lessonImages[i];
        if (!im) return;
        pickCorner((corner) => {
          im.corner = corner;
          renderImagesPreview();
        }, im.corner);
      });
    });
    wrap.querySelectorAll('[data-bubbles]').forEach(b => {
      b.addEventListener('click', () =>
        openBubbleEditor(parseInt(b.dataset.bubbles, 10)));
    });
    refreshLessonPreview(true);
  }

  // ----------------------------------------------------------------
  //  COMIC LESSON — Storage upload + bubble OCR helpers
  // ----------------------------------------------------------------
  // Move freshly-added panel images into Supabase Storage. An image
  // that already has a `url` (loaded from a saved lesson, or uploaded
  // earlier this session) is skipped. Best-effort: if Storage isn't
  // set up yet the image keeps its inline data URL and still saves.
  async function uploadLessonImagesToStorage() {
    for (const im of lessonImages) {
      if (!im || im.url || !im.data_url) continue;
      try {
        im.url = await window.WCDB.storage.uploadDataUrl(im.data_url);
      } catch (e) {
        console.warn('[lesson-save] panel image upload failed — keeping inline:',
          e && e.message);
      }
    }
  }
  // Shape an image record for the DB. When the image lives in Storage
  // we save only the small `url` and DROP the heavy base64 `data_url`;
  // when upload failed we keep `data_url` so the lesson still renders.
  function serializeLessonImage(im) {
    const o = { corner: im.corner, scale: Number.isFinite(im.scale) ? im.scale : 1.0 };
    if (Array.isArray(im.bubbles) && im.bubbles.length) o.bubbles = im.bubbles;
    if (im.url) o.url = im.url;
    else if (im.data_url) o.data_url = im.data_url;
    return o;
  }
  // Ask the wc-ocr edge function to read a cropped bubble image
  // (base64 JPEG, no data: prefix). Returns the recognised text.
  async function ocrBubbleImage(imageB64) {
    const sb = window.WC_SUPABASE || {};
    if (!sb.url) throw new Error('Supabase not configured');
    const fn = sb.url.replace(/\/+$/, '') + '/functions/v1/wc-ocr';
    const r = await fetch(fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: sb.anon || '',
        Authorization: 'Bearer ' + (sb.anon || ''),
      },
      body: JSON.stringify({ image_base64: imageB64 }),
    });
    if (!r.ok) throw new Error('wc-ocr ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error(j.error);
    return String((j && j.text) || '').trim();
  }

  // ----------------------------------------------------------------
  //  LESSON AUDIO (mp3) — attach + per-sentence sync editor
  //
  //  The teacher attaches an mp3 of the text read aloud, then marks
  //  which slice of audio each sentence is. Saved as wc_lessons
  //  .audio_url + .audio_segments [{text,start,end}]. On the lesson
  //  page each matching sentence gets a 🔊 that plays just its slice.
  // ----------------------------------------------------------------
  let lessonAudioUrl       = null;   // Storage URL (loaded from a saved lesson)
  let lessonAudioFile      = null;   // freshly-picked File, pending upload
  let lessonAudioObjectUrl = null;   // object URL — for in-editor playback
  let lessonAudioSegments  = [];     // [{text,start,end}]

  function audioPlaybackSrc() {
    return lessonAudioObjectUrl || lessonAudioUrl || '';
  }
  function refreshAudioUi() {
    const status  = $('lessonAudioStatus');
    const syncBtn = $('audioSyncBtn');
    const waveBtn = $('audioWaveBtn');
    const has = !!audioPlaybackSrc();
    if (syncBtn) syncBtn.classList.toggle('wc-hidden', !has);
    if (waveBtn) waveBtn.classList.toggle('wc-hidden', !has);
    if (status) {
      if (!has) {
        status.textContent = '';
      } else {
        const n = lessonAudioSegments.length;
        const synced = `${n} sentence${n !== 1 ? 's' : ''} synced`;
        status.textContent = lessonAudioFile
          ? `${lessonAudioFile.name} · ${synced}`
          : `mp3 attached · ${synced}`;
      }
    }
  }
  function resetLessonAudio() {
    lessonAudioUrl = null;
    lessonAudioFile = null;
    if (lessonAudioObjectUrl) { try { URL.revokeObjectURL(lessonAudioObjectUrl); } catch {} }
    lessonAudioObjectUrl = null;
    lessonAudioSegments = [];
    const fi = $('addAudioFile');
    if (fi) fi.value = '';
    refreshAudioUi();
  }

  // ----------------------------------------------------------------
  //  Cover image — the book / song-CD cover the teacher picks.
  //  Stored on wc_lessons.cover_image_url (Storage public URL).
  //  Shown on the student home page library view next to the title.
  //  Aspect ratio is preserved in both the editor preview and the
  //  student-side library (object-fit: contain).
  // ----------------------------------------------------------------
  let lessonCoverUrl       = null;   // saved Storage URL
  let lessonCoverFile      = null;   // freshly-picked File, pending upload
  let lessonCoverObjectUrl = null;   // object: URL for in-editor preview

  function refreshCoverUi() {
    const prev   = $('lessonCoverPreview');
    const status = $('lessonCoverStatus');
    const rmBtn  = $('removeCoverBtn');
    if (!prev) return;
    const src = lessonCoverObjectUrl || lessonCoverUrl || '';
    if (src) {
      prev.innerHTML = `<img src="${src}" alt="cover preview"
        style="max-width:100%; max-height:100%; object-fit:contain; display:block;" />`;
      if (rmBtn) rmBtn.classList.remove('wc-hidden');
      if (status) status.textContent = lessonCoverFile
        ? `${lessonCoverFile.name} (저장 시 업로드)`
        : '저장된 커버';
    } else {
      prev.innerHTML = '<span class="wc-muted" style="font-size:11px;">No cover</span>';
      if (rmBtn) rmBtn.classList.add('wc-hidden');
      if (status) status.textContent = '';
    }
  }
  function resetLessonCover() {
    lessonCoverUrl  = null;
    lessonCoverFile = null;
    if (lessonCoverObjectUrl) { try { URL.revokeObjectURL(lessonCoverObjectUrl); } catch {} }
    lessonCoverObjectUrl = null;
    const fi = $('addCoverFile');
    if (fi) fi.value = '';
    refreshCoverUi();
  }
  // Wire the cover picker — click → file dialog → set preview.
  (function wireCoverPicker() {
    const btn  = $('addCoverBtn');
    const file = $('addCoverFile');
    const rm   = $('removeCoverBtn');
    if (!btn || !file) return;
    btn.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      // Drop any older object: URL so we don't leak it.
      if (lessonCoverObjectUrl) { try { URL.revokeObjectURL(lessonCoverObjectUrl); } catch {} }
      lessonCoverFile      = f;
      lessonCoverObjectUrl = URL.createObjectURL(f);
      // New file supersedes any saved URL — the save handler will
      // upload the fresh file, then store the new public URL.
      lessonCoverUrl = null;
      refreshCoverUi();
    });
    if (rm) rm.addEventListener('click', () => resetLessonCover());
  })();

  // Read a File as raw base64 (data: prefix stripped) — used to send
  // the mp3 to the wc-align edge function.
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const s = String(fr.result || '');
        const c = s.indexOf(',');
        resolve(c >= 0 ? s.slice(c + 1) : s);
      };
      fr.onerror = () => reject(new Error('read failed'));
      fr.readAsDataURL(file);
    });
  }

  // Call the wc-align edge function — returns a per-line array of
  // {start,end}|null. Shared by both audio editors (rows + waveform).
  async function requestAutoAlign(lines) {
    const payload = { lines };
    if (lessonAudioFile)     payload.audio_base64 = await readFileAsBase64(lessonAudioFile);
    else if (lessonAudioUrl) payload.audio_url    = lessonAudioUrl;
    else throw new Error('no audio attached');
    const sb = window.WC_SUPABASE || {};
    const r = await fetch((sb.url || '').replace(/\/+$/, '') + '/functions/v1/wc-align', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: sb.anon || '',
        Authorization: 'Bearer ' + (sb.anon || ''),
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('wc-align ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error(j.error);
    return Array.isArray(j.segments) ? j.segments : [];
  }

  // Split the body into the units the audio editors sync against.
  //   song mode  → one unit per lyric line (newline-separated)
  //   text/comic → one unit per sentence
  // The lesson page matches segments to rendered text BY TEXT, so a
  // rare mis-split just means that one line shows no 🔊.
  function splitBodyIntoLines(body) {
    // Comic — the studyable text lives in the speech bubbles, not the
    // body. Sync against every bubble's text, panel by panel, in order.
    if (lessonMode === 'comic') {
      const out = [];
      lessonImages.forEach(im => {
        (Array.isArray(im && im.bubbles) ? im.bubbles : []).forEach(b => {
          const t = ((b && b.text) || '').trim();
          if (t) out.push(t);
        });
      });
      return out;
    }
    const text = String(body || '')
      .replace(/\[\[IMG:\d+\]\]/g, ' ')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/^[-*]{3,}\s*$/gm, ' ');
    const out = [];
    text.split(/\n+/).forEach(para => {
      const line = para.trim();
      if (!line) return;
      if (lessonMode === 'song') {
        // Lyrics — each newline-separated line is one unit.
        out.push(line);
      } else {
        line.split(/(?<=[.!?])\s+/).forEach(s => {
          const t = s.trim();
          if (t) out.push(t);
        });
      }
    });
    return out;
  }

  (function wireLessonAudio() {
    const addBtn  = $('addAudioBtn');
    const fileInp = $('addAudioFile');
    const syncBtn = $('audioSyncBtn');
    if (addBtn && fileInp) {
      addBtn.addEventListener('click', () => fileInp.click());
      fileInp.addEventListener('change', () => {
        const f = fileInp.files && fileInp.files[0];
        if (!f) return;
        if (lessonAudioObjectUrl) { try { URL.revokeObjectURL(lessonAudioObjectUrl); } catch {} }
        lessonAudioFile      = f;
        lessonAudioObjectUrl = URL.createObjectURL(f);
        lessonAudioUrl       = null;   // a new file supersedes any saved URL
        lessonAudioSegments  = [];     // old timings belong to the old audio
        refreshAudioUi();
      });
    }
    if (syncBtn) syncBtn.addEventListener('click', openAudioSyncEditor);
    const waveBtn = $('audioWaveBtn');
    if (waveBtn) waveBtn.addEventListener('click', openWaveformSyncEditor);
  })();

  function openAudioSyncEditor() {
    const src = audioPlaybackSrc();
    if (!src) { alert('Attach an mp3 first.'); return; }
    const lines = splitBodyIntoLines($('lessonBody').value);
    if (!lines.length) { alert('Add the lesson body text first.'); return; }

    const old = document.getElementById('audioSyncHost');
    if (old) old.remove();

    // Pre-fill from any saved segments, matched by sentence text.
    const segByText = new Map();
    lessonAudioSegments.forEach(s => {
      if (s && typeof s.text === 'string') segByText.set(s.text.trim(), s);
    });

    const host = document.createElement('div');
    host.id = 'audioSyncHost';
    host.className = 'wc-popup-backdrop';
    host.innerHTML = `
      <div class="wc-popup wc-audio-sync">
        <button class="wc-popup-close" aria-label="Close">×</button>
        <h3 style="margin:0 0 4px;">Audio sync</h3>
        <p class="wc-muted" style="margin:0 0 10px;font-size:13px;line-height:1.5;">
          <strong>✨ Auto-align</strong> drafts the timings by speech recognition — then
          proofread. Or do it by hand: play the mp3, pause at the right moment and click
          <strong>⏱ start</strong> / <strong>⏱ end</strong> on a sentence (or type seconds
          directly). ▶ previews that slice. On the lesson page students tap 🔊 on a
          sentence to hear exactly that part. Sentences left blank get no 🔊.
        </p>
        <audio id="asAudio" controls preload="metadata" src="${src}" style="width:100%;"></audio>
        <div class="wc-as-toolbar">
          <button class="wc-btn ghost" id="asAuto" type="button">✨ Auto-align</button>
          <span class="wc-muted" id="asAutoStatus" style="font-size:12.5px;"></span>
        </div>
        <div class="wc-as-rows" id="asRows"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
          <button class="wc-btn ghost" id="asCancel" type="button">Cancel</button>
          <button class="wc-btn" id="asSave" type="button">Save timings</button>
        </div>
      </div>
    `;
    document.body.appendChild(host);
    const audio = host.querySelector('#asAudio');
    const rows  = host.querySelector('#asRows');

    lines.forEach((text, i) => {
      const seg = segByText.get(text);
      const row = document.createElement('div');
      row.className = 'wc-as-row';
      row.dataset.text = text;
      row.innerHTML = `
        <span class="wc-as-num">${i + 1}</span>
        <span class="wc-as-text">${escForTextarea(text)}</span>
        <span class="wc-as-ctl">
          <button type="button" class="wc-btn ghost wc-as-cap" data-cap="start">⏱ start</button>
          <input class="wc-as-in" data-t="start" type="number" step="0.1" min="0"
                 value="${seg && Number.isFinite(seg.start) ? seg.start : ''}">
          <button type="button" class="wc-btn ghost wc-as-cap" data-cap="end">⏱ end</button>
          <input class="wc-as-in" data-t="end" type="number" step="0.1" min="0"
                 value="${seg && Number.isFinite(seg.end) ? seg.end : ''}">
          <button type="button" class="wc-btn ghost wc-as-play" title="Preview this slice">▶</button>
        </span>
      `;
      rows.appendChild(row);
    });

    // Preview playback — stop at the row's end time.
    let stopAt = null;
    audio.addEventListener('timeupdate', () => {
      if (stopAt != null && audio.currentTime >= stopAt) { audio.pause(); stopAt = null; }
    });

    rows.addEventListener('click', (e) => {
      const row = e.target.closest('.wc-as-row');
      if (!row) return;
      const cap = e.target.closest('.wc-as-cap');
      if (cap) {
        const inp = row.querySelector(`.wc-as-in[data-t="${cap.dataset.cap}"]`);
        if (inp) inp.value = audio.currentTime.toFixed(1);
        return;
      }
      if (e.target.closest('.wc-as-play')) {
        const a = parseFloat(row.querySelector('.wc-as-in[data-t="start"]').value);
        const b = parseFloat(row.querySelector('.wc-as-in[data-t="end"]').value);
        if (!Number.isFinite(a)) return;
        stopAt = (Number.isFinite(b) && b > a) ? b : null;
        audio.currentTime = Math.max(0, a);
        audio.play().catch(() => {});
      }
    });

    // ── Auto-align — Google STT (via the wc-align edge function)
    // drafts the timings; the teacher then proofreads. Best-effort:
    // if wc-align isn't deployed, or recognition fails, the manual
    // capture buttons are the fallback.
    const autoBtn    = host.querySelector('#asAuto');
    const autoStatus = host.querySelector('#asAutoStatus');
    if (autoBtn) {
      autoBtn.addEventListener('click', async () => {
        if (autoBtn.dataset.busy === '1') return;
        autoBtn.dataset.busy = '1';
        const orig = autoBtn.textContent;
        autoBtn.textContent = '⏳ Aligning…';
        autoStatus.textContent = 'Recognising speech — this can take up to ~2 min for a long mp3.';
        try {
          const rowEls = [...rows.querySelectorAll('.wc-as-row')];
          const segs = await requestAutoAlign(rowEls.map(r => r.dataset.text));
          let filled = 0;
          rowEls.forEach((row, i) => {
            const seg = segs[i];
            if (seg && Number.isFinite(seg.start) && Number.isFinite(seg.end)) {
              row.querySelector('.wc-as-in[data-t="start"]').value = (+seg.start).toFixed(1);
              row.querySelector('.wc-as-in[data-t="end"]').value   = (+seg.end).toFixed(1);
              filled++;
            }
          });
          autoStatus.textContent = filled
            ? `Auto-filled ${filled} / ${rowEls.length} — check the timings, nudge any that are off, then Save.`
            : 'No sentences matched the audio — sync them by hand.';
        } catch (e) {
          autoStatus.textContent = 'Auto-align unavailable (' + ((e && e.message) || e)
            + ') — sync by hand below.';
        } finally {
          autoBtn.textContent = orig;
          autoBtn.dataset.busy = '';
        }
      });
    }

    function close() { try { audio.pause(); } catch {} host.remove(); }
    host.querySelector('.wc-popup-close').addEventListener('click', close);
    host.querySelector('#asCancel').addEventListener('click', close);
    host.addEventListener('click', (e) => { if (e.target === host) close(); });

    host.querySelector('#asSave').addEventListener('click', () => {
      const out = [];
      rows.querySelectorAll('.wc-as-row').forEach(row => {
        const a = parseFloat(row.querySelector('.wc-as-in[data-t="start"]').value);
        const b = parseFloat(row.querySelector('.wc-as-in[data-t="end"]').value);
        if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
          out.push({ text: row.dataset.text, start: +a.toFixed(2), end: +b.toFixed(2) });
        }
      });
      lessonAudioSegments = out;
      refreshAudioUi();
      close();
    });
  }

  // ----------------------------------------------------------------
  //  WAVEFORM AUDIO-CORRECTION EDITOR
  //
  //  A visual, sentence-by-sentence sync tool — especially for songs.
  //  The mp3 is decoded to a waveform; for each line the teacher
  //  LEFT-clicks the start position and RIGHT-clicks the end. Auto-
  //  align can pre-fill every line first, so this becomes a quick
  //  "nudge the boundaries" correction pass over the waveform.
  //    SPACE play/stop · Z play from the line's start · Enter next
  // ----------------------------------------------------------------
  function openWaveformSyncEditor() {
    const src = audioPlaybackSrc();
    if (!src) { alert('Attach an mp3 first.'); return; }
    const lines = splitBodyIntoLines($('lessonBody').value);
    if (!lines.length) { alert('Add the lesson body text first.'); return; }

    const old = document.getElementById('waveSyncHost');
    if (old) old.remove();

    // Working timings, pre-filled from saved segments matched by text.
    const segByText = new Map();
    lessonAudioSegments.forEach(s => {
      if (s && typeof s.text === 'string') segByText.set(s.text.trim(), s);
    });
    const work = lines.map(text => {
      const s = segByText.get(text);
      return {
        start: s && Number.isFinite(s.start) ? s.start : null,
        end:   s && Number.isFinite(s.end)   ? s.end   : null,
      };
    });
    let idx = 0;

    const host = document.createElement('div');
    host.id = 'waveSyncHost';
    host.className = 'wc-popup-backdrop';
    host.innerHTML = `
      <div class="wc-popup wc-wave-sync">
        <button class="wc-popup-close" aria-label="Close">×</button>
        <div class="wc-ws-head">
          <h3 style="margin:0; display:inline-flex; align-items:center; gap:8px;">
            오디오 보정 — 문장별 구간
            <button class="wc-btn ghost wc-ws-fast wc-ws-fast-on" id="wsFast" type="button"
                    title="빨리 모드 — 모든 문장 boundary 를 한 번에 편집"
                    style="height:28px; padding:4px 14px; font-size:13px;">⚡ 빨리</button>
            <span class="wc-ws-zoom" role="group" aria-label="확대/축소"
                  style="display:inline-flex; gap:4px;">
              <button class="wc-btn ghost wc-ws-zbtn" id="wsZoomOut" type="button"
                      title="축소"
                      style="height:28px; min-width:28px; padding:2px 8px; font-size:14px; line-height:1;">−</button>
              <button class="wc-btn ghost wc-ws-zbtn" id="wsZoomIn" type="button"
                      title="확대"
                      style="height:28px; min-width:28px; padding:2px 8px; font-size:14px; line-height:1;">+</button>
            </span>
          </h3>
          <div class="wc-ws-meta">
            <label>재생속도
              <select id="wsSpeed">
                <option value="0.5">0.5×</option>
                <option value="0.75">0.75×</option>
                <option value="1" selected>1.0×</option>
                <option value="1.25">1.25×</option>
                <option value="1.5">1.5×</option>
              </select>
            </label>
            <span>진행도 <strong id="wsProgress">1 / ${lines.length}</strong></span>
          </div>
        </div>
        <p class="wc-ws-instr" id="wsInstr"></p>
        <div class="wc-ws-stage">
          <canvas id="wsCanvas"></canvas>
          <div class="wc-ws-loading" id="wsLoading">파형 분석 중…</div>
        </div>
        <div class="wc-ws-sent" id="wsSent"></div>
        <div class="wc-ws-foot">
          <span class="wc-ws-keys">SPACE 재생/정지 · Z 문장 처음부터 · ← 시작 · → 끝(⚡ 켜져 있으면 다음 문장 자동) · Enter 다음 문장 · , −2초 · . +2초 · 검은선·번호 드래그=위치 이동</span>
          <span class="wc-ws-act">
            <button class="wc-btn ghost" id="wsAuto" type="button">✨ Auto-align</button>
            <button class="wc-btn ghost" id="wsPrev" type="button">‹ 이전</button>
            <button class="wc-btn ghost" id="wsNext" type="button">다음 문장 ›</button>
            <button class="wc-btn" id="wsSave" type="button">저장</button>
          </span>
        </div>
      </div>
    `;
    document.body.appendChild(host);

    const canvas  = host.querySelector('#wsCanvas');
    const cx      = canvas.getContext('2d');
    const stage   = host.querySelector('.wc-ws-stage');
    const instrEl = host.querySelector('#wsInstr');
    const sentEl  = host.querySelector('#wsSent');
    const progEl  = host.querySelector('#wsProgress');
    const loadEl  = host.querySelector('#wsLoading');

    const audio = new Audio(src);
    audio.preload = 'auto';

    let peaks = null, duration = 0, cssW = 0, baseW = 0;
    const cssH = 170;
    let rafId = null;
    // Zoom factor — 1 = waveform fills the stage exactly. Each + step
    // multiplies by ZOOM_STEP; − divides. Min 1 (no shrink below
    // base), max 8× (covers ~5-min songs at decent detail).
    let zoom = 1;
    const ZOOM_STEP = 1.5;
    const ZOOM_MIN = 1;
    const ZOOM_MAX = 8;

    function layoutCanvas() {
      baseW = Math.max(320, stage.clientWidth);
      cssW  = Math.round(baseW * zoom);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width  = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width  = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Re-render the waveform peaks at the new canvas width — call
    // after a zoom change so the wave isn't visually stretched
    // (would look fuzzy at high zoom without re-sampling).
    function regenPeaks(audioBuf) {
      if (!audioBuf) return;
      const ch = audioBuf.getChannelData(0);
      const cols = Math.max(400, Math.round(cssW));
      const per = Math.max(1, Math.floor(ch.length / cols));
      peaks = new Float32Array(cols);
      for (let c = 0; c < cols; c++) {
        let mx = 0;
        const s0 = c * per, e0 = Math.min(ch.length, s0 + per);
        for (let i = s0; i < e0; i++) {
          const v = Math.abs(ch[i]);
          if (v > mx) mx = v;
        }
        peaks[c] = mx;
      }
    }
    // Decoded AudioBuffer kept so the zoom re-renders the peaks at
    // the new column count (cleaner zoom-in view).
    let decodedBuf = null;

    // Auto-scroll the stage so the playhead stays in view. Called
    // from tick() (per-frame while playing) and after any
    // currentTime change (keyboard scrub, drag, set-edge).
    function autoScrollToPlayhead() {
      if (!cssW || !duration) return;
      const px = (audio.currentTime / duration) * cssW;
      const vw = stage.clientWidth;
      const margin = 60;
      const left = stage.scrollLeft;
      // Push the scroll only when the playhead is about to leave
      // the right edge OR has fallen off the left edge.
      if (px > left + vw - margin) {
        stage.scrollLeft = Math.max(0, px - vw + margin);
      } else if (px < left + margin) {
        stage.scrollLeft = Math.max(0, px - margin);
      }
    }

    // ⚡ 빨리 (fast) mode — default ON. When ON, the waveform shows
    // EVERY sentence's start/end pair at once (each with a small
    // numbered badge above) so the teacher can rapid-fire through
    // the whole song without losing context. When OFF, only the
    // currently-edited sentence's lines are drawn.
    let fastMode = true;

    // Numbered badge — a small filled circle with the sentence's
    // 1-based index inside, drawn above a start (green) or end
    // (red) line. The badges are draggable; their position is the
    // canonical hit-test for adjusting the corresponding time.
    const BADGE_R = 9;       // radius
    const BADGE_Y = BADGE_R + 2;
    function drawBadge(x, num, which, isCurrent) {
      const color = which === 'start' ? '#1f9d4d' : '#d33';
      cx.beginPath();
      cx.arc(x, BADGE_Y, BADGE_R, 0, Math.PI * 2);
      cx.fillStyle = color;
      cx.fill();
      if (isCurrent) {
        cx.strokeStyle = '#000';
        cx.lineWidth = 2;
        cx.stroke();
      }
      cx.fillStyle = '#fff';
      cx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(String(num), x, BADGE_Y);
    }

    function draw() {
      if (!cssW) return;
      cx.clearRect(0, 0, cssW, cssH);
      cx.fillStyle = '#eef0f2';
      cx.fillRect(0, 0, cssW, cssH);
      if (!peaks || !duration) return;
      const seg = work[idx];
      const toX = (t) => Math.max(0, Math.min(cssW, (t / duration) * cssW));
      // current line's marked region
      if (seg.start != null && seg.end != null) {
        const x1 = toX(Math.min(seg.start, seg.end));
        const x2 = toX(Math.max(seg.start, seg.end));
        const g = cx.createLinearGradient(x1, 0, x2, 0);
        g.addColorStop(0, 'rgba(58,74,216,0.32)');
        g.addColorStop(1, 'rgba(58,74,216,0.07)');
        cx.fillStyle = g;
        cx.fillRect(x1, 0, x2 - x1, cssH);
      }
      // waveform line
      cx.beginPath();
      const n = peaks.length;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * cssW;
        const y = cssH - peaks[i] * (cssH - 12) - 3;
        if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
      }
      cx.strokeStyle = '#3a4ad8';
      cx.lineWidth = 1.3;
      cx.stroke();
      // start / end markers + playhead
      const vline = (x, color, w) => {
        cx.strokeStyle = color; cx.lineWidth = w || 2;
        cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, cssH); cx.stroke();
      };
      if (fastMode) {
        // Draw EVERY sentence's start/end. Current sentence (idx)
        // gets thicker lines + a black ring on its badges so the
        // teacher always knows which sentence ←/→ will edit.
        work.forEach((s, i) => {
          const isCurrent = (i === idx);
          if (s.start != null) {
            vline(toX(s.start), '#1f9d4d', isCurrent ? 3 : 2);
            drawBadge(toX(s.start), i + 1, 'start', isCurrent);
          }
          if (s.end != null) {
            vline(toX(s.end),   '#d33',   isCurrent ? 3 : 2);
            drawBadge(toX(s.end),   i + 1, 'end',   isCurrent);
          }
        });
      } else {
        if (seg.start != null) vline(toX(seg.start), '#1f9d4d');
        if (seg.end   != null) vline(toX(seg.end),   '#d33');
      }
      // Black playhead — drawn ALWAYS so the teacher can see where
      // the audio is sitting even when paused.
      vline(toX(audio.currentTime), '#000', audio.paused ? 1.5 : 2);
    }

    function tick() {
      draw();
      autoScrollToPlayhead();
      if (!audio.paused) rafId = requestAnimationFrame(tick);
    }

    function refreshSentenceUi() {
      instrEl.innerHTML =
        `<strong>${idx + 1}번</strong> 문장의 시작 위치에 ` +
        `<strong style="color:#1f9d4d;">좌클릭</strong>, 끝 위치에 ` +
        `<strong style="color:#d33;">우클릭</strong>하세요. ` +
        `<span style="color:#888;">재생하며 시작에서 <strong>←</strong>, ` +
        `끝에서 <strong>→</strong> 를 눌러도 됩니다.</span>`;
      sentEl.textContent = lines[idx] || '';
      progEl.textContent = `${idx + 1} / ${lines.length}`;
      host.querySelector('#wsPrev').disabled = idx <= 0;
      host.querySelector('#wsNext').disabled = idx >= lines.length - 1;
      draw();
    }

    // Decode the mp3 → amplitude peaks for the waveform.
    (async () => {
      try {
        layoutCanvas();
        const ab = await (await fetch(src)).arrayBuffer();
        const AC = window.AudioContext || window.webkitAudioContext;
        const actx = new AC();
        decodedBuf = await actx.decodeAudioData(ab);
        try { actx.close(); } catch {}
        duration = decodedBuf.duration;
        regenPeaks(decodedBuf);
        loadEl.style.display = 'none';
        refreshSentenceUi();
      } catch (e) {
        loadEl.textContent = '파형을 그릴 수 없습니다 — 🎚 Audio sync(숫자 입력)를 쓰세요.';
        console.warn('[waveform] decode failed', e && e.message);
      }
    })();

    // ── Zoom controls — re-layout the canvas at a wider px size,
    //    re-sample peaks for sharpness, and keep the playhead in
    //    view after the layout change. Min 1× (no shrink below base
    //    width), max 8×. ──
    function applyZoom(newZoom) {
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
      if (z === zoom) return;
      // Preserve the time the playhead sat on so the user's mental
      // model of "where am I in the song" survives the zoom.
      const wasAt = audio.currentTime || 0;
      zoom = z;
      layoutCanvas();
      regenPeaks(decodedBuf);
      draw();
      // Scroll so the playhead's TIME stays in view after the
      // wider canvas was rendered. Center it on the viewport.
      if (duration) {
        const px = (wasAt / duration) * cssW;
        const vw = stage.clientWidth;
        stage.scrollLeft = Math.max(0, px - vw / 2);
      }
      // Disable buttons at the limits.
      host.querySelector('#wsZoomIn').disabled  = zoom >= ZOOM_MAX;
      host.querySelector('#wsZoomOut').disabled = zoom <= ZOOM_MIN;
    }
    host.querySelector('#wsZoomIn').addEventListener('click',
      () => applyZoom(zoom * ZOOM_STEP));
    host.querySelector('#wsZoomOut').addEventListener('click',
      () => applyZoom(zoom / ZOOM_STEP));
    // Sync the disabled state at the initial limit.
    host.querySelector('#wsZoomOut').disabled = true;

    // ── Playhead drag — grab the black line within 14 px and drag
    //    sideways to scrub. While dragging the audio is paused so
    //    we don't fight playback. On release, the suppress-click
    //    flag keeps the existing left-click-= start logic from
    //    treating the drop point as a new sentence-start. ──
    let playheadDragging = false;
    let suppressNextClick = false;
    function playheadX() {
      return duration ? (audio.currentTime / duration) * cssW : -100;
    }
    // Native CSS cursor `ew-resize` shows the drag arrows when the
    // pointer is over the canvas — fine enough for a quick visual
    // affordance without needing a per-frame hover hit-test.
    canvas.style.cursor = 'crosshair';
    canvas.addEventListener('mousemove', (e) => {
      if (playheadDragging) return;
      if (!duration) return;
      // Badge takes priority over playhead-hover cue.
      if (badgeHitAt(e.offsetX, e.offsetY)) {
        canvas.style.cursor = 'grab';
        return;
      }
      const near = Math.abs(e.offsetX - playheadX()) < 14;
      canvas.style.cursor = near ? 'ew-resize' : 'crosshair';
    });
    // Hit-test the small numbered badges at the top of the canvas.
    // Returns {i, which:'start'|'end'} or null. Only meaningful in
    // fast mode (badges are only drawn then). Y is constrained to
    // the top strip so a click lower on the line itself doesn't
    // accidentally drag a badge.
    function badgeHitAt(ox, oy) {
      if (!fastMode || oy > BADGE_R * 2 + 6) return null;
      let best = null;
      let bestDist = Infinity;
      work.forEach((s, i) => {
        if (s.start != null) {
          const x = (s.start / duration) * cssW;
          const d = Math.abs(ox - x);
          if (d < BADGE_R + 4 && d < bestDist) {
            best = { i, which: 'start' }; bestDist = d;
          }
        }
        if (s.end != null) {
          const x = (s.end / duration) * cssW;
          const d = Math.abs(ox - x);
          if (d < BADGE_R + 4 && d < bestDist) {
            best = { i, which: 'end' }; bestDist = d;
          }
        }
      });
      return best;
    }

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !duration) return;
      // 1. Try a numbered badge first (fast mode only). Dragging it
      //    re-positions the corresponding start/end without touching
      //    the playhead or audio. The current sentence is unaffected
      //    — boundaries belong to whichever sentence's badge moved.
      const hit = badgeHitAt(e.offsetX, e.offsetY);
      if (hit) {
        e.preventDefault();
        const rect0 = canvas.getBoundingClientRect();
        function onBMove(ev) {
          const x = Math.max(0, Math.min(cssW, ev.clientX - rect0.left));
          work[hit.i][hit.which] =
            +((x / cssW) * duration).toFixed(2);
          draw();
        }
        function onBUp() {
          document.removeEventListener('mousemove', onBMove);
          document.removeEventListener('mouseup',   onBUp);
          suppressNextClick = true;
          setTimeout(() => { suppressNextClick = false; }, 50);
        }
        document.addEventListener('mousemove', onBMove);
        document.addEventListener('mouseup',   onBUp);
        return;
      }
      // 2. Otherwise try the playhead — within 14 px → drag-to-scrub.
      if (Math.abs(e.offsetX - playheadX()) >= 14) return;   // miss
      e.preventDefault();
      playheadDragging = true;
      const wasPlaying = !audio.paused;
      try { audio.pause(); } catch {}
      const rect0 = canvas.getBoundingClientRect();
      function onMove(ev) {
        const x = Math.max(0, Math.min(cssW, ev.clientX - rect0.left));
        try { audio.currentTime = (x / cssW) * duration; } catch {}
        draw();
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        playheadDragging = false;
        canvas.style.cursor = 'crosshair';
        // Eat the click event the browser fires right after mouseup
        // — without this, the canvas.click handler below would treat
        // the drop point as the new sentence-start position.
        suppressNextClick = true;
        setTimeout(() => { suppressNextClick = false; }, 50);
        if (wasPlaying) audio.play().catch(() => {});
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });

    // Left-click = start, right-click = end of the current line.
    canvas.addEventListener('click', (e) => {
      if (suppressNextClick) return;          // just finished a drag
      if (!duration) return;
      work[idx].start = +(e.offsetX / cssW * duration).toFixed(2);
      draw();
    });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!duration) return;
      work[idx].end = +(e.offsetX / cssW * duration).toFixed(2);
      draw();
    });

    host.querySelector('#wsSpeed').addEventListener('change', (e) => {
      audio.playbackRate = parseFloat(e.target.value) || 1;
    });

    // ⚡ 빨리 toggle. Default ON (the button starts with class
    // .wc-ws-fast-on from the markup). Clicking flips the mode +
    // the .wc-ws-fast-on class, then re-draws so the canvas
    // immediately reflects "all sentences" vs "only current".
    host.querySelector('#wsFast').addEventListener('click', (e) => {
      fastMode = !fastMode;
      e.currentTarget.classList.toggle('wc-ws-fast-on', fastMode);
      e.currentTarget.title = fastMode
        ? '빨리 모드 ON — →/← 가 자동 진행, 모든 문장의 시작/끝 동시 표시'
        : '빨리 모드 OFF — 현재 문장만 표시, Enter 로 다음 문장';
      draw();
    });

    function gotoSentence(n, keepPlaying) {
      idx = Math.max(0, Math.min(lines.length - 1, n));
      if (!keepPlaying) {
        try { audio.pause(); } catch {}
      }
      refreshSentenceUi();
    }
    host.querySelector('#wsPrev').addEventListener('click', () => gotoSentence(idx - 1));
    host.querySelector('#wsNext').addEventListener('click', () => gotoSentence(idx + 1));

    function togglePlay() {
      if (audio.paused) { audio.play().catch(() => {}); tick(); }
      else audio.pause();
    }
    function playFromStart() {
      const s = work[idx].start;
      try { audio.currentTime = Number.isFinite(s) ? s : 0; } catch {}
      audio.play().catch(() => {});
      tick();
    }
    // Stop at the current line's end while playing — but ONLY when
    // fastMode is OFF. In fast mode, we want continuous playback so
    // the teacher can mark every sentence in one pass with ←/→.
    audio.addEventListener('timeupdate', () => {
      if (fastMode) return;
      const seg = work[idx];
      if (!audio.paused && seg.end != null && audio.currentTime >= seg.end) audio.pause();
    });
    audio.addEventListener('pause', () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      draw();
    });

    // Capture the current playhead time as this sentence's start /
    // end — the keyboard equivalent of left-/right-clicking the wave.
    function setEdgeAtPlayhead(which) {
      if (!duration) return;
      work[idx][which] = +Math.max(0, Math.min(duration, audio.currentTime)).toFixed(2);
      draw();
    }
    // Nudge the playhead by ±N seconds. Works whether playing or
    // paused; calls draw() (or the running tick loop) so the new
    // position is reflected on the black playhead line immediately,
    // and scrolls the stage so the playhead stays in view at high zoom.
    function seekBy(delta) {
      if (!duration) return;
      try {
        audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + delta));
      } catch {}
      if (!audio.paused) tick();
      else { draw(); autoScrollToPlayhead(); }
    }
    function onKey(e) {
      const tag = e.target && e.target.tagName;
      if ((tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') && e.key !== 'Enter') return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'z' || e.key === 'Z')  { e.preventDefault(); playFromStart(); }
      // ← / → set the current sentence's start / end to the
      // black-playhead position. Behavior splits on fastMode:
      //   - fastMode ON (default): → also advances to the next
      //     sentence WITHOUT pausing the audio, so the teacher can
      //     mark every boundary in a single playthrough. ← also
      //     keeps the audio playing.
      //   - fastMode OFF: just sets the value, no advance, no
      //     change to playback. Enter is the explicit "next" key.
      // Both keys ALWAYS override an existing value so re-pressing
      // snaps to the new playhead — handy for fine-tuning either
      // before advancing (fastMode) or repeatedly (slow mode).
      else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setEdgeAtPlayhead('start');
      }
      else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setEdgeAtPlayhead('end');
        if (fastMode && idx < lines.length - 1) gotoSentence(idx + 1, true);
      }
      else if (e.key === 'Enter')               { e.preventDefault(); gotoSentence(idx + 1); }
      // Per-2-sec scrub shortcuts — swapped to the standard mapping
      // (`,` carries the `<` glyph = rewind, `.` carries `>` =
      // forward), so muscle memory from other media players carries.
      //   , → 뒤로 2초 (rewind)
      //   . → 앞으로 2초 (skip forward)
      else if (e.key === ',')                   { e.preventDefault(); seekBy(-2); }
      else if (e.key === '.')                   { e.preventDefault(); seekBy(+2); }
    }
    document.addEventListener('keydown', onKey);

    // Auto-align inside the waveform editor — fills every line, then
    // the teacher just nudges the boundaries.
    host.querySelector('#wsAuto').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.busy === '1') return;
      btn.dataset.busy = '1';
      const orig = btn.textContent;
      btn.textContent = '⏳ Aligning…';
      try {
        const segs = await requestAutoAlign(lines);
        let filled = 0;
        segs.forEach((s, i) => {
          if (s && Number.isFinite(s.start) && Number.isFinite(s.end) && work[i]) {
            work[i].start = s.start;
            work[i].end   = s.end;
            filled++;
          }
        });
        btn.textContent = filled ? `✓ ${filled} aligned` : '⚠ No match';
        draw();
      } catch (err) {
        btn.textContent = '⚠ Failed';
        console.warn('[waveform auto-align]', err && err.message);
      } finally {
        setTimeout(() => { btn.textContent = orig; btn.dataset.busy = ''; }, 2600);
      }
    });

    function onResize() {
      layoutCanvas();
      regenPeaks(decodedBuf);
      draw();
    }
    window.addEventListener('resize', onResize);

    function cleanup() {
      try { audio.pause(); } catch {}
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      host.remove();
    }
    host.querySelector('.wc-popup-close').addEventListener('click', cleanup);
    host.addEventListener('click', (e) => { if (e.target === host) cleanup(); });

    host.querySelector('#wsSave').addEventListener('click', () => {
      const out = [];
      lines.forEach((text, i) => {
        const w = work[i];
        if (w && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start) {
          out.push({ text, start: +w.start.toFixed(2), end: +w.end.toFixed(2) });
        }
      });
      lessonAudioSegments = out;
      refreshAudioUi();
      cleanup();
    });
  }

  // ----------------------------------------------------------------
  //  SPEECH-BUBBLE EDITOR  (comic-panel images)
  //
  //  The teacher lays a box over each speech bubble and types the
  //  dialogue it should contain. Boxes are stored on the image record
  //  as `bubbles: [{x,y,w,h,text}]` where x/y/w/h are 0-1 fractions
  //  of the image — resolution-independent, so the lesson renderer
  //  can overlay them at any display size. The overlaid white box
  //  hides the original lettering; the typed text becomes real,
  //  studyable words (chunk underline / select / highlight / TTS).
  // ----------------------------------------------------------------
  function escForTextarea(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;');
  }
  function clamp01(n) { return Math.max(0, Math.min(1, Number(n) || 0)); }

  function openBubbleEditor(idx) {
    const im = lessonImages[idx];
    if (!im) return;
    if (!Array.isArray(im.bubbles)) im.bubbles = [];

    const old = document.getElementById('bubbleEditorHost');
    if (old) old.remove();

    const host = document.createElement('div');
    host.id = 'bubbleEditorHost';
    host.className = 'wc-popup-backdrop';
    host.innerHTML = `
      <div class="wc-popup wc-bubble-editor">
        <button class="wc-popup-close" aria-label="Close">×</button>
        <div class="wc-be-head-sticky">
          <h3 style="margin:0 0 6px;">Speech bubbles — [[IMG:${idx}]]</h3>
          <div class="wc-be-toolbar">
            <button class="wc-btn wc-be-toolbtn" id="beAddRect" type="button">+ Add rectangle</button>
            <button class="wc-btn wc-be-toolbtn" id="beAddCircle" type="button">+ Add circle</button>
            <span class="wc-muted wc-be-meta" id="beCount"></span>
            <span class="wc-be-msg" id="beMsg"></span>
            <span class="wc-be-spacer"></span>
            <button class="wc-btn ghost wc-be-toolbtn" id="beCancel" type="button">Cancel</button>
            <button class="wc-btn wc-be-toolbtn" id="beDone" type="button">Save</button>
          </div>
        </div>
        <div class="wc-be-stage-wrap">
          <div class="wc-be-stage" id="beStage"></div>
        </div>
      </div>
    `;
    document.body.appendChild(host);

    const stage   = host.querySelector('#beStage');
    const countEl = host.querySelector('#beCount');

    // Renumber every box's order badge from its DOM position. DOM
    // order = the order boxes were added = the reading order students
    // follow with the arrow keys. Runs on every add / delete / load.
    function renumber() {
      stage.querySelectorAll('.wc-be-box').forEach((box, i) => {
        const o = box.querySelector('.wc-be-order');
        if (o) o.textContent = String(i + 1);
      });
    }
    function refreshCount() {
      renumber();
      const n = stage.querySelectorAll('.wc-be-box').length;
      countEl.textContent = n
        ? `${n} bubble${n > 1 ? 's' : ''} — numbered in reading order`
        : 'No bubbles yet — click a speech bubble in the image.';
    }
    // Transient status line — e.g. when auto-detect can't find a bubble.
    let _msgT = null;
    function flashMsg(text) {
      const m = host.querySelector('#beMsg');
      if (!m) return;
      m.textContent = text;
      clearTimeout(_msgT);
      _msgT = setTimeout(() => { m.textContent = ''; }, 3400);
    }

    // ---- speech-bubble auto-detect -------------------------------
    //  A bubble interior is a light region fully enclosed by the dark
    //  outline. Reading the panel's pixels into an offscreen canvas
    //  once, a flood fill from the teacher's click point grows over
    //  connected light pixels and stops at the outline — its bounding
    //  box IS the bubble. The teacher only has to click roughly
    //  inside; the fill finds the exact extent.
    const LIGHT = 160;            // luminance ≥ this = bubble interior
    let cW = 0, cH = 0;           // detect-canvas (= image) pixel size
    let lightMask = null;         // Uint8Array, 1 = light pixel
    let detectCanvas = null;      // image drawn at native res — for crop/OCR

    function buildLightMask(imgEl) {
      cW = imgEl.naturalWidth;
      cH = imgEl.naturalHeight;
      if (!cW || !cH) { lightMask = null; detectCanvas = null; return; }
      try {
        const cv = document.createElement('canvas');
        cv.width = cW; cv.height = cH;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(imgEl, 0, 0);
        const d = cx.getImageData(0, 0, cW, cH).data;
        lightMask = new Uint8Array(cW * cH);
        for (let p = 0, n = cW * cH; p < n; p++) {
          const i = p * 4;
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          lightMask[p] = lum >= LIGHT ? 1 : 0;
        }
        detectCanvas = cv;   // kept so tryOcrInto can crop bubble regions
      } catch (e) {
        lightMask = null;    // tainted canvas etc. — fall back to manual
        detectCanvas = null;
      }
    }

    // Best-effort OCR — crop the detected bubble out of the panel and
    // ask the wc-ocr edge function to draft its dialogue into the box.
    // If wc-ocr isn't deployed (or finds nothing) the box just stays
    // empty for the teacher to type into.
    async function tryOcrInto(box, region) {
      const ta = box && box.querySelector('.wc-be-text');
      if (!ta || !detectCanvas || ta.value.trim()) return;
      ta.placeholder = 'Reading bubble text…';
      box.classList.add('wc-be-ocr-busy');
      try {
        // Pad the detected region ~12% each way — the flood-fill bbox
        // hugs the light interior and can clip handwriting that
        // touches the bubble outline.
        const padX = region.w * 0.12, padY = region.h * 0.12;
        const sx = Math.max(0, Math.round((region.x - padX) * cW));
        const sy = Math.max(0, Math.round((region.y - padY) * cH));
        const sw = Math.max(1, Math.min(cW - sx, Math.round((region.w + padX * 2) * cW)));
        const sh = Math.max(1, Math.min(cH - sy, Math.round((region.h + padY * 2) * cH)));
        // Upscale small crops — Cloud Vision reads handwriting far more
        // reliably on a larger image. Push the long side toward 1000px.
        const scale = Math.min(4, Math.max(1, 1000 / Math.max(sw, sh)));
        const crop = document.createElement('canvas');
        crop.width  = Math.round(sw * scale);
        crop.height = Math.round(sh * scale);
        const cx = crop.getContext('2d');
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(detectCanvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
        const b64 = crop.toDataURL('image/jpeg', 0.95).split(',')[1];
        const text = await ocrBubbleImage(b64);
        if (text && !ta.value.trim()) ta.value = text;
        else if (!text) flashMsg('Auto-read found no text — type the dialogue in.');
      } catch (e) {
        console.warn('[bubble-ocr] failed', e && e.message);
        // Silent — manual typing is the fallback.
      } finally {
        box.classList.remove('wc-be-ocr-busy');
        ta.placeholder = 'Type dialogue…';
      }
    }

    // Flood fill the enclosed light region containing fraction (fx,fy).
    // Returns {x,y,w,h} fractions, or null if no bubble found there.
    function detectBubbleAt(fx, fy) {
      if (!lightMask) return null;
      const W = cW, H = cH;
      let sx = Math.max(0, Math.min(W - 1, Math.round(fx * W)));
      let sy = Math.max(0, Math.min(H - 1, Math.round(fy * H)));
      // Seed landed on dark ink (outline / a letter)? Nudge outward to
      // the nearest light pixel so the fill starts inside the bubble.
      if (!lightMask[sy * W + sx]) {
        let found = false;
        for (let r = 1; r <= 18 && !found; r++) {
          for (let dy = -r; dy <= r && !found; dy++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              const x = sx + dx, y = sy + dy;
              if (x < 0 || y < 0 || x >= W || y >= H) continue;
              if (lightMask[y * W + x]) { sx = x; sy = y; found = true; }
            }
          }
        }
        if (!found) return null;
      }
      const visited = new Uint8Array(W * H);
      const start = sy * W + sx;
      visited[start] = 1;
      const stack = [start];
      let minX = sx, maxX = sx, minY = sy, maxY = sy, count = 0;
      while (stack.length) {
        const p = stack.pop();
        const x = p % W, y = (p / W) | 0;
        count++;
        if (x < minX) minX = x; else if (x > maxX) maxX = x;
        if (y < minY) minY = y; else if (y > maxY) maxY = y;
        // 4-connected — diagonals would leak through outline corners.
        if (x + 1 < W) { const q = p + 1;  if (!visited[q]) { visited[q] = 1; if (lightMask[q]) stack.push(q); } }
        if (x - 1 >= 0) { const q = p - 1; if (!visited[q]) { visited[q] = 1; if (lightMask[q]) stack.push(q); } }
        if (y + 1 < H) { const q = p + W; if (!visited[q]) { visited[q] = 1; if (lightMask[q]) stack.push(q); } }
        if (y - 1 >= 0) { const q = p - W; if (!visited[q]) { visited[q] = 1; if (lightMask[q]) stack.push(q); } }
      }
      // Region covering most of the image → the click escaped into the
      // page background or an open (un-closed) bubble. Reject.
      if (count / (W * H) > 0.55) return null;
      return {
        x: minX / W,
        y: minY / H,
        w: (maxX - minX + 1) / W,
        h: (maxY - minY + 1) / H,
      };
    }

    // Draw the panel image into the stage at a fitted size, build the
    // detect mask, then lay out any saved bubble boxes on top.
    const probe = new Image();
    probe.onload = () => {
      const maxW = 700, maxH = 440;
      const r  = Math.min(maxW / probe.naturalWidth, maxH / probe.naturalHeight, 1);
      const sw = Math.round(probe.naturalWidth  * r);
      const sh = Math.round(probe.naturalHeight * r);
      stage.style.width  = sw + 'px';
      stage.style.height = sh + 'px';
      stage.style.backgroundImage = `url("${im.url || im.data_url}")`;
      buildLightMask(probe);
      im.bubbles.forEach(addBox);
      refreshCount();
    };
    probe.onerror = () => { stage.textContent = 'Could not load image.'; };
    // crossOrigin lets the detect canvas read pixels from a Storage
    // URL without tainting (Supabase Storage serves CORS headers);
    // harmless for inline data URLs.
    probe.crossOrigin = 'anonymous';
    probe.src = im.url || im.data_url;

    // Currently-armed bubble shape. `null` = no tool armed (the
    // original "click stage to auto-detect" flow with default
    // shape). `'rect'` / `'circle'` = the matching toolbar button
    // has been pressed; the NEXT stage-click on a bubble snaps a
    // fitted box of THAT shape (instead of immediately creating a
    // centered manual box, which is what the buttons used to do).
    // Re-clicking the same button or pressing Esc disarms.
    let pendingShape = null;
    function setPendingShape(shape) {
      pendingShape = shape;
      const rb = host.querySelector('#beAddRect');
      const cb = host.querySelector('#beAddCircle');
      if (rb) rb.classList.toggle('wc-be-armed', shape === 'rect');
      if (cb) cb.classList.toggle('wc-be-armed', shape === 'circle');
      // Cursor cue while a tool is armed.
      stage.style.cursor = shape ? 'crosshair' : '';
    }

    // Click on bare stage (not on an existing box) → auto-detect the
    // bubble under the cursor and snap a fitted box to it. If a
    // toolbar shape is armed, the new box gets that shape (and the
    // tool disarms after one use).
    stage.addEventListener('click', (e) => {
      if (e.target !== stage) return;       // clicked a box / textarea / handle
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top)  / rect.height;
      const hit = detectBubbleAt(fx, fy);
      if (!hit) {
        flashMsg('No bubble found there — click nearer its centre.');
        return;
      }
      const shape = pendingShape || undefined;
      const box = addBox({ x: hit.x, y: hit.y, w: hit.w, h: hit.h, text: '', shape });
      refreshCount();
      const ta = box.querySelector('.wc-be-text');
      if (ta) ta.focus();
      // Auto-draft the dialogue from the cropped bubble (best-effort).
      tryOcrInto(box, hit);
      // One-shot: disarm the tool after a successful place.
      if (pendingShape) setPendingShape(null);
    });

    function addBox(model) {
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const box = document.createElement('div');
      // Bubble shape — 'rect' (slightly-rounded rectangle) or 'circle'
      // (rounded oval, the default). Saved with the bubble; the lesson
      // page renders the matching outline.
      const shape = model.shape === 'rect' ? 'rect' : 'circle';
      box.className = 'wc-be-box wc-be-' + shape;
      box.dataset.shape = shape;
      box.style.left   = (clamp01(model.x) * sw) + 'px';
      box.style.top    = (clamp01(model.y) * sh) + 'px';
      box.style.width  = (Math.max(0.05, clamp01(model.w)) * sw) + 'px';
      box.style.height = (Math.max(0.05, clamp01(model.h)) * sh) + 'px';
      box.innerHTML = `
        <span class="wc-be-order" title="Reading order"></span>
        <textarea class="wc-be-text" placeholder="Type dialogue…">${escForTextarea(model.text)}</textarea>
        <div class="wc-be-handle" title="Resize"></div>
        <button class="wc-be-del" type="button" title="Delete bubble">×</button>
      `;
      stage.appendChild(box);
      wireBox(box);
      return box;
    }

    // Pointer drag helper — `onMove(dx,dy)` fires per mousemove until
    // the button is released.
    function startDrag(e, onMove) {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      function mv(ev) { onMove(ev.clientX - sx, ev.clientY - sy); }
      function up() {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    }

    function wireBox(box) {
      const handle = box.querySelector('.wc-be-handle');
      const del    = box.querySelector('.wc-be-del');
      const ta     = box.querySelector('.wc-be-text');
      const order  = box.querySelector('.wc-be-order');

      del.addEventListener('click', (e) => {
        e.stopPropagation();
        box.remove();
        refreshCount();
      });

      // Move the box. `startMove` is shared by two grips: the box
      // body, and the top-left order-number badge (so the badge —
      // which overhangs the box corner — is also a drag handle).
      function startMove(e) {
        const sw = stage.clientWidth, sh = stage.clientHeight;
        const x0 = box.offsetLeft, y0 = box.offsetTop;
        startDrag(e, (dx, dy) => {
          box.style.left = Math.max(0, Math.min(sw - box.offsetWidth,  x0 + dx)) + 'px';
          box.style.top  = Math.max(0, Math.min(sh - box.offsetHeight, y0 + dy)) + 'px';
        });
      }
      // Move — mousedown on the box body (ignore textarea/handle/del).
      box.addEventListener('mousedown', (e) => {
        if (e.target === ta || e.target === handle || e.target === del) return;
        startMove(e);
      });
      // Move — mousedown on the order-number badge.
      if (order) order.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startMove(e);
      });

      // Resize — drag the corner handle.
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const sw = stage.clientWidth, sh = stage.clientHeight;
        const w0 = box.offsetWidth, h0 = box.offsetHeight;
        startDrag(e, (dx, dy) => {
          box.style.width  = Math.max(40, Math.min(sw - box.offsetLeft, w0 + dx)) + 'px';
          box.style.height = Math.max(28, Math.min(sh - box.offsetTop,  h0 + dy)) + 'px';
        });
      });
    }

    // Add-rectangle / Add-circle buttons NO LONGER create a centered
    // manual box on click. Instead they ARM the corresponding shape
    // — the next stage-click on a bubble auto-detects + creates a
    // box of that shape. Click the same button again to disarm.
    host.querySelector('#beAddRect').addEventListener('click',
      () => setPendingShape(pendingShape === 'rect' ? null : 'rect'));
    host.querySelector('#beAddCircle').addEventListener('click',
      () => setPendingShape(pendingShape === 'circle' ? null : 'circle'));
    // Esc disarms — useful if the teacher hit the wrong tool.
    host.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && pendingShape) { setPendingShape(null); e.stopPropagation(); }
    });

    function close() { host.remove(); }
    host.querySelector('.wc-popup-close').addEventListener('click', close);
    host.querySelector('#beCancel').addEventListener('click', close);
    host.addEventListener('click', (e) => { if (e.target === host) close(); });

    host.querySelector('#beDone').addEventListener('click', () => {
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const out = [];
      if (sw && sh) {
        stage.querySelectorAll('.wc-be-box').forEach(box => {
          const text = (box.querySelector('.wc-be-text').value || '').trim();
          if (!text) return;   // drop empty bubbles
          out.push({
            x: +(box.offsetLeft   / sw).toFixed(4),
            y: +(box.offsetTop    / sh).toFixed(4),
            w: +(box.offsetWidth  / sw).toFixed(4),
            h: +(box.offsetHeight / sh).toFixed(4),
            shape: box.dataset.shape === 'rect' ? 'rect' : 'circle',
            text,
          });
        });
      }
      im.bubbles = out;
      renderImagesPreview();
      close();
    });
  }

  // Resize an image in 5 % steps. Clamped to [20 %, 300 %] so the
  // image never disappears or grows past the white-card width.
  function adjustImageSize(idx, dir) {
    const im = lessonImages[idx];
    if (!im) return;
    const step = 0.05;
    const cur  = Number.isFinite(im.scale) ? im.scale : 1.0;
    const next = Math.max(0.2, Math.min(3.0, +(cur + dir * step).toFixed(2)));
    im.scale = next;
    renderImagesPreview();
  }
  function cornerLabel(c) {
    return ({
      tl: 'top-left',
      tr: 'top-right',
      bl: 'bottom-left',
      br: 'bottom-right',
      cc: 'centre',
      cs: 'small centre',
      panel: 'comic panel',
    })[c] || c;
  }
  function removeImage(idx) {
    // Drop from array, then re-index the markers in the body. The
    // marker `[[IMG:idx]]` is unique per index — we walk and rewrite.
    const ta = $('lessonBody');
    // Step 1: strip the removed marker entirely.
    ta.value = ta.value.replace(new RegExp(`\\s*\\[\\[IMG:${idx}\\]\\]\\s*`), ' ');
    // Step 2: shift down indices > idx by 1 in the body.
    ta.value = ta.value.replace(/\[\[IMG:(\d+)\]\]/g, (m, n) => {
      const k = parseInt(n, 10);
      return k > idx ? `[[IMG:${k - 1}]]` : m;
    });
    lessonImages.splice(idx, 1);
    renderImagesPreview();
  }

  function resetImages() {
    lessonImages = [];
    pendingInsertPos = null;
    renderImagesPreview();
    lessonWordImages = [];
    activeWordImageRow = null;
    renderWordImageRows();
    lessonWordNotes = [];
    renderWordNoteRows();
  }

  // ----------------------------------------------------------------
  //  WORD-IMAGE PAIRS — optional per-word images shown in the sidebar
  //  when a student taps that word. Each row has a text input for
  //  the word + an image (file picker or paste). Rows without both
  //  fields filled get stripped before save.
  // ----------------------------------------------------------------
  $('addWordImageBtn').addEventListener('click', () => {
    lessonWordImages.push({ word: '', data_url: '' });
    renderWordImageRows();
    // Focus the new row's word input so the teacher can start typing
    // immediately.
    setTimeout(() => {
      const rows = document.querySelectorAll('.wc-wordimg-row');
      const last = rows[rows.length - 1];
      if (last) last.querySelector('.wi-word').focus();
    }, 0);
  });

  // Bulk word-image picker. Click the button → OS-native multi-select
  // file dialog → for each picked file we use the filename (sans
  // extension) as the word and downscale the bytes into the same
  // data_url shape the single-row flow produces. Existing rows with
  // the same word are updated in place (so re-picking replaces).
  $('addWordImagesBulkBtn').addEventListener('click', () => {
    $('addWordImagesBulkInput').click();
  });
  $('addWordImagesBulkInput').addEventListener('change', async (e) => {
    const status = $('addWordImagesBulkStatus');
    const files  = Array.from(e.target.files || []);
    if (!files.length) return;
    status.textContent = `Processing ${files.length}…`;
    status.style.color = 'var(--ink-soft)';
    let added = 0, updated = 0, skipped = 0;
    for (const file of files) {
      // "kororā.jpg" → "kororā". Multi-dot filenames keep everything
      // before the LAST dot ("my.word.png" → "my.word"), which
      // matches the OS-level "extension" convention.
      const base = (file.name || '').replace(/\.[^.]+$/, '').trim();
      const word = base.toLowerCase();
      if (!word) { skipped++; continue; }
      const dataUrl = await downscaleImage(file).catch(() => null);
      if (!dataUrl) { skipped++; continue; }
      const existing = lessonWordImages.find(wi =>
        (wi.word || '').toLowerCase() === word);
      if (existing) {
        existing.data_url = dataUrl;
        updated++;
      } else {
        lessonWordImages.push({ word, data_url: dataUrl });
        added++;
      }
    }
    renderWordImageRows();
    const parts = [];
    if (added)   parts.push(`${added} added`);
    if (updated) parts.push(`${updated} updated`);
    if (skipped) parts.push(`${skipped} skipped`);
    status.textContent = parts.length
      ? parts.join(' · ') + ' ✓'
      : 'Nothing usable in the selection.';
    status.style.color = (added || updated) ? 'var(--good)' : 'var(--bad)';
    // Reset the input so picking the SAME files again re-fires change.
    e.target.value = '';
  });

  function renderWordImageRows() {
    const wrap = $('wordImageRows');
    if (!wrap) return;
    if (!lessonWordImages.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = lessonWordImages.map((wi, i) => `
      <div class="wc-wordimg-row" data-idx="${i}">
        <input class="wi-word wc-input" type="text" placeholder="word"
               value="${escapeHtml(wi.word || '')}" />
        <div class="wi-image-slot">
          ${wi.data_url
            ? `<img class="wi-thumb" src="${wi.data_url}" alt=""/>`
            : `<button type="button" class="wi-add wc-btn ghost">📷 Image (or Cmd+V)</button>`}
          <input type="file" class="wi-file" accept="image/*" hidden />
        </div>
        <button type="button" class="wi-remove wc-btn ghost" title="Remove">×</button>
      </div>
    `).join('');

    wrap.querySelectorAll('.wc-wordimg-row').forEach(row => {
      const idx = parseInt(row.dataset.idx, 10);
      const wordInput = row.querySelector('.wi-word');
      const fileInput = row.querySelector('.wi-file');
      const addBtn    = row.querySelector('.wi-add');
      const removeBtn = row.querySelector('.wi-remove');

      // Any interaction with this row marks it as paste-target.
      row.addEventListener('click', () => { activeWordImageRow = idx; });
      wordInput.addEventListener('focus', () => { activeWordImageRow = idx; });

      wordInput.addEventListener('input', () => {
        lessonWordImages[idx].word = wordInput.value.trim().toLowerCase();
      });

      if (addBtn) {
        addBtn.addEventListener('click', () => {
          activeWordImageRow = idx;
          fileInput.click();
        });
      }
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const dataUrl = await downscaleImage(file).catch(() => null);
        if (dataUrl) {
          lessonWordImages[idx].data_url = dataUrl;
          renderWordImageRows();
        }
        e.target.value = '';
      });
      removeBtn.addEventListener('click', () => {
        lessonWordImages.splice(idx, 1);
        if (activeWordImageRow === idx) activeWordImageRow = null;
        renderWordImageRows();
      });
    });
  }

  // ----------------------------------------------------------------
  //  WORD-MEANING PAIRS — teacher's own note for a word in the body.
  //  Mirrors the word-image flow above: rows of [word | note | ×],
  //  rendered as a static input + textarea pair. Stored as JSONB on
  //  the lesson row (`word_notes`). Empty rows stripped before save.
  // ----------------------------------------------------------------
  $('addWordNoteBtn').addEventListener('click', () => {
    lessonWordNotes.push({ word: '', note: '' });
    renderWordNoteRows();
    setTimeout(() => {
      const rows = document.querySelectorAll('.wc-wordnote-row');
      const last = rows[rows.length - 1];
      if (last) last.querySelector('.wn-word').focus();
    }, 0);
  });

  // Bulk paste: one "word: meaning" per line. Lines without a colon
  // (or with an empty key/value half) are silently skipped so the
  // teacher can leave example text or notes in the textarea. Existing
  // rows with the same word are updated in place; new words append.
  $('wordNoteBulkAddBtn').addEventListener('click', () => {
    const ta     = $('wordNoteBulkInput');
    const status = $('wordNoteBulkStatus');
    if (!ta || !status) return;
    const raw = (ta.value || '').trim();
    if (!raw) {
      status.textContent = 'Paste some lines first.';
      status.style.color = 'var(--bad)';
      return;
    }
    const lines = raw.split(/\r?\n/);
    let added = 0, updated = 0, skipped = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Accept either ":" or "," as the separator — colon is what we
      // recommend in the placeholder, but pasted spreadsheet cells
      // often come comma-separated.
      const sepIdx = trimmed.search(/[:,]/);
      if (sepIdx <= 0) { skipped++; continue; }
      const word = trimmed.slice(0, sepIdx).trim().toLowerCase();
      const note = trimmed.slice(sepIdx + 1).trim();
      if (!word || !note) { skipped++; continue; }
      const existing = lessonWordNotes.find(wn =>
        (wn.word || '').toLowerCase() === word);
      if (existing) {
        existing.note = note;
        updated++;
      } else {
        lessonWordNotes.push({ word, note });
        added++;
      }
    }
    renderWordNoteRows();
    if (!added && !updated) {
      status.textContent = `Nothing added — ${skipped} line(s) skipped (need "word: meaning").`;
      status.style.color = 'var(--bad)';
    } else {
      const parts = [];
      if (added)   parts.push(`${added} added`);
      if (updated) parts.push(`${updated} updated`);
      if (skipped) parts.push(`${skipped} skipped`);
      status.textContent = parts.join(' · ') + ' ✓';
      status.style.color = 'var(--good)';
      ta.value = '';
    }
  });

  function renderWordNoteRows() {
    const wrap = $('wordNoteRows');
    if (!wrap) return;
    if (!lessonWordNotes.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = lessonWordNotes.map((wn, i) => `
      <div class="wc-wordnote-row" data-idx="${i}">
        <input class="wn-word wc-input" type="text" placeholder="word"
               value="${escapeHtml(wn.word || '')}" />
        <textarea class="wn-note wc-input" rows="2"
                  placeholder="meaning for this word…">${escapeHtml(wn.note || '')}</textarea>
        <button type="button" class="wn-remove wc-btn ghost" title="Remove">×</button>
      </div>
    `).join('');

    wrap.querySelectorAll('.wc-wordnote-row').forEach(row => {
      const idx = parseInt(row.dataset.idx, 10);
      const wordInput = row.querySelector('.wn-word');
      const noteInput = row.querySelector('.wn-note');
      const removeBtn = row.querySelector('.wn-remove');

      wordInput.addEventListener('input', () => {
        // Match the word-image convention: lowercase the lemma so
        // sidebar lookups don't have to do case-insensitive matching.
        lessonWordNotes[idx].word = wordInput.value.trim().toLowerCase();
      });
      noteInput.addEventListener('input', () => {
        lessonWordNotes[idx].note = noteInput.value;
      });
      removeBtn.addEventListener('click', () => {
        lessonWordNotes.splice(idx, 1);
        renderWordNoteRows();
      });
    });
  }

  // Paste support — when the user is interacting with a word-image
  // row and pastes an image from the clipboard, route it to the
  // active row's image slot. Body-textarea paste keeps its own
  // separate handler (lessonImages flow above).
  document.addEventListener('paste', async (e) => {
    if (activeWordImageRow == null) return;
    if (!lessonWordImages[activeWordImageRow]) return;
    // If the textarea has focus, the body-image paste handler above
    // owns the event. We only run when focus is on a word-image row.
    if (document.activeElement === $('lessonBody')) return;
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        e.preventDefault();
        const file = it.getAsFile();
        if (!file) return;
        const dataUrl = await downscaleImage(file).catch(() => null);
        if (dataUrl) {
          lessonWordImages[activeWordImageRow].data_url = dataUrl;
          renderWordImageRows();
        }
        return;
      }
    }
  });

  $('addLessonBtn').addEventListener('click', async () => {
    const msg = $('addLessonMsg');
    msg.classList.add('wc-hidden');
    if (!currentClass) {
      msg.textContent = 'Create a class first.';
      msg.className = 'wc-alert error'; msg.classList.remove('wc-hidden'); return;
    }
    const title = $('lessonTitle').value.trim();
    // Body is a textarea now — read .value as plain text + markdown
    // syntax. The lesson page converts markdown → HTML at render time.
    const body  = $('lessonBody').value.trim();
    if (!title || !body) {
      msg.textContent = 'Please enter a title and body.';
      msg.className = 'wc-alert error'; msg.classList.remove('wc-hidden'); return;
    }
    // Strip empty word-image rows (no word AND no image) — those are
    // half-filled drafts that don't need to make it to the DB.
    const cleanedWordImages = lessonWordImages.filter(
      wi => (wi.word && wi.word.trim()) && wi.data_url
    );
    // Same idea for word-meaning rows: both fields must be filled.
    const cleanedWordNotes = lessonWordNotes
      .map(wn => ({
        word: (wn.word || '').trim().toLowerCase(),
        note: (wn.note || '').trim(),
      }))
      .filter(wn => wn.word && wn.note);
    // Upload any freshly-added panel images to Supabase Storage so the
    // lesson row stays small (inline base64 bloats every lesson fetch).
    await uploadLessonImagesToStorage();
    // Upload a freshly-attached mp3 (best-effort — a failure just
    // leaves the lesson without audio rather than blocking the save).
    if (lessonAudioFile && !lessonAudioUrl) {
      try {
        const raw = (lessonAudioFile.name.split('.').pop() || 'mp3').toLowerCase();
        const ext = /^(mp3|mpeg|m4a|wav|ogg)$/.test(raw)
          ? raw.replace('mpeg', 'mp3') : 'mp3';
        lessonAudioUrl = await window.WCDB.storage.uploadBlob(lessonAudioFile, ext, 'audio');
      } catch (e) {
        console.warn('[lesson-save] audio upload failed:', e && e.message);
      }
    }
    // Upload a freshly-picked cover image (best-effort — a failure
    // leaves the lesson without a cover but still saves the rest).
    if (lessonCoverFile && !lessonCoverUrl) {
      try {
        const raw = (lessonCoverFile.name.split('.').pop() || 'jpg').toLowerCase();
        const ext = /^(jpg|jpeg|png|webp|gif|avif)$/.test(raw)
          ? raw.replace('jpeg', 'jpg') : 'jpg';
        lessonCoverUrl = await window.WCDB.storage.uploadBlob(
          lessonCoverFile, ext, 'covers');
      } catch (e) {
        console.warn('[lesson-save] cover upload failed:', e && e.message);
      }
    }
    const payload = {
      title, body,
      animal_set: $('lessonAnimalSet').value,
      gift_limit_per_day: parseInt($('lessonGiftLimit').value, 10) || 3,
      images: lessonImages.map(serializeLessonImage),
      word_images: cleanedWordImages,
      word_notes:  cleanedWordNotes,
      headings_start_new_page: !!$('lessonHeadingsNewPage').checked,
      mode: lessonMode,
      // Continuous-scroll default — only meaningful for comic
      // lessons; text / song lessons store NULL ("no preference"
      // → the lesson page falls back to paginated).
      default_scroll: lessonMode === 'comic'
        ? !!$('lessonComicScroll').checked : null,
      audio_url: lessonAudioUrl || null,
      audio_segments: lessonAudioSegments,
      // Book / song-CD cover. writeResilient strips it server-side
      // if the column hasn't been migrated yet.
      cover_image_url: lessonCoverUrl || null,
    };
    try {
      // Stash the lesson id BEFORE resetting state below — we use it
      // to pop the preview tab after save.
      let savedLessonId = null;
      if (editingLessonId) {
        // PATCH only the editable fields — never overwrite created_by,
        // class_id, created_at (those are immutable identity).
        await window.WCDB.lessons.update(editingLessonId, payload);
        savedLessonId = editingLessonId;
        msg.textContent = 'Lesson updated. Opening preview…';
      } else {
        const created = await window.WCDB.lessons.create({
          ...payload,
          class_id:   currentClass.id,
          created_by: me.id,
        });
        savedLessonId = created && created.id;
        msg.textContent = 'Lesson created.';
      }
      const wasEditing = !!editingLessonId;
      // Reset form regardless of create/update.
      editingLessonId = null;
      $('lessonTitle').value = '';
      $('lessonBody').value = '';
      $('lessonHeadingsNewPage').checked = false;
      $('lessonComicScroll').checked = true;   // comic lessons scroll by default
      setLessonMode('text');
      resetLessonAudio();
      resetLessonCover();
      resetImages();
      updateFormMode();
      // Collapse the form card back to its default closed state so
      // the next visit to the Lessons tab is a clean view.
      const cardEl = $('createLessonCard');
      if (cardEl) cardEl.open = false;
      msg.className = 'wc-alert ok'; msg.classList.remove('wc-hidden');
      await refreshAll();
      // After saving an EDIT, open the preview in a fresh tab so the
      // teacher can immediately see their changes in the student view
      // (no auth swap, no data writes — preview mode handles that).
      // New-lesson saves don't auto-preview — the teacher is usually
      // ready to write the next one rather than immediately review.
      if (wasEditing && savedLessonId) {
        window.open(
          './lesson.html?id=' + encodeURIComponent(savedLessonId) + '&preview=1',
          '_blank',
          'noopener'
        );
      }
    } catch (e) {
      msg.textContent = e.message || 'Could not save lesson.';
      msg.className = 'wc-alert error'; msg.classList.remove('wc-hidden');
    }
  });

  // ============================================================
  //  TAB 3 — INSIGHTS
  // ============================================================
  async function renderInsights() {
    const wrap = $('insightsBody');
    if (!currentClass || !students.length) {
      wrap.innerHTML = '<p class="wc-muted wc-center">No students yet.</p>';
      return;
    }
    wrap.innerHTML = '<p class="wc-muted">Loading insights…</p>';

    const studentIds = students.map(s => s.id);
    const [wordRows, petRows] = await Promise.all([
      window.WCDB.insights.wordStatesForStudents(studentIds),
      window.WCDB.insights.petsForStudents(studentIds),
    ]);

    // class-wide level totals
    const classTotals = { '-1':0,'1':0,'2':0,'3':0,'4':0,'5':0 };
    wordRows.forEach(r => {
      if (r.level === 0) return; // unseen — irrelevant for the chart
      const k = String(r.level);
      if (classTotals[k] !== undefined) classTotals[k]++;
    });
    // per-student aggregates
    const byStudent = {};
    students.forEach(s => byStudent[s.id] = {
      name: s.real_name, encounter_level: s.encounter_level || 1,
      money: s.money || 0,
      levels: { '-1':0,'1':0,'2':0,'3':0,'4':0,'5':0 },
      pets: 0,
    });
    wordRows.forEach(r => {
      const b = byStudent[r.user_id]; if (!b) return;
      if (r.level === 0) return;
      const k = String(r.level);
      if (b.levels[k] !== undefined) b.levels[k]++;
    });
    petRows.forEach(p => {
      const b = byStudent[p.user_id]; if (!b) return;
      b.pets++;
    });

    // ---- render class-wide distribution chart ----
    const ORDER = [-1, 1, 2, 3, 4, 5];
    const classMax = Math.max(1, ...ORDER.map(l => classTotals[String(l)] || 0));
    const classBars = ORDER.map(lvl => {
      const n = classTotals[String(lvl)] || 0;
      const pct = Math.round(n * 100 / classMax);
      const lbl = (lvl === -1) ? 'Skipped' : `Lv ${lvl}`;
      return `
        <div class="wc-distbar">
          <img src="${window.WCAssets.levels[lvl].real}" alt="${lbl}" />
          <div class="wc-distbar-wrap">
            <div class="wc-distbar-fill" style="width:${pct}%"></div>
          </div>
          <span class="wc-distbar-num">${n}</span>
        </div>
      `;
    }).join('');

    // ---- render per-student rows ----
    const studentRows = Object.values(byStudent)
      .sort((a,b) => b.pets - a.pets || (a.name.localeCompare(b.name)))
      .map(s => {
        const cells = ORDER.map(lvl => {
          const n = s.levels[String(lvl)] || 0;
          return `<td class="wc-ins-cell ${n>0?'':'muted'}">${n}</td>`;
        }).join('');
        return `
          <tr>
            <td class="wc-ins-name">${escapeHtml(s.name)}</td>
            <td>⭐ Lv ${s.encounter_level}</td>
            ${cells}
            <td>${s.pets}</td>
            <td>💰 ${s.money}</td>
          </tr>
        `;
      }).join('');

    wrap.innerHTML = `
      <h3 style="margin: 0 0 12px;">Class word distribution</h3>
      <div class="wc-distchart">${classBars}</div>

      <h3 style="margin: 28px 0 12px;">Per student</h3>
      <div class="wc-ins-table-wrap">
        <table class="wc-ins-table">
          <thead>
            <tr>
              <th>Name</th><th>Level</th>
              <th>⛔</th><th>Lv1</th><th>Lv2</th><th>Lv3</th><th>Lv4</th><th>Lv5</th>
              <th>Pets</th><th>Coins</th>
            </tr>
          </thead>
          <tbody>${studentRows}</tbody>
        </table>
      </div>
    `;
  }

  // ============================================================
  //  TAB 4 — MESSAGES (visualization inbox + animal gift reply)
  // ============================================================
  async function renderMessages() {
    const wrap = $('messagesBody');
    // Re-fetch on open — messages a student sends AFTER the dashboard
    // first loaded would otherwise stay invisible until a full page
    // reload (refreshAll only runs on load / class switch).
    if (currentClass && lessons.length) {
      try {
        messages = await window.WCDB.viz.forLessons(lessons.map(L => L.id));
      } catch (e) { /* network blip — keep the cached list */ }
    }
    if (!messages.length) {
      wrap.innerHTML = '<p class="wc-muted wc-center">No student messages yet.</p>';
      return;
    }
    // Group: pending (no response) first, then answered
    const pending  = messages.filter(m => !m.responded_at);
    const answered = messages.filter(m =>  m.responded_at);
    const studentById = new Map(students.map(s => [s.id, s]));
    const lessonById  = new Map(lessons.map(L => [L.id, L]));

    wrap.innerHTML = `
      <h3 style="margin: 0 0 12px;">Awaiting reply (${pending.length})</h3>
      <div class="wc-msg-inbox" id="msgInboxPending"></div>
      <h3 style="margin: 28px 0 12px;">Sent (${answered.length})</h3>
      <div class="wc-msg-inbox" id="msgInboxDone"></div>
    `;
    pending .forEach(m => $('msgInboxPending').appendChild(messageCard(m, studentById, lessonById, true)));
    answered.forEach(m => $('msgInboxDone')   .appendChild(messageCard(m, studentById, lessonById, false)));
    if (!pending.length)  $('msgInboxPending').innerHTML = '<p class="wc-muted">Nothing to reply to.</p>';
    if (!answered.length) $('msgInboxDone')   .innerHTML = '<p class="wc-muted">No replies sent yet.</p>';
  }

  function messageCard(m, studentById, lessonById, editable) {
    const student = studentById.get(m.student_id);
    const lesson  = lessonById.get(m.lesson_id);
    const card = document.createElement('div');
    card.className = 'wc-tmsg' + (editable ? ' editable' : '');
    let gifts = '';
    if (m.gift_animal_set != null) {
      const sprite = window.WCAssets.spriteFor(m.gift_animal_set, m.gift_animal_index, false);
      const label  = window.WCAssets.labelFor(m.gift_animal_set, m.gift_animal_index);
      gifts = `<img class="wc-tmsg-gift" src="${sprite}" alt="${escapeHtml(label)}" title="Gift: ${escapeHtml(label)}" />`;
    }
    const quotaToday = lesson ? countGiftsToday(lesson.id) : 0;
    const quotaMax   = lesson ? lesson.gift_limit_per_day : 0;
    const quotaLeft  = Math.max(0, quotaMax - quotaToday);

    // Recording-message marker: lesson.js posts these with the special
    // word '__recording__' + an array of page recording URLs. Render
    // them as inline <audio controls> so the teacher can listen right
    // here in the inbox. Filter to http(s) URLs only — blob: URLs are
    // session-only and would 404 in the teacher's browser.
    const recUrls = Array.isArray(m.recording_urls)
      ? m.recording_urls.filter(u => typeof u === 'string' && /^https?:\/\//.test(u))
      : [];
    const recBlock = recUrls.length ? `
      <div class="wc-tmsg-recs" style="margin:8px 0;display:flex;flex-direction:column;gap:6px;">
        <div class="wc-muted" style="font-size:12px;">
          🎙️ 학생 녹음 (${recUrls.length}개) — 페이지 순서대로 재생
        </div>
        ${recUrls.map((u, i) => `
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="wc-muted" style="font-size:12px;min-width:1.5em;">${i + 1}.</span>
            <audio controls preload="none" src="${escapeHtml(u)}"
                   style="flex:1;max-width:380px;height:32px;"></audio>
          </div>`).join('')}
      </div>` : '';
    // Student voice note (recorded inside the popup, separate from sentence recordings).
    const voiceUrl = typeof m.student_voice_url === 'string' && /^https?:\/\//.test(m.student_voice_url)
      ? m.student_voice_url : null;
    const voiceBlock = voiceUrl ? `
      <div class="wc-tmsg-recs" style="margin:8px 0;">
        <div class="wc-muted" style="font-size:12px;">🎤 학생 목소리 메시지</div>
        <audio controls preload="none" src="${escapeHtml(voiceUrl)}"
               style="width:100%;max-width:380px;height:32px;margin-top:4px;"></audio>
      </div>` : '';
    // Word label — hide the internal '__recording__' marker; instead
    // show a friendly "🎙️ 녹음 메시지" tag.
    const wordLabel = m.word === '__recording__'
      ? ` · <span class="wc-muted">🎙️ 녹음 메시지</span>`
      : (m.word ? ` · re: <em>${escapeHtml(m.word)}</em>` : '');

    card.innerHTML = `
      <div class="wc-tmsg-header">
        <div>
          <strong>${escapeHtml(student?.real_name || 'Unknown student')}</strong>
          ${wordLabel}
        </div>
        <div class="wc-muted" style="font-size:13px;">
          ${lesson ? escapeHtml(lesson.title) + ' · ' : ''}${new Date(m.sent_at).toLocaleString('en-NZ')}
        </div>
      </div>
      ${recBlock}
      ${voiceBlock}
      <div class="wc-tmsg-prompt">${escapeHtml(m.prompt)}</div>
      ${editable ? `
        <div class="wc-tmsg-reply">
          <div class="wc-muted" style="margin-bottom:6px;">
            Reply with any combo of text, sticker, and coins. At least one is required.
            Stickers left today on this lesson: <strong>${quotaLeft}</strong> / ${quotaMax}
          </div>
          <div class="wc-animal-picker" data-msg="${m.id}"></div>
          <textarea class="wc-textarea wc-tmsg-text" rows="2" placeholder="Reply to ${escapeHtml(student?.real_name||'')}…"></textarea>
          <!-- Money gift — quick-pick dollar presets plus a free-form
               cents input. The student's balance is in cents
               (wc_users.money) so we send / store cents directly;
               the dollar buttons just translate ($0.50 → 50 cents).
               -->
          <div class="wc-tmsg-money">
            <span class="wc-muted">💰</span>
            <button type="button" class="wc-money-preset" data-money="50">+$0.50</button>
            <button type="button" class="wc-money-preset" data-money="100">+$1</button>
            <button type="button" class="wc-money-preset" data-money="150">+$1.50</button>
            <button type="button" class="wc-money-preset" data-money="200">+$2</button>
            <input type="number" class="wc-tmsg-money-input" min="0" max="100000"
                   step="50" placeholder="cents (1$ = 100)" />
          </div>
          <!-- Rest-time gift — same pattern, in minutes. Credited to
               wc_time_entries on the student side. -->
          <div class="wc-tmsg-money">
            <span class="wc-muted">⏰</span>
            <button type="button" class="wc-mins-preset" data-mins="1">+1분</button>
            <button type="button" class="wc-mins-preset" data-mins="2">+2분</button>
            <button type="button" class="wc-mins-preset" data-mins="3">+3분</button>
            <input type="number" class="wc-tmsg-mins-input" min="0" max="240"
                   step="1" placeholder="분" />
          </div>
          <!-- Teacher voice reply — record a voice note to send back. -->
          <div class="wc-tmsg-teacher-rec">
            <button type="button" class="wc-tmsg-rec-btn" data-state="idle">
              <span class="wc-tmsg-rec-ico">⏺</span>
              <span class="wc-tmsg-rec-lbl"> 목소리 답장 녹음</span>
            </button>
            <span class="wc-tmsg-rec-status wc-muted"></span>
            <audio class="wc-tmsg-rec-play wc-hidden" controls preload="none"
                   style="height:30px;max-width:300px;"></audio>
            <button type="button" class="wc-tmsg-rec-reset wc-hidden wc-muted">다시 녹음</button>
          </div>
          <button class="wc-btn wc-tmsg-send" data-msg="${m.id}">Send reply 📨</button>
          <span class="wc-tmsg-status wc-muted"></span>
        </div>
      ` : `
        <div class="wc-tmsg-done">
          ${gifts}
          <div>
            ${m.teacher_response ? `<div>${escapeHtml(m.teacher_response)}</div>` : ''}
            ${(m.gift_money && m.gift_money > 0)
              ? `<div class="wc-muted" style="font-size:13px;">💰 Sent ${window.WCDB.fmtDollars(m.gift_money)}</div>`
              : ''}
            ${(m.gift_minutes && m.gift_minutes > 0)
              ? `<div class="wc-muted" style="font-size:13px;">⏰ Sent ${m.gift_minutes}분 쉬는 시간</div>`
              : ''}
            ${(m.teacher_voice_url && /^https?:\/\//.test(m.teacher_voice_url))
              ? `<div style="margin-top:4px;">
                  <div class="wc-muted" style="font-size:12px;">🎤 선생님 목소리 답장</div>
                  <audio controls preload="none" src="${escapeHtml(m.teacher_voice_url)}"
                         style="height:30px;max-width:300px;"></audio>
                 </div>`
              : ''}
            <div class="wc-muted" style="font-size:13px;">
              Replied ${new Date(m.responded_at).toLocaleDateString('en-NZ')}
            </div>
          </div>
        </div>
      `}
    `;
    if (editable) {
      mountAnimalPicker(card.querySelector('.wc-animal-picker'));
      // Coin preset buttons — clicking adds the preset value to the
      // current input total (so two clicks of +5 = 10). Keeps the
      // workflow snappy without the teacher reaching for the keypad.
      const moneyInput = card.querySelector('.wc-tmsg-money-input');
      card.querySelectorAll('.wc-money-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          const cur = parseInt(moneyInput.value, 10) || 0;
          const add = parseInt(btn.dataset.money, 10) || 0;
          moneyInput.value = String(Math.min(100000, Math.max(0, cur + add)));
        });
      });
      const minsInput = card.querySelector('.wc-tmsg-mins-input');
      card.querySelectorAll('.wc-mins-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          const cur = parseInt(minsInput.value, 10) || 0;
          const add = parseInt(btn.dataset.mins, 10) || 0;
          minsInput.value = String(Math.min(240, Math.max(0, cur + add)));
        });
      });
      // Teacher voice reply recording — MediaRecorder, same pattern as
      // the student-side recording in lesson.js showRecordingMessagePopup.
      const recBtn   = card.querySelector('.wc-tmsg-rec-btn');
      const recIco   = card.querySelector('.wc-tmsg-rec-ico');
      const recLbl   = card.querySelector('.wc-tmsg-rec-lbl');
      const recStat  = card.querySelector('.wc-tmsg-rec-status');
      const recPlay  = card.querySelector('.wc-tmsg-rec-play');
      const recReset = card.querySelector('.wc-tmsg-rec-reset');
      let tMR = null, tStream = null, tBlob = null, tChunks = [];

      function setTeacherRecState(state) {
        if (state === 'idle') {
          recBtn.dataset.state = 'idle';
          recIco.textContent  = '⏺';
          recLbl.textContent  = ' 목소리 답장 녹음';
          recStat.textContent = '';
          recPlay.classList.add('wc-hidden');
          recReset.classList.add('wc-hidden');
          tBlob = null;
        } else if (state === 'recording') {
          recBtn.dataset.state = 'recording';
          recIco.textContent  = '⏹';
          recLbl.textContent  = ' 녹음 중지';
          recStat.textContent = '녹음 중…';
        } else if (state === 'done') {
          recBtn.dataset.state = 'done';
          recIco.textContent  = '✓';
          recLbl.textContent  = ' 녹음됨';
          recStat.textContent = '';
          recPlay.classList.remove('wc-hidden');
          recReset.classList.remove('wc-hidden');
        }
      }

      recBtn.addEventListener('click', async () => {
        if (recBtn.dataset.state === 'recording') {
          if (tMR) tMR.stop();
          return;
        }
        tChunks = []; tBlob = null;
        try {
          tStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          recStat.textContent = '마이크 권한이 필요해요.';
          return;
        }
        tMR = new MediaRecorder(tStream);
        tMR.ondataavailable = e => { if (e.data && e.data.size) tChunks.push(e.data); };
        tMR.onstop = () => {
          tStream.getTracks().forEach(t => t.stop());
          tBlob = new Blob(tChunks, { type: tChunks[0] && tChunks[0].type || 'audio/webm' });
          recPlay.src = URL.createObjectURL(tBlob);
          setTeacherRecState('done');
        };
        tMR.start();
        setTeacherRecState('recording');
      });

      recReset.addEventListener('click', () => {
        if (recPlay.src && recPlay.src.startsWith('blob:')) URL.revokeObjectURL(recPlay.src);
        recPlay.src = '';
        setTeacherRecState('idle');
      });

      setTeacherRecState('idle');

      card.querySelector('.wc-tmsg-send').addEventListener('click', () => sendGift(card, m,
        () => tMR && tMR.state === 'recording' ? (tMR.stop(), tBlob) : tBlob));
    }
    return card;
  }

  async function sendGift(card, m, getTeacherBlob) {
    const status  = card.querySelector('.wc-tmsg-status');
    const sendBtn = card.querySelector('.wc-tmsg-send');
    const picked  = card.querySelector('.wc-animal-picker').dataset.picked;
    const note    = card.querySelector('.wc-tmsg-text').value.trim();
    const moneyEl = card.querySelector('.wc-tmsg-money-input');
    const money   = Math.max(0, Math.min(100000, parseInt(moneyEl?.value, 10) || 0));
    const minsEl  = card.querySelector('.wc-tmsg-mins-input');
    const minutes = Math.max(0, Math.min(240, parseInt(minsEl?.value, 10) || 0));
    // Text alone, sticker alone, money alone, minutes alone, or any
    // combo — all OK. Only invalid case is everything empty.
    if (!picked && !note && money <= 0 && minutes <= 0) {
      status.textContent = 'Pick a sticker, type a reply, or add some money / minutes first.';
      status.style.color = 'var(--bad)';
      return;
    }
    let setName = null, idx = null;
    if (picked) {
      const parts = picked.split('::');
      setName = parts[0];
      idx = parseInt(parts[1], 10);
      // Sticker quota — text-only / money-only replies are unlimited,
      // only the sticker case is rate-limited. We re-read the lesson
      // row via the closure's `lessons` array.
      const lessonRow = (typeof lessons !== 'undefined' && Array.isArray(lessons))
        ? lessons.find(L => L.id === m.lesson_id) : null;
      const used = countGiftsToday(m.lesson_id);
      const max  = lessonRow ? (lessonRow.gift_limit_per_day || 0) : Infinity;
      if (used >= max) {
        status.textContent = 'No stickers left for this lesson today. Send text or coins instead.';
        status.style.color = 'var(--bad)';
        return;
      }
    }
    sendBtn.disabled = true;
    status.textContent = 'Sending…';
    status.style.color = 'var(--ink-soft)';
    try {
      // Upload teacher voice note if any.
      let teacherVoiceUrl = null;
      const tBlob = typeof getTeacherBlob === 'function' ? getTeacherBlob() : null;
      if (tBlob) {
        try {
          const ext = /ogg/i.test(tBlob.type) ? 'ogg' : (/mp4/i.test(tBlob.type) ? 'mp4' : 'webm');
          teacherVoiceUrl = await window.WCDB.storage.uploadBlob(tBlob, ext, 'recordings');
        } catch (e) {
          console.warn('[teacher] voice upload failed', e && e.message);
        }
      }
      await window.WCDB.viz.respondWithGift(m.id, setName, idx, note || null, money, minutes, teacherVoiceUrl);
      status.textContent = 'Sent ✓';
      status.style.color = 'var(--good)';
      // refresh messages list (move this card from pending → answered)
      setTimeout(refreshAll, 500);
    } catch (e) {
      status.textContent = 'Could not send. Try again.';
      status.style.color = 'var(--bad)';
      sendBtn.disabled = false;
    }
  }

  // Animal picker — 30 sprites across 3 sets, single-select.
  function mountAnimalPicker(host) {
    host.innerHTML = '';
    window.WCAssets.allSetNames.forEach(setName => {
      const sec = document.createElement('div');
      sec.className = 'wc-picker-row';
      sec.innerHTML = `<div class="wc-picker-set">${setLabel(setName)}</div>`;
      const grid = document.createElement('div');
      grid.className = 'wc-picker-grid';
      window.WCAssets.sets[setName].forEach(a => {
        const b = document.createElement('button');
        b.className = 'wc-picker-cell';
        b.type = 'button';
        b.title = a.label;
        b.dataset.key = `${setName}::${a.index}`;
        b.innerHTML = `<img src="${a.real}" alt="${a.label}" /><span>${a.label}</span>`;
        b.addEventListener('click', () => {
          host.querySelectorAll('.wc-picker-cell.selected').forEach(x => x.classList.remove('selected'));
          b.classList.add('selected');
          host.dataset.picked = b.dataset.key;
        });
        grid.appendChild(b);
      });
      sec.appendChild(grid);
      host.appendChild(sec);
    });
  }
  function setLabel(s) {
    return ({
      'animals': '🌍 World animals',
      'nz-animals': '🇳🇿 NZ animals',
      'penguin': '🐧 Penguins & seals',
    })[s] || s;
  }

  // ============================================================
  //  TAB 5 — SETTINGS (per-class feature toggles)
  // ============================================================
  function renderSettings() {
    const wrap = $('settingsBody');
    if (!currentClass) {
      wrap.innerHTML = '<p class="wc-muted wc-center">Create a class first.</p>';
      return;
    }
    const flags = currentClass.hide_features || {};
    const TOGGLES = [
      { key: 'hideStudentLessonUpload', label: 'Hide "student can upload their own lesson" feature', tip: 'Not built yet — placeholder for future.' },
      { key: 'hideVisualizationSidebar', label: 'Hide the "Imagine this!" sidebar section', tip: 'Students won\'t see the text input → teacher pipeline.' },
      { key: 'hideEncounters',           label: 'Disable animal encounters entirely', tip: 'Some teachers may want plain reading without the game layer.' },
      { key: 'hideAnimalComments',       label: 'Hide comments on Animal Friends pages',     tip: 'Removes the comment thread + post box at the bottom of every animal-detail page. Existing comments are kept in the database — toggling back on restores them.' },
    ];
    // Compact home-page toggles — short labels. Each tick removes
    // one button from the student home. Saved into the same
    // hide_features JSONB column the longer toggles above use.
    const NAV_TOGGLES = [
      // Maths bars + Reading
      { key: 'hideReading',        label: 'Reading' },
      { key: 'hideSubtraction',    label: 'Subtraction' },
      { key: 'hideFunTakingAway',  label: 'Fun Taking Away' },
      { key: 'hideMinusBombs',     label: 'Minus Bombs' },
      { key: 'hideFraction',       label: 'Fraction' },
      // Other app tiles
      { key: 'hideMyPets',         label: 'My Pets' },
      { key: 'hideTheSpace',       label: 'The Space' },
      { key: 'hidePhonics',        label: 'Phonics' },
      { key: 'hideAnimals',        label: 'Animals' },
    ];

    // Pages-per-quiz — how many forward page turns between animal
    // quizzes. Stored on the class's hide_features JSONB (a plain
    // number alongside the boolean flags — no schema column needed).
    // Default 1 = a quiz on every page turn.
    let nPagesPerQuiz = Number(flags.quizEveryNPages);
    if (!Number.isFinite(nPagesPerQuiz) || nPagesPerQuiz < 1) nPagesPerQuiz = 1;
    nPagesPerQuiz = Math.min(20, Math.floor(nPagesPerQuiz));

    // Reward fade (SDT): preset → how fast extrinsic rewards thin out
    // as a student's cumulative reading grows; daily rest minutes →
    // the fixed game-time grant that fades IN to replace the wheel.
    const fadePreset = ['off', 'slow', 'normal', 'fast'].includes(flags.rewardFade)
      ? flags.rewardFade : 'off';
    let nDaily = Number(flags.dailyRestMinutes);
    if (!Number.isFinite(nDaily) || nDaily < 0) nDaily = 20;
    nDaily = Math.min(120, Math.floor(nDaily));

    // Encouragement lines — one per textarea row. The profile page
    // picks one at random. Empty → profile uses its built-in Korean
    // defaults so the box is never blank.
    const encsArr = Array.isArray(flags.encouragements)
      ? flags.encouragements.filter(s => typeof s === 'string' && s.trim())
      : [];
    const encsText = encsArr.join('\n');

    wrap.innerHTML = `
      <p class="wc-muted" style="margin: 0 0 16px;">
        These flags apply to <strong>${escapeHtml(currentClass.name)}</strong>. They take effect the next time a student opens a lesson.
      </p>
      <div class="wc-toggles">
        ${TOGGLES.map(t => `
          <label class="wc-toggle">
            <input type="checkbox" data-flag="${t.key}" ${flags[t.key] ? 'checked' : ''} />
            <span><strong>${t.label}</strong><br><small class="wc-muted">${t.tip}</small></span>
          </label>
        `).join('')}

        <!-- Animals default toggle — single source of truth for every
             lesson's initial 🐾 state. Click flips On ↔ Off. The flag
             stored under hide_features.lessonsAnimalsDefaultOff stays
             the same key the lesson page reads. -->
        <div class="wc-toggle" style="cursor:default;">
          <span style="flex:1;">
            <strong>
              Start with Animals
              <button id="animalsDefaultBtn" type="button"
                      class="wc-btn icon-only wc-mini-toggle ${flags.lessonsAnimalsDefaultOff ? '' : 'on'}"
                      data-state="${flags.lessonsAnimalsDefaultOff ? 'off' : 'on'}"
                      aria-pressed="${flags.lessonsAnimalsDefaultOff ? 'false' : 'true'}"
                      style="margin-left:6px;min-width:54px;">
                ${flags.lessonsAnimalsDefaultOff ? '[Off]' : '[On]'}
              </button>
            </strong>
            <br><small class="wc-muted">
              Sets the default state of the 🐾 chip for <strong>every</strong>
              lesson (new or already studied). A student can still toggle
              the 🐾 chip live within a session — the next lesson opens
              with the state you pick here.
            </small>
          </span>
        </div>
      </div>

      <h3 style="margin: 28px 0 6px;">🏠 Student home — buttons</h3>
      <p class="wc-muted" style="margin: 0 0 10px;">
        Tick to hide that button on the student home page.
        Takes effect next time the student opens / refreshes Ako.
      </p>
      <div class="wc-nav-toggle-grid">
        ${NAV_TOGGLES.map(t => `
          <label class="wc-nav-toggle">
            <input type="checkbox" data-flag="${t.key}" ${flags[t.key] ? 'checked' : ''} />
            <span>${t.label}</span>
          </label>
        `).join('')}
      </div>

      <h3 style="margin: 28px 0 6px;">🐾 Animal quiz frequency</h3>
      <p class="wc-muted" style="margin: 0 0 12px;">
        An animal quiz appears every time the student turns this many
        pages — at the page boundary, so it never breaks the reading
        flow mid-sentence. <strong>1</strong> = a quiz on every page
        turn. For comic lessons, one panel image counts as one page.
      </p>
      <div class="wc-field" style="max-width: 240px;">
        <label for="quizEveryNPages">Pages per quiz</label>
        <input id="quizEveryNPages" class="wc-input" type="number"
               min="1" max="20" step="1" value="${nPagesPerQuiz}">
      </div>

      <h3 style="margin: 28px 0 6px;">🌱 Reward fade</h3>
      <p class="wc-muted" style="margin: 0 0 12px;">
        As a student reads more (cumulative pages, all lessons), the
        extrinsic rewards — quiz frequency, word-mark coins, the
        reward wheel — automatically thin out, so reading becomes its
        own reward. The wheel's lost game-time is replaced by a fixed
        daily grant. <strong>Off</strong> keeps every reward at full
        strength (today's behaviour).
      </p>
      <div class="wc-field" style="max-width: 280px;">
        <label for="rewardFade">Fade speed</label>
        <select id="rewardFade" class="wc-select">
          <option value="off">끄기 — 페이드 없음 (기본)</option>
          <option value="slow">느림 (~600 페이지에 걸쳐)</option>
          <option value="normal">보통 (~300 페이지에 걸쳐)</option>
          <option value="fast">빠름 (~150 페이지에 걸쳐)</option>
        </select>
      </div>
      <div class="wc-field" style="max-width: 280px;">
        <label for="dailyRestMinutes">Daily rest minutes (게임 시간)</label>
        <input id="dailyRestMinutes" class="wc-input" type="number"
               min="0" max="120" step="5" value="${nDaily}">
      </div>
      <p class="wc-muted" style="margin: -2px 0 0; font-size: 12px;">
        As the wheel fades, up to this many game-time minutes are
        granted automatically each day instead — so reading stops
        being the price of play. Only active when fade is on.
      </p>

      <h3 style="margin: 28px 0 6px;">💝 격려 문구 (학생 프로필)</h3>
      <p class="wc-muted" style="margin: 0 0 8px;">
        한 줄에 하나씩 적으면, 학생의 프로필 화면에 매번 무작위로
        한 문장이 나타납니다. (비워두면 기본 한글 문구 5개가 자동
        표시돼요 — 한 줄이라도 적으면 그쪽만 보입니다.)
      </p>
      <textarea id="encouragementsTextarea" class="wc-input"
                style="min-height: 120px; font-family: inherit; line-height: 1.5;"
                placeholder="예) 잘하고 있어! 한 걸음씩 가자. 🌱">${escapeHtml(encsText)}</textarea>

      <button id="saveSettingsBtn" class="wc-btn wc-mt-24">Save settings</button>
      <span id="settingsStatus" class="wc-muted" style="margin-left:10px;"></span>
    `;

    // <select> can't carry a selected value via the template string
    // cleanly — set it after render.
    const fadeSel = $('rewardFade');
    if (fadeSel) fadeSel.value = fadePreset;

    // Animals default toggle — click flips state + repaints the label
    // and the .on class. State is read by the save handler below.
    const animalsBtn = $('animalsDefaultBtn');
    if (animalsBtn) {
      animalsBtn.addEventListener('click', () => {
        const nextOff = animalsBtn.dataset.state !== 'off';
        animalsBtn.dataset.state = nextOff ? 'off' : 'on';
        animalsBtn.classList.toggle('on', !nextOff);
        animalsBtn.setAttribute('aria-pressed', nextOff ? 'false' : 'true');
        animalsBtn.textContent = nextOff ? '[Off]' : '[On]';
      });
    }

    $('saveSettingsBtn').addEventListener('click', async () => {
      const next = {};
      wrap.querySelectorAll('[data-flag]').forEach(cb => {
        if (cb.checked) next[cb.dataset.flag] = true;
      });
      // Animals default — read the dedicated toggle button; [Off]
      // → stored true (= hideEncounters by default), [On] → unset.
      if (animalsBtn && animalsBtn.dataset.state === 'off') {
        next.lessonsAnimalsDefaultOff = true;
      }
      // Pages-per-quiz rides along in the same hide_features JSONB
      // as a plain number next to the boolean flags.
      let np = parseInt(($('quizEveryNPages') || {}).value, 10);
      if (!Number.isFinite(np) || np < 1) np = 1;
      if (np > 20) np = 20;
      next.quizEveryNPages = np;
      // Reward fade — preset + daily rest minutes. 'off' is stored as
      // absent so rewardIntensity() reads unset === off.
      const fv = ($('rewardFade') || {}).value;
      if (['slow', 'normal', 'fast'].includes(fv)) next.rewardFade = fv;
      let nd = parseInt(($('dailyRestMinutes') || {}).value, 10);
      if (!Number.isFinite(nd) || nd < 0) nd = 20;
      if (nd > 120) nd = 120;
      next.dailyRestMinutes = nd;
      // Encouragements — one per line, trim, drop empties. Empty
      // array drops the key so the profile falls back to defaults.
      const encsEl = $('encouragementsTextarea');
      const encsClean = encsEl
        ? encsEl.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
        : [];
      if (encsClean.length) next.encouragements = encsClean;
      try {
        await window.WCDB.classes.update(currentClass.id, {
          hide_features: next,
        });
        currentClass.hide_features = next;
        $('settingsStatus').textContent = 'Saved ✓';
        $('settingsStatus').style.color = 'var(--good)';
        setTimeout(() => { $('settingsStatus').textContent = ''; }, 2500);
      } catch (e) {
        $('settingsStatus').textContent = 'Save failed: ' + (e.message || e);
        $('settingsStatus').style.color = 'var(--bad)';
      }
    });
  }

  // ---------- util ----------
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }
})();
