(function attachTutorialPage(root) {
  const params = new URLSearchParams(root.location.search);
  const LANG = params.get('lang') === 'en' ? 'en' : 'ja';

  const TEXT = {
    ja: {
      pageTitle: '初めての方向けガイド | FFXIV Skill Rotation Diff',
      heading: '初めての方向けガイド',
      subheading: '公開 FF Logs ログを読み込み、比較結果へ進む流れをこのページ内で体験できます。',
      backBtn: '比較ページへ戻る',
      langToggle: 'EN',
      previous: '戻る',
      next: '次へ',
      done: '完了',
      waitCompare: '比較を開始すると結果へ進みます。',
      progress: ['概要', 'URL', '失敗例', '一致', 'プレイヤー', '結果'],
      steps: {
        overview: {
          kicker: 'Step 1',
          title: 'スキル回しの差分を、同じ時間軸で見るサイトです',
          body: '2つの公開 FF Logs レポートから戦闘とプレイヤーを選び、スキル使用タイミングを横並びのタイムラインで比較できます。下のサンプルはドラッグやアイコンクリックで触れます。',
          state: 'サンプルを触ったら次へ進んでください。',
        },
        urls: {
          kicker: 'Step 2',
          title: '公開ログの URL を 2 つ入れます',
          body: 'このガイドでは入力欄をクリックするだけでサンプル URL が入ります。A と B の両方が入ったら、読み込み開始を押してください。',
          stateReady: '2つのURLが入りました。読み込み開始を押してください。',
          stateDone: 'サンプルログを読み込んだ状態になりました。',
        },
        mismatch: {
          kicker: 'Step 3',
          title: '違うコンテンツを選ぶとエラーになります',
          body: 'ログAをヘビー級零式1層、ログBをヘビー級零式2層のままプレイヤー一覧を取得して、失敗例を確認します。',
          state: 'エラーを確認したら次へ進めます。',
        },
        match: {
          kicker: 'Step 4',
          title: '同じコンテンツにそろえます',
          body: '今度はログBもヘビー級零式1層に変更してから、もう一度プレイヤー一覧を取得してください。',
          state: '同じコンテンツにそろえると次へ進めます。',
        },
        players: {
          kicker: 'Step 5',
          title: '比較するプレイヤーを選びます',
          body: 'ログAとログBからプレイヤーを1人ずつ選び、比較を開始してください。ここではサンプルのプレイヤー名とジョブ略称を使います。',
          state: 'A と B のプレイヤーを選んでください。',
        },
        result: {
          kicker: 'Step 6',
          title: '比較結果が表示されます',
          body: '実際のトップページでは、この画面でタブ切替、フェーズ選択、ズーム、タイムラインの横スクロールを使って差分を確認します。',
          state: '完了を押すと通常利用のトップページへ戻ります。',
        },
      },
      labels: {
        sampleResult: '比較結果サンプル',
        urlA: 'ログURL A',
        urlB: 'ログURL B',
        clickToFill: 'クリックでサンプルURLを入力',
        loadReports: '読み込み開始',
        loadingComplete: '読み込み完了。戦闘データ選択へ進めます。',
        fightA: 'ログA 戦闘',
        fightB: 'ログB 戦闘',
        getPlayers: 'この戦闘でプレイヤー一覧を取得',
        mismatchError: 'ログAとログBの戦闘コンテンツが一致していません。異なるコンテンツ同士は比較できません。',
        mismatchHint: 'このステップでは、あえて違う層のまま押してみてください。',
        matchSuccess: '同じ戦闘コンテンツになりました。プレイヤー選択へ進めます。',
        matchError: 'まだ違うコンテンツです。ログBをヘビー級零式1層に変更してください。',
        playerA: 'ログA プレイヤー',
        playerB: 'ログB プレイヤー',
        choosePlayer: 'プレイヤーを選択',
        compare: '比較を開始',
        compareReady: '比較を開始できます。',
        all: '全体',
        odd: '奇数GCD',
        even: '偶数GCD',
        phaseAll: '全フェーズ',
        phaseOne: 'P1',
        phaseTwo: 'P2',
        zoom: '100%',
        zoomOut: '縮小',
        zoomIn: '拡大',
        laneA: 'ログA',
        laneB: 'ログB',
        sampleNotice: 'このTLはガイド用のサンプルです。実際の最適なスキル回しとは異なる場合があります。',
      },
      fights: {
        m1: 'ヘビー級零式1層 / 7:42 / Kill',
        m2: 'ヘビー級零式2層 / 8:18 / Kill',
      },
      urls: {
        a: 'https://ja.fflogs.com/reports/sampleAlpha?fight=12',
        b: 'https://ja.fflogs.com/reports/sampleBeta?fight=8',
      },
      players: 'プレイヤー',
      timeline: {
        overviewTitle: '侍 サンプル / 侍 サンプル',
        resultFallbackTitle: '選択したプレイヤーのサンプルTL',
        burstWindow: 'バースト目安',
      },
    },
    en: {
      pageTitle: 'First-Time User Guide | FFXIV Skill Rotation Diff',
      heading: 'First-Time User Guide',
      subheading: 'Walk through the flow from public FF Logs URLs to a comparison result on this page.',
      backBtn: 'Back to App',
      langToggle: 'JA',
      previous: 'Back',
      next: 'Next',
      done: 'Done',
      waitCompare: 'Start the comparison to continue.',
      progress: ['Overview', 'URLs', 'Error', 'Match', 'Players', 'Result'],
      steps: {
        overview: {
          kicker: 'Step 1',
          title: 'Compare rotations on the same timeline',
          body: 'Choose fights and players from two public FF Logs reports, then compare skill timing on a shared timeline. You can drag the sample below or click its action icons.',
          state: 'Try the sample, then continue.',
        },
        urls: {
          kicker: 'Step 2',
          title: 'Enter two public log URLs',
          body: 'In this guide, clicking each field fills a sample URL. Once both fields are filled, press Load Reports.',
          stateReady: 'Both URLs are ready. Press Load Reports.',
          stateDone: 'The sample logs are loaded.',
        },
        mismatch: {
          kicker: 'Step 3',
          title: 'Different encounters cause an error',
          body: 'Keep Log A on Cruiserweight Savage 1 and Log B on Cruiserweight Savage 2, then fetch players to see the failure case.',
          state: 'After seeing the error, you can continue.',
        },
        match: {
          kicker: 'Step 4',
          title: 'Select the same encounter',
          body: 'Now change Log B to Cruiserweight Savage 1 and fetch players again.',
          state: 'Match the encounters to continue.',
        },
        players: {
          kicker: 'Step 5',
          title: 'Choose players to compare',
          body: 'Select one player from each log and start the comparison. This guide uses sample player names and job abbreviations.',
          state: 'Choose one player on each side.',
        },
        result: {
          kicker: 'Step 6',
          title: 'The comparison timeline appears',
          body: 'On the real app page, this view lets you switch tabs, select phases, zoom, and scroll the timeline to inspect differences.',
          state: 'Press Done to return to the app.',
        },
      },
      labels: {
        sampleResult: 'Comparison sample',
        urlA: 'Log URL A',
        urlB: 'Log URL B',
        clickToFill: 'Click to fill a sample URL',
        loadReports: 'Load Reports',
        loadingComplete: 'Loaded. You can move to fight selection.',
        fightA: 'Log A Fight',
        fightB: 'Log B Fight',
        getPlayers: 'Get Players for This Fight',
        mismatchError: 'Log A and Log B are not the same encounter. Different encounters cannot be compared.',
        mismatchHint: 'For this step, keep the two fights different and press the button.',
        matchSuccess: 'The encounters match. You can move to player selection.',
        matchError: 'The encounters still differ. Change Log B to Cruiserweight Savage 1.',
        playerA: 'Log A Player',
        playerB: 'Log B Player',
        choosePlayer: 'Choose a player',
        compare: 'Start Comparison',
        compareReady: 'Ready to compare.',
        all: 'All',
        odd: 'Odd GCD',
        even: 'Even GCD',
        phaseAll: 'All phases',
        phaseOne: 'P1',
        phaseTwo: 'P2',
        zoom: '100%',
        zoomOut: 'Zoom out',
        zoomIn: 'Zoom in',
        laneA: 'Log A',
        laneB: 'Log B',
        sampleNotice: 'This timeline is an illustrative guide sample. It may differ from an optimal real rotation.',
      },
      fights: {
        m1: 'Cruiserweight Savage 1 / 7:42 / Kill',
        m2: 'Cruiserweight Savage 2 / 8:18 / Kill',
      },
      urls: {
        a: 'https://www.fflogs.com/reports/sampleAlpha?fight=12',
        b: 'https://www.fflogs.com/reports/sampleBeta?fight=8',
      },
      players: 'Player',
      timeline: {
        overviewTitle: 'Samurai Sample / Samurai Sample',
        resultFallbackTitle: 'Sample timelines for selected players',
        burstWindow: 'Burst window',
      },
    },
  };

  const t = TEXT[LANG] || TEXT.ja;
  const STEPS = ['overview', 'urls', 'mismatch', 'match', 'players', 'result'];
  const PLAYERS = [
    { value: 'p1', job: 'PLD' },
    { value: 'p2', job: 'WAR' },
    { value: 'p3', job: 'WHM' },
    { value: 'p4', job: 'SCH' },
    { value: 'p5', job: 'VPR' },
    { value: 'p6', job: 'DRG' },
    { value: 'p7', job: 'PCT' },
    { value: 'p8', job: 'BRD' },
  ];
  const JOB_ROTATIONS = {
    SAM: [
      ['Hakaze', 5, 'blue', '基本コンボの開始です。', 'Starts the core combo.'],
      ['Meikyo_Shisui', 9, 'teal', '開幕の雪月花準備を短縮します。', 'Speeds up the opener setup.'],
      ['Jinpu', 13, 'blue', '与ダメージ上昇を維持します。', 'Maintains the damage buff.'],
      ['Gekko', 18, 'blue', '月の閃を付与する主力GCDです。', 'Adds Setsu Getsu Ka progress.'],
      ['Ikishoten', 21, 'gold', '剣気と大技の起点です。', 'Starts the Kenki burst setup.'],
      ['Midare_Setsugekka', 27, 'purple', '侍の大きな単体バーストです。', 'A major single-target burst hit.'],
      ['Kaeshi_Setsugekka', 30, 'purple', '返しでバースト密度を高めます。', 'Adds burst density with the follow-up.'],
      ['Ogi_Namikiri', 39, 'gold', '2分バーストの中心になる大技です。', 'A centerpiece action in the burst window.'],
      ['Kaeshi_Namikiri', 42, 'gold', '大技を重ねて差分が見えやすい位置です。', 'A stacked finisher that makes timing drift visible.'],
      ['Hissatsu_Senei', 47, 'teal', '剣気を使う高威力アビリティです。', 'A high-potency Kenki spender.'],
      ['Hissatsu_Shinten', 55, 'teal', '細かい剣気消費の位置も比較できます。', 'Shows smaller Kenki spend timing.'],
      ['Zanshin', 65, 'gold', '高レベル帯の追加バーストです。', 'A later burst action in the sample.'],
    ],
    PLD: [
      ['Fast_Blade', 5, 'blue', '物理コンボの開始です。', 'Starts the physical combo.'],
      ['Fight_or_Flight', 9, 'teal', 'バースト開始の自己強化です。', 'Starts the personal burst window.'],
      ['Goring_Blade', 13, 'gold', '強化中に合わせたい一撃です。', 'A key hit inside the buff window.'],
      ['Royal_Authority', 20, 'blue', '物理コンボの締めです。', 'Finishes the physical combo.'],
      ['Requiescat', 27, 'teal', '魔法コンボへ移る合図です。', 'Signals the spell combo.'],
      ['Confiteor', 31, 'gold', '魔法バーストの起点です。', 'Starts the magic burst sequence.'],
      ['Blade_of_Faith', 36, 'purple', 'Confiteor後の連続魔法です。', 'A follow-up spell after Confiteor.'],
      ['Blade_of_Truth', 41, 'purple', '魔法コンボの中盤です。', 'Midway through the spell combo.'],
      ['Blade_of_Valor', 46, 'purple', '魔法コンボの締めです。', 'Finishes the spell combo.'],
      ['Blade_of_Honor', 54, 'gold', '追加の高威力アビリティです。', 'An additional high-impact ability.'],
    ],
    WAR: [
      ['Heavy_Swing', 5, 'blue', 'コンボ開始です。', 'Starts the combo.'],
      ['Maim', 10, 'blue', 'コンボを進めます。', 'Continues the combo.'],
      ["Storm's_Eye", 15, 'blue', '与ダメージ上昇を維持します。', 'Maintains the damage buff.'],
      ['Inner_Release', 21, 'teal', 'ウォリアーの主要バースト開始です。', 'Starts the main burst window.'],
      ['Fell_Cleave', 25, 'gold', '解放中の主力GCDです。', 'A core GCD inside burst.'],
      ['Infuriate', 29, 'teal', 'リソースを追加します。', 'Adds resources.'],
      ['Inner_Chaos', 33, 'gold', '高威力のリソース消費です。', 'A high-potency resource spender.'],
      ['Primal_Rend', 42, 'purple', 'バースト中の大技です。', 'A large burst action.'],
      ['Primal_Ruination', 48, 'purple', '追加の追撃です。', 'A follow-up burst hit.'],
      ['Upheaval', 56, 'teal', 'アビリティ差し込み位置です。', 'An oGCD weave point.'],
    ],
    WHM: [
      ['Dia', 5, 'purple', 'DoT更新タイミングです。', 'Shows DoT timing.'],
      ['Glare_IV', 10, 'blue', '基本攻撃魔法です。', 'A core damage spell.'],
      ['Presence_of_Mind', 16, 'teal', '詠唱短縮バーストです。', 'Starts the cast speed window.'],
      ['Assize', 21, 'gold', '攻撃と回復を兼ねるアビリティです。', 'A damage and healing ability.'],
      ['Glare_IV', 28, 'blue', '短縮中の詠唱密度を見ます。', 'Shows cast density during the buff.'],
      ['Afflatus_Rapture', 38, 'purple', '全体回復の差し込み例です。', 'An example raid heal.'],
      ['Temperance', 50, 'teal', '軽減バフのタイミングです。', 'Shows mitigation timing.'],
      ['Afflatus_Misery', 62, 'gold', 'リリー消費後の大技です。', 'A high-impact lily spender.'],
    ],
    SCH: [
      ['Biolysis', 5, 'purple', 'DoT更新タイミングです。', 'Shows DoT timing.'],
      ['Broil_IV', 10, 'blue', '基本攻撃魔法です。', 'A core damage spell.'],
      ['Chain_Stratagem', 16, 'teal', 'シナジーバーストの開始です。', 'Starts the raid burst window.'],
      ['Aetherflow', 20, 'teal', 'リソース更新です。', 'Refreshes resources.'],
      ['Energy_Drain', 24, 'gold', 'バースト中のアビリティです。', 'An oGCD inside burst.'],
      ['Baneful_Impaction', 34, 'purple', '高レベル帯の追加攻撃です。', 'A later damage action.'],
      ['Sacred_Soil', 47, 'teal', '軽減設置の例です。', 'A mitigation placement.'],
      ['Indomitability', 60, 'gold', '全体回復の例です。', 'A raid healing example.'],
    ],
    VPR: [
      ['Steel_Fangs', 5, 'blue', '基本コンボの開始です。', 'Starts the combo.'],
      ['Serpent\'s_Ire', 10, 'teal', 'バースト準備の起点です。', 'Starts burst preparation.'],
      ['Vicewinder', 15, 'gold', '分岐コンボへ入ります。', 'Moves into the combo branch.'],
      ['Hunter\'s_Coil', 20, 'purple', '方向指定を含む主力GCDです。', 'A positional GCD in the sample.'],
      ['Reawaken', 27, 'teal', 'リウェイクン連続技の開始です。', 'Starts the Reawaken sequence.'],
      ['First_Generation', 32, 'gold', '連続技1段目です。', 'First step in the burst sequence.'],
      ['Second_Generation', 37, 'gold', '連続技2段目です。', 'Second step in the burst sequence.'],
      ['Third_Generation', 42, 'gold', '連続技3段目です。', 'Third step in the burst sequence.'],
      ['Fourth_Generation', 47, 'gold', '連続技4段目です。', 'Fourth step in the burst sequence.'],
      ['Ouroboros', 54, 'purple', '連続技の締めです。', 'Finishes the burst sequence.'],
    ],
    DRG: [
      ['True_Thrust', 5, 'blue', 'コンボ開始です。', 'Starts the combo.'],
      ['Lance_Charge', 9, 'teal', '自己強化の開始です。', 'Starts the personal buff.'],
      ['Disembowel', 14, 'blue', '与ダメージ上昇を維持します。', 'Maintains the damage buff.'],
      ['Chaotic_Spring', 20, 'purple', 'DoT付きコンボです。', 'A combo action with DoT.'],
      ['Battle_Litany', 25, 'teal', 'シナジーバーストです。', 'A raid burst buff.'],
      ['Geirskogul', 30, 'gold', '竜血系のバースト起点です。', 'Starts the dragon burst sequence.'],
      ['High_Jump', 36, 'gold', 'ジャンプ系アビリティです。', 'A jump ability.'],
      ['Nastrond', 43, 'purple', 'バースト中の追撃です。', 'A burst follow-up.'],
      ['Stardiver', 52, 'gold', '大きなジャンプ技です。', 'A major jump attack.'],
      ['Starcross', 60, 'purple', '高レベル帯の追加追撃です。', 'A later follow-up hit.'],
    ],
    PCT: [
      ['Fire_in_Red', 5, 'blue', '基本の色魔法です。', 'A core color spell.'],
      ['Subtractive_Palette', 11, 'teal', 'パレット切替の位置です。', 'Changes palette state.'],
      ['Hammer_Motif', 16, 'purple', 'モチーフ準備です。', 'Prepares a motif.'],
      ['Hammer_Brush', 24, 'gold', 'ハンマー連続技に入ります。', 'Starts the hammer sequence.'],
      ['Polishing_Hammer', 31, 'gold', 'ハンマー連続技の締めです。', 'Finishes the hammer sequence.'],
      ['Starry_Muse', 39, 'teal', '大きなバースト窓です。', 'A major burst window.'],
      ['Rainbow_Drip', 47, 'purple', '詠唱の重い大技です。', 'A heavy-cast finisher.'],
      ['Star_Prism', 58, 'gold', 'バースト中の主力技です。', 'A key burst action.'],
      ['Mog_of_the_Ages', 67, 'purple', 'クリーチャー系の大技です。', 'A creature finisher.'],
    ],
    BRD: [
      ['Stormbite', 5, 'purple', 'DoT更新タイミングです。', 'Shows DoT timing.'],
      ['The_Wanderer\'s_Minuet', 10, 'teal', '歌の開始です。', 'Starts the song.'],
      ['Raging_Strikes', 15, 'teal', '自己バフの開始です。', 'Starts a personal buff.'],
      ['Battle_Voice', 20, 'teal', 'シナジーバフです。', 'A raid burst buff.'],
      ['Barrage', 25, 'gold', 'バースト中の強化です。', 'A burst damage enhancer.'],
      ['Refulgent_Arrow', 30, 'gold', '強化された主力GCDです。', 'A buffed GCD hit.'],
      ['Empyreal_Arrow', 38, 'purple', 'アビリティ差し込み位置です。', 'An oGCD weave point.'],
      ['Pitch_Perfect', 47, 'gold', '歌中のリソース消費です。', 'A song resource spender.'],
      ['Radiant_Finale', 58, 'teal', 'パーティーバフの位置です。', 'A party buff timing point.'],
      ['Apex_Arrow', 67, 'purple', 'ゲージ消費の大技です。', 'A gauge spender.'],
    ],
  };
  const ABILITY_ACTIONS = new Set([
    'Meikyo_Shisui',
    'Ikishoten',
    'Hissatsu_Senei',
    'Hissatsu_Shinten',
    'Fight_or_Flight',
    'Requiescat',
    'Blade_of_Honor',
    'Inner_Release',
    'Infuriate',
    'Upheaval',
    'Onslaught',
    'Primal_Ruination',
    'Presence_of_Mind',
    'Assize',
    'Temperance',
    'Chain_Stratagem',
    'Aetherflow',
    'Energy_Drain',
    'Sacred_Soil',
    'Indomitability',
    'Serpent\'s_Ire',
    'Lance_Charge',
    'Battle_Litany',
    'Geirskogul',
    'High_Jump',
    'Nastrond',
    'Stardiver',
    'Starcross',
    'Subtractive_Palette',
    'Starry_Muse',
    'Star_Prism',
    'The_Wanderer\'s_Minuet',
    'Raging_Strikes',
    'Battle_Voice',
    'Barrage',
    'Empyreal_Arrow',
    'Pitch_Perfect',
    'Radiant_Finale',
  ]);

  const state = {
    stepIndex: 0,
    selectedEventId: 'burst-a',
    urls: { a: '', b: '' },
    reportsLoaded: false,
    mismatchFights: { a: 'm1', b: 'm2' },
    mismatchTried: false,
    mismatchMessage: '',
    matchFights: { a: 'm1', b: 'm2' },
    fightsMatched: false,
    matchMessage: '',
    players: { a: '', b: '' },
    timelineZoom: 1,
  };

  const nodes = {};

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function homeHref() {
    return LANG === 'en' ? '/?lang=en' : '/';
  }

  function applyStaticText() {
    root.document.documentElement.lang = LANG;
    root.document.querySelectorAll('[data-guide-text]').forEach((element) => {
      const key = element.getAttribute('data-guide-text');
      if (t[key] === undefined) return;
      if (element.tagName === 'TITLE') {
        root.document.title = t[key];
      } else {
        element.textContent = t[key];
      }
    });

    root.document.querySelectorAll('[data-guide-href-ja], [data-guide-href-en]').forEach((element) => {
      const attr = `data-guide-href-${LANG}`;
      if (element.hasAttribute(attr)) element.href = element.getAttribute(attr);
    });

    const langToggle = root.document.getElementById('langToggle');
    if (langToggle) {
      langToggle.textContent = t.langToggle;
      langToggle.addEventListener('click', () => {
        const url = new URL(root.location.href);
        url.searchParams.set('lang', LANG === 'ja' ? 'en' : 'ja');
        root.location.href = url.toString();
      });
    }
  }

  function currentStepKey() {
    return STEPS[state.stepIndex] || STEPS[0];
  }

  function isUrlReady() {
    return Boolean(state.urls.a && state.urls.b);
  }

  function canAdvance() {
    const key = currentStepKey();
    if (key === 'overview') return true;
    if (key === 'urls') return state.reportsLoaded;
    if (key === 'mismatch') return state.mismatchTried;
    if (key === 'match') return state.fightsMatched;
    if (key === 'result') return true;
    return false;
  }

  function stepStateText() {
    const key = currentStepKey();
    if (key === 'urls') {
      if (state.reportsLoaded) return t.steps.urls.stateDone;
      if (isUrlReady()) return t.steps.urls.stateReady;
      return t.steps.urls.body;
    }
    if (key === 'players') {
      return state.players.a && state.players.b ? t.labels.compareReady : t.steps.players.state;
    }
    return t.steps[key]?.state || '';
  }

  function renderCopy() {
    const key = currentStepKey();
    const copy = t.steps[key];
    nodes.copy.innerHTML = `
      <div class="guide-kicker">${escapeHtml(copy.kicker)}</div>
      <h2 id="guideStageTitle">${escapeHtml(copy.title)}</h2>
      <p>${escapeHtml(copy.body)}</p>
    `;
  }

  function renderProgress() {
    nodes.progress.innerHTML = STEPS.map((key, index) => {
      const active = index === state.stepIndex ? ' is-active' : '';
      const done = index < state.stepIndex ? ' is-done' : '';
      return `
        <div class="guide-progress-step${active}${done}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(t.progress[index])}</strong>
        </div>
      `;
    }).join('');
  }

  function normalizeIconPath(job, action) {
    return encodeURI(`/public/job-icons/jobs/${job}/${action}.png`);
  }

  function formatActionName(action) {
    return String(action || '').replace(/_/g, ' ');
  }

  function getPlayerByValue(value) {
    return PLAYERS.find((player) => player.value === value) || null;
  }

  function playerJob(side) {
    return getPlayerByValue(state.players[side])?.job || (side === 'a' ? 'VPR' : 'PCT');
  }

  function playerDisplay(value) {
    const player = getPlayerByValue(value);
    if (!player) return '';
    const index = PLAYERS.indexOf(player);
    return `${t.players}${index + 1} - ${player.job}`;
  }

  function buildRotationEvents(job, lane, offset = 0) {
    const rotation = JOB_ROTATIONS[job] || JOB_ROTATIONS.SAM;
    let gcdIndex = 0;
    let lastGcdTime = 0;
    let weaveIndex = 0;
    return rotation.map(([action, _sampleTime, tone], index) => {
      const category = ABILITY_ACTIONS.has(action) ? 'ability' : 'gcd';
      let t;
      if (category === 'gcd') {
        t = gcdIndex * 2.45;
        lastGcdTime = t;
        gcdIndex += 1;
        weaveIndex = 0;
      } else {
        t = lastGcdTime + (weaveIndex % 2 === 0 ? 0.75 : 1.45);
        weaveIndex += 1;
      }
      return {
        id: `${lane}-${job}-${index}`,
        lane,
        job,
        action,
        label: formatActionName(action),
        t: Number((t + offset).toFixed(2)),
        tone,
        icon: normalizeIconPath(job, action),
        category,
      };
    });
  }

  function timelinePxPerSec() {
    return 36 * state.timelineZoom;
  }

  function timelineLeft(seconds) {
    return 60 + seconds * timelinePxPerSec();
  }

  function timelineWidth(events) {
    const maxPosition = Math.max(timelineLeft(20), ...events.map((event) => event.left || timelineLeft(event.t)));
    return Math.ceil(maxPosition + 84);
  }

  function positionTimelineEvents(events) {
    const lastByLane = new Map();
    const minGap = 54;
    return events.map((event) => {
      const laneKey = `${event.lane}-${event.category}`;
      const baseLeft = timelineLeft(event.t);
      const left = Math.max(baseLeft, (lastByLane.get(laneKey) || -Infinity) + minGap);
      lastByLane.set(laneKey, left);
      return {
        ...event,
        left,
      };
    });
  }

  function zoomPercent() {
    return `${Math.round(state.timelineZoom * 100)}%`;
  }

  function setTimelineZoom(nextZoom) {
    state.timelineZoom = Math.max(0.65, Math.min(1.75, Number(nextZoom) || 1));
    renderCurrent();
  }

  function eventTop(event) {
    if (event.lane === 'a') return event.category === 'ability' ? 64 : 122;
    return event.category === 'ability' ? 202 : 260;
  }

  function timelineEventsForMode(result) {
    if (!result) {
      return [
        ...buildRotationEvents('SAM', 'a', 0),
        ...buildRotationEvents('SAM', 'b', 0.55),
      ];
    }

    return [
      ...buildRotationEvents(playerJob('a'), 'a', 0),
      ...buildRotationEvents(playerJob('b'), 'b', 0.55),
    ];
  }

  function timelineTitle(result) {
    if (!result) return t.timeline.overviewTitle;
    const title = [playerDisplay(state.players.a), playerDisplay(state.players.b)].filter(Boolean).join(' / ');
    return title || t.timeline.resultFallbackTitle;
  }

  function renderTimelineSample({ result = false } = {}) {
    const eventsForTimeline = timelineEventsForMode(result);
    const positionedEvents = positionTimelineEvents(eventsForTimeline);
    let selected = eventsForTimeline.find((event) => event.id === state.selectedEventId);
    if (!selected) {
      selected = eventsForTimeline[0];
      state.selectedEventId = selected.id;
    }
    const maxTick = Math.ceil(Math.max(20, ...eventsForTimeline.map((event) => event.t)));
    const ticks = Array.from({ length: maxTick + 1 }, (_value, tick) => tick).map((tick) => `
      <span class="guide-time-tick${tick % 10 === 0 ? ' is-major' : tick % 5 === 0 ? ' is-five' : ''}" style="left:${timelineLeft(tick)}px">${tick === 0 ? '0:00' : `0:${String(tick).padStart(2, '0')}`}</span>
    `).join('');
    const events = positionedEvents.map((event) => {
      const top = eventTop(event);
      const left = event.left;
      const active = event.id === state.selectedEventId ? ' is-active' : '';
      return `
        <button
          class="guide-skill guide-skill-${event.tone}${active}"
          type="button"
          style="left:${left}px; top:${top}px"
          data-guide-event="${escapeHtml(event.id)}"
          aria-label="${escapeHtml(event.label)}">
          <img src="${escapeHtml(event.icon)}" alt="" loading="lazy" />
          <span>${escapeHtml(event.label.slice(0, 3).toUpperCase())}</span>
        </button>
      `;
    }).join('');

    return `
      <div class="guide-timeline-head">
        <div>
          <span>${escapeHtml(t.labels.sampleResult)}</span>
          <strong>${escapeHtml(timelineTitle(result))}</strong>
        </div>
      </div>
      ${result ? `
        <div class="guide-result-controls">
          <span class="is-active">${escapeHtml(t.labels.phaseAll)}</span>
          <span>${escapeHtml(t.labels.phaseOne)}</span>
          <span>${escapeHtml(t.labels.phaseTwo)}</span>
          <div class="guide-zoom-controls" aria-label="${escapeHtml(t.labels.zoom)}">
            <button type="button" data-guide-zoom="out" aria-label="${escapeHtml(t.labels.zoomOut)}">-</button>
            <strong>${escapeHtml(zoomPercent())}</strong>
            <button type="button" data-guide-zoom="in" aria-label="${escapeHtml(t.labels.zoomIn)}">+</button>
          </div>
        </div>
      ` : ''}
      <div class="guide-timeline-scroll" tabindex="0" aria-label="${escapeHtml(t.labels.sampleResult)}">
        <div class="guide-demo-timeline" style="width:${timelineWidth(positionedEvents)}px">
          ${ticks}
          <div class="guide-lane-label guide-lane-a">${escapeHtml(t.labels.laneA)}</div>
          <div class="guide-lane-label guide-lane-b">${escapeHtml(t.labels.laneB)}</div>
          <div class="guide-sub-lane-label guide-sub-lane-a-ability">Ability</div>
          <div class="guide-sub-lane-label guide-sub-lane-a-gcd">GCD</div>
          <div class="guide-sub-lane-label guide-sub-lane-b-ability">Ability</div>
          <div class="guide-sub-lane-label guide-sub-lane-b-gcd">GCD</div>
          <div class="guide-lane-line guide-lane-line-a-ability"></div>
          <div class="guide-lane-line guide-lane-line-a-gcd"></div>
          <div class="guide-player-divider"></div>
          <div class="guide-lane-line guide-lane-line-b-ability"></div>
          <div class="guide-lane-line guide-lane-line-b-gcd"></div>
          <div class="guide-burst-window" style="left:${timelineLeft(8)}px; width:${8 * timelinePxPerSec()}px"></div>
          <div class="guide-burst-window-label" style="left:${timelineLeft(8) + 6}px">${escapeHtml(t.timeline.burstWindow)}</div>
          ${events}
        </div>
      </div>
      <p class="guide-sample-notice">${escapeHtml(t.labels.sampleNotice)}</p>
    `;
  }

  function renderOverviewWorkspace() {
    nodes.workspace.innerHTML = `
      <div class="guide-sample-board">
        ${renderTimelineSample()}
      </div>
    `;
    bindTimelineInteractions();
  }

  function renderUrlWorkspace() {
    const pointerClass = state.reportsLoaded
      ? ''
      : !state.urls.a
        ? 'guide-pointer--url-a'
        : !state.urls.b
          ? 'guide-pointer--url-b'
          : 'guide-pointer--url-button';
    const ready = isUrlReady();
    nodes.workspace.innerHTML = `
      <div class="guide-form-window">
        ${pointerClass ? `<div class="guide-pointer ${pointerClass}" aria-hidden="true"></div>` : ''}
        <div class="guide-form-grid">
          <label class="guide-field">
            <span>${escapeHtml(t.labels.urlA)}</span>
            <input type="url" readonly value="${escapeHtml(state.urls.a)}" placeholder="${escapeHtml(t.labels.clickToFill)}" data-guide-url="a" />
          </label>
          <label class="guide-field">
            <span>${escapeHtml(t.labels.urlB)}</span>
            <input type="url" readonly value="${escapeHtml(state.urls.b)}" placeholder="${escapeHtml(t.labels.clickToFill)}" data-guide-url="b" />
          </label>
        </div>
        <button class="guide-demo-button" type="button" data-guide-load-reports${ready ? '' : ' disabled'}>
          ${escapeHtml(t.labels.loadReports)}
        </button>
        <p class="guide-status${state.reportsLoaded ? ' is-success' : ''}">
          ${state.reportsLoaded ? escapeHtml(t.labels.loadingComplete) : escapeHtml(stepStateText())}
        </p>
      </div>
    `;
    nodes.workspace.querySelectorAll('[data-guide-url]').forEach((input) => {
      const fill = () => {
        const side = input.getAttribute('data-guide-url');
        state.urls[side] = t.urls[side];
        renderCurrent();
      };
      input.addEventListener('click', fill);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          fill();
        }
      });
    });
    const button = nodes.workspace.querySelector('[data-guide-load-reports]');
    button?.addEventListener('click', () => {
      if (!isUrlReady()) return;
      state.reportsLoaded = true;
      renderCurrent();
    });
  }

  function renderFightOptions(selected) {
    return Object.entries(t.fights).map(([value, label]) => `
      <option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>
    `).join('');
  }

  function renderFightWorkspace(mode) {
    const isMismatchStep = mode === 'mismatch';
    const model = isMismatchStep ? state.mismatchFights : state.matchFights;
    const complete = isMismatchStep ? state.mismatchTried : state.fightsMatched;
    const sameFight = model.a === model.b;
    const pointerClass = isMismatchStep
      ? (sameFight ? 'guide-pointer--fight-b' : 'guide-pointer--fight-button')
      : (sameFight ? 'guide-pointer--fight-button' : 'guide-pointer--fight-b');
    const message = isMismatchStep
      ? state.mismatchMessage
      : state.matchMessage;
    const statusClass = message
      ? complete
        ? (isMismatchStep ? ' is-error' : ' is-success')
        : ' is-warning'
      : '';

    nodes.workspace.innerHTML = `
      <div class="guide-form-window guide-fight-window">
        ${complete ? '' : `<div class="guide-pointer ${pointerClass}" aria-hidden="true"></div>`}
        <div class="guide-form-grid">
          <label class="guide-field">
            <span>${escapeHtml(t.labels.fightA)}</span>
            <select data-guide-fight="a">${renderFightOptions(model.a)}</select>
          </label>
          <label class="guide-field">
            <span>${escapeHtml(t.labels.fightB)}</span>
            <select data-guide-fight="b">${renderFightOptions(model.b)}</select>
          </label>
        </div>
        <button class="guide-demo-button" type="button" data-guide-load-players>
          ${escapeHtml(t.labels.getPlayers)}
        </button>
        <p class="guide-status${statusClass}">
          ${escapeHtml(message || (isMismatchStep ? t.steps.mismatch.state : t.steps.match.state))}
        </p>
      </div>
    `;

    nodes.workspace.querySelectorAll('[data-guide-fight]').forEach((select) => {
      select.addEventListener('change', () => {
        const side = select.getAttribute('data-guide-fight');
        model[side] = select.value;
        if (isMismatchStep) {
          state.mismatchTried = false;
          state.mismatchMessage = '';
        } else {
          state.fightsMatched = false;
          state.matchMessage = '';
        }
        renderCurrent();
      });
    });

    nodes.workspace.querySelector('[data-guide-load-players]')?.addEventListener('click', () => {
      if (isMismatchStep) {
        if (model.a !== model.b) {
          state.mismatchTried = true;
          state.mismatchMessage = t.labels.mismatchError;
        } else {
          state.mismatchTried = false;
          state.mismatchMessage = t.labels.mismatchHint;
        }
      } else if (model.a === model.b) {
        state.fightsMatched = true;
        state.matchMessage = t.labels.matchSuccess;
      } else {
        state.fightsMatched = false;
        state.matchMessage = t.labels.matchError;
      }
      renderCurrent();
    });
  }

  function playerLabel(index) {
    return `${t.players}${index + 1} - ${PLAYERS[index]?.job || ''}`;
  }

  function renderPlayerOptions(selected) {
    const options = [`<option value="">${escapeHtml(t.labels.choosePlayer)}</option>`];
    PLAYERS.forEach((player, index) => {
      options.push(`<option value="${player.value}"${player.value === selected ? ' selected' : ''}>${escapeHtml(playerLabel(index))}</option>`);
    });
    return options.join('');
  }

  function renderPlayersWorkspace() {
    const ready = Boolean(state.players.a && state.players.b);
    const pointerClass = !state.players.a
      ? 'guide-pointer--player-a'
      : !state.players.b
        ? 'guide-pointer--player-b'
        : 'guide-pointer--player-button';
    nodes.workspace.innerHTML = `
      <div class="guide-form-window guide-player-window">
        <div class="guide-pointer ${pointerClass}" aria-hidden="true"></div>
        <div class="guide-form-grid">
          <label class="guide-field">
            <span>${escapeHtml(t.labels.playerA)}</span>
            <select data-guide-player="a">${renderPlayerOptions(state.players.a)}</select>
          </label>
          <label class="guide-field">
            <span>${escapeHtml(t.labels.playerB)}</span>
            <select data-guide-player="b">${renderPlayerOptions(state.players.b)}</select>
          </label>
        </div>
        <button class="guide-demo-button guide-compare-button" type="button" data-guide-compare${ready ? '' : ' disabled'}>
          ${escapeHtml(t.labels.compare)}
        </button>
        <p class="guide-status${ready ? ' is-success' : ''}">
          ${escapeHtml(ready ? t.labels.compareReady : t.steps.players.state)}
        </p>
      </div>
    `;

    nodes.workspace.querySelectorAll('[data-guide-player]').forEach((select) => {
      select.addEventListener('change', () => {
        const side = select.getAttribute('data-guide-player');
        state.players[side] = select.value;
        renderCurrent();
      });
    });

    nodes.workspace.querySelector('[data-guide-compare]')?.addEventListener('click', () => {
      if (!state.players.a || !state.players.b) return;
      transitionTo(STEPS.indexOf('result'));
    });
  }

  function renderResultWorkspace() {
    nodes.workspace.innerHTML = `
      <div class="guide-result-board">
        ${renderTimelineSample({ result: true })}
      </div>
    `;
    bindTimelineInteractions();
  }

  function bindTimelineInteractions() {
    nodes.workspace.querySelectorAll('[data-guide-event]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedEventId = button.getAttribute('data-guide-event');
        renderCurrent();
      });
    });

    nodes.workspace.querySelectorAll('.guide-skill img').forEach((img) => {
      img.addEventListener('error', () => {
        img.closest('.guide-skill')?.classList.add('is-missing-icon');
      });
    });

    nodes.workspace.querySelectorAll('[data-guide-zoom]').forEach((button) => {
      button.addEventListener('click', () => {
        const direction = button.getAttribute('data-guide-zoom');
        setTimelineZoom(state.timelineZoom + (direction === 'in' ? 0.15 : -0.15));
      });
    });

    const scroller = nodes.workspace.querySelector('.guide-timeline-scroll');
    if (!scroller) return;
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    scroller.addEventListener('pointerdown', (event) => {
      isDragging = true;
      startX = event.clientX;
      startScrollLeft = scroller.scrollLeft;
      scroller.classList.add('is-dragging');
      scroller.setPointerCapture?.(event.pointerId);
    });

    scroller.addEventListener('pointermove', (event) => {
      if (!isDragging) return;
      event.preventDefault();
      scroller.scrollLeft = startScrollLeft - (event.clientX - startX);
    });

    const stopDragging = (event) => {
      isDragging = false;
      scroller.classList.remove('is-dragging');
      scroller.releasePointerCapture?.(event.pointerId);
    };
    scroller.addEventListener('pointerup', stopDragging);
    scroller.addEventListener('pointercancel', stopDragging);
    scroller.addEventListener('pointerleave', () => {
      isDragging = false;
      scroller.classList.remove('is-dragging');
    });
  }

  function renderWorkspace() {
    const key = currentStepKey();
    if (key === 'overview') renderOverviewWorkspace();
    if (key === 'urls') renderUrlWorkspace();
    if (key === 'mismatch') renderFightWorkspace('mismatch');
    if (key === 'match') renderFightWorkspace('match');
    if (key === 'players') renderPlayersWorkspace();
    if (key === 'result') renderResultWorkspace();
  }

  function updateNavigation() {
    const key = currentStepKey();
    nodes.prev.disabled = state.stepIndex === 0;
    nodes.prev.textContent = t.previous;
    nodes.next.textContent = key === 'result' ? t.done : t.next;
    nodes.next.hidden = key === 'players';
    nodes.next.disabled = key !== 'players' && !canAdvance();
    nodes.state.textContent = key === 'players' ? t.waitCompare : stepStateText();
    nodes.root.dataset.guideStep = key;
  }

  function renderCurrent() {
    renderProgress();
    renderCopy();
    renderWorkspace();
    updateNavigation();
  }

  function transitionTo(index) {
    const nextIndex = Math.max(0, Math.min(index, STEPS.length - 1));
    if (nextIndex === state.stepIndex) {
      renderCurrent();
      return;
    }

    nodes.stage.classList.add('is-leaving');
    root.setTimeout(() => {
      state.stepIndex = nextIndex;
      renderCurrent();
      nodes.stage.classList.remove('is-leaving');
      nodes.stage.classList.add('is-entering');
      root.requestAnimationFrame(() => {
        nodes.stage.classList.remove('is-entering');
      });
    }, 180);
  }

  function init() {
    nodes.root = root.document.querySelector('[data-guide-root]');
    if (!nodes.root) return;
    nodes.stage = nodes.root.querySelector('[data-guide-stage]');
    nodes.copy = nodes.root.querySelector('[data-guide-copy]');
    nodes.workspace = nodes.root.querySelector('[data-guide-workspace]');
    nodes.progress = nodes.root.querySelector('[data-guide-progress]');
    nodes.prev = nodes.root.querySelector('[data-guide-prev]');
    nodes.next = nodes.root.querySelector('[data-guide-next]');
    nodes.state = nodes.root.querySelector('[data-guide-state]');

    applyStaticText();

    nodes.prev.addEventListener('click', () => transitionTo(state.stepIndex - 1));
    nodes.next.addEventListener('click', () => {
      if (currentStepKey() === 'result') {
        root.location.href = homeHref();
        return;
      }
      if (!canAdvance()) return;
      transitionTo(state.stepIndex + 1);
    });

    renderCurrent();
  }

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
