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
      lessons  = await window.WCDB.lessons.listForClass(currentClass.id).catch(() => []);
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
    if (name === 'messages') renderMessages();
    if (name === 'settings') renderSettings();
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
    students.forEach(s => {
      const row = document.createElement('div');
      row.className = 'wc-list-item';
      const seen = s.last_seen_at ? new Date(s.last_seen_at).toLocaleDateString('en-NZ') : 'never';
      row.innerHTML = `
        <div>
          <div class="title">${escapeHtml(s.real_name)}</div>
          <div class="meta">
            ${escapeHtml(s.gender || '—')}
            · code <strong style="letter-spacing:3px;font-family:monospace;">${s.login_code || '—'}</strong>
            · 🪙 ${s.money || 0}
            · ⭐ Lv ${s.encounter_level || 1}
            · seen ${seen}
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="wc-btn ghost" data-impersonate="${s.id}" title="See this student's lesson view">👁 View as</button>
          <button class="wc-btn ghost" data-regen="${s.id}">New code</button>
        </div>
      `;
      list.appendChild(row);
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
            <div class="brand">Word<span>Catch</span></div>
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
      const row = document.createElement('div');
      row.className = 'wc-list-item';
      row.innerHTML = `
        <div>
          <div class="title">${escapeHtml(L.title)}</div>
          <div class="meta">
            ${escapeHtml(L.animal_set)} ·
            🎁 ${todaySent} / ${L.gift_limit_per_day} sent today ·
            ${new Date(L.created_at).toLocaleDateString('en-NZ')}
          </div>
        </div>
        <a href="./lesson.html?id=${encodeURIComponent(L.id)}" class="wc-btn ghost">Preview</a>
      `;
      list.appendChild(row);
    });
  }
  function countGiftsToday(lessonId) {
    const today = new Date().toISOString().slice(0, 10);
    return messages.filter(m =>
      m.lesson_id === lessonId
      && m.responded_at && m.responded_at.slice(0,10) === today
      && m.gift_animal_set != null
    ).length;
  }

  $('addLessonBtn').addEventListener('click', async () => {
    const msg = $('addLessonMsg');
    msg.classList.add('wc-hidden');
    if (!currentClass) {
      msg.textContent = 'Create a class first.';
      msg.className = 'wc-alert error'; msg.classList.remove('wc-hidden'); return;
    }
    const title = $('lessonTitle').value.trim();
    const body  = $('lessonBody').value.trim();
    if (!title || !body) {
      msg.textContent = 'Please enter a title and body.';
      msg.className = 'wc-alert error'; msg.classList.remove('wc-hidden'); return;
    }
    try {
      await window.WCDB.lessons.create({
        class_id: currentClass.id, created_by: me.id,
        title, body,
        animal_set: $('lessonAnimalSet').value,
        gift_limit_per_day: parseInt($('lessonGiftLimit').value, 10) || 3,
      });
      $('lessonTitle').value = ''; $('lessonBody').value = '';
      msg.textContent = 'Lesson created.';
      msg.className = 'wc-alert ok'; msg.classList.remove('wc-hidden');
      await refreshAll();
    } catch (e) {
      msg.textContent = e.message || 'Could not create lesson.';
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
            <td>🪙 ${s.money}</td>
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
  function renderMessages() {
    const wrap = $('messagesBody');
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

    card.innerHTML = `
      <div class="wc-tmsg-header">
        <div>
          <strong>${escapeHtml(student?.real_name || 'Unknown student')}</strong>
          ${m.word ? ` · re: <em>${escapeHtml(m.word)}</em>` : ''}
        </div>
        <div class="wc-muted" style="font-size:13px;">
          ${lesson ? escapeHtml(lesson.title) + ' · ' : ''}${new Date(m.sent_at).toLocaleString('en-NZ')}
        </div>
      </div>
      <div class="wc-tmsg-prompt">${escapeHtml(m.prompt)}</div>
      ${editable ? `
        <div class="wc-tmsg-reply">
          <div class="wc-muted" style="margin-bottom:6px;">
            Gifts left today on this lesson: <strong>${quotaLeft}</strong> / ${quotaMax}
          </div>
          <div class="wc-animal-picker" data-msg="${m.id}"></div>
          <textarea class="wc-textarea wc-tmsg-text" rows="2" placeholder="Optional note for ${escapeHtml(student?.real_name||'')}…"></textarea>
          <button class="wc-btn wc-tmsg-send" data-msg="${m.id}" ${quotaLeft <= 0 ? 'disabled' : ''}>Send gift 📨</button>
          <span class="wc-tmsg-status wc-muted"></span>
        </div>
      ` : `
        <div class="wc-tmsg-done">
          ${gifts}
          <div>
            ${m.teacher_response ? `<div>${escapeHtml(m.teacher_response)}</div>` : ''}
            <div class="wc-muted" style="font-size:13px;">
              Replied ${new Date(m.responded_at).toLocaleDateString('en-NZ')}
            </div>
          </div>
        </div>
      `}
    `;
    if (editable) {
      mountAnimalPicker(card.querySelector('.wc-animal-picker'));
      card.querySelector('.wc-tmsg-send').addEventListener('click', () => sendGift(card, m));
    }
    return card;
  }

  async function sendGift(card, m) {
    const status = card.querySelector('.wc-tmsg-status');
    const sendBtn = card.querySelector('.wc-tmsg-send');
    const picked  = card.querySelector('.wc-animal-picker').dataset.picked;
    const note    = card.querySelector('.wc-tmsg-text').value.trim();
    if (!picked) {
      status.textContent = 'Pick an animal first.';
      status.style.color = 'var(--bad)';
      return;
    }
    const [setName, idx] = picked.split('::');
    sendBtn.disabled = true;
    status.textContent = 'Sending…';
    status.style.color = 'var(--ink-soft)';
    try {
      await window.WCDB.viz.respondWithGift(m.id, setName, parseInt(idx, 10), note || null);
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
      { key: 'hideDictionaryIframe',     label: 'Hide vocabulary.com iframe (new-tab only)', tip: 'In case of strict school content filters.' },
    ];
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
      </div>
      <button id="saveSettingsBtn" class="wc-btn wc-mt-24">Save settings</button>
      <span id="settingsStatus" class="wc-muted" style="margin-left:10px;"></span>
    `;
    $('saveSettingsBtn').addEventListener('click', async () => {
      const next = {};
      wrap.querySelectorAll('[data-flag]').forEach(cb => {
        if (cb.checked) next[cb.dataset.flag] = true;
      });
      try {
        await window.WCDB.classes.update(currentClass.id, { hide_features: next });
        currentClass.hide_features = next;
        $('settingsStatus').textContent = 'Saved ✓';
        $('settingsStatus').style.color = 'var(--good)';
        setTimeout(() => { $('settingsStatus').textContent = ''; }, 2500);
      } catch (e) {
        $('settingsStatus').textContent = 'Save failed';
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
