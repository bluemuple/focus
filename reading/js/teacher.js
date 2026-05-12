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
      const imgCount = Array.isArray(L.images) ? L.images.length : 0;
      const editing = editingLessonId === L.id;
      const row = document.createElement('div');
      row.className = 'wc-list-item' + (editing ? ' wc-editing' : '');
      row.innerHTML = `
        <div>
          <div class="title">${escapeHtml(L.title)}${editing ? ' <span class="wc-muted" style="font-size:13px;">(editing)</span>' : ''}</div>
          <div class="meta">
            ${escapeHtml(L.animal_set)} ·
            🎁 ${todaySent} / ${L.gift_limit_per_day} sent today
            ${imgCount ? ' · 📷 ' + imgCount : ''}
            · ${new Date(L.created_at).toLocaleDateString('en-NZ')}
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="wc-btn ghost" data-edit="${L.id}">✏️ Edit</button>
          <a href="./lesson.html?id=${encodeURIComponent(L.id)}&preview=1" class="wc-btn ghost" target="_blank" rel="noopener">Preview</a>
          <button class="wc-btn ghost wc-btn-danger" data-delete-row="${L.id}">🗑 Delete</button>
        </div>
      `;
      list.appendChild(row);
    });
    list.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', () => startEditing(b.dataset.edit));
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
  function startEditing(lessonId) {
    const L = lessons.find(x => x.id === lessonId);
    if (!L) return;
    editingLessonId = L.id;
    $('lessonTitle').value      = L.title || '';
    // Old plain-text bodies still load fine — assigning to innerHTML
    // just puts the text inside the editor. New HTML bodies render
    // with their formatting intact.
    $('lessonBody').innerHTML   = L.body  || '';
    $('lessonAnimalSet').value  = L.animal_set || 'animals';
    $('lessonGiftLimit').value  = L.gift_limit_per_day || 3;
    lessonImages = Array.isArray(L.images) ? L.images.map(im => ({ ...im })) : [];
    renderImagesPreview();
    lessonWordImages = Array.isArray(L.word_images)
      ? L.word_images.map(wi => ({ ...wi })) : [];
    renderWordImageRows();
    updateFormMode();
    // Scroll the form into view so the teacher sees the fields populate.
    $('lessonTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('lessonTitle').focus();
    // Re-render the list so the row gets the "(editing)" badge highlight.
    renderLessons();
  }

  function cancelEditing() {
    editingLessonId = null;
    $('lessonTitle').value = '';
    $('lessonBody').innerHTML = '';
    $('lessonAnimalSet').value = 'animals';
    $('lessonGiftLimit').value = 3;
    resetImages();
    updateFormMode();
    renderLessons();
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

  // contentEditable body — `pendingInsertPos` now stashes a DOM Range
  // rather than a textarea cursor index. When the user triggers an
  // image upload (button or paste), we restore this range so the
  // marker lands where the cursor was even if focus has since moved.
  function rememberCursor() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // Only stash if the selection is INSIDE the body editor.
    const body = $('lessonBody');
    if (body && body.contains(range.startContainer)) {
      pendingInsertPos = range.cloneRange();
    }
  }
  // Selection events fire whenever the caret moves; sample them so
  // the most recent caret position is always remembered.
  document.addEventListener('selectionchange', rememberCursor);
  $('lessonBody').addEventListener('click', rememberCursor);
  $('lessonBody').addEventListener('keyup', rememberCursor);

  // ----------------------------------------------------------------
  //  RICH-TEXT TOOLBAR (H1/H2/H3/Body/Bold/Underline/Colour)
  //
  //  Uses document.execCommand for portability. While execCommand is
  //  marked deprecated, every shipping browser still implements the
  //  basic formatting commands and they remain the simplest way to
  //  apply inline styling to a Selection inside a contentEditable.
  //  We restore the stashed Range before each command so a click on
  //  a toolbar button (which steals focus) doesn't lose the user's
  //  text selection.
  // ----------------------------------------------------------------
  function runFormatCommand(cmd, arg) {
    const body = $('lessonBody');
    body.focus();
    if (pendingInsertPos && body.contains(pendingInsertPos.startContainer)) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(pendingInsertPos);
    }
    try {
      document.execCommand(cmd, false, arg || null);
    } catch (e) { console.warn('execCommand', cmd, e); }
    rememberCursor();
  }
  // mousedown (not click) — prevents focus from leaving the editor
  // before we run the command (some browsers blur the editor when a
  // toolbar button receives mousedown).
  document.querySelectorAll('.wc-rt-toolbar [data-rt-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      runFormatCommand(btn.dataset.rtCmd, btn.dataset.rtArg);
    });
  });
  // Colour picker — apply foreColor when the user picks a colour.
  const colorInput = document.getElementById('rtColorInput');
  if (colorInput) {
    colorInput.addEventListener('mousedown', () => rememberCursor());
    colorInput.addEventListener('input', () => {
      runFormatCommand('foreColor', colorInput.value);
    });
  }

  $('addImageBtn').addEventListener('click', () => {
    rememberCursor();
    $('addImageFile').click();
  });
  $('addImageFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    await handleImageFile(file);
    e.target.value = '';   // allow same file twice
  });
  // Paste — works anywhere on the page; we only consume when there's
  // actually an image in the clipboard. Plain-text paste keeps default
  // textarea behaviour.
  document.addEventListener('paste', async (e) => {
    // Body editor active — handle image paste (insert marker) AND
    // plain-text paste (strip formatting so external HTML doesn't
    // muddy the editor's clean output).
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
    // No image — let browser handle text paste but force plain text
    // to avoid pasting in foreign HTML/styles.
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      e.preventDefault();
      document.execCommand('insertText', false, text);
    }
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

  // Reads `file` into an <img>, redraws it on a canvas at ≤800px on
  // the long edge, returns a JPEG data URL.
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

  // Small modal asks: "Where should this image sit?" with 4 corner
  // buttons. Resolves with 'tl' | 'tr' | 'bl' | 'br'.
  function pickCorner(onPick) {
    let host = document.getElementById('cornerPickerHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'cornerPickerHost';
      host.className = 'wc-popup-backdrop';
      host.innerHTML = `
        <div class="wc-popup" style="max-width: 360px;">
          <button class="wc-popup-close" aria-label="Close">×</button>
          <h3 style="margin: 0 0 12px;">Where should this image sit?</h3>
          <div class="wc-corner-grid">
            <button data-corner="tl"><span>↖</span> Top-left</button>
            <button data-corner="tr"><span>↗</span> Top-right</button>
            <button data-corner="bl"><span>↙</span> Bottom-left</button>
            <button data-corner="br"><span>↘</span> Bottom-right</button>
          </div>
        </div>
      `;
      document.body.appendChild(host);
      host.addEventListener('click', e => { if (e.target === host) host.remove(); });
      host.querySelector('.wc-popup-close').addEventListener('click', () => host.remove());
    } else {
      host.style.display = 'flex';
    }
    host.querySelectorAll('[data-corner]').forEach(b => {
      b.onclick = () => {
        const c = b.dataset.corner;
        host.remove();
        onPick(c);
      };
    });
  }

  function insertImage(corner, dataUrl) {
    const idx = lessonImages.length;
    lessonImages.push({ corner, data_url: dataUrl });
    const marker = `[[IMG:${idx}]]`;

    const body = $('lessonBody');
    body.focus();

    // Restore the stashed Range so the marker lands where the cursor
    // was when the user clicked "Add image", even if focus jumped to
    // the file picker / corner modal in between.
    if (pendingInsertPos && body.contains(pendingInsertPos.startContainer)) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(pendingInsertPos);
    }
    // insertText is the simplest way to insert plain text at the
    // current caret position inside a contentEditable without
    // breaking the surrounding markup.
    document.execCommand('insertText', false, ' ' + marker + ' ');

    // Update pending range to "after the inserted text" so a second
    // image insertion appends after the first, not on top of it.
    rememberCursor();
    renderImagesPreview();
  }

  function renderImagesPreview() {
    const wrap = $('lessonImagesPreview');
    if (!wrap) return;
    if (!lessonImages.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = lessonImages.map((im, i) => `
      <div class="wc-img-chip">
        <img src="${im.data_url}" alt="image ${i}"/>
        <div class="wc-img-chip-meta">
          <strong>[[IMG:${i}]]</strong>
          <span class="wc-muted">${cornerLabel(im.corner)}</span>
        </div>
        <button data-rm="${i}" class="wc-btn ghost">Remove</button>
      </div>
    `).join('');
    wrap.querySelectorAll('[data-rm]').forEach(b => {
      b.addEventListener('click', () => removeImage(parseInt(b.dataset.rm, 10)));
    });
  }
  function cornerLabel(c) {
    return ({ tl: 'top-left', tr: 'top-right', bl: 'bottom-left', br: 'bottom-right' })[c] || c;
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
    // Body is a contentEditable — read innerHTML to preserve
    // formatting (H1-H3, bold, underline, colour). textContent check
    // for the empty-state guard since an empty editor has whitespace
    // <br> filler in some browsers.
    const bodyEl = $('lessonBody');
    const body   = bodyEl.innerHTML.trim();
    const bodyText = bodyEl.textContent.trim();
    if (!title || !bodyText) {
      msg.textContent = 'Please enter a title and body.';
      msg.className = 'wc-alert error'; msg.classList.remove('wc-hidden'); return;
    }
    // Strip empty word-image rows (no word AND no image) — those are
    // half-filled drafts that don't need to make it to the DB.
    const cleanedWordImages = lessonWordImages.filter(
      wi => (wi.word && wi.word.trim()) && wi.data_url
    );
    const payload = {
      title, body,
      animal_set: $('lessonAnimalSet').value,
      gift_limit_per_day: parseInt($('lessonGiftLimit').value, 10) || 3,
      images: lessonImages,
      word_images: cleanedWordImages,
    };
    try {
      if (editingLessonId) {
        // PATCH only the editable fields — never overwrite created_by,
        // class_id, created_at (those are immutable identity).
        await window.WCDB.lessons.update(editingLessonId, payload);
        msg.textContent = 'Lesson updated.';
      } else {
        await window.WCDB.lessons.create({
          ...payload,
          class_id:   currentClass.id,
          created_by: me.id,
        });
        msg.textContent = 'Lesson created.';
      }
      // Reset form regardless of create/update.
      editingLessonId = null;
      $('lessonTitle').value = '';
      $('lessonBody').innerHTML = '';
      resetImages();
      updateFormMode();
      msg.className = 'wc-alert ok'; msg.classList.remove('wc-hidden');
      await refreshAll();
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
