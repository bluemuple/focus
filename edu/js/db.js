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
  // PostgREST write (POST/PATCH) that survives a schema that's behind:
  // when a 400 names a column PostgREST can't find (a migration the
  // teacher hasn't run yet), strip that column from the payload and
  // retry — so an un-run migration degrades gracefully (the feature
  // simply isn't saved) instead of 400-ing the entire lesson save.
  async function writeResilient(method, path, body) {
    if (!REST) throw new Error('Supabase not configured');
    const payload = { ...body };
    for (let attempt = 0; attempt < 10; attempt++) {
      const r = await fetch(REST + path, {
        method,
        headers: headers({ Prefer: 'return=representation' }),
        body: JSON.stringify(payload),
      });
      if (r.ok) return r.json();
      const txt = await r.text().catch(() => '');
      // e.g. "Could not find the 'default_scroll' column of 'wc_lessons'…"
      const m = r.status === 400 && txt.match(/'([A-Za-z_][\w]*)' column/);
      if (m && Object.prototype.hasOwnProperty.call(payload, m[1])) {
        console.warn('[WCDB] column "' + m[1] + '" missing — run the matching '
          + 'migration; saving without it for now.');
        delete payload[m[1]];
        continue;
      }
      throw new Error('WCDB ' + method + ' ' + r.status + ' ' + path
        + ' :: ' + txt.slice(0, 200));
    }
    throw new Error('WCDB ' + method + ' ' + path + ' — too many missing columns');
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
    async byId(id) {
      const rows = await rGet('/wc_users?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1');
      return rows && rows[0] || null;
    },
    // Bulk fetch — used by teacher dashboards reading per-student state.
    async byIds(ids) {
      if (!ids || !ids.length) return [];
      const list = ids.map(encodeURIComponent).join(',');
      return rGet('/wc_users?select=*&id=in.(' + list + ')');
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
      // Resilient — a lesson save must not 400 just because a recent
      // column migration hasn't been run yet.
      const rows = await writeResilient('POST', '/wc_lessons', row);
      return rows && rows[0];
    },
    async update(id, patch) {
      const rows = await writeResilient(
        'PATCH', '/wc_lessons?id=eq.' + encodeURIComponent(id), patch);
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
    // Send a reply with optional sticker, text, AND/OR coin gift.
    // Any of (animalSet+animalIndex), response, or money can be null/0;
    // the caller validates at least one of the three is present.
    // Money credits flow on the student side: the sidebar's pollViz
    // picks the reply up and bumps wc_users.money there. Doing the
    // credit client-side keeps the optimistic in-page counter and the
    // persisted row in lockstep without a server-side trigger.
    async respondWithGift(messageId, animalSet, animalIndex, response, money) {
      const patch = {
        gift_animal_set:   animalSet,
        gift_animal_index: animalIndex,
        teacher_response:  response || null,
        responded_at:      new Date().toISOString(),
      };
      // Only write gift_money when the caller actually opted in — older
      // databases without the column would 400 on the column name
      // otherwise. Run the supabase-add-viz-money.sql migration first
      // to use this feature.
      if (Number.isFinite(money) && money > 0) {
        patch.gift_money = Math.max(0, Math.floor(money));
      }
      return rPatch('/wc_visualization_messages?id=eq.' + encodeURIComponent(messageId), patch);
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

  // ---------- lesson reading progress ----------
  //  One row per (user, lesson) holding the last page index the
  //  student viewed. lesson.js writes it on page change and reads
  //  it on load to resume long lessons (e.g. multi-page comics).
  //  Run edu/supabase-add-lesson-progress.sql once before use.
  const progress = {
    async get(userId, lessonId) {
      if (!userId || !lessonId) return null;
      const rows = await rGet('/wc_lesson_progress?select=*&user_id=eq.'
        + encodeURIComponent(userId) + '&lesson_id=eq.'
        + encodeURIComponent(lessonId) + '&limit=1');
      return rows && rows[0] || null;
    },
    async save(userId, lessonId, page) {
      if (!REST || !userId || !lessonId) return false;
      const body = [{
        user_id:    userId,
        lesson_id:  lessonId,
        page:       Math.max(0, page | 0),
        updated_at: new Date().toISOString(),
      }];
      const r = await fetch(REST + '/wc_lesson_progress?on_conflict=user_id,lesson_id', {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('WCDB progress save ' + r.status);
      return true;
    },
  };

  // ---------- money ledger (reward wheel + 💰 spending) ----------
  //  Dollar money is stored as integer CENTS. wc_users.money is the
  //  authoritative balance; this ledger keeps the history (weekly
  //  earn graph + spend log) the home 💰 popup renders.
  //  Run edu/supabase-add-xp-and-money-ledger.sql once before use.
  const money = {
    async list(userId) {
      if (!userId) return [];
      return rGet('/wc_money_entries?select=*&user_id=eq.'
        + encodeURIComponent(userId) + '&order=created_at.desc');
    },
    async add(userId, kind, cents, memo) {
      if (!REST || !userId) return null;
      const rows = await rPost('/wc_money_entries', {
        user_id: userId,
        kind:    kind === 'spend' ? 'spend' : 'earn',
        cents:   Math.max(0, Math.round(Number(cents) || 0)),
        memo:    (memo && String(memo).trim()) || null,
      }, true);
      return rows && rows[0];
    },
  };
  // "$X.XX" formatter. Stored cents → display string. Negative cents
  // (e.g. a spend row shown directly) clamps to 0 — the popup that
  // displays a spend already prints its own "-" prefix.
  function fmtDollars(cents) {
    const c = Math.max(0, Math.round(Number(cents) || 0));
    return '$' + (c / 100).toFixed(2);
  }

  // ---------- time economy (reward wheel + ⏰ spending) ----------
  //  A ledger of earn / spend rows. Balance is summed client-side.
  //  Run edu/supabase-add-time-economy.sql once before use.
  const time = {
    async list(userId) {
      if (!userId) return [];
      return rGet('/wc_time_entries?select=*&user_id=eq.'
        + encodeURIComponent(userId) + '&order=created_at.desc');
    },
    async add(userId, kind, minutes, memo) {
      if (!REST || !userId) return null;
      const rows = await rPost('/wc_time_entries', {
        user_id: userId,
        kind:    kind === 'spend' ? 'spend' : 'earn',
        minutes: Math.max(0, Math.round(Number(minutes) || 0)),
        memo:    (memo && String(memo).trim()) || null,
      }, true);
      return rows && rows[0];
    },
  };

  // ---------- voice recordings (Record mode) ----------
  //  One row per take; the audio blob lives in Storage. Run
  //  edu/supabase-add-recordings.sql once before use.
  const recordingsDb = {
    async list(userId, lessonId) {
      if (!userId || !lessonId) return [];
      return rGet('/wc_recordings?select=*&user_id=eq.'
        + encodeURIComponent(userId) + '&lesson_id=eq.'
        + encodeURIComponent(lessonId) + '&order=created_at.asc');
    },
    async add(row) {
      const rows = await rPost('/wc_recordings', row, true);
      return rows && rows[0];
    },
    async remove(id) {
      if (!id) return true;
      return rDelete('/wc_recordings?id=eq.' + encodeURIComponent(id));
    },
    // Make take `takeN` the only selected take for this line (pass
    // null to clear the selection entirely).
    async setSelected(userId, lessonId, sentenceKey, takeN) {
      if (!REST || !userId || !lessonId) return false;
      const scope = '/wc_recordings?user_id=eq.' + encodeURIComponent(userId)
        + '&lesson_id=eq.' + encodeURIComponent(lessonId)
        + '&sentence_key=eq.' + encodeURIComponent(sentenceKey);
      await rPatch(scope, { selected: false });
      if (takeN != null) {
        await rPatch(scope + '&take_n=eq.' + encodeURIComponent(takeN), { selected: true });
      }
      return true;
    },
  };

  // ---------- Storage (lesson / panel images) ----------
  //  Panel images move out of the wc_lessons.images jsonb blob into
  //  a public Storage bucket so the lesson row stays small and the
  //  images get CDN caching. uploadDataUrl() takes a data: URL (the
  //  shape teacher.js's downscaleImage already produces) and returns
  //  the public URL to store on the image record.
  //  Run edu/supabase-add-comic-storage.sql once before use.
  const storage = {
    BUCKET: 'wc-lesson-images',
    // Upload any Blob (panel image, mp3, …) to the bucket and return
    // its public URL. `folder` namespaces the object (panels / audio).
    async uploadBlob(blob, ext, folder) {
      if (!URL) throw new Error('Supabase not configured');
      const base = URL.replace(/\/+$/, '');
      const path = (folder || 'panels') + '/' + Date.now().toString(36) + '-'
        + Math.random().toString(36).slice(2, 10) + '.' + (ext || 'bin');
      const r = await fetch(base + '/storage/v1/object/' + storage.BUCKET + '/' + path, {
        method: 'POST',
        headers: {
          apikey:         ANON,
          Authorization:  'Bearer ' + ANON,
          'Content-Type': blob.type || 'application/octet-stream',
          'x-upsert':     'true',
        },
        body: blob,
      });
      if (!r.ok) {
        throw new Error('WCDB storage upload ' + r.status + ' :: '
          + (await r.text().catch(() => '')).slice(0, 200));
      }
      return base + '/storage/v1/object/public/' + storage.BUCKET + '/' + path;
    },
    // Convenience: decode a data: URL to a Blob and upload it.
    async uploadDataUrl(dataUrl) {
      const m = /^data:([^;,]+)[^,]*,(.*)$/.exec(String(dataUrl || ''));
      if (!m) throw new Error('not a data URL');
      const mime = m[1] || 'image/jpeg';
      const bin  = atob(m[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const ext  = /png/i.test(mime) ? 'png' : (/webp/i.test(mime) ? 'webp' : 'jpg');
      return storage.uploadBlob(new Blob([bytes], { type: mime }), ext, 'panels');
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

  // ---------- animal hearts ----------
  //  Single-vote-per-user "heart" on an animal. user_id is PK in
  //  wc_animal_hearts, so the upsert silently replaces an existing
  //  vote (after the change-confirm popup the UI shows).
  const animalHearts = {
    async listAll() {
      // Joined with the user row so we get the real_name in one hop.
      return rGet('/wc_animal_hearts?select=user_id,animal_id,updated_at,user:wc_users(real_name)&order=updated_at.desc');
    },
    async forUser(userId) {
      if (!userId) return null;
      const rows = await rGet('/wc_animal_hearts?user_id=eq.'
        + encodeURIComponent(userId) + '&select=animal_id&limit=1');
      return rows && rows[0] && rows[0].animal_id || null;
    },
    async setHeart(userId, animalId) {
      if (!REST) throw new Error('Supabase not configured');
      const r = await fetch(REST + '/wc_animal_hearts?on_conflict=user_id', {
        method: 'POST',
        headers: headers({
          Prefer: 'return=minimal,resolution=merge-duplicates',
        }),
        body: JSON.stringify({
          user_id:    userId,
          animal_id:  animalId,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!r.ok) throw new Error('WCDB heart-set ' + r.status + ' :: ' + (await r.text()).slice(0, 200));
    },
    // Removes the user's heart entirely — used by the "unheart"
    // flow on both index.html and animal-detail.html. After
    // clearing, the user has no heart anywhere.
    async clearHeart(userId) {
      if (!REST) throw new Error('Supabase not configured');
      const r = await fetch(REST + '/wc_animal_hearts?user_id=eq.' + encodeURIComponent(userId), {
        method: 'DELETE',
        headers: headers({ Prefer: 'return=minimal' }),
      });
      if (!r.ok) throw new Error('WCDB heart-clear ' + r.status);
    },
  };

  // ---------- animal comments + contributions ----------
  //  Comments are a threaded discussion on each animal page.
  //  Contributions track which user added content to which animal
  //  (idempotent — one row per (animal, user)) so we can:
  //    • show the comment box only on animals with any contributor;
  //    • allow only users who have added content somewhere to POST.
  const animalComments = {
    async listForAnimal(animalId) {
      return rGet('/wc_animal_comments?animal_id=eq.' + encodeURIComponent(animalId)
        + '&select=*&order=created_at.asc');
    },
    async post({ animalId, parentId, authorId, authorName, text }) {
      const rows = await rPost('/wc_animal_comments', {
        animal_id:   animalId,
        parent_id:   parentId || null,
        author_id:   authorId || null,
        author_name: authorName || 'Anonymous',
        text:        text,
      }, true);
      return rows && rows[0];
    },
    // Edit the body of an existing comment. Caller must enforce
    // permission (author of the row, or a teacher). We also bump
    // an `edited_at` timestamp so the UI can render "(edited)".
    async update(commentId, text) {
      if (!commentId) throw new Error('comment id required');
      return rPatch('/wc_animal_comments?id=eq.' + encodeURIComponent(commentId), {
        text:      text,
        edited_at: new Date().toISOString(),
      });
    },
    // Remove a comment row. Any replies that pointed at it become
    // orphans — the renderer promotes orphans back to top level so
    // the thread stays readable.
    async remove(commentId) {
      if (!commentId) throw new Error('comment id required');
      return rDelete('/wc_animal_comments?id=eq.' + encodeURIComponent(commentId));
    },
  };

  const animalContributions = {
    async hasAny(userId) {
      if (!userId) return false;
      const rows = await rGet('/wc_animal_contributions?contributor_id=eq.'
        + encodeURIComponent(userId) + '&select=animal_id&limit=1');
      return !!(rows && rows.length);
    },
    async hasAnyOnAnimal(animalId) {
      const rows = await rGet('/wc_animal_contributions?animal_id=eq.'
        + encodeURIComponent(animalId) + '&select=contributor_id&limit=1');
      return !!(rows && rows.length);
    },
    // Idempotent — upserts a (animal_id, contributor_id) row.
    async record(animalId, user) {
      if (!user || !user.id) return;
      if (!REST) return;
      try {
        await fetch(REST + '/wc_animal_contributions?on_conflict=animal_id,contributor_id', {
          method: 'POST',
          headers: headers({
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify({
            animal_id:        animalId,
            contributor_id:   user.id,
            contributor_name: user.real_name || user.name || null,
          }),
        });
      } catch (e) { /* non-fatal */ }
    },
  };

  // ---------- reward fade (SDT internalization) ----------
  //  Maps a student's cumulative pages-read to a 0.25–1.0 "reward
  //  intensity". 1.0 = full rewards (habit-forming phase); it decays
  //  linearly over `span` pages to a 0.25 floor so extrinsic rewards
  //  (quiz frequency, word coins, the screen-time wheel) thin out —
  //  but never vanish — as reading becomes a habit. `flags` is the
  //  class hide_features JSONB; `rewardFade` is the teacher preset
  //  (off/slow/normal/fast). Unset / 'off' → no fade (always 1.0),
  //  so existing classes behave exactly as before until opted in.
  function rewardIntensity(totalPages, flags) {
    const span = { slow: 600, normal: 300, fast: 150 }[flags && flags.rewardFade] || 0;
    if (!span) return 1;
    const FLOOR = 0.25;
    const p = Math.max(0, Number(totalPages) || 0);
    return Math.max(FLOOR, Math.min(1, 1 - p / span));
  }

  window.WCDB = { classes, users, lessons, wordStates, pets, viz, encounters, realtime, insights, animalHearts, animalComments, animalContributions, progress, storage, time, money, fmtDollars, recordingsDb, rewardIntensity };
})();
