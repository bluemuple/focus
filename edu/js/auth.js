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
//    .requireStudent(redirect)  → redirects to /edu/ if no session
//    .requireTeacher(redirect)  → redirects to /edu/ if not a teacher
// =============================================================

(() => {
  const KEY          = 'wc.session.v1';
  const ORIGINAL_KEY = 'wc.session.original.v1';   // teacher's session, saved while impersonating

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

  // ----------------------------------------------------------------
  //  Teacher impersonation — "Preview as a student"
  //
  //  When a teacher hits "View as student" in the dashboard we
  //  STASH their session under ORIGINAL_KEY and swap KEY to the
  //  student's row. From the student-facing pages' perspective
  //  nothing changes — they read the same `wc.session.v1` and run
  //  as the impersonated user. A small banner (injected here on
  //  every page load) makes the mode obvious and gives a one-tap
  //  return to the teacher dashboard.
  //
  //  Re-impersonating (teacher → student A → student B) keeps the
  //  original teacher row intact, so "Switch back" still works.
  // ----------------------------------------------------------------
  function isImpersonating() {
    try { return !!localStorage.getItem(ORIGINAL_KEY); } catch { return false; }
  }
  function originalSession() {
    try {
      const raw = localStorage.getItem(ORIGINAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function impersonate(student) {
    if (!student) return;
    if (!isImpersonating()) {
      // First impersonation: save the current (teacher) session.
      const cur = session();
      if (cur) {
        try { localStorage.setItem(ORIGINAL_KEY, JSON.stringify(cur)); } catch {}
      }
    }
    setSession(student);
  }
  function unimpersonate() {
    const orig = originalSession();
    if (!orig) return null;
    setSession(orig);
    try { localStorage.removeItem(ORIGINAL_KEY); } catch {}
    return orig;
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

  function logout() {
    // Full sign-out wipes BOTH the active session and any stashed
    // teacher session. Use unimpersonate() instead if the goal is
    // to return to teacher mode.
    setSession(null);
    try { localStorage.removeItem(ORIGINAL_KEY); } catch {}
  }

  function requireStudent(redirect) {
    const u = session();
    // Teachers and students both pass this gate now: teachers
    // routinely open student-facing pages (lessons, profile, …)
    // to preview what the class will see. The home page already
    // surfaces a Settings tile that takes them back to the
    // dashboard, so a teacher reading a lesson is intentional.
    if (!u || (u.role !== 'student' && u.role !== 'teacher')) {
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

  // ----------------------------------------------------------------
  //  Impersonation banner — auto-injected on every page load.
  //  Yellow strip pinned to the top of the viewport. Disappears when
  //  the user clicks "Switch back to teacher".
  // ----------------------------------------------------------------
  function injectImpersonationBanner() {
    if (!isImpersonating()) return;
    if (document.getElementById('wcImpersonationBanner')) return;
    const cur  = session();
    const orig = originalSession();
    if (!cur || !orig) return;

    const banner = document.createElement('div');
    banner.id = 'wcImpersonationBanner';
    banner.innerHTML = `
      <span class="wc-imp-msg">
        👁 Previewing as <strong>${escapeText(cur.real_name)}</strong>
        <span class="wc-imp-sep">·</span>
        signed in as <strong>${escapeText(orig.real_name)}</strong>
      </span>
      <button id="wcUnimpersonateBtn" class="wc-imp-btn">↩ Switch back to teacher</button>
    `;
    Object.assign(banner.style, {
      position:    'fixed',
      top:         '0', left: '0', right: '0',
      zIndex:      '9999',
      display:     'flex',
      justifyContent: 'center', alignItems: 'center',
      gap:         '14px',
      padding:     '8px 14px',
      background:  '#fff4c2',
      borderBottom:'1px solid #e6c84b',
      color:       '#5a4a1a',
      fontSize:    '14px',
      fontFamily:  'inherit',
      boxShadow:   '0 1px 4px rgba(0,0,0,.06)',
      flexWrap:    'wrap',
    });
    document.body.appendChild(banner);

    // Push the rest of the page down by the banner's height — works
    // for any page layout (fixed-header pages set body padding-top).
    const h = banner.offsetHeight;
    document.body.style.paddingTop = (parseFloat(getComputedStyle(document.body).paddingTop) || 0) + h + 'px';

    const btn = document.getElementById('wcUnimpersonateBtn');
    Object.assign(btn.style, {
      appearance: 'none', cursor: 'pointer',
      background: '#5a4a1a', color: '#fff',
      border: 'none', borderRadius: '999px',
      padding: '6px 14px',
      font: 'inherit', fontWeight: '700', fontSize: '13px',
    });
    btn.addEventListener('click', () => {
      unimpersonate();
      location.href = './teacher.html';
    });
  }

  function escapeText(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }

  // Auto-inject the banner on every page (no-op when not impersonating).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectImpersonationBanner);
  } else {
    injectImpersonationBanner();
  }

  window.WCAuth = {
    session, login, logout, requireStudent, requireTeacher,
    impersonate, unimpersonate, isImpersonating, originalSession,
  };
})();
