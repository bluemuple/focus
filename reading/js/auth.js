// =============================================================
//  WordCatch — auth (4-digit code, no Supabase auth)
//
//  "Logging in" = looking up the wc_users row whose login_code
//  matches the entered code AND whose real_name matches the
//  picked name. On success, the row is cached in localStorage
//  as `wc.session` and is what the rest of the app treats as
//  "the current user."
//
//  Why name + code instead of code only? Defence-in-depth
//  against guessing — a child could brute-force 10,000 codes
//  quickly otherwise. Requiring the right name first cuts
//  guessing down to the codes issued to that exact name (1 in
//  ~99% of cases). This is enough for a Year 4 class; Phase 7
//  will move validation server-side via an edge function and
//  add a rate-limit.
//
//  Exposes window.WCAuth:
//    .session()          → cached user row or null
//    .login(name, code)  → validates, caches, returns user row
//    .logout()           → wipes cache
//    .requireStudent(redirect)  → redirects to /reading/ if no session
//    .requireTeacher(redirect)  → redirects to /reading/ if not a teacher
// =============================================================

(() => {
  const KEY = 'wc.session.v1';

  function session() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function setSession(u) {
    try {
      if (u) localStorage.setItem(KEY, JSON.stringify(u));
      else localStorage.removeItem(KEY);
    } catch {}
  }

  async function login(name, code) {
    const cleanCode = String(code || '').trim();
    const cleanName = String(name || '').trim();
    if (!/^\d{4}$/.test(cleanCode)) throw new Error('Code must be 4 digits.');
    if (!cleanName)                 throw new Error('Please pick your name.');

    const user = await window.WCDB.users.byLoginCode(cleanCode);
    if (!user) throw new Error('That code isn’t right. Ask your teacher.');
    if (user.real_name !== cleanName) {
      throw new Error('That code doesn’t belong to ' + cleanName + '.');
    }

    setSession(user);
    window.WCDB.users.touchSeen(user.id).catch(() => {});
    return user;
  }

  function logout() { setSession(null); }

  function requireStudent(redirect) {
    const u = session();
    if (!u || u.role !== 'student') {
      window.location.href = redirect || './index.html';
      return null;
    }
    return u;
  }
  function requireTeacher(redirect) {
    const u = session();
    if (!u || u.role !== 'teacher') {
      window.location.href = redirect || './index.html';
      return null;
    }
    return u;
  }

  window.WCAuth = { session, login, logout, requireStudent, requireTeacher };
})();
