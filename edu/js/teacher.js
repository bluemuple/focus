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
    if (name === 'messages') renderMessages();
    if (name === 'animals')  renderAnimalsTab();
    if (name === 'settings') renderSettings();
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
    setTimeout(() => { btn.textContent = origLabel; btn.dataset.busy = ''; }, 2500);
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
    setTimeout(() => { btn.textContent = origLabel; btn.dataset.busy = ''; }, 2500);
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
      row.innerHTML = `
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
            · ${new Date(L.created_at).toLocaleDateString('en-NZ')}
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="wc-btn ghost" data-edit="${L.id}"
                  title="Open this lesson in the edit form below">✏️ Edit</button>
          <button class="wc-btn ghost" data-toggle-hidden="${L.id}"
                  title="${isHidden ? 'Show this lesson to students again' : 'Hide this lesson from students'}">
            ${isHidden ? '👁 Show' : '🙈 Hide'}
          </button>
          <button class="wc-btn ghost icon-only" data-prewarm="${L.id}"
                  title="Prewarm: pre-fetch sentence chunks + word-info data so the first student doesn't wait">🔥</button>
          <button class="wc-btn ghost icon-only" data-prewarmaudio="${L.id}"
                  title="Audio: generate &amp; cache TTS audio for every sentence (Google's API won't be hit again for this lesson)">🎵</button>
          <button class="wc-btn ghost wc-btn-danger" data-delete-row="${L.id}"
                  title="Permanently delete this lesson — cannot be undone">🗑 Delete</button>
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
  }

  function cancelEditing() {
    editingLessonId = null;
    $('lessonTitle').value = '';
    $('lessonBody').value = '';
    $('lessonAnimalSet').value = 'animals';
    $('lessonGiftLimit').value = 3;
    $('lessonHeadingsNewPage').checked = false;
    resetImages();
    updateFormMode();
    // Return the form card to its default collapsed state.
    const card = $('createLessonCard');
    if (card) card.open = false;
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
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    await handleImageFile(file);
    e.target.value = '';   // allow same file twice
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
      return `
        <div class="wc-img-chip">
          <img src="${im.data_url}" alt="image ${i}"/>
          <div class="wc-img-chip-meta">
            <strong>[[IMG:${i}]]</strong>
            <span class="wc-muted">${cornerLabel(im.corner)} · ${pct}%</span>
          </div>
          <div class="wc-img-chip-actions">
            <button data-size="-"   data-i="${i}" class="wc-btn ghost" title="Shrink 5%">−</button>
            <button data-size="+"   data-i="${i}" class="wc-btn ghost" title="Grow 5%">+</button>
            <button data-corner-edit="${i}" class="wc-btn ghost" title="Change where this image sits">📍 Position</button>
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
    const payload = {
      title, body,
      animal_set: $('lessonAnimalSet').value,
      gift_limit_per_day: parseInt($('lessonGiftLimit').value, 10) || 3,
      images: lessonImages,
      word_images: cleanedWordImages,
      word_notes:  cleanedWordNotes,
      headings_start_new_page: !!$('lessonHeadingsNewPage').checked,
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
            Reply with any combo of text, sticker, and coins. At least one is required.
            Stickers left today on this lesson: <strong>${quotaLeft}</strong> / ${quotaMax}
          </div>
          <div class="wc-animal-picker" data-msg="${m.id}"></div>
          <textarea class="wc-textarea wc-tmsg-text" rows="2" placeholder="Reply to ${escapeHtml(student?.real_name||'')}…"></textarea>
          <!-- Coin gift — quick-pick presets plus a free-form number
               so the teacher can reward a great "Use it" answer
               without having to remember the keyboard sequence. -->
          <div class="wc-tmsg-money">
            <span class="wc-muted">🪙 Coins:</span>
            <button type="button" class="wc-money-preset" data-money="1">+1</button>
            <button type="button" class="wc-money-preset" data-money="5">+5</button>
            <button type="button" class="wc-money-preset" data-money="10">+10</button>
            <input type="number" class="wc-tmsg-money-input" min="0" max="999"
                   step="1" placeholder="0" />
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
              ? `<div class="wc-muted" style="font-size:13px;">🪙 Sent ${m.gift_money} coin${m.gift_money === 1 ? '' : 's'}</div>`
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
          moneyInput.value = String(Math.min(999, Math.max(0, cur + add)));
        });
      });
      card.querySelector('.wc-tmsg-send').addEventListener('click', () => sendGift(card, m));
    }
    return card;
  }

  async function sendGift(card, m) {
    const status  = card.querySelector('.wc-tmsg-status');
    const sendBtn = card.querySelector('.wc-tmsg-send');
    const picked  = card.querySelector('.wc-animal-picker').dataset.picked;
    const note    = card.querySelector('.wc-tmsg-text').value.trim();
    const moneyEl = card.querySelector('.wc-tmsg-money-input');
    const money   = Math.max(0, Math.min(999, parseInt(moneyEl?.value, 10) || 0));
    // Text alone, sticker alone, money alone, or any combo — all OK.
    // Only invalid case is everything empty (blank reply).
    if (!picked && !note && money <= 0) {
      status.textContent = 'Pick a sticker, type a reply, or add some coins first.';
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
      await window.WCDB.viz.respondWithGift(m.id, setName, idx, note || null, money);
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
    // Compact home-page toggles — short labels. Each tick removes
    // one button from the student home. Saved into the same
    // hide_features JSONB column the longer toggles above use.
    const NAV_TOGGLES = [
      // Maths bars + Reading
      { key: 'hideReading',     label: 'Reading' },
      { key: 'hideSubtraction', label: 'Subtraction' },
      { key: 'hideFraction',    label: 'Fraction' },
      // Other app tiles
      { key: 'hideMyPets',      label: 'My Pets' },
      { key: 'hideTheSpace',    label: 'The Space' },
      { key: 'hidePhonics',     label: 'Phonics' },
      { key: 'hideAnimals',     label: 'Animals' },
    ];

    // Per-level encounter probabilities. Start from whatever is saved
    // on the class row; if a slot is null/missing, fall back to the
    // global default (20 → 65%). Sliders write back to the array in
    // memory and Save persists the whole 10-element array.
    const savedProbs = Array.isArray(currentClass.level_probabilities)
      ? currentClass.level_probabilities : [];
    const defaultsByLv = (window.WCLevels && window.WCLevels.all) ? window.WCLevels.all() : [];
    function defaultFor(lv) {
      const d = defaultsByLv[lv];
      return d && typeof d.probability === 'number' ? d.probability : 0.5;
    }
    function effectiveProb(lv) {
      const v = savedProbs[lv - 1];
      return (typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1) ? v : defaultFor(lv);
    }
    let probDraft = [];
    for (let lv = 1; lv <= 10; lv++) probDraft.push(effectiveProb(lv));

    function probRowsHtml() {
      let html = '';
      for (let lv = 1; lv <= 10; lv++) {
        const pct = Math.round(probDraft[lv - 1] * 100);
        const def = Math.round(defaultFor(lv) * 100);
        html += `
          <div class="wc-prob-row" data-lv="${lv}">
            <span class="wc-prob-label">Lv ${lv}</span>
            <input type="range" class="wc-prob-slider"
                   min="0" max="100" step="5" value="${pct}" />
            <span class="wc-prob-value" id="probVal${lv}">${pct}%</span>
            <span class="wc-prob-default">(default ${def}%)</span>
          </div>
        `;
      }
      return html;
    }

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

      <h3 style="margin: 28px 0 6px;">🐾 Animal-encounter probability</h3>
      <p class="wc-muted" style="margin: 0 0 12px;">
        Each time a student marks a word, this is the chance they meet
        an animal — different per encounter level. Lower numbers = calmer
        reading flow.
      </p>
      <div id="probRows">${probRowsHtml()}</div>
      <div style="margin-top: 8px;">
        <button id="probResetBtn" class="wc-btn ghost" type="button">Reset to defaults</button>
      </div>

      <button id="saveSettingsBtn" class="wc-btn wc-mt-24">Save settings</button>
      <span id="settingsStatus" class="wc-muted" style="margin-left:10px;"></span>
    `;

    // Wire sliders — live update of the "%" label as the teacher drags.
    wrap.querySelectorAll('.wc-prob-slider').forEach(slider => {
      const row = slider.closest('.wc-prob-row');
      const lv  = parseInt(row.dataset.lv, 10);
      slider.addEventListener('input', () => {
        const pct = parseInt(slider.value, 10);
        probDraft[lv - 1] = pct / 100;
        const valEl = row.querySelector('.wc-prob-value');
        if (valEl) valEl.textContent = pct + '%';
      });
    });

    $('probResetBtn').addEventListener('click', () => {
      probDraft = [];
      for (let lv = 1; lv <= 10; lv++) probDraft.push(defaultFor(lv));
      wrap.querySelectorAll('.wc-prob-row').forEach(row => {
        const lv  = parseInt(row.dataset.lv, 10);
        const pct = Math.round(probDraft[lv - 1] * 100);
        row.querySelector('.wc-prob-slider').value = pct;
        row.querySelector('.wc-prob-value').textContent = pct + '%';
      });
    });

    $('saveSettingsBtn').addEventListener('click', async () => {
      const next = {};
      wrap.querySelectorAll('[data-flag]').forEach(cb => {
        if (cb.checked) next[cb.dataset.flag] = true;
      });
      try {
        await window.WCDB.classes.update(currentClass.id, {
          hide_features: next,
          level_probabilities: probDraft.slice(),
        });
        currentClass.hide_features = next;
        currentClass.level_probabilities = probDraft.slice();
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
