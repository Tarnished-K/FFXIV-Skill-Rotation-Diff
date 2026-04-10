const state = {
  iconMap: [],
  apiKey: '',
  urlA: null,
  urlB: null,
  reportA: null,
  reportB: null,
  selectedFightA: null,
  selectedFightB: null,
  playersA: [],
  playersB: [],
  selectedA: null,
  selectedB: null,
  currentTab: 'all',
  timelineA: [],
  timelineB: [],
  dpsA: [],
  dpsB: [],
};

const el = {
  apiKey: document.getElementById('apiKey'),
  urlA: document.getElementById('urlA'),
  urlB: document.getElementById('urlB'),
  loadBtn: document.getElementById('loadBtn'),
  loadPlayersBtn: document.getElementById('loadPlayersBtn'),
  compareBtn: document.getElementById('compareBtn'),
  step2: document.getElementById('step2'),
  step3: document.getElementById('step3'),
  step4: document.getElementById('step4'),
  msg: document.getElementById('step1Message'),
  step2Message: document.getElementById('step2Message'),
  fightA: document.getElementById('fightA'),
  fightB: document.getElementById('fightB'),
  playerA: document.getElementById('playerA'),
  playerB: document.getElementById('playerB'),
  tabs: [...document.querySelectorAll('.tab')],
  timelineWrap: document.getElementById('timelineWrap'),
  dpsCanvas: document.getElementById('dpsCanvas'),
};

function parseFFLogsUrl(raw) {
  try {
    const u = new URL(raw);
    const match = u.pathname.match(/\/reports\/([A-Za-z0-9]+)/);
    if (!match) return null;
    return { reportId: match[1], original: raw };
  } catch {
    return null;
  }
}

async function loadIconMap() {
  try {
    const res = await fetch('/job-icons/job_icon.json');
    if (!res.ok) return [];
    const data = await res.json();
    return data.records || data;
  } catch {
    return [];
  }
}

function findIcon(actionNameEn) {
  const found = state.iconMap.find(
    r => r.action_name_en === actionNameEn || (r.aliases || []).includes(actionNameEn),
  );
  return found?.icon_path || '';
}

function normalizeJobCode(type) {
  if (!type) return 'UNK';
  return String(type).toUpperCase();
}

function formatDurationMs(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatFightLabel(fight, index) {
  const duration = formatDurationMs((fight.end_time || 0) - (fight.start_time || 0));
  const status = fight.kill ? 'Kill' : 'Wipe';
  const name = fight.name || `Fight ${fight.id}`;
  return `#${index + 1} ${name} / ${duration} / ${status}`;
}

async function fetchReportData(reportId, apiKey) {
  const url = `https://www.fflogs.com/v1/report/fights/${reportId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`FFLogs API error: ${res.status}`);
  }
  return res.json();
}

function extractSelectableFights(reportJson) {
  // ボス戦かつKillのみ選択対象にする
  return (reportJson.fights || []).filter(f => f.boss && f.boss !== 0 && f.kill === true);
}

function getPlayersFromFight(reportJson, fightId) {
  const fight = (reportJson.fights || []).find(f => Number(f.id) === Number(fightId));
  if (!fight) {
    throw new Error(`fight=${fightId} が見つかりません`);
  }

  const allowedIds = new Set(fight.friendlyPlayers || []);

  const belongsToFight = (friendly) => {
    if (!Array.isArray(friendly.fights) || friendly.fights.length === 0) {
      return true;
    }
    return friendly.fights.some(entry => {
      if (typeof entry === 'number') return entry === Number(fightId);
      if (entry && typeof entry === 'object') {
        const id = entry.id ?? entry.fight ?? entry.fightID;
        return Number(id) === Number(fightId);
      }
      return false;
    });
  };

  const base = (reportJson.friendlies || [])
    .filter(p => !p.petOwner)
    .filter(p => {
      const n = String(p.name || '').toLowerCase();
      return !n.includes('limit break') && !n.includes('リミットブレイク');
    });

  // 1st: fight.friendlyPlayers と friendly.fights の両方で絞る
  let filtered = base.filter(p => {
    const inAllowed = allowedIds.size > 0 ? allowedIds.has(p.id) : true;
    const inFight = belongsToFight(p);
    return inAllowed && inFight;
  });

  // 2nd fallback: 1件も出ない場合は friendlyPlayers のみで絞る
  if (!filtered.length && allowedIds.size > 0) {
    filtered = base.filter(p => allowedIds.has(p.id));
  }

  // 3rd fallback: それでも0件なら fights 情報のみで絞る
  if (!filtered.length) {
    filtered = base.filter(belongsToFight);
  }

  const players = filtered
    .map(p => ({
      id: String(p.id),
      name: p.name || `Unknown-${p.id}`,
      job: normalizeJobCode(p.type),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  if (!players.length) {
    throw new Error('選択戦闘に紐づくプレイヤー一覧を取得できませんでした');
  }
  return players;
}

function fillFightSelect(select, fights) {
  select.innerHTML = fights
    .map((f, i) => `<option value="${f.id}">${formatFightLabel(f, i)}</option>`)
    .join('');
}

function fillPlayerSelect(select, players) {
  select.innerHTML = players
    .map(p => `<option value="${p.id}">${p.name} (${p.job})</option>`)
    .join('');
}

function makeSampleTimeline(baseName) {
  const actions = ['Fast Blade', 'Riot Blade', 'Royal Authority', 'Fight or Flight', 'Requiescat'];
  return Array.from({ length: 45 }, (_, i) => ({
    t: i * 6,
    action: actions[i % actions.length],
    actor: baseName,
  }));
}

function makeSampleDps() {
  let x = 20000;
  return Array.from({ length: 120 }, (_, i) => {
    x += (Math.random() - 0.5) * 1200;
    return { t: i * 5, v: Math.max(1000, Math.round(x)) };
  });
}

function filterTimeline(records, tab) {
  if (tab === 'all') return records;
  if (tab === 'odd') return records.filter(r => Math.floor(r.t / 60) % 2 === 1);
  if (tab === 'even') return records.filter(r => Math.floor(r.t / 60) % 2 === 0 && r.t >= 60);
  return records;
}

function renderTimeline() {
  const a = filterTimeline(state.timelineA, state.currentTab);
  const b = filterTimeline(state.timelineB, state.currentTab);
  const maxT = Math.max(1, ...a.map(x => x.t), ...b.map(x => x.t));
  const pxPerSec = 6;
  const width = Math.max(1200, maxT * pxPerSec + 120);

  const buildEvents = (records, cls) =>
    records
      .map(r => {
        const x = 40 + r.t * pxPerSec;
        const icon = findIcon(r.action);
        return `<div class="event ${cls}" style="left:${x}px; top:${cls === 'a' ? 30 : 110}px" title="${r.t}s ${r.action}">${icon ? `<img src="${icon}" alt="${r.action}" />` : ''}</div>`;
      })
      .join('');

  el.timelineWrap.innerHTML = `
    <div class="timeline" style="width:${width}px">
      <div class="track a"></div>
      <div class="track b"></div>
      ${buildEvents(a, 'a')}
      ${buildEvents(b, 'b')}
    </div>
    <div class="legend">上段: ${state.selectedA?.name || '-'} / 下段: ${state.selectedB?.name || '-'}</div>
  `;
}

function renderDps() {
  const cvs = el.dpsCanvas;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, cvs.width, cvs.height);

  const maxV = Math.max(...state.dpsA.map(p => p.v), ...state.dpsB.map(p => p.v), 1);
  const drawLine = (arr, color) => {
    ctx.beginPath();
    arr.forEach((p, i) => {
      const x = (p.t / 600) * (cvs.width - 40) + 20;
      const y = cvs.height - 20 - (p.v / maxV) * (cvs.height - 40);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  drawLine(state.dpsA, '#38bdf8');
  drawLine(state.dpsB, '#f97316');
}

el.loadBtn.addEventListener('click', async () => {
  state.apiKey = el.apiKey.value.trim();
  const parsedA = parseFFLogsUrl(el.urlA.value.trim());
  const parsedB = parseFFLogsUrl(el.urlB.value.trim());

  if (!state.apiKey) {
    el.msg.textContent = 'FFLogs API Key（V1）を入力してください。';
    return;
  }
  if (!parsedA || !parsedB) {
    el.msg.textContent = 'FFLogs URL形式を確認してください。';
    return;
  }

  el.loadBtn.disabled = true;
  el.msg.textContent = 'レポートを読み込み中...';
  el.step2Message.textContent = '';

  try {
    state.urlA = parsedA;
    state.urlB = parsedB;
    state.iconMap = await loadIconMap();
    state.reportA = await fetchReportData(parsedA.reportId, state.apiKey);
    state.reportB = await fetchReportData(parsedB.reportId, state.apiKey);

    const fightsA = extractSelectableFights(state.reportA);
    const fightsB = extractSelectableFights(state.reportB);

    if (!fightsA.length || !fightsB.length) {
      throw new Error('選択可能な戦闘データが見つかりませんでした。');
    }

    fillFightSelect(el.fightA, fightsA);
    fillFightSelect(el.fightB, fightsB);
    el.playerA.innerHTML = '';
    el.playerB.innerHTML = '';
    el.step2.classList.remove('hidden');
    el.step3.classList.add('hidden');
    el.step4.classList.add('hidden');
    el.msg.textContent = `Kill戦闘一覧取得成功: A=${fightsA.length}件 / B=${fightsB.length}件`; 
  } catch (e) {
    el.msg.textContent = `取得失敗: ${e.message}`;
  } finally {
    el.loadBtn.disabled = false;
  }
});

el.loadPlayersBtn.addEventListener('click', () => {
  try {
    state.selectedFightA = Number(el.fightA.value);
    state.selectedFightB = Number(el.fightB.value);

    state.playersA = getPlayersFromFight(state.reportA, state.selectedFightA);
    state.playersB = getPlayersFromFight(state.reportB, state.selectedFightB);

    fillPlayerSelect(el.playerA, state.playersA);
    fillPlayerSelect(el.playerB, state.playersB);
    el.step3.classList.remove('hidden');
    el.step4.classList.add('hidden');
    el.step2Message.textContent = `プレイヤー取得成功: A=${state.playersA.length}人 / B=${state.playersB.length}人`;
  } catch (e) {
    el.step2Message.textContent = `プレイヤー取得失敗: ${e.message}`;
  }
});

el.compareBtn.addEventListener('click', () => {
  state.selectedA = state.playersA.find(p => p.id === el.playerA.value);
  state.selectedB = state.playersB.find(p => p.id === el.playerB.value);
  if (!state.selectedA || !state.selectedB) return;

  state.timelineA = makeSampleTimeline(state.selectedA.name);
  state.timelineB = makeSampleTimeline(state.selectedB.name);
  state.dpsA = makeSampleDps();
  state.dpsB = makeSampleDps();

  el.step4.classList.remove('hidden');
  state.currentTab = 'all';
  el.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'all'));
  el.dpsCanvas.classList.add('hidden');
  el.timelineWrap.classList.remove('hidden');
  renderTimeline();
});

el.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    el.tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.currentTab = tab.dataset.tab;

    if (state.currentTab === 'dps') {
      el.timelineWrap.classList.add('hidden');
      el.dpsCanvas.classList.remove('hidden');
      renderDps();
    } else {
      el.dpsCanvas.classList.add('hidden');
      el.timelineWrap.classList.remove('hidden');
      renderTimeline();
    }
  });
});
