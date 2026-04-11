diff --git a/script.js b/script.js
index 16b9a2b1fb287008e9dd474b01d4d6303f01c9f7..8d2cec655443a595a2653980d9750e513a7923ff 100644
--- a/script.js
+++ b/script.js
@@ -246,90 +246,108 @@ async function loadIconMap() {
     try {
       const res = await fetch(path);
       if (!res.ok) continue;
       const data = await res.json();
       const records = data.records || data;
       logDebug(`icon map loaded: ${path}`, {count: records.length});
       state.actionById = new Map();
       for (const r of records) {
         if (r?.action_id) state.actionById.set(Number(r.action_id), r);
       }
       return records;
     } catch {
       // try next candidate
     }
   }
   state.actionById = new Map();
   logDebug("icon map not found on all candidate paths");
   return [];
 }
 function normalizeActionKey(v) {
   return String(v || '').toLowerCase().replace(/[^a-z0-9぀-ヿ一-龯]/g, '');
 }
 function uniq(values) {
   return [...new Set(values.filter(Boolean))];
 }
+function shouldSkipIconLookup(actionName = '') {
+  const n = String(actionName || '').toLowerCase();
+  return n.includes('sprint')
+    || n.includes('スプリント')
+    || n.includes('tincture')
+    || n.includes('potion')
+    || n.includes('薬')
+    || n.includes('limit break')
+    || n.includes('リミットブレイク');
+}
 function getActionMeta(actionName, actionId, preferredJobCode = '') {
   let found = null;
   if (actionId && state.actionById.has(Number(actionId))) {
     found = state.actionById.get(Number(actionId));
   }
   if (!found) {
     const key = normalizeActionKey(actionName);
     found = state.iconMap.find(r => {
       const names = [r.action_name_en, r.action_name_ja, ...(r.aliases || [])].map(normalizeActionKey);
       return names.includes(key);
     });
   }
+  if (shouldSkipIconLookup(actionName) || shouldSkipIconLookup(found?.action_name_en) || shouldSkipIconLookup(found?.action_name_ja)) {
+    return {
+      icon: '',
+      iconCandidates: [],
+      category: String(found?.category || found?.action_type || '').toLowerCase(),
+      label: found?.action_name_ja || found?.action_name_en || actionName || 'Unknown',
+    };
+  }
   const raw = found?.icon_path || '';
   const iconCandidates = [];
   if (raw) {
     const mappedJob = JOB_ICON_SCOPE_MAP[String(preferredJobCode || '').toUpperCase()];
     const rawMatch = raw.match(/^\/job-icons\/jobs\/([A-Z]+)\/(.+)$/);
     if (rawMatch) {
       const rawJob = rawMatch[1];
       const rawTail = rawMatch[2];
       const fileName = rawTail.split('/').pop();
       const categoryDir = found?.category === 'role_action'
         ? 'Role_Actions'
         : found?.category === 'trait'
           ? 'Traits'
           : found?.category === 'pet_actions'
             ? 'Pet_Actions'
             : '';
       const tail = categoryDir ? `${categoryDir}/${fileName}` : rawTail;
       const targetScope = mappedJob || JOB_ICON_SCOPE_MAP[rawJob] || '';
       if (targetScope) {
         iconCandidates.push(`/public/job-icons/${targetScope}/${tail}`);
       }
       if (JOB_ICON_SCOPE_MAP[rawJob]) iconCandidates.push(`/public/job-icons/${JOB_ICON_SCOPE_MAP[rawJob]}/${tail}`);
-      iconCandidates.push(`/public/job-icons/jobs/${rawJob}/${rawTail}`);
       if (found?.category === 'role_action') {
         iconCandidates.push(`/public/job-icons/jobs/${rawJob}/Role_Actions/${fileName}`);
         iconCandidates.push(`/public/job-icons/jobs/Role_Actions/${fileName}`);
         iconCandidates.push(`/public/job-icons/Role_Actions/${fileName}`);
       }
+      iconCandidates.push(`/public/job-icons/jobs/${rawJob}/${rawTail}`);
     }
     iconCandidates.push(raw.startsWith('/job-icons/') ? '/public' + raw : raw);
     iconCandidates.push(raw);
   }
   const uniqueCandidates = uniq(iconCandidates).map(x => encodeURI(x));
   return {
     icon: uniqueCandidates[0] || '',
     iconCandidates: uniqueCandidates,
     category: String(found?.category || found?.action_type || '').toLowerCase(),
     label: found?.action_name_ja || found?.action_name_en || actionName || 'Unknown',
   };
 }
 function normalizeJobCode(type, subType) {
   const c = (subType || type || '').toString().toUpperCase();
   return c || 'UNK';
 }
 function formatDurationMs(ms) {
   const sec = Math.floor(ms / 1000);
   const m = Math.floor(sec / 60);
   const s = String(sec % 60).padStart(2, '0');
   return `${m}:${s}`;
 }
 function formatFightLabel(fight, index) {
   const duration = formatDurationMs((fight.endTime || 0) - (fight.startTime || 0));
   const status = fight.kill ? 'Kill' : 'Wipe';
@@ -359,141 +377,166 @@ function getPlayersFromFight(reportJson, fightId) {
       const n = String(a.name || '').toLowerCase();
       return !n.includes('limit break') && !n.includes('リミットブレイク');
     });
   // V2では actor.fights が取得できないため、fight.friendlyPlayers を主軸に絞る
   let filtered = base.filter(a => (allowedIds.size > 0 ? allowedIds.has(a.id) : true));
   // fallback: friendlyPlayers が空の場合のみ全actorから採用
   if (!filtered.length && allowedIds.size === 0) filtered = base;
   const players = filtered
     .map(a => ({
       id: String(a.id),
       name: a.name || `Unknown-${a.id}`,
       job: normalizeJobCode(a.type, a.subType),
     }))
     .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
   if (!players.length) throw new Error('選択戦闘に紐づくプレイヤー一覧を取得できませんでした');
   return players;
 }
 function fillFightSelect(select, fights) {
   select.innerHTML = fights.map((f, i) => `<option value="${f.id}">${formatFightLabel(f, i)}</option>`).join('');
 }
 function fillPlayerSelect(select, players) {
   select.innerHTML = players.map(p => `<option value="${p.id}">${p.name} (${p.job})</option>`).join('');
 }
 async function fetchPlayerTimelineV2(reportCode, fight, sourceId, playerJobCode = '') {
   const all = [];
+  const pendingBegincast = new Map();
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
+      const type = String(e?.type || '').toLowerCase();
+      const key = `${actionId}:${name}`;
+      if (type === 'begincast') {
+        if (!pendingBegincast.has(key)) pendingBegincast.set(key, []);
+        pendingBegincast.get(key).push({
+          t,
+          action: String(name),
+          actionId,
+          category: meta.category,
+          icon: meta.icon,
+          iconCandidates: meta.iconCandidates || [],
+          label: meta.label,
+        });
+        continue;
+      }
+      if (type === 'cast' && pendingBegincast.has(key) && pendingBegincast.get(key).length) {
+        const startEvent = pendingBegincast.get(key).shift();
+        all.push({ ...startEvent, castEndT: t });
+        continue;
+      }
       all.push({ t, action: String(name), actionId, category: meta.category, icon: meta.icon, iconCandidates: meta.iconCandidates || [], label: meta.label });
     }
     if (!block?.nextPageTimestamp) break;
     startTime = block.nextPageTimestamp;
   }
   return all.sort((a, b) => a.t - b.t);
 }
 function makeSampleTimeline() {
   const actions = ['Fast Blade', 'Riot Blade', 'Royal Authority', 'Fight or Flight', 'Requiescat'];
   return Array.from({ length: 45 }, (_, i) => ({ t: i * 6, action: actions[i % actions.length] }));
 }
 function makeSampleDps() {
   let x = 20000;
   return Array.from({ length: 120 }, (_, i) => {
     x += (Math.random() - 0.5) * 1200;
     return { t: i * 5, v: Math.max(1000, Math.round(x)) };
   });
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
 function renderTimeline() {
   const a = filterTimeline(state.timelineA, state.currentTab);
   const b = filterTimeline(state.timelineB, state.currentTab);
   const maxT = Math.max(1, ...a.map(x => x.t), ...b.map(x => x.t));
   const pxPerSec = 16 * state.zoom;
   const width = Math.max(1800, maxT * pxPerSec + 220);
   const laneTop = {
-    a_gcd: 22,
-    a_ogcd: 54,
-    b_gcd: 118,
-    b_ogcd: 150,
+    a_gcd: 26,
+    a_ogcd: 62,
+    b_gcd: 146,
+    b_ogcd: 182,
   };
   const isGcd = r => r.category === 'weaponskill' || r.category === 'spell';
   const buildEvents = (records, owner) => {
     const lanesLastX = { gcd: -999, ogcd: -999 };
+    const minGap = 8;
     return records.map(r => {
       const lane = isGcd(r) ? 'gcd' : 'ogcd';
-      const x = 60 + r.t * pxPerSec;
-      if (x - lanesLastX[lane] < 20) return '';
+      const baseX = 60 + r.t * pxPerSec;
+      const x = Math.max(baseX, lanesLastX[lane] + minGap);
       lanesLastX[lane] = x;
       const icon = r.icon || '';
       const fallback = (r.label || r.action || '?').slice(0, 2).toUpperCase();
       const top = laneTop[`${owner}_${lane}`];
       const candidates = (r.iconCandidates || []).join('|');
-      return `<div class="event ${owner} ${lane}" style="left:${x}px; top:${top}px" title="${r.t.toFixed(1)}s ${r.label || r.action}">${icon ? `<img class="event-icon" src="${icon}" data-fallbacks="${candidates}" alt="${r.label || r.action}" />` : `<span>${fallback}</span>`}</div>`;
+      const castBar = Number(r.castEndT) > Number(r.t)
+        ? `<div class="cast-bar" style="width:${Math.max(8, (r.castEndT - r.t) * pxPerSec)}px"></div>`
+        : '';
+      return `<div class="event ${owner} ${lane}" style="left:${x}px; top:${top}px" title="${r.t.toFixed(1)}s ${r.label || r.action}">${castBar}${icon ? `<img class="event-icon" src="${icon}" data-fallbacks="${candidates}" alt="${r.label || r.action}" />` : `<span>${fallback}</span>`}</div>`;
     }).join('');
   };
   el.timelineWrap.innerHTML = `
     <div class="timeline" style="width:${width}px">
       ${buildRuler(maxT, pxPerSec)}
       <div class="track a"></div>
       <div class="track b"></div>
       ${buildEvents(a, 'a')}
       ${buildEvents(b, 'b')}
     </div>
     <div class="legend">上段プレイヤー: ${state.selectedA?.name || 'A'}（上:GCD / 下:oGCD）<br/>下段プレイヤー: ${state.selectedB?.name || 'B'}（上:GCD / 下:oGCD）</div>
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
