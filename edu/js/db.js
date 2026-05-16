// =============================================================
//  WordCatch — DB helpers (PostgREST via anon key)
//
//  Thin wrapper around fetch() for the wc_* tables. No Supabase
//  auth — we pass `apikey` + `Authorization: Bearer <anon>` on
//  every call. Phase 7 will swap Authorization to a per-user JWT
//  issued by the validate-login-code edge function once we move
//  to strict RLS.
//
//  Exposes window.WCDB.{ classes, users, lessons, wordStates,
//  pets, viz, encounters }.
// =============================================================

(() => {
  const URL  = (window.WC_SUPABASE && window.WC_SUPABASE.url)  || '';
  const ANON = (window.WC_SUPABASE && window.WC_SUPABASE.anon) || '';
  const REST = URL ? URL.replace(/\/+$/, '') + '/rest/v1' : '';

  function headers(extra) {
    return Object.assign({
      apikey:         ANON,
      Authorization:  'Bearer ' + ANON,
      'Content-Type': 'application/json',
    }, extra || {});
  }

  async function rGet(path) {
    if (!REST) return [];
    const r = await fetch(REST + path, { headers: headers() });
    if (!r.ok) throw new Error('WCDB GET ' + r.status + ' ' + path);
    return r.json();
  }
  async function rPost(path, body, preferReturn) {
    if (!REST) throw new Error('Supabase not configured');
    const r = await fetch(REST + path, {
      method: 'POST',
      headers: headers(preferReturn ? { Prefer: 'return=representation' } : {}),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('WCDB POST ' + r.status + ' ' + path + ' :: ' + (await r.text()));
    return preferReturn ? r.json() : null;
  }
  async function rPatch(path, body) {
    if (!REST) throw new Error('Supabase not configured');
    const r = await fetch(REST + path, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('WCDB PATCH ' + r.status + ' ' + path);
    return r.json();
  }
  async function rDelete(path) {
    if (!REST) throw new Error('Supabase not configured');
    const r = await fetch(REST + path, { method: 'DELETE', headers: headers() });
    if (!r.ok) throw new Error('WCDB DELETE ' + r.status + ' ' + path);
    return true;
  }

  // ---------- classes ----------
  const classes = {
    async list() {
      return rGet('/wc_classes?select=*&order=created_at.asc');
    },
    async byId(id) {
      const rows = await rGet('/wc_classes?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1');
      return rows && rows[0] || null;
    },
    async create(name, teacherId) {
      const rows = await rPost('/wc_classes', { name, teacher_id: teacherId || null }, true);
      return rows && rows[0];
    },
    async update(id, patch) {
      return rPatch('/wc_classes?id=eq.' + encodeURIComponent(id), patch);
    },
  };

  // ---------- users ----------
  const users = {
    async byLoginCode(code) {
      const rows = await rGet('/wc_users?select=*&login_code=eq.' + encodeURIComponent(code) + '&limit=1');
      return rows && rows[0] || null;
    },
    async listStudents(classId, gender) {
      const q = ['role=eq.student', 'select=id,real_name,gender,class_id'];
      if (classId) q.push('class_id=eq.' + encodeURIComponent(classId));
      if (gender)  q.push('gender=eq.'   + encodeURIComponent(gender));
      q.push('order=real_name.asc');
      return rGet('/wc_users?' + q.join('&'));
    },
    async listAllStudents(gender) {
      const q = ['role=eq.student', 'select=id,real_name,gender,class_id'];
      if (gender) q.push('gender=eq.' + encodeURIComponent(gender));
      q.push('order=real_name.asc');
      return rGet('/wc_users?' + q.join('&'));
    },
    async create(row) {
      const rows = await rPost('/wc_users', row, true);
      return rows && rows[0];
    },
    async update(id, patch) {
      return rPatch('/wc_users?id=eq.' + encodeURIComponent(id), patch);
    },
    async touchSeen(id) {
      return rPatch('/wc_users?id=eq.' + encodeURIComponent(id), { last_seen_at: new Date().toISOString() });
    },
  };

  // ---------- lessons ----------
  const lessons = {
    // Students' view — hidden lessons are filtered out at the DB.
    // Older rows without a `hidden` column return as if false thanks
    // to the migration's `default false`.
    async listForClass(classId) {
      return rGet('/wc_lessons?select=*&class_id=eq.' + encodeURIComponent(classId) + '&hidden=eq.false&order=created_at.desc');
    },
    // Teacher view — every lesson in the class, hidden or not, so
    // the dashboard can show + toggle them.
    async listForClassAll(classId) {
      return rGet('/wc_lessons?select=*&class_id=eq.' + encodeURIComponent(classId) + '&order=created_at.desc');
    },
    // All non-hidden lessons (used by guests + teachers on the home
    // page where they're browsing rather than managing).
    async listAll() {
      return rGet('/wc_lessons?select=*&hidden=eq.false&order=created_at.desc');
    },
    async byId(id) {
      const rows = await rGet('/wc_lessons?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1');
      return rows && rows[0] || null;
    },
    async create(row) {
      const rows = await rPost('/wc_lessons', row, true);
      return rows && rows[0];
    },
    async update(id, patch) {
      const rows = await rPatch('/wc_lessons?id=eq.' + encodeURIComponent(id), patch);
      return rows && rows[0];
    },
    async delete(id) {
      // FK cascade is set on wc_visualization_messages (ON DELETE SET NULL)
      // and wc_encounter_counters (ON DELETE CASCADE), so deleting a lesson
      // doesn't orphan student progress — word_states stay (they're per-
      // user, not per-lesson), and viz messages keep their content with a
      // null lesson_id.
      return rDelete('/wc_lessons?id=eq.' + encodeURIComponent(id));
    },
  };

  // ---------- word states ----------
  const wordStates = {
    async forUser(userId) {
      return rGet('/wc_word_states?select=*&user_id=eq.' + encodeURIComponent(userId));
    },
    async upsert(userId, word, level) {
      // PostgREST upsert via on-conflict
      const body = [{ user_id: userId, word, level, last_clicked_at: new Date().toISOString() }];
      const r = await fetch(REST + '/wc_word_states?on_conflict=user_id,word', {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('WCDB upsert wordStates ' + r.status);
      return (await r.json())[0];
    },
    // Delete every word-state row for a student — used by the teacher
    // "Reset colors" action. After this, the student opens any lesson
    // and every word is back to its untouched (sky-blue) state.
    async deleteAllForUser(userId) {
      return rDelete('/wc_word_states?user_id=eq.' + encodeURIComponent(userId));
    },
  };

  // ---------- pets ----------
  const pets = {
    async forUser(userId) {
      return rGet('/wc_student_pets?select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=caught_at.desc');
    },
    async catch_(userId, animalSet, animalIndex, level) {
      return rPost('/wc_student_pets', {
        user_id: userId, animal_set: animalSet, animal_index: animalIndex, animal_level: level || 1,
      }, true);
    },
    async rename(petId, name) {
      return rPatch('/wc_student_pets?id=eq.' + encodeURIComponent(petId), { custom_name: name });
    },
  };

  // ---------- visualization messages ----------
  const viz = {
    async send(studentId, lessonId, word, prompt) {
      const rows = await rPost('/wc_visualization_messages',
        { student_id: studentId, lesson_id: lessonId, word, prompt }, true);
      return rows && rows[0];
    },
    async forStudent(studentId) {
      return rGet('/wc_visualization_messages?select=*&student_id=eq.'
        + encodeURIComponent(studentId) + '&order=sent_at.desc');
    },
    async forLesson(lessonId) {
      return rGet('/wc_visualization_messages?select=*&lesson_id=eq.'
        + encodeURIComponent(lessonId) + '&order=sent_at.desc');
    },
    // Inbox view for a teacher — every message tied to any of their
    // class's lessons. PostgREST's `in.(…)` handles the multi-lesson
    // OR cleanly; we'd otherwise have to make N round-trips.
    async forLessons(lessonIds) {
      if (!lessonIds || !lessonIds.length) return [];
      const list = lessonIds.map(encodeURIComponent).join(',');
      return rGet('/wc_visualization_messages?select=*&lesson_id=in.(' + list + ')&order=sent_at.desc');
    },
    async respondWithGift(messageId, animalSet, animalIndex, response) {
      return rPatch('/wc_visualization_messages?id=eq.' + encodeURIComponent(messageId), {
        gift_animal_set:   animalSet,
        gift_animal_index: animalIndex,
        teacher_response:  response || null,
        responded_at:      new Date().toISOString(),
      });
    },
  };

  // ---------- bulk fetches for teacher insight views ----------
  const insights = {
    // All word-state rows for a list of student ids — used for the
    // class-wide ice cream distribution chart and per-student rows.
    async wordStatesForStudents(studentIds) {
      if (!studentIds || !studentIds.length) return [];
      const list = studentIds.map(encodeURIComponent).join(',');
      return rGet('/wc_word_states?select=user_id,word,level&user_id=in.(' + list + ')');
    },
    // All pets for a list of students — count totals per student.
    async petsForStudents(studentIds) {
      if (!studentIds || !studentIds.length) return [];
      const list = studentIds.map(encodeURIComponent).join(',');
      return rGet('/wc_student_pets?select=user_id,animal_set,animal_index,animal_level&user_id=in.(' + list + ')');
    },
  };

  // ---------- encounter counters ----------
  const encounters = {
    async get(userId, lessonId) {
      const rows = await rGet('/wc_encounter_counters?select=*&user_id=eq.'
        + encodeURIComponent(userId) + '&lesson_id=eq.' + encodeURIComponent(lessonId) + '&limit=1');
      return rows && rows[0] || null;
    },
    async bump(userId, lessonId) {
      // Read-modify-write — atomic counter via RPC would be cleaner, but
      // for Phase 1 a simple upsert with the current value suffices.
      const cur = await this.get(userId, lessonId);
      const next = (cur?.count_value || 0) + 1;
      const body = [{
        user_id: userId, lesson_id: lessonId,
        count_value: next, last_change_at: new Date().toISOString(),
      }];
      const r = await fetch(REST + '/wc_encounter_counters?on_conflict=user_id,lesson_id', {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('WCDB encounter bump ' + r.status);
      return (await r.json())[0];
    },
    async reset(userId, lessonId) {
      const body = [{
        user_id: userId, lesson_id: lessonId,
        count_value: 0, last_change_at: new Date().toISOString(),
      }];
      const r = await fetch(REST + '/wc_encounter_counters?on_conflict=user_id,lesson_id', {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('WCDB encounter reset ' + r.status);
      return true;
    },
  };

  // ---------- realtime helpers ----------
  // Phase 4 wires student-side polling for new teacher replies. Phase
  // 7 will swap to Supabase Realtime channels — for now a 30-second
  // poll keeps the wire-up simple and works on every browser.
  const realtime = {
    pollViz(studentId, sinceISO, onNewReply, intervalMs) {
      let lastSeen = sinceISO || new Date().toISOString();
      let stopped  = false;
      async function tick() {
        if (stopped) return;
        try {
          const rows = await rGet('/wc_visualization_messages?select=*'
            + '&student_id=eq.'   + encodeURIComponent(studentId)
            + '&responded_at=gt.' + encodeURIComponent(lastSeen)
            + '&order=responded_at.asc');
          if (rows && rows.length) {
            lastSeen = rows[rows.length - 1].responded_at;
            rows.forEach(onNewReply);
          }
        } catch (e) { /* network blips are fine */ }
        if (!stopped) setTimeout(tick, intervalMs || 30000);
      }
      setTimeout(tick, intervalMs || 30000);
      return () => { stopped = true; };
    },
  };

  window.WCDB = { classes, users, lessons, wordStates, pets, viz, encounters, realtime, insights };
})();
