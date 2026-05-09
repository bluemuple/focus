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
  // EXPLICIT storageKey — separates this app's auth session from the
  // parent Bidoro app (which uses 'sb-bidoro-auth'). When both apps shared
  // the default `sb-<projectRef>-auth-token` key, simultaneous auto-
  // refresh attempts from the two tabs would race and one would get
  // an "invalid_grant" error → SIGNED_OUT cascade that wiped the shared
  // storage and logged BOTH apps out. Independent keys = independent
  // refresh cycles, no race. Trade-off: the user signs in to each app
  // separately (no SSO), which the user explicitly opted into for
  // stability over convenience.
  const sb = haveSupabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'sb-tobaktobak-auth',
        }
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

  // ---------- target-language switching ----------
  // 'en' (default) | 'ja'. The whole app's per-language data —
  // streak, money, mastered, lessons, word states, phrases, corpora,
  // quiz cards — is namespaced by this value so the same account can
  // hold separate progress for each language. Persisted to
  // localStorage; cloud rows carry a `language` column (added in the
  // Phase 2 migration). Language-aware localStorage helpers below
  // (lsLang) prefix keys with the current language so e.g.
  //   eng.v1.ja.streak vs eng.v1.streak (legacy English value).
  const LANG_KEY = 'language';
  const SUPPORTED_LANGS = ['en', 'ja'];
  function getLang() {
    const raw = ls.get(LANG_KEY, 'en');
    return SUPPORTED_LANGS.indexOf(raw) >= 0 ? raw : 'en';
  }
  function setLang(lang) {
    if (SUPPORTED_LANGS.indexOf(lang) < 0) return;
    ls.set(LANG_KEY, lang);
    try { window.dispatchEvent(new CustomEvent('eng:lang-changed', { detail: { lang } })); } catch (e) {}
  }
  // Language-namespaced localStorage. English keeps the original
  // un-prefixed keys (so existing user data isn't lost) — only
  // non-English languages get a prefix. This means migrating to
  // bilingual storage doesn't require any data move for current
  // English-only users.
  function langPrefix(k) {
    const lang = getLang();
    return lang === 'en' ? k : (lang + '.' + k);
  }
  const lsLang = {
    get(k, d) { return ls.get(langPrefix(k), d); },
    set(k, v) { return ls.set(langPrefix(k), v); },
    del(k)    { return ls.del(langPrefix(k)); },
  };

  // Try-it mode: user pressed "체험하기" — local only, no auth.
  function setTryMode(on) { ls.set('try_mode', !!on); }
  function isTryMode() { return !!ls.get('try_mode', false); }

  // ---------- AUTH ----------
  // `_user` is a fast in-memory cache; the source of truth is whatever
  // sb.auth.getSession() returns from local storage. We re-read the
  // session on every currentUser() call so a quietly-expired token
  // (e.g. ITP wiped the storage on iOS Safari) is detected immediately
  // instead of returning a stale user object that survives a real logout.
  let _user = null;
  async function currentUser() {
    if (!sb) return null;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { _user = null; return null; }
      // Defensive expiry check — autoRefreshToken handles this when the
      // network is up, but if a refresh failed silently we still want to
      // treat an expired session as signed-out rather than returning a
      // ghost user.
      const expSec = session.expires_at || 0;
      if (expSec && (expSec * 1000) < Date.now() - 5000) {
        _user = null;
        return null;
      }
      _user = session.user || null;
      return _user;
    } catch (e) {
      console.warn('[auth] getSession failed', e);
      _user = null;
      return null;
    }
  }

  // React to login / logout events from anywhere — Supabase fires these
  // when a token refresh fails, when the user signs out in another tab,
  // when the parent Bidoro app signs in/out with a shared session, when
  // ITP wipes storage, etc. We update the cached user and dispatch a
  // window event so auth.js can re-show / dismiss the login modal.
  if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
      _user = (session && session.user) || null;
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        try {
          window.dispatchEvent(new CustomEvent('eng:signed-out', { detail: { event } }));
        } catch (e) {}
      } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // Cross-tab / cross-app sign-in: the parent Bidoro app shares the
        // Supabase storage key with us, so a sign-in there fires SIGNED_IN
        // here. Surface it so a modal that's currently up can auto-dismiss.
        try {
          window.dispatchEvent(new CustomEvent('eng:signed-in', { detail: { event, user: session.user } }));
        } catch (e) {}
      }
    });
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
        .select('*')
        .eq('user_id', u.id)
        .eq('language', getLang())          // bilingual separation (Phase 2)
        .order('created_at', { ascending: false });
      if (error) { console.error(error); return lsLang.get('lessons', []); }
      return data || [];
    }
    return lsLang.get('lessons', []);
  }
  // Like listLessons() but WITHOUT the user_id filter — pulls every
  // lesson visible to the current account (subject to RLS policies on
  // the `lessons` table). Used by the corpora popup so the user sees
  // example sentences from across the whole site, not just their own
  // lessons. We only request the columns we actually need (id, title,
  // body) to keep the payload small even when there are many lessons.
  async function listAllLessons() {
    if (await useCloud()) {
      const { data, error } = await sb.from('lessons')
        .select('id,title,body')
        .eq('language', getLang())          // corpora is per-language too
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error);
        // Fallback: return whatever's locally cached (the user's own).
        return lsLang.get('lessons', []);
      }
      return data || [];
    }
    return lsLang.get('lessons', []);
  }
  async function getLesson(id) {
    // Lesson IDs are globally unique, so no language filter needed —
    // a JP lesson will simply have language='ja' on its returned row,
    // and the lesson page can read that field if it ever needs to
    // distinguish (e.g. to apply JP-specific tokenization).
    if (await useCloud()) {
      const { data, error } = await sb.from('lessons').select('*').eq('id', id).maybeSingle();
      if (error) { console.error(error); }
      if (data) return data;
    }
    return (lsLang.get('lessons', []) || []).find(x => x.id === id) || null;
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
      const row = {
        user_id: u.id, title, body, audio_url, thumbnail_url,
        language: getLang(),                // Phase 2: tag every new lesson
      };
      const { data, error } = await sb.from('lessons').insert(row).select().single();
      if (error) {
        // If the schema is missing thumbnail_url / bookmarked / language
        // (user hasn't run the ALTER TABLE yet), retry without those
        // columns instead of breaking the whole flow.
        if (/thumbnail_url|bookmarked|language/.test(String(error.message || ''))) {
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
    const list = lsLang.get('lessons', []);
    const row = {
      id: uid(), title, body, audio_url, thumbnail_url,
      bookmarked: false,
      language: getLang(),
      created_at: new Date().toISOString(),
    };
    list.unshift(row); lsLang.set('lessons', list);
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
    const list = lsLang.get('lessons', []);
    const i = list.findIndex(x => x.id === lessonId);
    if (i >= 0) { list[i].bookmarked = on; lsLang.set('lessons', list); }
    return on;
  }
  async function deleteLesson(id) {
    if (await useCloud()) {
      const { error } = await sb.from('lessons').delete().eq('id', id);
      if (error) console.error(error);
      return;
    }
    lsLang.set('lessons', lsLang.get('lessons', []).filter(x => x.id !== id));
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
    const list = lsLang.get('lessons', []);
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return false;
    list[i].title = newTitle;
    lsLang.set('lessons', list);
    return true;
  }

  // Full lesson edit: update title + body, optionally replace audio /
  // thumbnail (new files), or null them out (`clearAudio` /
  // `clearThumbnail`). The kebab "수정" menu on the home page now
  // routes to import.html?edit=<id> which gathers a full set of
  // changes and posts them in one call here.
  async function updateLesson(id, opts) {
    opts = opts || {};
    const patch = {};
    if (typeof opts.title === 'string') patch.title = opts.title.trim();
    if (typeof opts.body  === 'string') patch.body  = opts.body;

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
      if (opts.audioFile)        patch.audio_url     = await uploadToAudioBucket(opts.audioFile, 'audio');
      else if (opts.clearAudio)  patch.audio_url     = null;
      if (opts.thumbFile)        patch.thumbnail_url = await uploadToAudioBucket(opts.thumbFile, 'thumb');
      else if (opts.clearThumbnail) patch.thumbnail_url = null;
      const { error } = await sb.from('lessons').update(patch).eq('id', id);
      if (error) { console.error('updateLesson', error); return false; }
      return true;
    }

    // localStorage path: encode files as data-URLs.
    const list = lsLang.get('lessons', []);
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return false;
    if (opts.audioFile)        list[i].audio_url     = await fileToDataURL(opts.audioFile);
    else if (opts.clearAudio)  list[i].audio_url     = null;
    if (opts.thumbFile)        list[i].thumbnail_url = await fileToDataURL(opts.thumbFile);
    else if (opts.clearThumbnail) list[i].thumbnail_url = null;
    Object.assign(list[i], patch);
    lsLang.set('lessons', list);
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
      const { data, error } = await sb.from('word_states')
        .select('*')
        .eq('user_id', u.id)
        .eq('language', getLang());            // bilingual separation (Phase 2)
      if (error) { console.error(error); return lsLang.get('word_states', {}); }
      const m = {};
      for (const r of data || []) m[r.word] = { state: r.state, last: r.last_clicked_date };
      return m;
    }
    return lsLang.get('word_states', {});
  }

  async function clickWord(word) {
    word = (word || '').toLowerCase();
    if (!word) return null;
    const t = today();
    const lang = getLang();

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
        .select('*')
        .eq('user_id', u.id)
        .eq('language', lang)
        .eq('word', word)
        .maybeSingle();
      const d = decide(existing ? existing.state : null);
      const row = { user_id: u.id, language: lang, word, state: d.state, last_clicked_date: t };
      // Composite unique key changed in Phase 2: now (user_id, language, word)
      // so the same word can hold separate state per language.
      const { error } = await sb.from('word_states')
        .upsert(row, { onConflict: 'user_id,language,word' });
      if (error) console.error(error);
      return { ...d, last: t };
    }

    const map = lsLang.get('word_states', {});
    const cur = map[word];
    const d = decide(cur ? cur.state : null);
    map[word] = { state: d.state, last: t };
    lsLang.set('word_states', map);
    return { ...d, last: t };
  }

  // Explicitly set the state from the picker menu. newState ∈ {-1, 1, 2, 3, 4, 5}.
  async function setWordState(word, newState) {
    word = (word || '').toLowerCase();
    if (!word) return null;
    const t = today();
    const lang = getLang();

    if (await useCloud()) {
      const u = await currentUser();
      const row = { user_id: u.id, language: lang, word, state: newState, last_clicked_date: t };
      const { error } = await sb.from('word_states')
        .upsert(row, { onConflict: 'user_id,language,word' });
      if (error) console.error(error);
      return { state: newState, last: t };
    }
    const map = lsLang.get('word_states', {});
    map[word] = { state: newState, last: t };
    lsLang.set('word_states', map);
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
    return new Set(lsLang.get('hearted', []) || []);
  }
  function setHearted(word, on) {
    const s = getHearted();
    const k = (word || '').toLowerCase();
    if (!k) return false;
    if (on) s.add(k); else s.delete(k);
    lsLang.set('hearted', [...s]);
    return s.has(k);
  }
  function isHearted(word) {
    return getHearted().has((word || '').toLowerCase());
  }

  // ---------- saved phrases (built up via the "이어서" mode add button) ----
  function listPhrases() { return lsLang.get('phrases', []) || []; }
  function addPhrase(phrase, koTranslation, lessonId) {
    if (!phrase) return null;
    const list = listPhrases();
    list.unshift({
      id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      phrase, ko: koTranslation || '', lessonId: lessonId || null,
      created_at: new Date().toISOString(),
    });
    lsLang.set('phrases', list);
    return list[0];
  }
  function deletePhrase(id) {
    const list = listPhrases().filter(p => p.id !== id);
    lsLang.set('phrases', list);
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

  // Stories are language-namespaced via `lsLang` so EN and JP keep
  // separate collections — clicking 영어 mode shows English-prompt
  // stories, 일본어 mode shows Japanese-prompt stories. Existing EN
  // users keep their data: `lsLang` returns the bare key `'stories'`
  // for English (preserving backwards compatibility), and `'ja.stories'`
  // for Japanese (a fresh empty list on first JP entry).
  function listStories() { return lsLang.get('stories', []) || []; }
  function addStory(s)   {
    const list = listStories();
    list.unshift(s);
    lsLang.set('stories', list);
    return s;
  }
  function deleteStory(id) {
    lsLang.set('stories', listStories().filter(s => s.id !== id));
  }

  // ---------- cross-device user_state sync ----------
  // Stores small per-user JSON blobs (money, streak, …) in the AUTH user's
  // `user_metadata` JSONB column. This requires zero schema setup — every
  // signed-in Supabase user has a metadata field by default — so PC and
  // mobile sync immediately on signin without any SQL migration.
  //
  // Conflict model is intentionally simple: full-blob last-writer-wins.
  // Both devices push the entire blob on every mutation; the latest call
  // overrides the previous.
  //
  // Keys are namespaced with "eng_" so we don't collide with any metadata
  // a parent app (or future feature) writes to the same field. ALSO
  // namespaced by language so the same account can hold separate
  // streak / money / mastered counts per language. English keeps the
  // original un-suffixed keys to preserve every existing user's data;
  // Japanese and any future language gets `eng_<lang>_<key>`.
  function _mdKey(key) {
    const lang = getLang();
    return lang === 'en' ? ('eng_' + key) : ('eng_' + lang + '_' + key);
  }

  async function _fetchUserState(key) {
    if (!(await useCloud())) return undefined;
    try {
      // Force a fresh read so we see updates pushed from a sibling device.
      // `auth.getUser()` round-trips to Supabase to confirm the session +
      // returns the latest user_metadata. This is the lightest sync we have.
      const { data, error } = await sb.auth.getUser();
      if (error || !data || !data.user) {
        console.warn('[user_state] fetch ' + key, (error && error.message) || 'no user');
        return undefined;
      }
      _user = data.user;
      const md = data.user.user_metadata || {};
      const v = md[_mdKey(key)];
      return (v === undefined) ? null : v;
    } catch (e) {
      console.warn('[user_state] fetch ' + key, e);
      return undefined;
    }
  }
  async function _pushUserState(key, value) {
    if (!(await useCloud())) return;
    try {
      const u = await currentUser();
      // Merge — never wipe other entries that might be in user_metadata.
      const md = Object.assign({}, (u && u.user_metadata) || {});
      md[_mdKey(key)] = value;
      const { data, error } = await sb.auth.updateUser({ data: md });
      if (error) {
        console.warn('[user_state] push ' + key, error.message || error);
      } else if (data && data.user) {
        _user = data.user;
      }
    } catch (e) {
      console.warn('[user_state] push ' + key, e);
    }
  }
  // Pull every synced key down once at app start. Local copy is replaced
  // when the cloud has a value — that's how the user's mobile picks up
  // money earned on PC. After this call, every mutation pushes back up.
  let _bootstrapped = false;
  async function bootstrapUserState() {
    if (_bootstrapped) return;
    if (!(await useCloud())) return;     // try-mode / signed out → no-op
    try {
      const [money, streak] = await Promise.all([
        _fetchUserState('money'),
        _fetchUserState('streak'),
      ]);
      // Only mark bootstrapped on a successful round-trip — that way a
      // transient failure (offline, RLS hiccup) doesn't permanently
      // disable sync for this tab.
      _bootstrapped = true;
      if (money)  lsLang.set('money',  money);
      if (streak) lsLang.set('streak', streak);
      console.info('[user_state] synced down',
        money  ? ('money=' + JSON.stringify(money.daily || {})) : 'money=∅',
        streak ? ('streak=' + (streak.count || 0) + 'd')        : 'streak=∅');
    } catch (e) {
      console.warn('[user_state] bootstrap failed — will retry next load', e);
    }
  }
  // Flush any pending debounced money push when the user backgrounds the
  // tab or closes it. Without this, a quick "click → switch tabs" sequence
  // on mobile would lose the last bit of progress.
  if (typeof window !== 'undefined') {
    const flush = () => {
      if (_moneyPushT) {
        clearTimeout(_moneyPushT);
        _moneyPushT = null;
        _pushUserState('money', _moneyData());
      }
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
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
    return lsLang.get('streak', { lastDay: '', count: 0, days: [] }) || { lastDay: '', count: 0, days: [] };
  }
  function recordLessonVisit() {
    const today = _ymd();
    const s = getStreak();
    if (s.lastDay === today) return s;            // already counted today
    if (s.lastDay === _yesterday()) s.count = (s.count || 0) + 1;
    else                            s.count = 1;
    s.lastDay = today;
    s.days = Array.from(new Set([...(s.days || []), today]));
    lsLang.set('streak', s);
    _pushUserState('streak', s);                  // fire-and-forget cloud sync
    return s;
  }

  // ---------- money (NZD earned per word click) ----------
  // RANDOMIZED reward system (replaces the old deterministic
  // "1¢ per 3 unique clicks" rule):
  //
  //   • Each unique-in-a-row word click increments runCount.
  //   • A reward fires when runCount reaches `nextThreshold` — itself
  //     a fresh uniform random integer in [1, 9] each time.
  //   • Reward amount is drawn from a heavy-tail weighted distribution
  //     over [1¢, 15¢]; small amounts (1-7¢) are common, large
  //     amounts (8-15¢) are rare jackpots.
  //   • Expected value: ≈ 1.72¢ per trigger × (1 trigger / 5 clicks) ≈
  //     0.34¢ / click — preserves the long-run average of the old
  //     "1¢ per 3 clicks" rule (1/3 ≈ 0.33¢ / click).
  //   • Daily cap remains 200 c (overflow truncated to 0 for that
  //     trigger).
  //   • Same word clicked twice in a row → counts as one.
  //
  // recordMoneyClick(word) RETURNS the cent amount actually credited
  // for THIS click (0 if no reward fired or daily cap was hit). The
  // caller uses the return value to render the on-screen reward
  // indicator (small floater for 1-7¢, big bubble for 8-15¢).
  function _moneyData() {
    return lsLang.get('money', {
      daily:    {},   // { 'YYYY-MM-DD': cents earned that day (max 200) }
      expenses: [],   // [{ date, cents, note }]
      runCount: 0,
      nextThreshold: 1 + Math.floor(Math.random() * 9),  // 1..9 inclusive
      lastWord: '',   // dedupes consecutive same-word clicks
    }) || {};
  }
  function _drawRewardAmount() {
    // Weights tuned so the per-trigger expectation lands at ~1.72¢
    // (combined with avg threshold 5 → ~0.34¢ / click). Common: 1-3¢.
    // Mid: 4-7¢. Rare jackpots: 8-15¢ with steady decay.
    const weights = [
      1.000,   // 1¢
      0.400,   // 2¢
      0.160,   // 3¢
      0.064,   // 4¢
      0.026,   // 5¢
      0.010,   // 6¢
      0.004,   // 7¢
      0.0030,  // 8¢
      0.0024,  // 9¢
      0.0019,  // 10¢
      0.0015,  // 11¢
      0.0012,  // 12¢
      0.0009,  // 13¢
      0.0007,  // 14¢
      0.0005,  // 15¢
    ];
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i + 1;
    }
    return 1;
  }
  function recordMoneyClick(word) {
    word = (word || '').toLowerCase();
    const d = _moneyData();
    if (!word) return 0;
    if (word === d.lastWord) return 0;            // same word twice → skip
    d.lastWord = word;
    d.runCount = (d.runCount || 0) + 1;
    if (!d.nextThreshold || d.nextThreshold < 1 || d.nextThreshold > 9) {
      d.nextThreshold = 1 + Math.floor(Math.random() * 9);
    }
    let earned = 0;
    if (d.runCount >= d.nextThreshold) {
      const rolled = _drawRewardAmount();
      const t = _ymd();
      const room = Math.max(0, 200 - (d.daily[t] || 0));
      earned = Math.min(rolled, room);
      d.daily[t] = (d.daily[t] || 0) + earned;
      d.runCount = 0;
      d.nextThreshold = 1 + Math.floor(Math.random() * 9);
    }
    lsLang.set('money', d);
    // Sync EVERY mutation to Supabase (debounced ~500ms so a flurry of
    // taps coalesces into a single upsert). Pushing on every mutation
    // (not just cent-earn) keeps runCount / nextThreshold / lastWord
    // in sync across devices.
    _scheduleMoneyPush(d);
    return earned;
  }
  // Debounced push so a sequence of clicks doesn't fire one upsert per click.
  let _moneyPushT = null;
  function _scheduleMoneyPush(d) {
    if (_moneyPushT) clearTimeout(_moneyPushT);
    _moneyPushT = setTimeout(() => {
      _moneyPushT = null;
      _pushUserState('money', d);
    }, 500);
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
    lsLang.set('money', d);
    _pushUserState('money', d);                   // sync expense to cloud
    return e;
  }

  // ---------- resets (settings modal) ----------
  // Each reset blanks both the local cache AND the cloud copy so the same
  // user signed in on another device sees the cleared state on next sync.
  async function resetWordStates() {
    // Reset is per-language: blow away the CURRENT language's word
    // states only, leaving the other language's progress intact.
    if (await useCloud()) {
      try {
        const u = await currentUser();
        const { error } = await sb.from('word_states')
          .delete()
          .eq('user_id', u.id)
          .eq('language', getLang());
        if (error) console.warn('[reset] word_states', error.message || error);
      } catch (e) { console.warn('[reset] word_states', e); }
    }
    lsLang.set('word_states', {});
  }
  async function resetStreak() {
    const blank = { lastDay: '', count: 0, days: [] };
    lsLang.set('streak', blank);
    try { await _pushUserState('streak', blank); } catch (e) {}
  }
  async function resetMoney() {
    const blank = { daily: {}, expenses: [], runCount: 0, lastWord: '' };
    lsLang.set('money', blank);
    try { await _pushUserState('money', blank); } catch (e) {}
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
    getLang, setLang, SUPPORTED_LANGS,
    currentUser, signIn, signUp, signOut,
    listLessons, listAllLessons, getLesson, addLesson, deleteLesson, setBookmark, renameLesson, updateLesson,
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
    resetWordStates, resetStreak, resetMoney,
    useCloud,
  };
})();
