(function () {
  function currentLang() {
    if (globalThis.state?.lang === 'en' || globalThis.state?.lang === 'ja') return globalThis.state.lang;
    return new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ja';
  }

  const labels = {
    ja: {
      home: 'ホーム',
      guide: '初めての方はこちら',
      login: 'ログイン',
      supporter: 'サポーター登録',
      lang: '言語切り替え',
      request: 'ご要望フォーム',
      ranking: 'ランキング',
      damage: 'ダメージランキング',
      speed: 'スピードランキング',
      username: 'ユーザー名',
      guest: 'ゲスト',
      memberStatus: '会員ステータス',
      remaining: '本日の残り回数',
      heavyweight: 'ヘビー級：零式',
      ultimate: '絶',
      extreme: '極',
      another: 'アナザーダンジョン',
      m1: '零式1層：ヴァンプファタール',
      m2: '零式2層：エクストリームズ',
      m3: '零式3層：ザ・タイラント',
      m4p1: '零式4層/前半：リンドブルム',
      m4p2: '零式4層/後半：リンドブルム',
      fru: '絶もう一つの未来',
      top: '絶オメガ検証戦',
      dsr: '絶竜詩戦争',
      tea: '絶アレキサンダー討滅戦',
      uwu: '絶アルテマウェポン破壊作戦',
      ucob: '絶バハムート討滅戦',
      enuo: 'エヌ・オー',
      doomtrain: 'グラシャラボラス',
      merchant: '商客物語',
    },
    en: {
      home: 'Home',
      guide: 'First time here?',
      login: 'Login',
      supporter: 'Supporter',
      lang: 'Language',
      request: 'Feedback / Request',
      ranking: 'Ranking',
      damage: 'Damage Rankings',
      speed: 'Speed Rankings',
      username: 'Username',
      guest: 'Guest',
      memberStatus: 'Membership Status',
      remaining: 'Remaining Today',
      heavyweight: 'AAC Heavyweight  (Savage)',
      ultimate: 'Ultimate',
      extreme: 'Extreme',
      another: 'Another Dungeon',
      m1: 'Savage M1: Vamp Fatale',
      m2: 'Savage M2: Extremes',
      m3: 'Savage M3: The Tyrant',
      m4p1: 'Savage M4 / Phase 1: Lindwurm',
      m4p2: 'Savage M4 / Phase 2: Lindwurm',
      fru: 'Futures Rewritten (Ultimate)',
      top: 'The Omega Protocol (Ultimate)',
      dsr: "Dragonsong's Reprise (Ultimate)",
      tea: 'The Epic of Alexander (Ultimate)',
      uwu: "The Weapon's Refrain (Ultimate)",
      ucob: 'The Unending Coil of Bahamut (Ultimate)',
      enuo: 'Enuo',
      doomtrain: 'Doomtrain',
      merchant: "The Merchant's Tale",
    },
  };

  const rankingGroups = [
    ['heavyweight', ['m1', 'm2', 'm3', 'm4p1', 'm4p2']],
    ['ultimate', ['fru', 'top', 'dsr', 'tea', 'uwu', 'ucob']],
    ['extreme', ['enuo', 'doomtrain']],
    ['another', ['merchant']],
  ];

  const damageUrls = [
    'https://ja.fflogs.com/zone/rankings/73?boss=101&metric=dps&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/73?boss=102&metric=dps&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/73?boss=103&metric=dps&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/73?boss=104&metric=dps&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/73?boss=105&metric=dps&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/65?metric=dps&dpstype=rdps&boss=1079',
    'https://ja.fflogs.com/zone/rankings/59?boss=1077&metric=dps&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/59?boss=1076&metric=dps&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/59?boss=1075&metric=dps&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/59?boss=1074&metric=dps&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/59?boss=1073&metric=dps&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/72?boss=1084&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/72?boss=1083&dpstype=rdps',
    'https://ja.fflogs.com/zone/rankings/74?metric=dps&boss=4550&dpstype=rdps',
  ];

  const speedUrls = [
    'https://ja.fflogs.com/zone/rankings/73?boss=101',
    'https://ja.fflogs.com/zone/rankings/73?boss=102',
    'https://ja.fflogs.com/zone/rankings/73?boss=103',
    'https://ja.fflogs.com/zone/rankings/73?boss=104',
    'https://ja.fflogs.com/zone/rankings/73?boss=105',
    'https://ja.fflogs.com/zone/rankings/65?boss=1079',
    'https://ja.fflogs.com/zone/rankings/59?boss=1077',
    'https://ja.fflogs.com/zone/rankings/59?boss=1076',
    'https://ja.fflogs.com/zone/rankings/59?boss=1075',
    'https://ja.fflogs.com/zone/rankings/59?boss=1074',
    'https://ja.fflogs.com/zone/rankings/59?boss=1073',
    'https://ja.fflogs.com/zone/rankings/72?boss=1084&metric=speed',
    'https://ja.fflogs.com/zone/rankings/72?boss=1083&metric=speed',
    'https://ja.fflogs.com/zone/rankings/74?metric=speed&boss=4550',
  ];

  function rankingContent(type) {
    const lang = currentLang();
    const text = labels[lang];
    const urls = type === 'speed' ? speedUrls : damageUrls;
    let urlIndex = 0;
    return rankingGroups.map(([groupKey, itemKeys]) => {
      const links = itemKeys.map((itemKey) => {
        const href = urls[urlIndex++];
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="sidebar-ranking-item">${text[itemKey]}</a>`;
      }).join('');
      return `<div class="sidebar-ranking-group"><div class="sidebar-ranking-group-label">${text[groupKey]}</div>${links}</div>`;
    }).join('');
  }

  function sidebarMarkup(activePage) {
    const lang = currentLang();
    const text = labels[lang];
    const active = (page) => page === activePage ? ' is-active' : '';
    const suffix = lang === 'en' ? '?lang=en' : '';
    return `
      <div class="sidebar-logo">
        <img src="assets/ui/crystal-emblem.webp" alt="FFXIV SRD" class="sidebar-logo-img" width="72" height="72" fetchpriority="high" decoding="async" />
      </div>
      <nav class="sidebar-nav" aria-label="${lang === 'ja' ? 'メインナビゲーション' : 'Main navigation'}">
        <a href="/${suffix}" class="sidebar-nav-item${active('home')}">
          <img src="assets/ui/icon-home.webp" alt="" class="sidebar-nav-icon" width="28" height="28" decoding="async" />
          <span id="navHome">${text.home}</span>
        </a>
        <a href="/tutorial.html${suffix}" class="sidebar-nav-item${active('guide')}">
          <img src="assets/ui/icon-guide.webp" alt="" class="sidebar-nav-icon" width="28" height="28" decoding="async" />
          <span id="navGuide">${text.guide}</span>
        </a>
        <button type="button" class="sidebar-nav-item sidebar-lang-btn" id="sidebarLoginBtn" onclick="globalThis.AuthUIModule?.openAuthModal?.('login')">
          <img src="assets/ui/icon-login-new.webp" alt="" class="sidebar-nav-icon" width="28" height="28" decoding="async" />
          <span id="navCompare">${text.login}</span>
        </button>
        <a href="/premium.html${suffix}" class="sidebar-nav-item${active('supporter')}">
          <img src="assets/ui/sap-icon.webp" alt="" class="sidebar-nav-icon" width="28" height="28" decoding="async" />
          <span id="navSupporter">${text.supporter}</span>
        </a>
        <button type="button" class="sidebar-nav-item sidebar-lang-btn" id="sidebarLangBtn" onclick="document.getElementById('langToggle')?.click()">
          <img src="assets/ui/icon-lang-switch.webp" alt="" class="sidebar-nav-icon" width="28" height="28" decoding="async" />
          <span id="navLang">${text.lang}</span>
        </button>
        <a href="/contact.html${suffix}" class="sidebar-nav-item${active('request')}">
          <img src="assets/ui/icon-request.webp" alt="" class="sidebar-nav-icon" width="28" height="28" decoding="async" />
          <span id="navLoad">${text.request}</span>
        </a>
        <button type="button" class="sidebar-nav-item sidebar-lang-btn sidebar-ranking-toggle" id="sidebarRankingBtn" aria-expanded="false" aria-controls="sidebarRankingMenu">
          <img src="assets/ui/icon-compare.webp" alt="" class="sidebar-nav-icon" width="28" height="28" decoding="async" />
          <span id="navRanking">${text.ranking}</span>
          <span class="sidebar-ranking-chevron" id="rankingChevron" aria-hidden="true">▶</span>
        </button>
        <div class="sidebar-ranking-menu" id="sidebarRankingMenu" aria-hidden="true">
          <button type="button" class="sidebar-ranking-type-btn" aria-expanded="false" aria-controls="rankingTypeDamage">
            <span id="navRankingDamage">${text.damage}</span>
            <span class="sidebar-ranking-chevron" aria-hidden="true">▶</span>
          </button>
          <div class="sidebar-ranking-type-content" id="rankingTypeDamage" aria-hidden="true">${rankingContent('damage')}</div>
          <button type="button" class="sidebar-ranking-type-btn" aria-expanded="false" aria-controls="rankingTypeSpeed">
            <span id="navRankingSpeed">${text.speed}</span>
            <span class="sidebar-ranking-chevron" aria-hidden="true">▶</span>
          </button>
          <div class="sidebar-ranking-type-content" id="rankingTypeSpeed" aria-hidden="true">${rankingContent('speed')}</div>
        </div>
      </nav>
      <div class="sidebar-divider">
        <img src="assets/ui/divider-gem.png" alt="" class="sidebar-divider-img" />
      </div>
      <div class="sidebar-data-section">
        <div class="sidebar-section-label" id="sidebarDataSourceLabel">${text.username}</div>
        <div class="sidebar-source-item">
          <img src="assets/ui/crystal-emblem.webp" alt="" class="sidebar-source-icon" width="28" height="28" decoding="async" />
          <div class="sidebar-source-info">
            <div class="sidebar-source-name" id="sidebarUsername">-</div>
            <div class="sidebar-source-type" id="sidebarUserRole">${text.guest}</div>
          </div>
        </div>
        <div class="sidebar-section-label sidebar-sub-label" id="sidebarMemberStatusLabel">${text.memberStatus}</div>
        <div class="sidebar-source-item sidebar-source-item--no-icon">
          <div class="sidebar-source-info"><div class="sidebar-source-name" id="sidebarMemberStatus">${text.guest}</div></div>
        </div>
        <div class="sidebar-section-label sidebar-sub-label" id="sidebarRemainingLabel">${text.remaining}</div>
        <div class="sidebar-source-item sidebar-source-item--no-icon">
          <div class="sidebar-source-info"><div class="sidebar-source-name" id="sidebarRemainingUsage">-</div></div>
        </div>
      </div>
    `;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function applyExistingSidebarText() {
    const lang = currentLang();
    const text = labels[lang];
    setText('navHome', text.home);
    setText('navGuide', text.guide);
    setText('navCompare', text.login);
    setText('navSupporter', text.supporter);
    setText('navLang', text.lang);
    setText('navLoad', text.request);
    setText('navRanking', text.ranking);
    setText('navRankingDamage', text.damage);
    setText('navRankingSpeed', text.speed);
    setText('sidebarDataSourceLabel', text.username);
    setText('sidebarUserRole', text.guest);
    setText('sidebarMemberStatusLabel', text.memberStatus);
    setText('sidebarMemberStatus', text.guest);
    setText('sidebarRemainingLabel', text.remaining);
    const damage = document.getElementById('rankingTypeDamage');
    const speed = document.getElementById('rankingTypeSpeed');
    if (damage) damage.innerHTML = rankingContent('damage');
    if (speed) speed.innerHTML = rankingContent('speed');
  }

  function initRankingMenu() {
    const rankingBtn = document.getElementById('sidebarRankingBtn');
    const rankingMenu = document.getElementById('sidebarRankingMenu');
    const rankingChevron = document.getElementById('rankingChevron');
    if (rankingBtn && rankingMenu && !rankingBtn.dataset.siteShellBound) {
      rankingBtn.dataset.siteShellBound = '1';
      rankingBtn.addEventListener('click', function () {
        const isOpen = rankingMenu.classList.contains('is-open');
        rankingMenu.classList.toggle('is-open', !isOpen);
        rankingBtn.setAttribute('aria-expanded', String(!isOpen));
        rankingMenu.setAttribute('aria-hidden', String(isOpen));
        if (rankingChevron) rankingChevron.textContent = isOpen ? '▶' : '▼';
      });
    }
    document.querySelectorAll('.sidebar-ranking-type-btn').forEach(function (btn) {
      if (btn.dataset.siteShellBound) return;
      btn.dataset.siteShellBound = '1';
      btn.addEventListener('click', function () {
        const targetEl = document.getElementById(btn.getAttribute('aria-controls'));
        const chevron = btn.querySelector('.sidebar-ranking-chevron');
        if (!targetEl) return;
        const isOpen = targetEl.classList.contains('is-open');
        targetEl.classList.toggle('is-open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
        targetEl.setAttribute('aria-hidden', String(isOpen));
        if (chevron) chevron.textContent = isOpen ? '▶' : '▼';
      });
    });
  }

  function initShell() {
    const lang = currentLang();
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-site-sidebar]').forEach((node) => {
      node.innerHTML = sidebarMarkup(node.getAttribute('data-active-page') || '');
    });
    applyExistingSidebarText();
    initRankingMenu();
  }

  globalThis.SiteShell = {
    applyLanguage: applyExistingSidebarText,
    init: initShell,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }
}());
