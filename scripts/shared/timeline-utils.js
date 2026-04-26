(function attachTimelineUtils(root, factory) {
  const exports = factory();
  root.TimelineUtils = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createTimelineUtils() {
  const NINJUTSU_KEYWORDS_JA = ['火遁', '雷遁', '氷遁', '風遁', '土遁', '水遁', '劫火滅却', '氷晶乱流', '月影', '風魔手裏剣'];
  const NINJUTSU_KEYWORDS_EN = ['katon', 'raiton', 'hyoton', 'huton', 'doton', 'suiton', 'goka mekkyaku', 'hyosho ranryu', 'moonshadow', 'fuma shuriken'];

  function isInTimelineFocusWindow(seconds, tab) {
    if (tab === 'all') return true;
    const t = Number(seconds || 0);
    if (!Number.isFinite(t) || t < 0) return false;
    // Show event if any minute mark of correct parity falls in [t-30, t+10]
    // (window = 10s before mark to 30s after mark)
    const mLo = Math.ceil((t - 30) / 60);
    const mHi = Math.floor((t + 10) / 60);
    const parity = tab === 'odd' ? 1 : 0;
    for (let m = Math.max(mLo, 1); m <= mHi; m++) {
      if (m % 2 === parity) return true;
    }
    return false;
  }

  function filterTimeline(records, tab) {
    if (tab === 'all') return records;
    if (tab === 'odd' || tab === 'even') return records.filter((record) => isInTimelineFocusWindow(record.t, tab));
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
    let gcd = 0;
    let ogcd = 0;
    let unknown = 0;
    for (const record of records) {
      if (record.category === 'weaponskill' || record.category === 'spell') gcd++;
      else if (record.category === 'ability') ogcd++;
      else unknown++;
    }
    return { gcd, ogcd, unknown, total: records.length };
  }

  function deduplicateTimeline(records) {
    const output = [];
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      const prev = output[output.length - 1];
      if (prev && prev.actionId === record.actionId && Math.abs(prev.t - record.t) < 0.5) continue;
      output.push(record);
    }
    return output;
  }

  function findEnemyActors(reportJson, fight, options = {}) {
    const normalizeJobCode = typeof options.normalizeJobCode === 'function'
      ? options.normalizeJobCode
      : (type, subType) => String(subType || type || 'UNK');
    const isSupportedJob = typeof options.isSupportedJob === 'function'
      ? options.isSupportedJob
      : (job) => Boolean(job && job !== 'UNK');
    const friendlyIds = new Set(fight?.friendlyPlayers || []);
    return (reportJson?.masterData?.actors || []).filter((actor) => {
      if (actor.petOwner) return false;
      if (friendlyIds.has(actor.id)) return false;
      const typeLower = String(actor.type || '').toLowerCase();
      if (typeLower === 'player' || typeLower === 'environment') return false;
      const job = normalizeJobCode(actor.type, actor.subType);
      if (job !== 'UNK' && isSupportedJob(job)) return false;
      const nameLower = String(actor.name || '').toLowerCase();
      if (nameLower.includes('limit break') || nameLower.includes('リミットブレイク')) return false;
      return true;
    });
  }

  function formatHitType(hitType, multistrike) {
    const isCrit = hitType === 2;
    const isDH = !!multistrike;
    if (isCrit && isDH) return 'CDH';
    if (isCrit) return 'Crit';
    if (isDH) return 'DH';
    return '';
  }

  function formatTimelineTime(seconds) {
    const totalSeconds = Math.max(0, Number(seconds || 0));
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds - minutes * 60;
    const wholeSecs = Math.floor(secs);
    const fraction = secs - wholeSecs;
    if (fraction >= 0.05) {
      const tenth = Math.round(fraction * 10);
      if (tenth >= 10) return `${minutes + 1}:00`;
      return `${minutes}:${String(wholeSecs).padStart(2, '0')}.${tenth}`;
    }
    return `${minutes}:${String(Math.round(secs)).padStart(2, '0')}`;
  }

  function normalizeActionCategory(category, actionName, jobCode = '') {
    const normalizedCategory = String(category || '').toLowerCase();
    if (normalizedCategory !== 'ability' || String(jobCode || '').toUpperCase() !== 'NIN') return normalizedCategory;
    const name = String(actionName || '');
    const lowerName = name.toLowerCase();
    const isNinjutsu =
      NINJUTSU_KEYWORDS_JA.some((keyword) => name.includes(keyword))
      || NINJUTSU_KEYWORDS_EN.some((keyword) => lowerName.includes(keyword));
    return isNinjutsu ? 'weaponskill' : normalizedCategory;
  }

  return {
    buildRuler,
    classifyStats,
    deduplicateTimeline,
    filterTimeline,
    findEnemyActors,
    formatHitType,
    formatTimelineTime,
    isInTimelineFocusWindow,
    normalizeActionCategory,
  };
}));
