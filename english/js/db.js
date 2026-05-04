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
  async function useCloud() {
    if (!sb) return false;
    if (isTryMode()) return false;
    const u = await currentUser();
    return !!u;
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
  async function addLesson({ title, body, audioFile }) {
    let audio_url = null;

    if (await useCloud()) {
      const u = await currentUser();
      if (audioFile) {
        const ext = (audioFile.name.split('.').pop() || 'mp3').toLowerCase();
        const path = `${u.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage.from('audio')
          .upload(path, audioFile, { upsert: false, contentType: audioFile.type || 'audio/mpeg' });
        if (upErr) { console.error('audio upload', upErr); }
        else {
          const { data: pub } = sb.storage.from('audio').getPublicUrl(path);
          audio_url = pub && pub.publicUrl ? pub.publicUrl : null;
        }
      }
      const { data, error } = await sb.from('lessons').insert({
        user_id: u.id, title, body, audio_url
      }).select().single();
      if (error) { console.error(error); throw error; }
      return data;
    }

    // localStorage path
    if (audioFile) {
      audio_url = await fileToDataURL(audioFile);
    }
    const list = ls.get('lessons', []);
    const row = { id: uid(), title, body, audio_url, created_at: new Date().toISOString() };
    list.unshift(row); ls.set('lessons', list);
    return row;
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
  // State semantics:
  //   0 = new (light green)            - never clicked
  //   1 = seen (light orange)          - clicked at least once today's session-start
  //   2 = known1 (light green-known)
  //   3 = known2 (light purple)
  //   4 = known3 (light pink)
  //   5 = mastered (light grey)
  //
  // On click:
  //   - If never seen → state 1.
  //   - Else if last_clicked_date === today → no level change.
  //   - Else (clicked on a different day) → state = min(state+1, 5).
  //   Last_clicked_date is always updated to today.
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

    if (await useCloud()) {
      const u = await currentUser();
      const { data: existing } = await sb.from('word_states')
        .select('*').eq('user_id', u.id).eq('word', word).maybeSingle();
      let state = 1;
      if (existing) {
        state = (existing.last_clicked_date === t)
          ? existing.state
          : Math.min((existing.state || 0) + 1, 5);
      }
      const row = { user_id: u.id, word, state, last_clicked_date: t };
      const { error } = await sb.from('word_states')
        .upsert(row, { onConflict: 'user_id,word' });
      if (error) console.error(error);
      return { state, last: t };
    }

    const map = ls.get('word_states', {});
    const cur = map[word];
    let state = 1;
    if (cur) {
      state = (cur.last === t) ? cur.state : Math.min((cur.state || 0) + 1, 5);
    }
    map[word] = { state, last: t };
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

  window.DB = {
    haveSupabase,
    isTryMode, setTryMode,
    currentUser, signIn, signUp, signOut,
    listLessons, getLesson, addLesson, deleteLesson,
    loadWordStates, clickWord,
    useCloud,
  };
})();
