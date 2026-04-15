(function attachPlayerUtils(root, factory) {
  const exports = factory();
  root.PlayerUtils = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPlayerUtils() {
  function getPlayersFromFight(reportJson, fightId, options = {}) {
    const normalizeJobCode = typeof options.normalizeJobCode === 'function'
      ? options.normalizeJobCode
      : (value) => String(value || 'UNK');
    const isSupportedJob = typeof options.isSupportedJob === 'function'
      ? options.isSupportedJob
      : (job) => Boolean(job && job !== 'UNK');

    const fight = (reportJson?.fights || []).find((entry) => Number(entry.id) === Number(fightId));
    if (!fight) throw new Error(`fight=${fightId} が見つかりません`);

    const allowedIds = new Set(fight.friendlyPlayers || []);
    const baseActors = (reportJson?.masterData?.actors || [])
      .filter((actor) => !actor.petOwner)
      .filter((actor) => {
        const typeLower = String(actor.type || '').toLowerCase();
        return typeLower !== 'pet' && typeLower !== 'npc' && typeLower !== 'boss' && typeLower !== 'environment';
      })
      .filter((actor) => {
        const nameLower = String(actor.name || '').toLowerCase();
        return !nameLower.includes('limit break') && !nameLower.includes('リミットブレイク');
      })
      .filter((actor) => {
        const job = normalizeJobCode(actor.type, actor.subType);
        return isSupportedJob(job);
      });

    let filtered = baseActors.filter((actor) => (allowedIds.size > 0 ? allowedIds.has(actor.id) : true));
    if (!filtered.length && allowedIds.size === 0) filtered = baseActors;

    const players = filtered
      .map((actor) => ({
        id: String(actor.id),
        name: actor.name || `Unknown-${actor.id}`,
        job: normalizeJobCode(actor.type, actor.subType),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    if (!players.length) {
      throw new Error('選択戦闘に紐づくプレイヤー一覧を取得できませんでした');
    }
    return players;
  }

  function formatPartyComp(players, options = {}) {
    const roleOrder = Array.isArray(options.roleOrder) ? options.roleOrder : ['T', 'H', 'D'];
    const jobRole = options.jobRole || {};
    const jobShortJa = options.jobShortJa || {};
    const lang = options.lang === 'ja' ? 'ja' : 'en';

    const sorted = [...(players || [])].sort((a, b) => {
      const roleIndexA = roleOrder.indexOf(jobRole[a.job] || 'D');
      const roleIndexB = roleOrder.indexOf(jobRole[b.job] || 'D');
      return roleIndexA - roleIndexB;
    });

    if (lang === 'ja') {
      return sorted.map((player) => jobShortJa[player.job] || player.job).join('');
    }
    return sorted.map((player) => player.job).join(',');
  }

  return {
    formatPartyComp,
    getPlayersFromFight,
  };
}));
