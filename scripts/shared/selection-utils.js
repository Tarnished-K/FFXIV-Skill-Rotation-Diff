(function attachSelectionUtils(root, factory) {
  const exports = factory();
  root.SelectionUtils = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSelectionUtils() {
  function formatDurationMs(ms) {
    const totalSec = Math.floor(Number(ms || 0) / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = String(totalSec % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function buildFightOptionLabel(fight, index, options = {}) {
    const baseName = String(options.baseName || `Fight ${fight?.id || ''}`);
    const floorTag = String(options.floorTag || '');
    const partyComp = String(options.partyComp || '');
    const statusLabel = String(options.statusLabel || (fight?.kill ? 'Kill' : 'Wipe'));
    const duration = formatDurationMs(Number(fight?.endTime || 0) - Number(fight?.startTime || 0));
    const name = floorTag ? `${baseName} (${floorTag})` : baseName;
    const phaseInfo = Number(fight?.lastPhase || 0) > 1 ? ` P${fight.lastPhase}` : '';
    const partyInfo = partyComp ? ` [${partyComp}]` : '';
    return `#${Number(index || 0) + 1} ${name}${phaseInfo} / ${duration} / ${statusLabel}${partyInfo}`;
  }

  function summarizePlayerDpsEntry(entry, fightDurationMs) {
    const fightSec = Math.max(1, Number(fightDurationMs || 1000) / 1000);
    const activeSec = Math.max(1, Number(entry?.activeTimeReduced || entry?.activeTime || fightDurationMs || 1000) / 1000);
    const rawRDps = Number(entry?.rDPS);
    const rawADps = Number(entry?.aDPS);
    const totalRDps = Number(entry?.totalRDPS || 0);
    const totalADps = Number(entry?.totalADPS || 0);
    const total = Number(entry?.total || 0);

    const rDps = Math.round(
      Number.isFinite(rawRDps) && rawRDps > 0
        ? rawRDps
        : totalRDps > 0
          ? totalRDps / activeSec
          : total / activeSec,
    );
    const aDps = Math.round(
      Number.isFinite(rawADps) && rawADps > 0
        ? rawADps
        : totalADps > 0
          ? totalADps / activeSec
          : total / fightSec,
    );

    return {
      id: String(entry?.id || ''),
      rDps,
      aDps,
    };
  }

  function buildPlayerDpsMap(dpsEntries, fightDurationMs) {
    const map = new Map();
    for (const entry of (dpsEntries || [])) {
      const summary = summarizePlayerDpsEntry(entry, fightDurationMs);
      if (summary.id) map.set(summary.id, summary);
    }
    return map;
  }

  function buildPlayerOptionLabel(player, options = {}) {
    const jobLabel = String(options.jobLabel || player?.job || '');
    const dps = options.dps || null;
    const dpsStr = dps ? ` rDPS:${dps.rDps} aDPS:${dps.aDps}` : '';
    return `${player?.name || ''} (${jobLabel})${dpsStr}`;
  }

  function buildPlayerSelectOptions(players, dpsEntries, fightDurationMs, options = {}) {
    const formatJobName = typeof options.formatJobName === 'function'
      ? options.formatJobName
      : (jobCode) => String(jobCode || '');
    const dpsMap = buildPlayerDpsMap(dpsEntries, fightDurationMs);
    return (players || []).map((player) => ({
      value: String(player?.id || ''),
      label: buildPlayerOptionLabel(player, {
        dps: dpsMap.get(String(player?.id || '')),
        jobLabel: formatJobName(player?.job),
      }),
    }));
  }

  return {
    buildFightOptionLabel,
    buildPlayerDpsMap,
    buildPlayerOptionLabel,
    buildPlayerSelectOptions,
    formatDurationMs,
    summarizePlayerDpsEntry,
  };
}));
