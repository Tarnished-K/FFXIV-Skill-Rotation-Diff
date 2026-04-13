// Timeline transforms, damage correlation, and rendering

function makeSampleTimeline() {
  const actions = ['Fast Blade', 'Riot Blade', 'Royal Authority', 'Fight or Flight', 'Requiescat'];
  return Array.from({ length: 45 }, (_, i) => ({ t: i * 6, action: actions[i % actions.length] }));
}
function filterTimeline(records, tab) {
  if (tab === 'all') return records;
  if (tab === 'odd') return records.filter(r => Math.floor(r.t / 60) % 2 === 1);
  if (tab === 'even') return records.filter(r => Math.floor(r.t / 60) % 2 === 0 && r.t >= 60);
  return records;
}
function buildRuler(maxT, pxPerSec) {
  const marks = [];
  for (let sec = 0; sec <= Math.ceil(maxT); sec++) {
    const x = 60 + sec * pxPerSec;
    const level = sec % 10 === 0 ? 'ten' : sec % 5 === 0 ? 'five' : 'one';
    const label = sec % 5 === 0 ? `<span>${sec}s</span>` : '';
    marks.push(`<div class="tick ${level}" style="left:${x}px">${label}</div>`);
  }
  return `<div class="ruler">${marks.join('')}</div>`;
}
function classifyStats(records) {
  let gcd = 0, ogcd = 0, unknown = 0;
  for (const r of records) {
    if (r.category === 'weaponskill' || r.category === 'spell') gcd++;
    else if (r.category === 'ability') ogcd++;
    else unknown++;
  }
  return { gcd, ogcd, unknown, total: records.length };
}
function deduplicateTimeline(records) {
  const out = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const prev = out[out.length - 1];
    if (prev && prev.actionId === r.actionId && Math.abs(prev.t - r.t) < 0.5) continue;
    out.push(r);
  }
  return out;
}
function findSelfBuff(actionName) {
  const n = String(actionName || '').toLowerCase();
  for (const buff of SELF_BUFFS) {
    if (n === buff.nameEn.toLowerCase() || n === buff.nameJa) return buff;
  }
  return null;
}
function getActiveSynergies(t, allRecords, partyBuffRecords) {
  const active = new Set();
  // 自分のキャスト記録からバフ検出
  for (const r of allRecords) {
    const buff = findBurstBuff(r.actionId, r.action) || findSelfBuff(r.action);
    if (!buff) continue;
    if (t >= r.t && t <= r.t + buff.duration) {
      active.add(state.lang === 'ja' ? buff.nameJa : buff.nameEn);
    }
  }
  // パーティメンバーからのバフ記録（Buffs APIから取得）
  for (const r of (partyBuffRecords || [])) {
    const dur = r.duration || 20;
    if (t >= r.t && t <= r.t + dur) {
      const buff = findBurstBuff(r.actionId, r.action) || findSelfBuff(r.action);
      const label = buff
        ? (state.lang === 'ja' ? buff.nameJa : buff.nameEn)
        : r.action;
      active.add(label);
    }
  }
  return [...active];
}
function findEnemyActors(reportJson, fight) {
  const friendlyIds = new Set(fight.friendlyPlayers || []);
  return (reportJson?.masterData?.actors || []).filter(a => {
    if (a.petOwner) return false;
    if (friendlyIds.has(a.id)) return false;
    // type=Playerは明示的に除外（他の戦闘のプレイヤーがmasterDataに含まれる場合）
    const typeLower = (a.type || '').toLowerCase();
    if (typeLower === 'player') return false;
    // normalizeJobCodeでプレイヤージョブとして認識できるactorを除外
    const job = normalizeJobCode(a.type, a.subType);
    if (job !== 'UNK' && JOB_ROLE[job]) return false;
    const n = String(a.name || '').toLowerCase();
    if (n.includes('limit break') || n.includes('リミットブレイク')) return false;
    // Environmentも除外
    if (typeLower === 'environment') return false;
    return true;
  });
}

async function fetchBossCastsV2(reportCode, fight, reportJson) {
  // masterData.actorsから敵NPCを特定し、sourceID指定で詠唱を取得
  const enemyActors = findEnemyActors(reportJson, fight);
  logDebug('ボス詠唱: 敵NPC候補', enemyActors.slice(0, 10).map(a => `${a.name}(id=${a.id},type=${a.type})`));
  if (!enemyActors.length) {
    logDebug('ボス詠唱: 敵NPCが見つかりません');
    return [];
  }

  const all = [];
  const pendingBegincast = new Map();
  const query = `
    query BossCasts($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: Casts, fightIDs: [$fightID], sourceID: $sourceID, startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;

  // 安全策: 負のIDを除外し、クエリ数を制限
  const validEnemies = enemyActors.filter(a => Number(a.id) > 0).slice(0, 5);
  if (validEnemies.length !== enemyActors.length) {
    logDebug(`ボス詠唱: ${enemyActors.length}候補中 ${validEnemies.length}体をクエリ（id>0, 上限5）`);
  }
  for (const enemy of validEnemies) {
    let startTime = null;
    let enemyCastCount = 0;
    while (true) {
      const vars = { code: reportCode, fightID: Number(fight.id), sourceID: Number(enemy.id), startTime };
      const data = await graphqlRequest(query, vars);
      const block = data?.reportData?.report?.events;
      const rows = block?.data || [];
      for (const e of rows) {
        const name = e?.ability?.name || '';
        const ts = Number(e?.timestamp || 0);
        if (!name || !ts) continue;
        const tSec = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
        const type = String(e?.type || '').toLowerCase();
        const key = `${enemy.id}_${name}`;
        if (type === 'begincast') {
          if (!pendingBegincast.has(key)) pendingBegincast.set(key, []);
          pendingBegincast.get(key).push({ t: tSec, name });
          enemyCastCount++;
          continue;
        }
        if (type === 'cast' && pendingBegincast.has(key) && pendingBegincast.get(key).length) {
          const start = pendingBegincast.get(key).shift();
          const castDuration = tSec - start.t;
          if (castDuration > 0.5) {
            all.push({ t: start.t, endT: tSec, name, duration: castDuration });
          }
          continue;
        }
      }
      if (!block?.nextPageTimestamp) break;
      startTime = block.nextPageTimestamp;
    }
    if (enemyCastCount > 0) logDebug(`  ${enemy.name}: rawイベント${enemyCastCount}件`);
  }
  logDebug(`ボス詠唱結果: ${all.length}件（詠唱バー付き）`);
  return all.sort((a, b) => a.t - b.t);
}
// FFLogs V2のステータスエフェクトID → バフ/デバフ名マッピング
// Buffs APIの abilityGameID はステータスエフェクトID (1000000+) であり、アクションIDとは異なる
const STATUS_DEBUFF_IDS = new Set([
  1000862, 1002911, // Damage Down (与ダメージ低下) - 各種
  1000043, 1002727, // Weakness (衰弱)
  1000044, 1002728, // Brink of Death (衰弱[強])
]);
const STATUS_DEBUFF_MAP = {
  1000862: 'damageDown', 1002911: 'damageDown',
  1000043: 'weakness',   1002727: 'weakness',
  1000044: 'brink',      1002728: 'brink',
};
const STATUS_BURST_BUFFS = {
  // ステータスエフェクトID → BURST_BUFFS内のnameEnへのマッピング
  1000786: 'Battle Litany',
  1001185: 'Brotherhood',
  1001882: 'Divination',
  1001221: 'Chain Stratagem',
  1001239: 'Embolden',
  1002599: 'Arcane Circle',
  1001822: 'Technical Finish', 1002698: 'Technical Finish',
  1002703: 'Searing Light',
  1002722: 'Radiant Finale', 1002964: 'Radiant Finale',
  1003685: 'Starry Muse',
  1004030: 'Dokumori',
};
const STATUS_SELF_BUFFS = {
  1000076: 'Fight or Flight',
  1001177: 'Inner Release', 1001303: 'Inner Release',
  1000742: 'Blood Weapon',
  1001624: 'Delirium', 1003836: 'Delirium',
  1000831: 'No Mercy',
  1001181: 'Riddle of Fire',
  1002720: 'Lance Charge',
  1000125: 'Raging Strikes',
  1000861: 'Wildfire',
  1001825: 'Devilment',
  1000737: 'Ley Lines',
  1001971: 'Manafication',
  1001233: 'Meikyo Shisui',
};
async function fetchPlayerAurasV2(reportCode, fight, targetId) {
  // プレイヤーに適用された全オーラ（バフ+デバフ）を取得し、デバフとPTバフに分離
  const debuffs = [];
  const partyBuffs = [];
  let startTime = null;
  const query = `
    query PlayerAuras($code: String!, $fightID: Int!, $targetID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: Buffs, fightIDs: [$fightID], targetID: $targetID, startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  const debuffNames = [
    'damage down', 'weakness', 'brink of death',
    '与ダメージ低下', '衰弱',
  ];
  let rawTotal = 0;
  let pageCount = 0;
  let debugMatchCount = { debuff: 0, burst: 0, self: 0 };
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), targetID: Number(targetId), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    rawTotal += rows.length;
    pageCount++;
    // 最初のページの詳細デバッグ
    if (pageCount === 1) {
      logDebug(`オーラ raw(target=${targetId}): page1=${rows.length}件`, rows.length > 0 ? {
        types: [...new Set(rows.slice(0, 50).map(e => e.type))],
        sample: rows.slice(0, 5).map(e => ({
          type: e.type,
          name: e.ability?.name || state.abilityById.get(Number(e.abilityGameID)) || '(unknown)',
          id: e.abilityGameID,
          dur: e.duration,
          src: e.sourceID,
        }))
      } : 'empty');
    }
    for (const e of rows) {
      const type = String(e?.type || '').toLowerCase();
      if (type !== 'applybuff' && type !== 'applydebuff') continue;
      const statusId = Number(e?.abilityGameID || e?.ability?.guid || 0);
      // ability名はAPIから取れない場合があるので、abilityByIdからも解決
      const abilityName = String(e?.ability?.name || state.abilityById.get(statusId) || '');
      const nameLower = abilityName.toLowerCase();
      const ts = Number(e?.timestamp || 0);
      const tSec = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
      const dur = Number(e?.duration || 0) / 1000;

      // デバフ判定: ステータスIDで判定（最優先）
      if (STATUS_DEBUFF_IDS.has(statusId)) {
        const kind = STATUS_DEBUFF_MAP[statusId] || 'damageDown';
        debuffs.push({ t: tSec, duration: dur > 0 ? dur : 10, kind, name: abilityName || DEBUFF_IDS[kind]?.nameJa || 'Debuff' });
        debugMatchCount.debuff++;
        continue;
      }
      // デバフ判定: 名前フォールバック
      if (abilityName && debuffNames.some(d => nameLower.includes(d))) {
        let kind = 'damageDown';
        if (nameLower.includes('weakness') || nameLower.includes('衰弱')) {
          kind = (nameLower.includes('brink') || nameLower.includes('強')) ? 'brink' : 'weakness';
        }
        debuffs.push({ t: tSec, duration: dur > 0 ? dur : 10, kind, name: abilityName });
        debugMatchCount.debuff++;
        continue;
      }

      // レイドバフ判定: ステータスIDで判定（最優先）
      const burstName = STATUS_BURST_BUFFS[statusId];
      if (burstName) {
        const buff = BURST_BUFFS.find(b => b.nameEn === burstName);
        if (buff) {
          partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName || burstName, duration: buff.duration });
          debugMatchCount.burst++;
          continue;
        }
      }
      // レイドバフ判定: 名前フォールバック
      const buff = findBurstBuff(statusId, abilityName);
      if (buff) {
        partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName || buff.nameEn, duration: buff.duration });
        debugMatchCount.burst++;
        continue;
      }

      // 自己バフ判定: ステータスIDで判定
      const selfName = STATUS_SELF_BUFFS[statusId];
      if (selfName) {
        const selfBuff = SELF_BUFFS.find(b => b.nameEn === selfName);
        if (selfBuff) {
          partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName || selfName, duration: selfBuff.duration });
          debugMatchCount.self++;
          continue;
        }
      }
      // 自己バフ判定: 名前フォールバック
      if (abilityName) {
        const selfBuff = findSelfBuff(abilityName);
        if (selfBuff) {
          partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName, duration: selfBuff.duration });
          debugMatchCount.self++;
        }
      }
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  logDebug(`オーラ取得(target=${targetId}): raw=${rawTotal}件 pages=${pageCount} デバフ=${debuffs.length}件 PTバフ=${partyBuffs.length}件`, debugMatchCount);
  return { debuffs, partyBuffs };
}
async function fetchFightDpsV2(reportCode, fightId) {
  const query = `
    query FightDps($code: String!, $fightID: [Int!]!) {
      reportData {
        report(code: $code) {
          table(dataType: DamageDone, fightIDs: $fightID)
        }
      }
    }
  `;
  try {
    const data = await graphqlRequest(query, { code: reportCode, fightID: [Number(fightId)] });
    const entries = data?.reportData?.report?.table?.data?.entries || [];
    if (entries.length) {
      const sample = entries[0];
      logDebug('DPS table sample', { keys: Object.keys(sample), name: sample.name, total: sample.total, activeTime: sample.activeTime, rDPS: sample.rDPS, aDPS: sample.aDPS });
    }
    return entries;
  } catch (e) {
    logDebug('DPS table取得失敗', { error: e.message });
    return [];
  }
}
function formatJobName(jobCode) {
  if (state.lang === 'ja') return JOB_NAME_JA[jobCode] || jobCode;
  return jobCode;
}
function findBurstBuff(actionId, actionName) {
  const id = Number(actionId);
  for (const buff of BURST_BUFFS) {
    if (buff.ids.includes(id)) return buff;
  }
  const n = String(actionName || '').toLowerCase();
  for (const buff of BURST_BUFFS) {
    if (n === buff.nameEn.toLowerCase() || n === buff.nameJa) return buff;
  }
  return null;
}
function computeRollingDps(damageEvents, maxT, windowSec = 15) {
  if (!damageEvents || !damageEvents.length) return [];
  const points = [];
  for (let t = 0; t <= maxT; t += 1) {
    const windowStart = Math.max(0, t - windowSec);
    let totalDamage = 0;
    for (const d of damageEvents) {
      if (d.t >= windowStart && d.t < t) totalDamage += d.amount;
    }
    const elapsed = Math.min(t, windowSec);
    points.push({ t, dps: elapsed > 0 ? totalDamage / elapsed : 0 });
  }
  return points;
}

function detectPhases(bossCasts, fightDurationSec, lastPhase) {
  // lastPhaseが2以上ならフェーズ有りが確定
  const hasMultiPhase = lastPhase && lastPhase > 1;

  if (!bossCasts || bossCasts.length < 2) {
    if (!hasMultiPhase) return [];
    // ボス詠唱がなくてもlastPhaseから均等分割で仮フェーズ生成
    const phases = [];
    for (let i = 1; i <= lastPhase; i++) {
      phases.push({
        id: i,
        startT: (i - 1) * fightDurationSec / lastPhase,
        endT: i * fightDurationSec / lastPhase,
        label: `P${i}`,
      });
    }
    logDebug(`フェーズ: lastPhase=${lastPhase}から均等分割`, phases.map(p => p.label));
    return phases;
  }

  // ボス詠唱ギャップから検出（3秒以上で区切り）
  const minGap = 3;
  const phases = [{ id: 1, startT: 0, label: 'P1' }];
  let lastEndT = 0;
  for (const c of bossCasts) {
    if (c.t - lastEndT > minGap && lastEndT > 3) {
      phases.push({ id: phases.length + 1, startT: c.t, label: `P${phases.length + 1}` });
    }
    lastEndT = Math.max(lastEndT, c.endT || c.t);
  }
  for (let i = 0; i < phases.length; i++) {
    phases[i].endT = i < phases.length - 1 ? phases[i + 1].startT : fightDurationSec;
  }

  // lastPhaseがあってフェーズ数が合わない場合、lastPhaseを信頼
  if (hasMultiPhase && phases.length < lastPhase) {
    logDebug(`フェーズ: ギャップ検出=${phases.length}個 < lastPhase=${lastPhase} → ギャップ検出結果を使用`);
  }

  return phases.length > 1 ? phases : [];
}

function formatHitType(hitType, multistrike) {
  const isCrit = hitType === 2;
  const isDH = !!multistrike;
  if (isCrit && isDH) return 'CDH';
  if (isCrit) return 'Crit';
  if (isDH) return 'DH';
  return '';
}
async function fetchPlayerDamageV2(reportCode, fight, sourceId) {
  const all = [];
  let startTime = null;
  const query = `
    query PlayerDamage($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: DamageDone, fightIDs: [$fightID], sourceID: $sourceID, startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), sourceID: Number(sourceId), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    for (const e of rows) {
      const actionId = Number(e?.abilityGameID || e?.ability?.guid || 0);
      const ts = Number(e?.timestamp || 0);
      if (!actionId || !ts) continue;
      const t = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
      all.push({
        t,
        actionId,
        amount: Number(e?.amount || 0),
        hitType: Number(e?.hitType || 0),
        multistrike: !!e?.multistrike,
      });
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  return all;
}
function correlateDamage(timeline, damageEvents) {
  const dmgByAction = new Map();
  for (const d of damageEvents) {
    const key = d.actionId;
    if (!dmgByAction.has(key)) dmgByAction.set(key, []);
    dmgByAction.get(key).push(d);
  }
  for (const ev of timeline) {
    const candidates = dmgByAction.get(ev.actionId) || [];
    let best = null;
    let bestDist = Infinity;
    for (const d of candidates) {
      const dist = Math.abs(d.t - ev.t);
      if (dist < bestDist && dist < 3) {
        bestDist = dist;
        best = d;
      }
    }
    if (best) {
      ev.damage = best.amount;
      ev.hitType = best.hitType;
      ev.multistrike = best.multistrike;
      const idx = candidates.indexOf(best);
      if (idx !== -1) candidates.splice(idx, 1);
    }
  }
}
function filterTimelineByPhase(records) {
  if (!state.currentPhase) return records;
  const p = state.currentPhase;
  return records.filter(r => r.t >= p.startT && r.t < p.endT);
}

function renderTimeline() {
  let a = filterTimeline(state.timelineA, state.currentTab);
  let b = filterTimeline(state.timelineB, state.currentTab);
  a = filterTimelineByPhase(a);
  b = filterTimelineByPhase(b);
  let bossCasts = state.bossCastsA || [];
  if (state.currentPhase) {
    const p = state.currentPhase;
    bossCasts = bossCasts.filter(c => c.t >= p.startT && c.endT <= p.endT + 5);
  }
  const maxT = Math.max(1, ...a.map(x => x.t), ...b.map(x => x.t));
  const pxPerSec = 16 * state.zoom;
  const width = Math.max(1800, maxT * pxPerSec + 220);
  const labelA = state.selectedA?.name || 'A';
  const labelB = state.selectedB?.name || 'B';
  const jobA = state.selectedA?.job || '';
  const jobB = state.selectedB?.job || '';

  // DPSグラフの有無
  const hasDps = state.rollingDpsA.length > 0 || state.rollingDpsB.length > 0;
  const dpsGraphHeight = hasDps ? 80 : 0;
  const dpsGraphTop = hasDps ? 4 : 0;

  // Layout: DPS graph → ruler → boss track → player A → divider → player B
  const rulerTop = dpsGraphTop + dpsGraphHeight;
  const bossTrackTop = rulerTop + 18;
  const bossTrackH = 24;
  const playerAStart = bossTrackTop + bossTrackH + 12;
  const laneTop = {
    a_ogcd: playerAStart + 10,
    a_gcd: playerAStart + 64,
    a_debuff: playerAStart + 120,
    b_ogcd: 0,
    b_gcd: 0,
    b_debuff: 0,
  };
  const trackATop = playerAStart;
  const trackAHeight = 110;
  const debuffATop = laneTop.a_debuff;
  const debuffAHeight = 22;
  const dividerTop = debuffATop + debuffAHeight + 16;
  const trackBTop = dividerTop + 30;
  const trackBHeight = 110;
  laneTop.b_ogcd = trackBTop + 10;
  laneTop.b_gcd = trackBTop + 64;
  laneTop.b_debuff = trackBTop + 120;
  const debuffBTop = laneTop.b_debuff;
  const debuffBHeight = 22;
  const totalHeight = debuffBTop + debuffBHeight + 20;

  const isGcd = r => r.category === 'weaponskill' || r.category === 'spell';

  const buildDpsGraph = () => {
    if (!hasDps) return '';
    let dpsA = state.rollingDpsA;
    let dpsB = state.rollingDpsB;
    if (state.currentPhase) {
      const p = state.currentPhase;
      dpsA = dpsA.filter(d => d.t >= p.startT && d.t <= p.endT);
      dpsB = dpsB.filter(d => d.t >= p.startT && d.t <= p.endT);
    }
    if (state.currentTab === 'odd') {
      dpsA = dpsA.filter(d => Math.floor(d.t / 60) % 2 === 1);
      dpsB = dpsB.filter(d => Math.floor(d.t / 60) % 2 === 1);
    } else if (state.currentTab === 'even') {
      dpsA = dpsA.filter(d => Math.floor(d.t / 60) % 2 === 0 && d.t >= 60);
      dpsB = dpsB.filter(d => Math.floor(d.t / 60) % 2 === 0 && d.t >= 60);
    }
    const maxDps = Math.max(...dpsA.map(p => p.dps), ...dpsB.map(p => p.dps), 1);
    const gH = dpsGraphHeight - 10;
    const toPoints = (pts, color) => {
      if (!pts.length) return '';
      const coords = pts.map(p => {
        const x = 60 + p.t * pxPerSec;
        const y = dpsGraphTop + gH - (p.dps / maxDps) * (gH - 5);
        return `${x},${y}`;
      }).join(' ');
      return `<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.8" />`;
    };
    // Y軸ラベル
    const labels = [];
    for (let i = 0; i <= 2; i++) {
      const dps = maxDps * i / 2;
      const y = dpsGraphTop + gH - (dps / maxDps) * (gH - 5);
      const label = dps >= 1000 ? `${(dps / 1000).toFixed(0)}k` : dps.toFixed(0);
      labels.push(`<text x="55" y="${y + 3}" text-anchor="end" fill="#64748b" font-size="9">${label}</text>`);
    }
    return `<svg class="dps-graph-svg" style="position:absolute; left:0; top:0; width:${width}px; height:${dpsGraphTop + dpsGraphHeight}px; pointer-events:none; overflow:visible;">
      <rect x="60" y="${dpsGraphTop}" width="${maxT * pxPerSec}" height="${gH}" fill="#0f172a" rx="4" opacity="0.5" />
      ${labels.join('')}
      <text x="62" y="${dpsGraphTop + 10}" fill="#38bdf8" font-size="9">${labelA}</text>
      <text x="${62 + labelA.length * 7 + 10}" y="${dpsGraphTop + 10}" fill="#f97316" font-size="9">${labelB}</text>
      ${toPoints(dpsA, '#38bdf8')}
      ${toPoints(dpsB, '#f97316')}
    </svg>`;
  };

  const buildRulerAtTop = () => {
    const marks = [];
    for (let sec = 0; sec <= Math.ceil(maxT); sec++) {
      const x = 60 + sec * pxPerSec;
      const level = sec % 10 === 0 ? 'ten' : sec % 5 === 0 ? 'five' : 'one';
      const label = sec % 5 === 0 ? `<span>${sec}s</span>` : '';
      marks.push(`<div class="tick ${level}" style="left:${x}px; top:${rulerTop}px">${label}</div>`);
    }
    return marks.join('');
  };

  const buildBossTrack = () => {
    if (!bossCasts.length) return '';
    return bossCasts.map(c => {
      const x = 60 + c.t * pxPerSec;
      const w = Math.max(4, c.duration * pxPerSec);
      return `<div class="boss-cast" style="left:${x}px; top:${bossTrackTop}px; width:${w}px;" title="${c.t.toFixed(1)}s - ${c.endT.toFixed(1)}s ${c.name}"><span class="boss-cast-name">${c.name}</span></div>`;
    }).join('');
  };

  const buildBuffOverlays = (records, owner) => {
    const overlays = [];
    const baseTop = owner === 'a' ? trackATop : trackBTop;
    const h = owner === 'a' ? trackAHeight : trackBHeight;
    for (const r of records) {
      const buff = findBurstBuff(r.actionId, r.action) || findSelfBuff(r.action);
      if (!buff) continue;
      const x = 60 + r.t * pxPerSec;
      const w = buff.duration * pxPerSec;
      const label = state.lang === 'ja' ? buff.nameJa : buff.nameEn;
      overlays.push(`<div class="burst-overlay" style="left:${x}px; top:${baseTop}px; width:${w}px; height:${h}px; background:${buff.color}20; border-left:2px solid ${buff.color}60;"><span class="burst-label" style="color:${buff.color}">${label}</span></div>`);
    }
    return overlays.join('');
  };

  const buildDebuffTrack = (debuffs, top) => {
    if (!debuffs || !debuffs.length) return '';
    let filtered = debuffs;
    if (state.currentPhase) {
      const p = state.currentPhase;
      filtered = debuffs.filter(d => d.t >= p.startT && d.t < p.endT);
    }
    return filtered.map(d => {
      const x = 60 + d.t * pxPerSec;
      const w = Math.max(6, d.duration * pxPerSec);
      const info = DEBUFF_IDS[d.kind] || DEBUFF_IDS.damageDown;
      const label = state.lang === 'ja' ? info.nameJa : info.nameEn;
      return `<div class="debuff-bar" style="left:${x}px; top:${top}px; width:${w}px; background:${info.color}40; border-left:2px solid ${info.color};" title="${d.t.toFixed(1)}s ${label} (${d.duration.toFixed(1)}s)"><span class="debuff-label">${label}</span></div>`;
    }).join('');
  };

  const buildPhaseLines = () => {
    if (!state.phases || state.phases.length < 2) return '';
    return state.phases.slice(1).map(phase => {
      const x = 60 + phase.startT * pxPerSec;
      return `<div class="phase-divider" style="left:${x}px; top:${rulerTop}px; height:${totalHeight - rulerTop}px">
        <span class="phase-divider-label">${phase.label}</span>
      </div>`;
    }).join('');
  };

  const buildEvents = (records, owner, partyBuffs) => {
    const lanesLastX = { gcd: -999, ogcd: -999 };
    const minGap = 24;
    return records.map(r => {
      const lane = isGcd(r) ? 'gcd' : 'ogcd';
      const baseX = 60 + r.t * pxPerSec;
      const x = Math.max(baseX, lanesLastX[lane] + minGap);
      lanesLastX[lane] = x;
      const icon = r.icon || '';
      const fallback = (r.label || r.action || '?').slice(0, 2).toUpperCase();
      const top = laneTop[`${owner}_${lane}`];
      const candidates = (r.iconCandidates || []).join('|');
      let tooltip = `${r.t.toFixed(1)}s ${r.label || r.action}`;
      if (r.damage != null && r.damage > 0) {
        tooltip += `\n${state.lang === 'ja' ? 'ダメージ' : 'Damage'}: ${r.damage.toLocaleString()}`;
        const ht = formatHitType(r.hitType, r.multistrike);
        if (ht) tooltip += ` (${ht})`;
      }
      const synergies = getActiveSynergies(r.t, records, partyBuffs);
      if (synergies.length) {
        tooltip += `\n${state.lang === 'ja' ? 'バフ' : 'Buffs'}: ${synergies.join(', ')}`;
      }
      return `<div class="event ${owner} ${lane}" style="left:${x}px; top:${top}px" title="${tooltip}">${icon ? `<img class="event-icon" src="${icon}" data-fallbacks="${candidates}" alt="${r.label || r.action}" />` : `<span>${fallback}</span>`}</div>`;
    }).join('');
  };

  el.timelineWrap.innerHTML = `
    <div class="timeline" style="width:${width}px; height:${totalHeight}px">
      ${buildDpsGraph()}
      ${buildRulerAtTop()}
      <div class="lane-label" style="top:${bossTrackTop - 2}px; font-weight:bold; color:#f87171">${t('laneBoss')}</div>
      ${buildBossTrack()}
      <div class="player-label" style="top:${playerAStart - 4}px">${labelA}${jobA ? ' (' + formatJobName(jobA) + ')' : ''}</div>
      <div class="lane-label" style="top:${laneTop.a_ogcd + 12}px">${t('laneAbility')}</div>
      <div class="track a" style="top:${trackATop}px; height:${trackAHeight}px"></div>
      <div class="lane-label" style="top:${laneTop.a_gcd + 12}px">${t('laneGcd')}</div>
      ${buildBuffOverlays(a, 'a')}
      <div class="lane-label" style="top:${debuffATop + 4}px; color:#ef4444">${t('laneDebuff')}</div>
      ${buildDebuffTrack(state.debuffsA, debuffATop)}
      <div class="player-divider" style="top:${dividerTop}px"></div>
      <div class="player-label" style="top:${dividerTop + 10}px">${labelB}${jobB ? ' (' + formatJobName(jobB) + ')' : ''}</div>
      <div class="lane-label" style="top:${laneTop.b_ogcd + 12}px">${t('laneAbility')}</div>
      <div class="track b" style="top:${trackBTop}px; height:${trackBHeight}px"></div>
      <div class="lane-label" style="top:${laneTop.b_gcd + 12}px">${t('laneGcd')}</div>
      ${buildBuffOverlays(b, 'b')}
      <div class="lane-label" style="top:${debuffBTop + 4}px; color:#ef4444">${t('laneDebuff')}</div>
      ${buildDebuffTrack(state.debuffsB, debuffBTop)}
      ${buildEvents(a, 'a', state.partyBuffsA)}
      ${buildEvents(b, 'b', state.partyBuffsB)}
      ${buildPhaseLines()}
    </div>
  `;
  el.timelineWrap.querySelectorAll('img.event-icon').forEach(img => {
    const queue = (img.dataset.fallbacks || '').split('|').filter(Boolean);
    const seen = new Set([img.getAttribute('src')]);
    img.addEventListener('error', () => {
      while (queue.length) {
        const next = queue.shift();
        if (!seen.has(next)) {
          seen.add(next);
          img.src = next;
          return;
        }
      }
      img.replaceWith(Object.assign(document.createElement('span'), { textContent: (img.alt || '?').slice(0, 2).toUpperCase() }));
    });
  });
}
function renderPhaseButtons() {
  const container = el.phaseContainer;
  if (!container) return;
  container.innerHTML = '';
  if (!state.phases.length) return;
  // 「全フェーズ」ボタン
  const allBtn = document.createElement('button');
  allBtn.className = 'phase-btn' + (state.currentPhase === null ? ' active' : '');
  allBtn.textContent = t('phaseAll');
  allBtn.addEventListener('click', () => {
    state.currentPhase = null;
    renderPhaseButtons();
    renderTimeline();
  });
  container.appendChild(allBtn);
  // 各フェーズボタン
  for (const phase of state.phases) {
    const btn = document.createElement('button');
    const isActive = state.currentPhase && state.currentPhase.id === phase.id;
    btn.className = 'phase-btn' + (isActive ? ' active' : '');
    btn.textContent = phase.label;
    btn.title = `${phase.startT.toFixed(0)}s - ${phase.endT.toFixed(0)}s`;
    btn.addEventListener('click', () => {
      state.currentPhase = phase;
      renderPhaseButtons();
      renderTimeline();
    });
    container.appendChild(btn);
  }
}
