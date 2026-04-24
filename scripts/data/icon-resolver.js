// Action icon lookup and fallback resolution
function loadIconMap() {
  const candidates = [
    '/public/job-icons/job_icon.json',
    './public/job-icons/job_icon.json',
    '/job-icons/job_icon.json',
    '/public/job-icons/ffxiv_job_action_icon_map.json',
    './public/job-icons/ffxiv_job_action_icon_map.json',
  ];
  return (async () => {
    for (const path of candidates) {
      try {
        const res = await fetch(path);
        if (!res.ok) continue;
        const data = await res.json();
        const records = data.records || data;
        logDebug(`icon map loaded: ${path}`, { count: records.length });
        state.actionById = new Map();
        for (const record of records) {
          if (record?.action_id) state.actionById.set(Number(record.action_id), record);
        }
        return records;
      } catch {
        // try next candidate
      }
    }
    state.actionById = new Map();
    logError('icon map not found on all candidate paths');
    return [];
  })();
}

function normalizeActionKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9邵ｺﾂ-郢晢ｽｿ闕ｳﾂ-魄ｴ・ｯ]/g, '');
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function shouldSkipIconLookup(actionName = '') {
  const normalized = String(actionName || '').toLowerCase();
  return normalized.includes('sprint')
    || normalized.includes('スプリント')
    || normalized.includes('tincture')
    || normalized.includes('potion')
    || normalized.includes('薬')
    || normalized.includes('limit break')
    || normalized.includes('リミットブレイク');
}

function getActionMeta(actionName, actionId, preferredJobCode = '') {
  let found = null;
  if (actionId && state.actionById.has(Number(actionId))) {
    found = state.actionById.get(Number(actionId));
  }
  if (!found) {
    const key = normalizeActionKey(actionName);
    found = state.iconMap.find((record) => {
      const names = [record.action_name_en, record.action_name_ja, ...(record.aliases || [])].map(normalizeActionKey);
      return names.includes(key);
    });
  }
  const normalizedName = String(actionName || '').toLowerCase();
  if (normalizedName.includes('sprint') || normalizedName.includes('スプリント')) {
    return {
      icon: '/public/job-icons/jobs/General/sprint.png',
      iconCandidates: ['/public/job-icons/jobs/General/sprint.png'],
      category: 'ability',
      label: found?.action_name_ja || found?.action_name_en || actionName,
    };
  }
  if (
    shouldSkipIconLookup(actionName)
    || shouldSkipIconLookup(found?.action_name_en)
    || shouldSkipIconLookup(found?.action_name_ja)
  ) {
    return {
      icon: '',
      iconCandidates: [],
      category: String(found?.action_type || '').toLowerCase(),
      label: found?.action_name_ja || found?.action_name_en || actionName || 'Unknown',
    };
  }
  const raw = found?.icon_path || '';
  const iconCandidates = [];
  if (raw) {
    const rawMatch = raw.match(/^\/job-icons\/jobs\/([A-Z]+)\/(.+)$/);
    if (rawMatch) {
      const rawJob = rawMatch[1];
      const targetJob = String(preferredJobCode || rawJob).toUpperCase() || rawJob;
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
      if (found?.category === 'role_action') {
        iconCandidates.push(`/public/job-icons/jobs/${targetJob}/Role_Actions/${fileName}`);
        iconCandidates.push(`/public/job-icons/jobs/${rawJob}/Role_Actions/${fileName}`);
      }
      iconCandidates.push(`/public/job-icons/jobs/${targetJob}/${tail}`);
      iconCandidates.push(`/public/job-icons/jobs/${rawJob}/${rawTail}`);
      iconCandidates.push(`/public/job-icons/jobs/${rawJob}/${tail}`);
    }
    iconCandidates.push(raw.startsWith('/job-icons/') ? '/public' + raw : raw);
    iconCandidates.push(raw);
  }
  const uniqueCandidates = uniq(iconCandidates).map((value) => encodeURI(value));
  return {
    icon: uniqueCandidates[0] || '',
    iconCandidates: uniqueCandidates,
    category: String(found?.action_type || '').toLowerCase(),
    label: found?.action_name_ja || found?.action_name_en || actionName || 'Unknown',
  };
}

Object.assign(globalThis, {
  getActionMeta,
  loadIconMap,
  normalizeActionKey,
  shouldSkipIconLookup,
  uniq,
});
