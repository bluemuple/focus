// Storage adapter for the English Learning site.
//
// Two backends:
//   • Supabase: when SUPABASE_CONFIG is filled in AND user is signed in.
//   • localStorage: "Try it" mode, or whenever Supabase isn't available.
//
// Expected Supabase tables:
//   lessons (id uuid pk default gen_random_uuid(),
//            user_id uuid references auth.users(id),
//            title text, body text, audio_url text,
//            created_at timestamptz default now())
//   word_states (id uuid pk default gen_random_uuid(),
//                user_id uuid, word text,
//                state int default 0, last_clicked_date date,
//                unique(user_id, word))
//   Storage bucket: "audio" (public read recommended, owner write).

(() => {
  const SUPABASE_URL  = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url)  || '';
  const SUPABASE_ANON = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.anon) || '';

  const haveSupabase = !!(SUPABASE_URL && SUPABASE_ANON && window.supabase);
  // No custom storageKey — we want to share the auth session with the parent
  // Focus app, which uses Supabase's default storage key. One sign-in covers both.
  const sb = haveSupabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: true, autoRefreshToken: true }
      })
    : null;

  const LS = 'eng.v1.';
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(LS+k); return v==null?d:JSON.parse(v); } catch(e){ return d; } },
    set(k, v) { try { localStorage.setItem(LS+k, JSON.stringify(v)); } catch(e){} },
    del(k)    { try { localStorage.removeItem(LS+k); } catch(e){} },
  };
  const uid = () => 'l_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const today = () => new Date().toISOString().slice(0,10);

  // Try-it mode: user pressed "체험하기" — local only, no auth.
  function setTryMode(on) { ls.set('try_mode', !!on); }
  function isTryMode() { return !!ls.get('try_mode', false); }

  // ---------- AUTH ----------
  let _user = null;
  async function currentUser() {
    if (!sb) return null;
    if (_user) return _user;
    const { data } = await sb.auth.getUser();
    _user = data && data.user ? data.user : null;
    return _user;
  }
  async function signUp(email, password) {
    if (!sb) throw new Error('Supabase가 설정되지 않았습니다.');
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    _user = data.user; return data;
  }
  async function signIn(email, password) {
    if (!sb) throw new Error('Supabase가 설정되지 않았습니다.');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    _user = data.user; return data;
  }
  async function signOut() {
    if (sb) await sb.auth.signOut();
    _user = null;
    setTryMode(false);
  }

  // Returns true when we should hit Supabase, false to use localStorage.
  // A real Supabase session always trumps a leftover `try_mode` flag — once
  // the user has signed in (here, or in the parent Bidoro app at the same
  // origin), every read/write should go to the cloud.
  async function useCloud() {
    if (!sb) return false;
    const u = await currentUser();
    if (u) return true;
    return false;
  }

  // ---------- LESSONS ----------
  async function listLessons() {
    if (await useCloud()) {
      const u = await currentUser();
      const { data, error } = await sb.from('lessons')
        .select('*').eq('user_id', u.id).order('created_at', { ascending: false });
      if (error) { console.error(error); return ls.get('lessons', []); }
      return data || [];
    }
    return ls.get('lessons', []);
  }
  async function getLesson(id) {
    if (await useCloud()) {
      const { data, error } = await sb.from('lessons').select('*').eq('id', id).maybeSingle();
      if (error) { console.error(error); }
      if (data) return data;
    }
    return (ls.get('lessons', []) || []).find(x => x.id === id) || null;
  }
  async function addLesson({ title, body, audioFile, thumbFile }) {
    let audio_url = null;
    let thumbnail_url = null;

    async function uploadToAudioBucket(file, prefix) {
      const u = await currentUser();
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `${u.id}/${prefix}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('audio')
        .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
      if (upErr) { console.error('upload ' + prefix, upErr); return null; }
      const { data: pub } = sb.storage.from('audio').getPublicUrl(path);
      return (pub && pub.publicUrl) || null;
    }

    if (await useCloud()) {
      if (audioFile) audio_url     = await uploadToAudioBucket(audioFile, 'audio');
      if (thumbFile) thumbnail_url = await uploadToAudioBucket(thumbFile, 'thumb');
      const u = await currentUser();
      const row = { user_id: u.id, title, body, audio_url, thumbnail_url };
      const { data, error } = await sb.from('lessons').insert(row).select().single();
      if (error) {
        // If the schema is missing thumbnail_url (user hasn't run the ALTER TABLE
        // yet), retry without that column instead of breaking the whole flow.
        if (/thumbnail_url|bookmarked/.test(String(error.message || ''))) {
          const fallback = { user_id: u.id, title, body, audio_url };
          const r2 = await sb.from('lessons').insert(fallback).select().single();
          if (r2.error) { console.error(r2.error); throw r2.error; }
          return r2.data;
        }
        console.error(error); throw error;
      }
      return data;
    }

    // localStorage path
    if (audioFile) audio_url     = await fileToDataURL(audioFile);
    if (thumbFile) thumbnail_url = await fileToDataURL(thumbFile);
    const list = ls.get('lessons', []);
    const row = {
      id: uid(), title, body, audio_url, thumbnail_url,
      bookmarked: false,
      created_at: new Date().toISOString(),
    };
    list.unshift(row); ls.set('lessons', list);
    return row;
  }

  async function setBookmark(lessonId, on) {
    on = !!on;
    if (await useCloud()) {
      const { error } = await sb.from('lessons')
        .update({ bookmarked: on }).eq('id', lessonId);
      if (error) console.error('setBookmark', error);
      return on;
    }
    const list = ls.get('lessons', []);
    const i = list.findIndex(x => x.id === lessonId);
    if (i >= 0) { list[i].bookmarked = on; ls.set('lessons', list); }
    return on;
  }
  async function deleteLesson(id) {
    if (await useCloud()) {
      const { error } = await sb.from('lessons').delete().eq('id', id);
      if (error) console.error(error);
      return;
    }
    ls.set('lessons', ls.get('lessons', []).filter(x => x.id !== id));
  }

  // Rename: just updates the title field. Used by the gallery card's
  // kebab "수정" entry to do a quick inline rename without a full
  // re-import flow.
  async function renameLesson(id, newTitle) {
    newTitle = (newTitle || '').trim();
    if (!newTitle) return false;
    if (await useCloud()) {
      const { error } = await sb.from('lessons')
        .update({ title: newTitle }).eq('id', id);
      if (error) { console.error(error); return false; }
      return true;
    }
    const list = ls.get('lessons', []);
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return false;
    list[i].title = newTitle;
    ls.set('lessons', list);
    return true;
  }

  // ---------- WORD STATES ----------
  // State semantics (user-controlled, LingQ-style):
  //   -1 = ignored ("무시")                — no highlight
  //    0 = new, never advanced            — sky-blue highlight (default)
  //    1 = 새로운 단어                      — darkest green
  //    2 = 어디선가 본 단어                  — medium green
  //    3 = 익숙한 단어                      — light green
  //    4 = 배운 단어                        — pale green
  //    5 = 완전히 아는 단어                  — no highlight
  //
  // Click flow:
  //   1st click on an unseen word → row inserted at state 0 (still sky blue);
  //                                  caller shows the meaning only, no badge.
  //   2nd click on a state-0 word → auto-advance to state 1, badge appears.
  //   click on a state ≥ 1 word   → no auto change. User picks via the menu.
  async function loadWordStates() {
    if (await useCloud()) {
      const u = await currentUser();
      const { data, error } = await sb.from('word_states').select('*').eq('user_id', u.id);
      if (error) { console.error(error); return ls.get('word_states', {}); }
      const m = {};
      for (const r of data || []) m[r.word] = { state: r.state, last: r.last_clicked_date };
      return m;
    }
    return ls.get('word_states', {});
  }

  async function clickWord(word) {
    word = (word || '').toLowerCase();
    if (!word) return null;
    const t = today();

    function decide(prevState) {
      if (prevState === undefined || prevState === null) {
        return { state: 0, isFirstClick: true,  justAdvanced: false };
      }
      if (prevState === 0) {
        return { state: 1, isFirstClick: false, justAdvanced: true  };
      }
      return { state: prevState, isFirstClick: false, justAdvanced: false };
    }

    if (await useCloud()) {
      const u = await currentUser();
      const { data: existing } = await sb.from('word_states')
        .select('*').eq('user_id', u.id).eq('word', word).maybeSingle();
      const d = decide(existing ? existing.state : null);
      const row = { user_id: u.id, word, state: d.state, last_clicked_date: t };
      const { error } = await sb.from('word_states')
        .upsert(row, { onConflict: 'user_id,word' });
      if (error) console.error(error);
      return { ...d, last: t };
    }

    const map = ls.get('word_states', {});
    const cur = map[word];
    const d = decide(cur ? cur.state : null);
    map[word] = { state: d.state, last: t };
    ls.set('word_states', map);
    return { ...d, last: t };
  }

  // Explicitly set the state from the picker menu. newState ∈ {-1, 1, 2, 3, 4, 5}.
  async function setWordState(word, newState) {
    word = (word || '').toLowerCase();
    if (!word) return null;
    const t = today();

    if (await useCloud()) {
      const u = await currentUser();
      const row = { user_id: u.id, word, state: newState, last_clicked_date: t };
      const { error } = await sb.from('word_states')
        .upsert(row, { onConflict: 'user_id,word' });
      if (error) console.error(error);
      return { state: newState, last: t };
    }
    const map = ls.get('word_states', {});
    map[word] = { state: newState, last: t };
    ls.set('word_states', map);
    return map[word];
  }

  // ---------- helpers ----------
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // ---------- hearted words (for the quiz / word-practice deck) ----------
  // Stored locally for now; can sync via a Supabase column later if needed.
  function getHearted() {
    return new Set(ls.get('hearted', []) || []);
  }
  function setHearted(word, on) {
    const s = getHearted();
    const k = (word || '').toLowerCase();
    if (!k) return false;
    if (on) s.add(k); else s.delete(k);
    ls.set('hearted', [...s]);
    return s.has(k);
  }
  function isHearted(word) {
    return getHearted().has((word || '').toLowerCase());
  }

  // ---------- saved phrases (built up via the "이어서" mode add button) ----
  function listPhrases() { return ls.get('phrases', []) || []; }
  function addPhrase(phrase, koTranslation, lessonId) {
    if (!phrase) return null;
    const list = listPhrases();
    list.unshift({
      id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      phrase, ko: koTranslation || '', lessonId: lessonId || null,
      created_at: new Date().toISOString(),
    });
    ls.set('phrases', list);
    return list[0];
  }
  function deletePhrase(id) {
    const list = listPhrases().filter(p => p.id !== id);
    ls.set('phrases', list);
  }

  // ---------- Word Master (state ≥ ?) + Word Stories ----------
  // A "mastered" word is one the user has placed at level 3, 4, or 5
  // (익숙한 단어 / 배운 단어 / 완전히 아는 단어). The home page surfaces
  // these in the 워드 마스터 section and uses their TOTAL count to decide
  // when to mint a new auto-generated 단어 스토리.
  //
  // Threshold for the (n+1)-th story (cumulative mastered-word count):
  //   stories  1..10 → +10 each
  //   stories 11..30 → +15 each
  //   stories 31..   → +25 each
  function thresholdForNthStory(n) {
    let total = 0;
    for (let i = 1; i <= n; i++) {
      total += (i <= 10) ? 10 : (i <= 30) ? 15 : 25;
    }
    return total;
  }
  // Count how many distinct words are currently at state 3, 4 or 5.
  // Caller passes the live word_states map (cloud or local — same shape).
  function countMastered(wordStates) {
    let n = 0;
    for (const v of Object.values(wordStates || {})) {
      if (v && v.state >= 3 && v.state <= 5) n++;
    }
    return n;
  }

  function listStories() { return ls.get('stories', []) || []; }
  function addStory(s)   {
    const list = listStories();
    list.unshift(s);
    ls.set('stories', list);
    return s;
  }
  function deleteStory(id) {
    ls.set('stories', listStories().filter(s => s.id !== id));
  }

  // ---------- cross-device user_state sync ----------
  // Small key/value store (Supabase table `user_state`) used to keep
  // device-private prefs (money, streak) consistent across PC + mobile.
  // Strategy is intentionally simple: the client always reads / writes
  // the WHOLE blob for a given key; conflicts are last-writer-wins.
  //
  // Apply supabase-sql/user_state.sql once before this works.
  async function _fetchUserState(key) {
    if (!(await useCloud())) return undefined;
    const u = await currentUser();
    const { data, error } = await sb.from('user_state')
      .select('value').eq('user_id', u.id).eq('key', key).maybeSingle();
    if (error) {
      // Table missing / RLS misconfigured — log once, fall back to local.
      console.warn('[user_state] fetch ' + key, error.message || error);
      return undefined;
    }
    return data ? data.value : null;          // null means "no row yet"
  }
  async function _pushUserState(key, value) {
    if (!(await useCloud())) return;
    const u = await currentUser();
    const row = {
      user_id: u.id, key,
      value, updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from('user_state')
      .upsert(row, { onConflict: 'user_id,key' });
    if (error) console.warn('[user_state] push ' + key, error.message || error);
  }
  // Pull every synced key down once at app start. Local copy is replaced
  // when the cloud has a value — that's how the user's mobile picks up
  // money earned on PC. After this call, every mutation pushes back up.
  let _bootstrapped = false;
  async function bootstrapUserState() {
    if (_bootstrapped) return;
    _bootstrapped = true;
    if (!(await useCloud())) return;
    try {
      const [money, streak] = await Promise.all([
        _fetchUserState('money'),
        _fetchUserState('streak'),
      ]);
      if (money)  ls.set('money',  money);
      if (streak) ls.set('streak', streak);
    } catch (e) {
      console.warn('[user_state] bootstrap', e);
    }
  }

  // ---------- streak (연속 학습일) ----------
  // Counts a "day" the user has done a lesson (we call recordLessonVisit
  // when the lesson page loads). The streak resets if they skip a day.
  function _ymd(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }
  function _yesterday() {
    return _ymd(new Date(Date.now() - 86400000));
  }
  function getStreak() {
    return ls.get('streak', { lastDay: '', count: 0, days: [] }) || { lastDay: '', count: 0, days: [] };
  }
  function recordLessonVisit() {
    const today = _ymd();
    const s = getStreak();
    if (s.lastDay === today) return s;            // already counted today
    if (s.lastDay === _yesterday()) s.count = (s.count || 0) + 1;
    else                            s.count = 1;
    s.lastDay = today;
    s.days = Array.from(new Set([...(s.days || []), today]));
    ls.set('streak', s);
    _pushUserState('streak', s);                  // fire-and-forget cloud sync
    return s;
  }

  // ---------- money (NZD earned per word click) ----------
  // Rule: every 3 *unique-in-a-row* clicks earns 1 cent. Daily cap = 200 c.
  // Same word clicked twice in a row → counts as one. Pattern A→B→A → 3.
  function _moneyData() {
    return ls.get('money', {
      daily:    {},   // { 'YYYY-MM-DD': cents earned that day (max 200) }
      expenses: [],   // [{ date, cents, note }]
      runCount: 0,    // 0..2; on each unique click ++; at 3 → +1c then reset
      lastWord: '',   // dedupes consecutive same-word clicks
    }) || {};
  }
  function recordMoneyClick(word) {
    word = (word || '').toLowerCase();
    const d = _moneyData();
    if (!word) return d;
    if (word === d.lastWord) return d;            // same word twice → skip
    d.lastWord = word;
    d.runCount = (d.runCount || 0) + 1;
    let earnedCent = false;
    if (d.runCount >= 3) {
      d.runCount = 0;
      const t = _ymd();
      d.daily[t] = Math.min(200, (d.daily[t] || 0) + 1);
      earnedCent = true;
    }
    ls.set('money', d);
    // Push every 3rd click (when a cent actually lands) — that's the only
    // change other devices need to see. Skipping the in-between increments
    // avoids hammering Supabase on every word click.
    if (earnedCent) _pushUserState('money', d);
    return d;
  }
  function getTodayCents() {
    const d = _moneyData();
    return d.daily[_ymd()] || 0;
  }
  function getTotalCents() {
    const d = _moneyData();
    let total = 0;
    for (const v of Object.values(d.daily || {})) total += v;
    for (const e of (d.expenses || [])) total -= (e.cents || 0);
    return total;
  }
  function getDailyHistory(days) {
    days = days || 7;
    const d = _moneyData();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 86400000);
      const key = _ymd(dt);
      out.push({ date: key, cents: d.daily[key] || 0 });
    }
    return out;
  }
  function listExpenses() {
    return (_moneyData().expenses || []).slice();
  }
  function addExpense(cents, note) {
    cents = Math.max(0, Math.floor(Number(cents) || 0));
    if (!cents) return null;
    const d = _moneyData();
    d.expenses = d.expenses || [];
    const e = { date: _ymd(), cents, note: (note || '').trim() };
    d.expenses.unshift(e);
    ls.set('money', d);
    _pushUserState('money', d);                   // sync expense to cloud
    return e;
  }

  // ---------- mastered words (state 5) ----------
  // Returns words with state===5 sorted by their `last` timestamp newest first.
  function listMasteredWords(wordStates) {
    const arr = [];
    for (const [w, v] of Object.entries(wordStates || {})) {
      if (v && v.state === 5) arr.push({ word: w, last: v.last || '' });
    }
    arr.sort((a, b) => (b.last || '').localeCompare(a.last || ''));
    return arr;
  }

  // ---------- spaced-repetition state (SM-2 lite) ----------
  // Per word: { ef: ease factor, interval: days, due: ms timestamp }.
  // Stored locally (the quiz/practice flows are device-private for now).
  const SR_KEY = 'review';
  function getReviewStates() { return ls.get(SR_KEY, {}) || {}; }
  function getReview(word) {
    const k = (word || '').toLowerCase();
    const all = getReviewStates();
    return all[k] || { ef: 2.5, interval: 0, due: Date.now() };
  }
  function rateReview(word, rating) {
    // rating: 0 = "다시" (forgot), 1 = "알겠음" (good), 2 = "쉬움" (easy)
    const k = (word || '').toLowerCase();
    if (!k) return;
    const all = getReviewStates();
    const cur = all[k] || { ef: 2.5, interval: 0, due: Date.now() };
    let { ef, interval } = cur;
    if (rating === 0) {
      interval = 0;             // see again in ~1 min
      ef = Math.max(1.3, ef - 0.2);
    } else if (rating === 1) {
      if (interval < 1) interval = 1;
      else interval = Math.round(interval * ef);
    } else {
      if (interval < 1) interval = 3;
      else interval = Math.round(interval * ef * 1.3);
      ef = Math.min(3.0, ef + 0.15);
    }
    const dueMs = (rating === 0 ? 60 * 1000 : interval * 86400 * 1000);
    all[k] = { ef, interval, due: Date.now() + dueMs };
    ls.set(SR_KEY, all);
    return all[k];
  }
  // List hearted words sorted by due (overdue first), capped at `cap`.
  function dueWordsForPractice(cap) {
    const hearted = [...getHearted()];
    if (!hearted.length) return [];
    const all = getReviewStates();
    const now = Date.now();
    const ranked = hearted.map(w => {
      const r = all[w] || { ef: 2.5, interval: 0, due: now };
      return { word: w, due: r.due };
    });
    // Overdue (due <= now) first, then nearest-future. Random tiebreaker.
    ranked.sort((a, b) => (a.due - b.due) || (Math.random() - 0.5));
    return ranked.slice(0, cap || 20).map(x => x.word);
  }

  window.DB = {
    haveSupabase,
    isTryMode, setTryMode,
    currentUser, signIn, signUp, signOut,
    listLessons, getLesson, addLesson, deleteLesson, setBookmark, renameLesson,
    loadWordStates, clickWord, setWordState,
    getHearted, setHearted, isHearted,
    listPhrases, addPhrase, deletePhrase,
    getReview, rateReview, dueWordsForPractice,
    countMastered, thresholdForNthStory,
    listStories, addStory, deleteStory,
    getStreak, recordLessonVisit,
    recordMoneyClick, getTodayCents, getTotalCents,
    getDailyHistory, listExpenses, addExpense,
    listMasteredWords,
    bootstrapUserState,
    useCloud,
  };
})();
