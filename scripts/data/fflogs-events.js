(function () {
const {
  graphqlRequest,
  getActionMeta,
  normalizeActionCategory,
} = globalThis.FFLogsReport;

async function fetchPlayerTimelineV2(reportCode, fight, sourceId, playerJobCode = '') {
  const all = [];
  const pendingBegincast = new Map();
  let startTime = null;
  const query = `
    query PlayerCasts($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
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
  while (true) {
    const vars = {
      code: reportCode,
      fightID: Number(fight.id),
      sourceID: Number(sourceId),
      startTime,
    };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    if (rows.length && all.length === 0) logDebug("events sample", rows[0]);
    for (const e of rows) {
      const actionId = Number(e?.abilityGameID || e?.ability?.guid || 0);
      const resolvedName = e?.ability?.name || e?.abilityName || state.abilityById.get(actionId) || '';
      const meta = getActionMeta(resolvedName, actionId, playerJobCode);
      const name = meta.label || resolvedName || '';
      const ts = Number(e?.timestamp || 0);
      if (!name || !ts) continue;
      const t = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
      const type = String(e?.type || '').toLowerCase();
      const key = String(actionId || name);
      if (type === 'begincast') {
        if (!pendingBegincast.has(key)) pendingBegincast.set(key, []);
        pendingBegincast.get(key).push({
          t,
          action: String(name),
          actionId,
          category: normalizeActionCategory(meta.category, name, playerJobCode),
          icon: meta.icon,
          iconCandidates: meta.iconCandidates || [],
          label: meta.label,
        });
        continue;
      }
      if (type === 'cast' && pendingBegincast.has(key) && pendingBegincast.get(key).length) {
        const startEvent = pendingBegincast.get(key).shift();
        all.push({ ...startEvent, castEndT: t });
        continue;
      }
      all.push({
        t,
        action: String(name),
        actionId,
        category: normalizeActionCategory(meta.category, name, playerJobCode),
        icon: meta.icon,
        iconCandidates: meta.iconCandidates || [],
        label: meta.label,
      });
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  return all.sort((a, b) => a.t - b.t);
}

function getEnemyActorsForFight(reportJson, fight) {
  const friendlyIds = new Set((fight?.friendlyPlayers || []).map((id) => Number(id)));
  const candidates = (reportJson?.masterData?.actors || []).filter((actor) => {
    const id = Number(actor?.id || 0);
    if (!id || friendlyIds.has(id)) return false;
    const type = String(actor?.type || '').toLowerCase();
    const subType = String(actor?.subType || '').toLowerCase();
    return type === 'boss' || type === 'npc' || subType === 'boss';
  });
  const bosses = candidates.filter((actor) => {
    const type = String(actor?.type || '').toLowerCase();
    const subType = String(actor?.subType || '').toLowerCase();
    return type === 'boss' || subType === 'boss';
  });
  if (bosses.length) return bosses;
  const fightName = String(fight?.name || '').toLowerCase();
  const named = candidates.filter((actor) => fightName && String(actor?.name || '').toLowerCase().includes(fightName));
  return named.length ? named : candidates.slice(0, 8);
}

async function fetchActionNamesJa(actionIds) {
  const ids = [...new Set((actionIds || []).map((id) => Number(id || 0)).filter(Boolean))];
  const result = new Map();
  const missing = ids.filter((id) => {
    if (state.bossActionNameJaById?.has(id)) {
      result.set(id, state.bossActionNameJaById.get(id));
      return false;
    }
    return true;
  });
  if (!missing.length || typeof fetch !== 'function') return result;
  if (!state.bossActionNameJaById) state.bossActionNameJaById = new Map();
  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50);
    try {
      const url = `https://v2.xivapi.com/api/sheet/Action?rows=${chunk.join(',')}&fields=Name&language=ja`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const row of data?.rows || []) {
        const id = Number(row?.row_id || 0);
        const name = String(row?.fields?.Name || '');
        if (!id || !name) continue;
        state.bossActionNameJaById.set(id, name);
        result.set(id, name);
      }
    } catch {
      // Keep English FF Logs names if XIVAPI is unavailable.
    }
  }
  return result;
}

async function fetchBossCastsV2(reportCode, fight, reportJson) {
  const actorsById = new Map((reportJson?.masterData?.actors || []).map((actor) => [Number(actor?.id || 0), actor]));
  const friendlyIds = new Set((fight?.friendlyPlayers || []).map((id) => Number(id)));
  const isFriendlySource = (sourceId) => {
    const id = Number(sourceId || 0);
    if (!id) return false;
    if (friendlyIds.has(id)) return true;
    const actor = actorsById.get(id);
    return actor?.petOwner && friendlyIds.has(Number(actor.petOwner));
  };
  const query = `
    query BossCasts($code: String!, $fightID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: Casts, fightIDs: [$fightID], hostilityType: Enemies, startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  const all = [];
  const pending = new Map();
  let startTime = null;
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    for (const event of rows) {
      const sourceId = Number(event?.sourceID || event?.source?.id || 0);
      if (isFriendlySource(sourceId)) continue;
      const type = String(event?.type || '').toLowerCase();
      const actionId = Number(event?.abilityGameID || event?.ability?.guid || 0);
      const name = String(event?.ability?.name || event?.abilityName || state.abilityById.get(actionId) || '');
      const ts = Number(event?.timestamp || 0);
      if (!name || !ts) continue;
      const t = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
      const sourceActor = actorsById.get(sourceId);
      const key = `${sourceId}:${actionId || name}`;
      if (type === 'begincast') {
        const durationMs = Number(event?.duration || 0);
        const actorType = String(sourceActor?.type || '').toLowerCase();
        const actorSubType = String(sourceActor?.subType || '').toLowerCase();
        const isBoss = actorType === 'boss' || actorSubType === 'boss';
        if (!pending.has(key)) pending.set(key, []);
        pending.get(key).push({
          t,
          endT: t + Math.max(0.1, durationMs / 1000),
          action: name,
          actionId,
          label: name,
          sourceId: String(sourceId || ''),
          sourceName: event?.source?.name || sourceActor?.name || '',
          isBoss,
          bossActorId: isBoss ? sourceId : 0,
        });
        continue;
      }
      if (type === 'cast' && pending.has(key) && pending.get(key).length) {
        const start = pending.get(key).shift();
        all.push({ ...start, endT: Math.max(t, start.t + 0.1) });
      }
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  for (const starts of pending.values()) all.push(...starts);
  const jaNamesById = await fetchActionNamesJa(all.map((record) => record.actionId));
  for (const record of all) {
    const labelEn = record.label || record.action || '';
    const labelJa = jaNamesById.get(Number(record.actionId || 0)) || labelEn;
    record.actionEn = record.action || labelEn;
    record.labelEn = labelEn;
    record.actionJa = labelJa;
    record.labelJa = labelJa;
    record.label = state.lang === 'ja' ? labelJa : labelEn;
  }
  return all.sort((a, b) => a.t - b.t);
}

function findTrackedPlayerDebuff(actionName, actionId) {
  const name = String(actionName || '').toLowerCase();
  const id = Number(actionId || 0);
  const tracked = [
    { labelJa: '衰弱', labelEn: 'Weakness', names: ['weakness', '衰弱'], color: '#a78bfa' },
    { labelJa: '衰弱[強]', labelEn: 'Brink of Death', names: ['brink of death', '衰弱[強]', '衰弱［強］'], color: '#c084fc' },
    { labelJa: 'ダメージ低下', labelEn: 'Damage Down', names: ['damage down', 'ダメージ低下'], color: '#f87171' },
  ];
  return tracked.find((debuff) => (
    debuff.names.some((candidate) => name.includes(candidate.toLowerCase()))
    || (id && debuff.ids?.includes(id))
  )) || null;
}

async function fetchPlayerDebuffsV2(reportCode, fight, targetId) {
  const query = `
    query PlayerDebuffs($code: String!, $fightID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: Debuffs, fightIDs: [$fightID], startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  const all = [];
  const pending = new Map();
  let startTime = null;
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    for (const event of rows) {
      const eventTargetId = Number(event?.targetID || event?.target?.id || 0);
      if (eventTargetId !== Number(targetId)) continue;
      const type = String(event?.type || '').toLowerCase();
      const actionId = Number(event?.abilityGameID || event?.ability?.guid || event?.status?.guid || 0);
      const name = String(event?.ability?.name || event?.status?.name || event?.abilityName || state.abilityById.get(actionId) || '');
      const debuff = findTrackedPlayerDebuff(name, actionId);
      const ts = Number(event?.timestamp || 0);
      if (!debuff || !ts) continue;
      const t = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
      const durationMs = Number(event?.duration || 0);
      const key = String(actionId || debuff.labelEn);
      if (type.includes('remove')) {
        const start = pending.get(key)?.shift();
        if (start) all.push({ ...start, endT: Math.max(t, start.t + 0.1) });
        continue;
      }
      if (type.includes('apply') || type.includes('refresh')) {
        if (!pending.has(key)) pending.set(key, []);
        pending.get(key).push({
          t,
          endT: t + Math.max(0.1, durationMs ? durationMs / 1000 : 30),
          action: debuff.labelEn,
          actionId,
          label: state.lang === 'ja' ? debuff.labelJa : debuff.labelEn,
          color: debuff.color,
        });
      }
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  for (const starts of pending.values()) all.push(...starts);
  const seen = new Set();
  return all
    .filter((event) => {
      const key = `${Math.round(event.t * 10)}:${event.actionId || event.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.t - b.t);
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
    const entries = (data?.reportData?.report?.table?.data?.entries || []).filter(Boolean);
    if (entries.length) {
      const sample = entries[0];
      logDebug('DPS table sample', { keys: Object.keys(sample), name: sample.name, total: sample.total, activeTime: sample.activeTime, rDPS: sample.rDPS, aDPS: sample.aDPS });
    }
    return entries;
  } catch (e) {
    logError('DPS table fetch failed', { error: e.message });
    return [];
  }
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

async function fetchPartyDamageV2(reportCode, fight) {
  const all = [];
  const friendlyIds = new Set((fight?.friendlyPlayers || []).map((id) => Number(id)));
  let startTime = null;
  const query = `
    query PartyDamage($code: String!, $fightID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: DamageDone, fightIDs: [$fightID], startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    for (const e of rows) {
      const sourceId = Number(e?.sourceID || e?.source?.id || 0);
      if (friendlyIds.size && !friendlyIds.has(sourceId)) continue;
      const actionId = Number(e?.abilityGameID || e?.ability?.guid || 0);
      const ts = Number(e?.timestamp || 0);
      if (!actionId || !ts) continue;
      all.push({
        t: Math.max(0, (ts - Number(fight.startTime || 0)) / 1000),
        actionId,
        amount: Number(e?.amount || 0),
        sourceId,
      });
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  return all;
}

async function fetchPlayerHealingV2(reportCode, fight, sourceId) {
  const all = [];
  let startTime = null;
  const query = `
    query PlayerHealing($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: Healing, fightIDs: [$fightID], sourceID: $sourceID, startTime: $startTime) {
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
        overheal: Number(e?.overheal || 0),
      });
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  return all;
}

const PARTY_SYNERGY_ACTIONS = [
  { ids: [7396], nameEn: 'Brotherhood', nameJa: '桃園結義', duration: 20, color: '#f472b6' },
  { ids: [7398], nameEn: 'Battle Litany', nameJa: 'バトルリタニー', duration: 20, color: '#60a5fa' },
  { ids: [24405], nameEn: 'Arcane Circle', nameJa: 'アルケインサークル', duration: 20, color: '#c084fc' },
  { ids: [118, 25786], nameEn: 'Battle Voice', nameJa: 'バトルボイス', duration: 20, color: '#a3e635' },
  { ids: [25785], nameEn: 'Radiant Finale', nameJa: '光神のフィナーレ', duration: 20, color: '#fb923c' },
  {
    ids: [],
    nameEn: 'Quadruple Technical Finish',
    nameJa: 'クワッド・テクニカルフィニッシュ',
    duration: 20,
    color: '#34d399',
    aliases: ['Quad Technical Finish', 'Quad. Technical Finish', 'クワッドテクニカルフィニッシュ'],
  },
  { ids: [25801], nameEn: 'Searing Light', nameJa: 'シアリングライト', duration: 20, color: '#fcd34d' },
  { ids: [7520], nameEn: 'Embolden', nameJa: 'エンボルデン', duration: 20, color: '#f87171' },
  { ids: [], nameEn: 'Starry Muse', nameJa: 'イマジンスカイ', duration: 20, color: '#38bdf8', aliases: ['Imagined Sky', 'スターリーミューズ'] },
  { ids: [16552], nameEn: 'Divination', nameJa: 'ディヴィネーション', duration: 20, color: '#fbbf24' },
  { ids: [36871], nameEn: 'Dokumori', nameJa: '毒盛の術', duration: 20, color: '#86efac' },
  { ids: [7436], nameEn: 'Chain Stratagem', nameJa: '連環計', duration: 20, color: '#a78bfa' },
];

function normalizeSynergyName(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findPartySynergyAction(actionId, actionName) {
  const id = Number(actionId || 0);
  if (id) {
    const byId = PARTY_SYNERGY_ACTIONS.find((action) => action.ids.includes(id));
    if (byId) return byId;
  }
  const normalized = normalizeSynergyName(actionName);
  if (!normalized) return null;
  return PARTY_SYNERGY_ACTIONS.find((action) => {
    const names = [action.nameEn, action.nameJa, ...(action.aliases || [])];
    return names.some((name) => normalizeSynergyName(name) === normalized);
  }) || null;
}

async function fetchPartySynergyCastsV2(reportCode, fight, players, selectedPlayerId) {
  const partyMembers = (players || []).filter((player) => String(player.id) !== String(selectedPlayerId));
  const query = `
    query PartySynergyCasts($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
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
  const all = [];
  await Promise.all(partyMembers.map(async (player) => {
    let startTime = null;
    while (true) {
      const vars = { code: reportCode, fightID: Number(fight.id), sourceID: Number(player.id), startTime };
      const data = await graphqlRequest(query, vars);
      const block = data?.reportData?.report?.events;
      const rows = block?.data || [];
      for (const event of rows) {
        const type = String(event?.type || '').toLowerCase();
        if (type !== 'cast') continue;
        const actionId = Number(event?.abilityGameID || event?.ability?.guid || 0);
        const abilityName = String(event?.ability?.name || event?.abilityName || state.abilityById.get(actionId) || '');
        const synergy = findPartySynergyAction(actionId, abilityName);
        if (!synergy) continue;
        const laneOrder = PARTY_SYNERGY_ACTIONS.indexOf(synergy);
        const meta = getActionMeta(abilityName || synergy.nameEn, actionId, player.job);
        const icon = synergy.icon || meta.icon;
        const iconCandidates = synergy.icon
          ? [synergy.icon, ...(meta.iconCandidates || [])]
          : (meta.iconCandidates || []);
        const ts = Number(event?.timestamp || 0);
        if (!ts) continue;
        all.push({
          t: Math.max(0, (ts - Number(fight.startTime || 0)) / 1000),
          actionId,
          action: synergy.nameEn,
          label: state.lang === 'ja' ? synergy.nameJa : synergy.nameEn,
          laneKey: synergy.nameEn,
          laneOrder: laneOrder >= 0 ? laneOrder : 999,
          duration: synergy.duration,
          color: synergy.color,
          icon,
          iconCandidates,
          sourceId: String(player.id),
          sourceName: player.name || '',
          sourceJob: player.job || '',
        });
      }
      if (!block?.nextPageTimestamp) break;
      startTime = block.nextPageTimestamp;
    }
  }));
  const seen = new Set();
  return all
    .sort((a, b) => a.t - b.t)
    .filter((record) => {
      const key = `${record.sourceId}:${record.actionId || record.action}:${Math.round(record.t * 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

Object.assign(globalThis, {
  FFLogsEvents: {
    fetchFightDpsV2,
    fetchPartyDamageV2,
    fetchPlayerDamageV2,
    fetchPlayerHealingV2,
    fetchPlayerTimelineV2,
    fetchBossCastsV2,
    fetchPlayerDebuffsV2,
    fetchPartySynergyCastsV2,
  },
});
}());
