// =============================================================
//  WordCatch — student profile / collection page
//
//  Loads:
//    - the student's caught pets (wc_student_pets)
//    - their word level totals across ALL lessons (wc_word_states)
//    - teacher reply messages (wc_visualization_messages, responded)
//
//  Renders:
//    - hero chip: name + coins + encounter level + total caught
//    - collection grids: per animal set, colour sprite if caught,
//      grayscale silhouette otherwise — Pokédex-style
//    - word stats: 6 ice cream icons with counts
//    - messages: teacher replies inline
//
//  Click on a caught pet → detail modal with custom-name input.
// =============================================================

(() => {
  const me = window.WCAuth.requireStudent('./index.html');
  if (!me) return;
  const $ = (id) => document.getElementById(id);

  // Refresh session from server so coins / encounter_level are fresh
  // (they update on the lesson page in another tab, and we want this
  // page to mirror that immediately on load).
  (async function refresh() {
    try {
      const fresh = await window.WCDB.users.byLoginCode(me.login_code);
      if (fresh) {
        Object.assign(me, fresh);
        localStorage.setItem('wc.session.v1', JSON.stringify(me));
      }
    } catch {}
    init();
  })();

  // Wire shared header bits.
  $('userName').textContent  = me.real_name;
  $('userMoney').textContent = me.money || 0;
  $('logoutBtn').addEventListener('click', e => {
    e.preventDefault();
    window.WCAuth.logout();
    location.href = './index.html';
  });

  async function init() {
    const [pets, wordRows, msgs] = await Promise.all([
      window.WCDB.pets.forUser(me.id).catch(() => []),
      window.WCDB.wordStates.forUser(me.id).catch(() => []),
      window.WCDB.viz.forStudent(me.id).catch(() => []),
    ]);
    renderHero(pets);
    renderCollection(pets);
    renderWordStats(wordRows);
    renderMessages(msgs.filter(m => m.responded_at));
  }

  // ============================================================
  //  HERO — name, coin total, encounter level, total catches
  // ============================================================
  function renderHero(pets) {
    const wrap = $('hero');
    const totalSets = window.WCAssets.allSetNames.length * 10;
    const uniqueCaught = uniqueKey(pets).size;
    wrap.innerHTML = `
      <div class="wc-hero-row">
        <div class="wc-hero-block">
          <div class="wc-hero-label">Coins</div>
          <div class="wc-hero-val">🪙 ${me.money || 0}</div>
        </div>
        <div class="wc-hero-block">
          <div class="wc-hero-label">Catcher level</div>
          <div class="wc-hero-val">⭐ ${me.encounter_level || 1}</div>
        </div>
        <div class="wc-hero-block">
          <div class="wc-hero-label">Animals caught</div>
          <div class="wc-hero-val">🐾 ${uniqueCaught} / ${totalSets}</div>
        </div>
      </div>
    `;
  }

  function uniqueKey(pets) {
    // A "unique" pet is one (animal_set, animal_index) pair; duplicates
    // (re-catches) don't count toward the collection percentage.
    const s = new Set();
    pets.forEach(p => s.add(`${p.animal_set}::${p.animal_index}`));
    return s;
  }

  // ============================================================
  //  COLLECTION — per-set grids, colour vs silhouette
  // ============================================================
  function renderCollection(pets) {
    const root = $('collection');
    root.innerHTML = '';

    const SETS_META = {
      'animals':    { icon: '🌍', title: 'World animals' },
      'nz-animals': { icon: '🇳🇿', title: 'NZ animals'    },
      'penguin':    { icon: '🐧', title: 'Penguins & seals' },
    };

    // Group every catch (pet ROW, not unique animal) by set. One card
    // per row: a student who caught the same mouse 3 times gets 3
    // mouse cards stacked side by side. We keep them sorted by
    // caught_at DESC so the most recent catch reads first.
    const bySet = new Map();
    [...pets]
      .sort((a, b) => new Date(b.caught_at) - new Date(a.caught_at))
      .forEach(p => {
        if (!bySet.has(p.animal_set)) bySet.set(p.animal_set, []);
        bySet.get(p.animal_set).push(p);
      });

    window.WCAssets.allSetNames.forEach(setName => {
      const meta    = SETS_META[setName];
      const setPets = bySet.get(setName) || [];
      // Skip empty sets — no header for a set the student has never
      // caught from.
      if (!setPets.length) return;

      const section = document.createElement('section');
      section.className = 'wc-collect-section';
      section.innerHTML = `
        <header class="wc-collect-header">
          <h3>${meta.icon} ${meta.title}</h3>
          <span class="wc-collect-count">${setPets.length} caught</span>
        </header>
        <div class="wc-collect-grid"></div>
      `;
      const grid = section.querySelector('.wc-collect-grid');

      // Render ONE card per pet row so duplicates pile up visually.
      // Mouse caught 3 times → 3 mouse cards.
      setPets.forEach(pet => {
        const asset = window.WCAssets.sets[setName][pet.animal_index];
        if (!asset) return;
        const name = pet.custom_name && pet.custom_name.trim();
        const labelText = name
          ? `${asset.label} (${name})`
          : asset.label;
        const card = document.createElement('button');
        card.className = 'wc-pet-card caught';
        card.innerHTML = `
          <img src="${asset.real}" alt="${escapeHtml(labelText)}" />
          <div class="wc-pet-label">${escapeHtml(labelText)}</div>
        `;
        card.addEventListener('click', () => openPetDetail(pet, setName, asset));
        grid.appendChild(card);
      });

      root.appendChild(section);
    });
  }

  // ============================================================
  //  PET DETAIL — modal with custom-name editing
  // ============================================================
  function openPetDetail(pet, setName, asset) {
    const host = ensureDetailHost();
    host.querySelector('.wc-pet-detail-sprite').src = asset.real;
    host.querySelector('.wc-pet-detail-title').textContent = asset.label;
    host.querySelector('.wc-pet-detail-meta').textContent =
      `Caught at level ${pet.animal_level} · ${new Date(pet.caught_at).toLocaleDateString('en-NZ')}`;
    const input = host.querySelector('.wc-pet-name-input');
    input.value = pet.custom_name || '';
    input.placeholder = `Give your ${asset.label} a name…`;

    const save = host.querySelector('.wc-pet-name-save');
    save.onclick = async () => {
      const name = input.value.trim();
      try {
        await window.WCDB.pets.rename(pet.id, name || null);
        pet.custom_name = name || null;
        save.textContent = 'Saved! ✓';
        setTimeout(() => save.textContent = 'Save name', 1500);
      } catch (e) {
        save.textContent = 'Try again';
        setTimeout(() => save.textContent = 'Save name', 1500);
      }
    };
    host.classList.remove('wc-hidden');
  }

  function ensureDetailHost() {
    let h = document.getElementById('wcPetDetail');
    if (h) return h;
    h = document.createElement('div');
    h.id = 'wcPetDetail';
    h.className = 'wc-popup-backdrop wc-hidden';
    h.innerHTML = `
      <div class="wc-popup wc-pet-detail" role="dialog" aria-modal="true">
        <button class="wc-popup-close" aria-label="Close">×</button>
        <img class="wc-pet-detail-sprite" src="" alt="" />
        <h2 class="wc-pet-detail-title"></h2>
        <p class="wc-pet-detail-meta wc-muted"></p>
        <div class="wc-field" style="text-align:left;">
          <label>Nickname</label>
          <input class="wc-input wc-pet-name-input" type="text" maxlength="40" />
        </div>
        <button class="wc-btn wc-pet-name-save">Save name</button>
      </div>
    `;
    document.body.appendChild(h);
    h.addEventListener('click', e => { if (e.target === h) h.classList.add('wc-hidden'); });
    h.querySelector('.wc-popup-close').addEventListener('click', () => h.classList.add('wc-hidden'));
    return h;
  }

  // ============================================================
  //  WORD STATS — ice cream icons
  // ============================================================
  function renderWordStats(rows) {
    const wrap = $('wordStats');
    const counts = { '-1':0,'0':0,'1':0,'2':0,'3':0,'4':0,'5':0 };
    rows.forEach(r => { counts[String(r.level)] = (counts[String(r.level)] || 0) + 1; });
    const ORDER = [-1, 1, 2, 3, 4, 5];
    const total = rows.length;
    const html = ORDER.map(lvl => {
      const img = window.WCAssets.levels[lvl].real;
      const n   = counts[String(lvl)] || 0;
      const tip = (lvl === -1) ? 'Skipped' : `Level ${lvl}`;
      return `
        <div class="wc-stat ${n > 0 ? '' : 'wc-stat-empty'}" title="${tip}">
          <img src="${img}" alt="${tip}" />
          <span class="wc-stat-count">${n}</span>
        </div>`;
    }).join('');
    wrap.innerHTML = `
      <p class="wc-muted" style="margin:0 0 12px;">
        You've tapped <strong>${total}</strong> ${total === 1 ? 'word' : 'words'} across all your lessons.
      </p>
      <div class="wc-stat-grid wc-stat-grid-big">${html}</div>
    `;
  }

  // ============================================================
  //  MESSAGES — teacher replies (text + gift animal)
  // ============================================================
  function renderMessages(msgs) {
    const wrap = $('messages');
    if (!msgs.length) {
      wrap.innerHTML = `<p class="wc-muted wc-center">No messages yet — send an "Imagine this!" from a lesson and your teacher will reply.</p>`;
      return;
    }
    wrap.innerHTML = '';
    const sorted = msgs.slice().sort((a,b) =>
      new Date(b.responded_at || b.sent_at) - new Date(a.responded_at || a.sent_at));
    sorted.forEach(m => {
      const giftAsset = (m.gift_animal_set != null && m.gift_animal_index != null)
        ? { src: window.WCAssets.spriteFor(m.gift_animal_set, m.gift_animal_index, false),
            label: window.WCAssets.labelFor(m.gift_animal_set, m.gift_animal_index) }
        : null;
      const card = document.createElement('div');
      card.className = 'wc-msg';
      card.innerHTML = `
        ${giftAsset ? `<img class="wc-msg-gift" src="${giftAsset.src}" alt="${escapeHtml(giftAsset.label)}" />` : ''}
        <div class="wc-msg-body">
          ${m.teacher_response ? `<p class="wc-msg-text">${escapeHtml(m.teacher_response)}</p>` : ''}
          <p class="wc-msg-meta">
            ${m.word ? `re: <em>${escapeHtml(m.word)}</em> · ` : ''}
            ${new Date(m.responded_at || m.sent_at).toLocaleDateString('en-NZ')}
          </p>
          ${m.prompt ? `<details class="wc-msg-original"><summary>What I sent</summary><p>${escapeHtml(m.prompt)}</p></details>` : ''}
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }
})();
