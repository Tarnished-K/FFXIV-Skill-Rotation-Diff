#!/usr/bin/env node
// One-time data fetch script for the premium page preview.
// Run: node scripts/fetch-premium-preview.js
// Requires: FFLOGS_CLIENT_ID, FFLOGS_CLIENT_SECRET (env vars or .env file)
'use strict';

const fs = require('fs');
const path = require('path');

// Minimal .env loader — no dotenv package needed
(function loadEnv() {
  const envFile = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
})();

// If NETLIFY_DEV_URL is set, route GraphQL through the running dev server proxy
// (no FFLOGS_CLIENT_ID/SECRET needed locally). Otherwise use direct OAuth client.
const PROXY_URL = process.env.NETLIFY_DEV_URL
  ? `${process.env.NETLIFY_DEV_URL}/api/fflogs-proxy`
  : null;

let _directClient = null;
async function graphqlRequest(query, variables = {}) {
  if (PROXY_URL) {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:8888' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Proxy responded ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    return json?.data;
  }
  if (!_directClient) _directClient = require('../lib/fflogs-client');
  return _directClient.graphqlRequest(query, variables);
}

const REPORT_CODE = 'nx7VrZcbt4qjfNzD';
const FIGHT_ID = 308;
const PREVIEW_MAX_SEC = 300; // first 5 minutes only

// Same synergy list as in scripts/data/fflogs.js PARTY_SYNERGY_ACTIONS
const SYNERGY_BY_ID = new Map([
  [7396,  { nameEn: 'Brotherhood',      nameJa: '桃園結義',           duration: 20, color: '#f472b6' }],
  [7398,  { nameEn: 'Battle Litany',    nameJa: 'バトルリタニー',     duration: 20, color: '#60a5fa' }],
  [24405, { nameEn: 'Arcane Circle',    nameJa: 'アルケインサークル', duration: 20, color: '#c084fc' }],
  [118,   { nameEn: 'Battle Voice',     nameJa: 'バトルボイス',       duration: 20, color: '#a3e635' }],
  [25786, { nameEn: 'Battle Voice',     nameJa: 'バトルボイス',       duration: 20, color: '#a3e635' }],
  [25785, { nameEn: 'Radiant Finale',   nameJa: '光神のフィナーレ',   duration: 20, color: '#fb923c' }],
  [25801, { nameEn: 'Searing Light',    nameJa: 'シアリングライト',   duration: 20, color: '#fcd34d' }],
  [7520,  { nameEn: 'Embolden',         nameJa: 'エンボルデン',       duration: 20, color: '#f87171' }],
  [16552, { nameEn: 'Divination',       nameJa: 'ディヴィネーション', duration: 20, color: '#fbbf24' }],
  [36871, { nameEn: 'Dokumori',         nameJa: '毒盛の術',           duration: 20, color: '#86efac' }],
  [7436,  { nameEn: 'Chain Stratagem',  nameJa: '連環計',             duration: 20, color: '#a78bfa' }],
]);
const SYNERGY_BY_NAME = new Map([
  ['technical finish',          { nameEn: 'Technical Finish', nameJa: 'テクニカルフィニッシュ', duration: 20, color: '#34d399' }],
  ['quadruple technical finish',{ nameEn: 'Technical Finish', nameJa: 'テクニカルフィニッシュ', duration: 20, color: '#34d399' }],
  ['quad technical finish',     { nameEn: 'Technical Finish', nameJa: 'テクニカルフィニッシュ', duration: 20, color: '#34d399' }],
  ['starry muse',               { nameEn: 'Starry Muse',      nameJa: 'イマジンスカイ',         duration: 20, color: '#38bdf8' }],
  ['imagined sky',              { nameEn: 'Starry Muse',      nameJa: 'イマジンスカイ',         duration: 20, color: '#38bdf8' }],
]);

function findSynergy(actionId, actionName) {
  if (actionId && SYNERGY_BY_ID.has(actionId)) return SYNERGY_BY_ID.get(actionId);
  const normalized = String(actionName || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return SYNERGY_BY_NAME.get(normalized) || null;
}

// --- GraphQL helpers ---

async function fetchReportMeta(code) {
  const query = `
    query($code: String!) {
      reportData {
        report(code: $code) {
          fights {
            id encounterID name kill startTime endTime friendlyPlayers
          }
          masterData {
            actors { id name type subType petOwner }
            abilities { gameID name }
          }
        }
      }
    }
  `;
  const data = await graphqlRequest(query, { code });
  return data?.reportData?.report;
}

async function fetchDpsTable(code, fightId) {
  const query = `
    query($code: String!, $fightID: [Int!]!) {
      reportData {
        report(code: $code) {
          table(dataType: DamageDone, fightIDs: $fightID)
        }
      }
    }
  `;
  const data = await graphqlRequest(query, { code, fightID: [fightId] });
  return data?.reportData?.report?.table?.data?.entries || [];
}

async function fetchEventsPaged(code, fightId, fightStartMs, opts = {}) {
  const { sourceId, hostility = 'Friendlies', dataType = 'Casts' } = opts;
  const cutoffMs = fightStartMs + PREVIEW_MAX_SEC * 1000;

  const query = sourceId != null
    ? `query($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
        reportData { report(code: $code) {
          events(dataType: ${dataType}, fightIDs: [$fightID], sourceID: $sourceID, startTime: $startTime) {
            data nextPageTimestamp
          }
        }}
      }`
    : `query($code: String!, $fightID: Int!, $startTime: Float) {
        reportData { report(code: $code) {
          events(dataType: ${dataType}, fightIDs: [$fightID], hostilityType: ${hostility}, startTime: $startTime) {
            data nextPageTimestamp
          }
        }}
      }`;

  const all = [];
  let pageStart = null;
  while (true) {
    const vars = { code, fightID: fightId, startTime: pageStart, ...(sourceId != null ? { sourceID: sourceId } : {}) };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    for (const e of rows) {
      if (Number(e.timestamp || 0) > cutoffMs) return all;
      all.push(e);
    }
    if (!block?.nextPageTimestamp || block.nextPageTimestamp > cutoffMs) break;
    pageStart = block.nextPageTimestamp;
  }
  return all;
}

async function fetchJaNames(actionIds) {
  const ids = [...new Set(actionIds.map(Number).filter(Boolean))];
  const result = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const url = `https://v2.xivapi.com/api/sheet/Action?rows=${chunk.join(',')}&fields=Name&language=ja`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      for (const row of json?.rows || []) {
        const id = Number(row?.row_id || 0);
        const name = String(row?.fields?.Name || '');
        if (id && name) result.set(id, name);
      }
    } catch { /* fall back to English */ }
  }
  return result;
}

// --- Main ---

async function main() {
  console.log(`Fetching FFLogs report ${REPORT_CODE}, fight ${FIGHT_ID} ...`);

  const report = await fetchReportMeta(REPORT_CODE);
  const fight = report.fights.find(f => f.id === FIGHT_ID);
  if (!fight) throw new Error(`Fight ${FIGHT_ID} not found in report`);

  const actorsById = new Map(report.masterData.actors.map(a => [Number(a.id), a]));
  const abilitiesById = new Map(report.masterData.abilities.map(a => [Number(a.gameID), a.name]));
  const friendlyIds = new Set(fight.friendlyPlayers.map(Number));
  const fightStartMs = Number(fight.startTime);
  const fightDurationMs = Number(fight.endTime) - fightStartMs;
  console.log(`  Fight: "${fight.name}" (${Math.round(fightDurationMs / 1000)}s)`);

  // Pick top 2 players by total damage
  console.log('  Fetching DPS table ...');
  const dpsEntries = await fetchDpsTable(REPORT_CODE, FIGHT_ID);
  const dpsPlayers = dpsEntries
    .filter(e => friendlyIds.has(Number(e.id)) && String(e.type || '').toLowerCase() !== 'pet')
    .sort((a, b) => (b.total || 0) - (a.total || 0))
    .slice(0, 2);
  if (dpsPlayers.length < 2) throw new Error(`Only ${dpsPlayers.length} eligible players found`);

  const players = dpsPlayers.map(entry => {
    const actor = actorsById.get(Number(entry.id)) || {};
    return {
      id: Number(entry.id),
      name: actor.name || entry.name || `Player ${entry.id}`,
      job: actor.subType || actor.type || entry.type || '',
      totalDamage: Number(entry.total || 0),
      dps: Math.round(Number(entry.total || 0) / (fightDurationMs / 1000)),
    };
  });
  console.log(`  Players: ${players.map(p => `${p.name}(${p.job})`).join(' vs ')}`);

  // Fetch player cast timelines in parallel
  console.log('  Fetching player timelines ...');
  const [rawA, rawB] = await Promise.all([
    fetchEventsPaged(REPORT_CODE, FIGHT_ID, fightStartMs, { sourceId: players[0].id }),
    fetchEventsPaged(REPORT_CODE, FIGHT_ID, fightStartMs, { sourceId: players[1].id }),
  ]);

  function processTimeline(events) {
    const pending = new Map();
    const all = [];
    for (const e of events) {
      const ts = Number(e.timestamp || 0);
      const t = (ts - fightStartMs) / 1000;
      const actionId = Number(e.abilityGameID || e.ability?.guid || 0);
      const name = String(e.ability?.name || e.abilityName || abilitiesById.get(actionId) || '');
      if (!name) continue;
      const type = String(e.type || '').toLowerCase();
      const key = String(actionId || name);
      if (type === 'begincast') {
        if (!pending.has(key)) pending.set(key, []);
        pending.get(key).push({ t, action: name, actionId });
        continue;
      }
      if (type === 'cast' && pending.has(key)?.length) {
        const start = pending.get(key).shift();
        all.push({ ...start, castEndT: t });
        continue;
      }
      all.push({ t, action: name, actionId });
    }
    return all.sort((a, b) => a.t - b.t);
  }

  players[0].timeline = processTimeline(rawA);
  players[1].timeline = processTimeline(rawB);

  // Boss casts
  console.log('  Fetching enemy casts ...');
  const enemyRaw = await fetchEventsPaged(REPORT_CODE, FIGHT_ID, fightStartMs, { hostility: 'Enemies' });

  const isFriendly = id => {
    const n = Number(id || 0);
    if (friendlyIds.has(n)) return true;
    const actor = actorsById.get(n);
    return actor?.petOwner != null && friendlyIds.has(Number(actor.petOwner));
  };

  const pendingBoss = new Map();
  const bossRaw = [];
  for (const e of enemyRaw) {
    const sourceId = Number(e.sourceID || e.source?.id || 0);
    if (isFriendly(sourceId)) continue;
    const ts = Number(e.timestamp || 0);
    const t = (ts - fightStartMs) / 1000;
    const actionId = Number(e.abilityGameID || e.ability?.guid || 0);
    const name = String(e.ability?.name || e.abilityName || abilitiesById.get(actionId) || '');
    if (!name) continue;
    const sourceActor = actorsById.get(sourceId);
    const actorType = String(sourceActor?.type || '').toLowerCase();
    const actorSubType = String(sourceActor?.subType || '').toLowerCase();
    const isBoss = actorType === 'boss' || actorSubType === 'boss';
    const type = String(e.type || '').toLowerCase();
    const key = `${sourceId}:${actionId || name}`;
    if (type === 'begincast') {
      if (!pendingBoss.has(key)) pendingBoss.set(key, []);
      pendingBoss.get(key).push({ t, action: name, actionId, isBoss, sourceName: sourceActor?.name || '' });
    } else if (type === 'cast' && pendingBoss.has(key) && pendingBoss.get(key).length) {
      const start = pendingBoss.get(key).shift();
      bossRaw.push({ ...start, endT: Math.max(t, start.t + 0.1) });
    }
  }
  for (const v of pendingBoss.values()) bossRaw.push(...v.map(s => ({ ...s, endT: s.t + 3 })));

  // Fetch Japanese names for boss cast actions
  const bossActionIds = [...new Set(bossRaw.map(r => r.actionId).filter(Boolean))];
  console.log(`  Fetching Japanese names for ${bossActionIds.length} actions via XIVAPI ...`);
  const jaNames = await fetchJaNames(bossActionIds);
  const bossCasts = bossRaw
    .sort((a, b) => a.t - b.t)
    .map(r => ({ ...r, actionJa: jaNames.get(Number(r.actionId)) || r.action }));

  // Party synergy casts
  console.log('  Fetching party synergy ...');
  const partyIds = fight.friendlyPlayers.map(Number).filter(id => !players.some(p => p.id === id));
  const synergyAll = [];
  for (const pid of partyIds) {
    const events = await fetchEventsPaged(REPORT_CODE, FIGHT_ID, fightStartMs, { sourceId: pid });
    const actor = actorsById.get(pid);
    for (const e of events) {
      if (String(e.type || '').toLowerCase() !== 'cast') continue;
      const actionId = Number(e.abilityGameID || e.ability?.guid || 0);
      const name = String(e.ability?.name || e.abilityName || abilitiesById.get(actionId) || '');
      const synergy = findSynergy(actionId, name);
      if (!synergy) continue;
      const t = (Number(e.timestamp || 0) - fightStartMs) / 1000;
      synergyAll.push({ t, ...synergy, actionId, sourceName: actor?.name || '', sourceJob: actor?.subType || '' });
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    reportCode: REPORT_CODE,
    fightId: FIGHT_ID,
    encounter: fight.name || 'Unknown',
    durationMs: fightDurationMs,
    previewMaxSec: PREVIEW_MAX_SEC,
    players,
    bossCasts,
    synergy: synergyAll.sort((a, b) => a.t - b.t),
  };

  const outDir = path.resolve(__dirname, '../assets');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'premium-preview-data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nDone! Written to ${outPath}`);
  console.log(`  Players:      ${players.map(p => `${p.name}/${p.job} ${p.dps.toLocaleString()} DPS`).join(' vs ')}`);
  console.log(`  Timeline A:   ${players[0].timeline.length} events`);
  console.log(`  Timeline B:   ${players[1].timeline.length} events`);
  console.log(`  Boss casts:   ${bossCasts.length}`);
  console.log(`  Synergy:      ${synergyAll.length} events`);
}

main().catch(err => {
  console.error('\nError:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
