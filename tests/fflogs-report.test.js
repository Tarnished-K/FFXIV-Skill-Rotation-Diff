const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFFLogsReportHarness() {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/data/fflogs-report.js'), 'utf8');
  const context = {
    console,
    globalThis: null,
    state: {
      lang: 'en',
      abilityById: new Map([[1, 'Existing']]),
    },
    JOB_CODE_MAP: {
      NINJA: 'NIN',
      LIMITBREAK: 'LB',
    },
    JOB_ROLE: {
      NIN: 'melee',
    },
    JOB_SHORT_JA: {
      NIN: 'NIN',
    },
    ROLE_ORDER: ['tank', 'healer', 'melee', 'ranged', 'caster'],
    AppSharedUtils: {
      parseFFLogsUrl(raw) {
        return { reportId: raw };
      },
    },
    EncounterUtils: {
      detectSavageFloor() {
        return '';
      },
      getEncounterDisplayName(_report, fight) {
        return fight?.name || '';
      },
      getSavageFloorFromName() {
        return null;
      },
      shouldShowUltimatePhaseSelector() {
        return false;
      },
    },
    TimelineUtils: {
      normalizeActionCategory(category) {
        return String(category || '').toLowerCase();
      },
    },
    PlayerUtils: {
      getPlayersFromFight(reportJson, fightId, options) {
        const fight = reportJson.fights.find((item) => Number(item.id) === Number(fightId));
        return reportJson.masterData.actors
          .filter((actor) => fight.friendlyPlayers.includes(actor.id))
          .map((actor) => ({
            id: String(actor.id),
            name: actor.name,
            job: options.normalizeJobCode(actor.type, actor.subType),
          }))
          .filter((player) => options.isSupportedJob(player.job));
      },
      formatPartyComp(players) {
        return players.map((player) => player.job).join('/');
      },
    },
    SelectionUtils: {
      buildFightOptionLabel(fight) {
        return fight.baseName || '';
      },
      buildPlayerSelectOptions() {
        return [];
      },
    },
    logDebug() {},
    logError() {},
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

describe('FFLogsReport helpers', () => {
  it('extracts only killed boss fights', () => {
    const { FFLogsReport } = loadFFLogsReportHarness();

    const fights = FFLogsReport.extractSelectableFights({
      fights: [
        { id: 1, encounterID: 10, kill: true },
        { id: 2, encounterID: 10, kill: false },
        { id: 3, encounterID: 0, kill: true },
      ],
    });

    expect(fights.map((fight) => fight.id)).toEqual([1]);
  });

  it('indexes new ability names without overwriting existing names', () => {
    const context = loadFFLogsReportHarness();

    context.FFLogsReport.indexAbilities({
      masterData: {
        abilities: [
          { gameID: 1, name: 'Replacement' },
          { gameID: 2, name: 'New Action' },
        ],
      },
    });

    expect(context.state.abilityById.get(1)).toBe('Existing');
    expect(context.state.abilityById.get(2)).toBe('New Action');
  });

  it('normalizes jobs before filtering supported players', () => {
    const { FFLogsReport } = loadFFLogsReportHarness();

    const players = FFLogsReport.getPlayersFromFight({
      fights: [{ id: 1, friendlyPlayers: [11, 22] }],
      masterData: {
        actors: [
          { id: 11, name: 'Player', type: 'Player', subType: 'Ninja' },
          { id: 22, name: 'Limit Break', type: 'Limit Break', subType: '' },
        ],
      },
    }, 1);

    expect(players).toEqual([{ id: '11', name: 'Player', job: 'NIN' }]);
  });
});
