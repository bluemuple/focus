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

  window.DB = {
    haveSupabase,
    isTryMode, setTryMode,
    currentUser, signIn, signUp, signOut,
    listLessons, getLesson, addLesson, deleteLesson, setBookmark,
    loadWordStates, clickWord, setWordState,
    getHearted, setHearted, isHearted,
    listPhrases, addPhrase,
    useCloud,
  };
})();
