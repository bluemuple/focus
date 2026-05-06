// Auth gate.
// Renders the sign-in / sign-up modal on top of a blurred page.
// Provides "Try it" mode that bypasses Supabase and uses localStorage only.

(() => {
  // Pages that don't require auth (none in this app — but the lesson and import
  // pages also need to either be authed or in try-mode).
  //
  // Check the real Supabase session FIRST so that a user who has signed in
  // via the parent Bidoro app (same origin → same localStorage) is recognised
  // even if a stale `try_mode` flag is hanging around from an earlier visit.
  // When that happens we clear the flag so the rest of the app talks to the
  // cloud instead of localStorage.
  async function isAuthed() {
    if (DB.haveSupabase) {
      const u = await DB.currentUser();
      if (u) {
        if (DB.isTryMode()) DB.setTryMode(false);
        return true;
      }
    }
    return DB.isTryMode();
  }

  function ensureModalRoot() {
    let root = document.getElementById('auth-modal-root');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'auth-modal-root';
    document.body.appendChild(root);
    return root;
  }

  function html(strings, ...values) {
    return strings.reduce((acc, s, i) => acc + s + (i < values.length ? values[i] : ''), '');
  }

  function renderModal(onAuthed) {
    const root = ensureModalRoot();
    document.body.classList.add('signed-out');
    root.innerHTML = html`
      <div class="modal-backdrop" id="auth-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <h1 id="auth-title">영어 학습 시작하기</h1>
          <div class="sub">계정을 만들면 학습 진도와 단어를 클라우드에 저장합니다.</div>
          <div class="tabs" role="tablist">
            <button class="tab active" data-tab="signin" role="tab">로그인</button>
            <button class="tab" data-tab="signup" role="tab">회원가입</button>
          </div>
          <form id="auth-form">
            <div class="field">
              <label for="auth-email">이메일</label>
              <input id="auth-email" type="email" autocomplete="email" required>
            </div>
            <div class="field">
              <label for="auth-pw">비밀번호</label>
              <input id="auth-pw" type="password" autocomplete="current-password" required minlength="6">
            </div>
            <div class="err" id="auth-err"></div>
            <button class="btn primary block lg" type="submit" id="auth-submit">로그인</button>
          </form>
          <div class="or">또는</div>
          <button class="btn block" id="auth-try" type="button">체험하기 (저장 없이 사용)</button>
        </div>
      </div>
    `;

    let mode = 'signin'; // or 'signup'
    const $ = (sel) => root.querySelector(sel);
    const submitBtn = $('#auth-submit');
    const errBox = $('#auth-err');

    function setMode(m) {
      mode = m;
      root.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === m);
      });
      submitBtn.textContent = m === 'signup' ? '계정 만들기' : '로그인';
      $('#auth-pw').autocomplete = (m === 'signup') ? 'new-password' : 'current-password';
      errBox.textContent = '';
    }

    root.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => setMode(t.dataset.tab));
    });

    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.textContent = '';
      const email = $('#auth-email').value.trim();
      const pw    = $('#auth-pw').value;
      if (!email || !pw) return;
      submitBtn.disabled = true;
      submitBtn.textContent = '처리 중...';
      try {
        if (mode === 'signup') {
          await DB.signUp(email, pw);
          // If email confirmations are ON in Supabase, the session won't be active yet.
          const u = await DB.currentUser();
          if (!u) {
            errBox.textContent = '확인 이메일을 보냈습니다. 메일함에서 인증 후 다시 로그인해 주세요.';
            submitBtn.disabled = false;
            setMode('signin');
            submitBtn.textContent = '로그인';
            return;
          }
        } else {
          await DB.signIn(email, pw);
        }
        DB.setTryMode(false);
        teardown();
        onAuthed && onAuthed();
      } catch (err) {
        const msg = (err && err.message) || String(err);
        // Translate the most common Supabase errors into Korean.
        if (/invalid login/i.test(msg))           errBox.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
        else if (/already registered/i.test(msg)) errBox.textContent = '이미 가입된 이메일입니다. 로그인해 주세요.';
        else if (/weak password/i.test(msg))      errBox.textContent = '비밀번호는 6자 이상이어야 합니다.';
        else if (/not configured/i.test(msg) || /설정/i.test(msg))
          errBox.textContent = 'Supabase가 설정되지 않았습니다. "체험하기"를 사용하세요.';
        else errBox.textContent = msg;
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'signup' ? '계정 만들기' : '로그인';
      }
    });

    $('#auth-try').addEventListener('click', () => {
      DB.setTryMode(true);
      teardown();
      onAuthed && onAuthed();
    });

    function teardown() {
      document.body.classList.remove('signed-out');
      root.innerHTML = '';
    }
  }

  async function gate(onAuthed) {
    if (await isAuthed()) {
      document.body.classList.remove('signed-out');
      onAuthed && onAuthed();
      // Listen for mid-session sign-outs (token refresh failures, another
      // tab signing out, iOS storage wipe). When that happens we put the
      // login modal back up — without this the user just sees a broken
      // page after Supabase silently invalidates their session.
      attachSignOutWatcher(onAuthed);
      return;
    }
    renderModal(onAuthed);
  }

  // Idempotent: only attaches the listener once per page load.
  let _signOutWatcherAttached = false;
  function attachSignOutWatcher(onAuthed) {
    if (_signOutWatcherAttached) return;
    _signOutWatcherAttached = true;
    window.addEventListener('eng:signed-out', () => {
      // The user might already be in try-mode at this point (e.g. they
      // tapped 체험하기 in another tab). Don't show the modal in that case.
      if (DB.isTryMode()) return;
      // Also ignore if a modal is already up.
      if (document.getElementById('auth-modal-root') &&
          document.getElementById('auth-modal-root').innerHTML.trim()) return;
      renderModal(onAuthed || (() => location.reload()));
    });
  }

  async function signOutAndReload() {
    await DB.signOut();
    location.href = 'index.html';
  }

  // Forcibly opens the sign-in / sign-up modal regardless of try-mode or
  // existing session. Used when the user taps the "게스트 / 체험 모드"
  // chip on the home page — they want to upgrade from try-mode to a real
  // account, so we always show the form even though isAuthed() is true.
  function showModal(onAuthed) {
    renderModal(onAuthed || (() => location.reload()));
  }

  window.Auth = { gate, signOutAndReload, isAuthed, showModal };
})();
