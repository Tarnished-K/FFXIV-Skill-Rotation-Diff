const state = {
  iconMap: [],
  urlA: null,
  urlB: null,
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
  urlA: document.getElementById('urlA'),
  urlB: document.getElementById('urlB'),
  loadBtn: document.getElementById('loadBtn'),
  compareBtn: document.getElementById('compareBtn'),
  step2: document.getElementById('step2'),
  step3: document.getElementById('step3'),
  msg: document.getElementById('step1Message'),
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
    const fight = u.searchParams.get('fight');
    if (!match || !fight) return null;
    return { reportId: match[1], fightId: Number(fight), original: raw };
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
  const found = state.iconMap.find(r => r.action_name_en === actionNameEn || (r.aliases || []).includes(actionNameEn));
  return found?.icon_path || '';
}

function makeMockPlayers(seed) {
  return [
    { id: `${seed}-1`, name: 'Player Alpha', job: 'PLD' },
    { id: `${seed}-2`, name: 'Player Beta', job: 'WAR' },
    { id: `${seed}-3`, name: 'Player Gamma', job: 'SAM' },
  ];
}

function makeMockTimeline() {
  const actions = ['Fast Blade', 'Riot Blade', 'Royal Authority', 'Fight or Flight', 'Requiescat'];
  return Array.from({ length: 45 }, (_, i) => ({
    t: i * 6,
    action: actions[i % actions.length],
  }));
}

function makeMockDps() {
  let x = 20000;
  return Array.from({ length: 120 }, (_, i) => {
    x += (Math.random() - 0.5) * 1200;
    return { t: i * 5, v: Math.max(1000, Math.round(x)) };
  });
}

function fillPlayerSelect(select, players) {
  select.innerHTML = players.map(p => `<option value="${p.id}">${p.name} (${p.job})</option>`).join('');
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

  const buildEvents = (records, cls) => records.map(r => {
    const x = 40 + r.t * pxPerSec;
    const icon = findIcon(r.action);
    return `<div class="event ${cls}" style="left:${x}px; top:${cls==='a' ? 30 : 110}px" title="${r.t}s ${r.action}">${icon ? `<img src="${icon}" alt="${r.action}" />` : ''}</div>`;
  }).join('');

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

  const drawLine = (arr, color) => {
    const maxV = Math.max(...state.dpsA.map(p => p.v), ...state.dpsB.map(p => p.v), 1);
    ctx.beginPath();
    arr.forEach((p, i) => {
      const x = (p.t / 600) * (cvs.width - 40) + 20;
      const y = cvs.height - 20 - (p.v / maxV) * (cvs.height - 40);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  drawLine(state.dpsA, '#38bdf8');
  drawLine(state.dpsB, '#f97316');
}

el.loadBtn.addEventListener('click', async () => {
  const parsedA = parseFFLogsUrl(el.urlA.value.trim());
  const parsedB = parseFFLogsUrl(el.urlB.value.trim());
  if (!parsedA || !parsedB) {
    el.msg.textContent = 'FFLogs URL形式を確認してください（fightパラメータ必須）。';
    return;
  }

  state.urlA = parsedA;
  state.urlB = parsedB;
  state.iconMap = await loadIconMap();
  state.playersA = makeMockPlayers(parsedA.reportId);
  state.playersB = makeMockPlayers(parsedB.reportId);

  fillPlayerSelect(el.playerA, state.playersA);
  fillPlayerSelect(el.playerB, state.playersB);
  el.msg.textContent = `読み込み成功: A=${parsedA.reportId} fight=${parsedA.fightId}, B=${parsedB.reportId} fight=${parsedB.fightId}`;
  el.step2.classList.remove('hidden');
});

el.compareBtn.addEventListener('click', () => {
  state.selectedA = state.playersA.find(p => p.id === el.playerA.value);
  state.selectedB = state.playersB.find(p => p.id === el.playerB.value);
  state.timelineA = makeMockTimeline();
  state.timelineB = makeMockTimeline();
  state.dpsA = makeMockDps();
  state.dpsB = makeMockDps();

  el.step3.classList.remove('hidden');
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
