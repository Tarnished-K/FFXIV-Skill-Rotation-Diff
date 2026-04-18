(function attachBuffUtils(root, factory) {
  const exports = factory();
  root.BuffUtils = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createBuffUtils() {
  function findBurstBuff(actionId, actionName, burstBuffs = []) {
    const id = Number(actionId);
    for (const buff of burstBuffs) {
      if (buff.ids.includes(id)) return buff;
    }
    const normalized = String(actionName || '').toLowerCase();
    for (const buff of burstBuffs) {
      if (normalized === buff.nameEn.toLowerCase() || normalized === buff.nameJa) return buff;
    }
    return null;
  }

  function findSelfBuff(actionName, selfBuffs = []) {
    const normalized = String(actionName || '').toLowerCase();
    for (const buff of selfBuffs) {
      if (
        normalized === String(buff.nameEn || '').toLowerCase()
        || normalized === String(buff.nameJa || '').toLowerCase()
      ) {
        return buff;
      }
    }
    return null;
  }

  function getActiveSynergies(t, allRecords, partyBuffRecords, options = {}) {
    const burstBuffs = options.burstBuffs || [];
    const selfBuffs = options.selfBuffs || [];
    const lang = options.lang === 'ja' ? 'ja' : 'en';
    const active = new Set();

    for (const record of (allRecords || [])) {
      const buff = findBurstBuff(record.actionId, record.action, burstBuffs)
        || findSelfBuff(record.action, selfBuffs);
      if (!buff) continue;
      if (t >= record.t && t <= record.t + buff.duration) {
        active.add(lang === 'ja' ? buff.nameJa : buff.nameEn);
      }
    }

    for (const record of (partyBuffRecords || [])) {
      const duration = record.duration || 20;
      if (t < record.t || t > record.t + duration) continue;
      const buff = findBurstBuff(record.actionId, record.action, burstBuffs)
        || findSelfBuff(record.action, selfBuffs);
      active.add(buff ? (lang === 'ja' ? buff.nameJa : buff.nameEn) : record.action);
    }

    return [...active];
  }

  return {
    findBurstBuff,
    findSelfBuff,
    getActiveSynergies,
  };
}));
