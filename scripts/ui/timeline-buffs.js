// Timeline buff matching and aura lookup helpers
const STATUS_BURST_BUFFS = {
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
  1000141: 'Battle Voice',
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

function findSelfBuff(actionName) {
  return globalThis.BuffUtils.findSelfBuff(actionName, SELF_BUFFS);
}

function findTinctureBuff(actionName) {
  const normalized = String(actionName || '').toLowerCase();
  if (normalized.includes('tincture') || normalized.includes('potion') || normalized.includes('薬')) {
    return { nameEn: 'Tincture', nameJa: '薬', duration: 30, color: '#e879f9' };
  }
  return null;
}

function getActiveSynergies(t, allRecords, partyBuffRecords) {
  return globalThis.BuffUtils.getActiveSynergies(t, allRecords, partyBuffRecords, {
    burstBuffs: BURST_BUFFS,
    selfBuffs: SELF_BUFFS,
    lang: state.lang,
  });
}

async function fetchPlayerAurasV2(reportCode, fight, targetId) {
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
  let rawTotal = 0;
  let pageCount = 0;
  let debugMatchCount = { burst: 0, self: 0 };
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), targetID: Number(targetId), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    rawTotal += rows.length;
    pageCount++;
    if (pageCount === 1) {
      logDebug(`auras raw(target=${targetId}): page1=${rows.length}`, rows.length > 0 ? {
        types: [...new Set(rows.slice(0, 50).map((event) => event.type))],
        sample: rows.slice(0, 5).map((event) => ({
          type: event.type,
          name: event.ability?.name || state.abilityById.get(Number(event.abilityGameID)) || '(unknown)',
          id: event.abilityGameID,
          dur: event.duration,
          src: event.sourceID,
        })),
      } : 'empty');
    }
    for (const event of rows) {
      const type = String(event?.type || '').toLowerCase();
      const isBuffApply = type === 'applybuff' || type === 'refreshbuff';
      if (!isBuffApply) continue;
      const statusId = Number(event?.abilityGameID || event?.ability?.guid || 0);
      const abilityName = String(event?.ability?.name || state.abilityById.get(statusId) || '');
      const ts = Number(event?.timestamp || 0);
      const tSec = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);

      const burstName = STATUS_BURST_BUFFS[statusId];
      if (burstName) {
        const buff = BURST_BUFFS.find((entry) => entry.nameEn === burstName);
        if (buff) {
          partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName || burstName, duration: buff.duration });
          debugMatchCount.burst++;
          continue;
        }
      }
      const buff = findBurstBuff(statusId, abilityName);
      if (buff) {
        partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName || buff.nameEn, duration: buff.duration });
        debugMatchCount.burst++;
        continue;
      }

      const selfName = STATUS_SELF_BUFFS[statusId];
      if (selfName) {
        const selfBuff = SELF_BUFFS.find((entry) => entry.nameEn === selfName);
        if (selfBuff) {
          partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName || selfName, duration: selfBuff.duration });
          debugMatchCount.self++;
          continue;
        }
      }
      if (abilityName) {
        const selfBuff = findSelfBuff(abilityName);
        if (selfBuff) {
          partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName, duration: selfBuff.duration });
          debugMatchCount.self++;
          continue;
        }
      }
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  logDebug(`auras(target=${targetId}): raw=${rawTotal} pages=${pageCount} PTbuff=${partyBuffs.length}`, debugMatchCount);
  return partyBuffs;
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
  const normalized = String(actionName || '').toLowerCase();
  for (const buff of BURST_BUFFS) {
    if (normalized === buff.nameEn.toLowerCase() || normalized === buff.nameJa) return buff;
  }
  return null;
}

Object.assign(globalThis, {
  fetchPlayerAurasV2,
  findBurstBuff,
  findSelfBuff,
  findTinctureBuff,
  formatJobName,
  getActiveSynergies,
});
