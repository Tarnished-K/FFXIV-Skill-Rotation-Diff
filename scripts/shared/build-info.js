(function () {
  async function fetchJson(path) {
    const response = await fetch(path, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${path}`);
    }
    return response.json();
  }

  async function loadBuildInfo() {
    try {
      return await fetchJson('/api/build-info');
    } catch (_) {
      try {
        const pkg = await fetchJson('/package.json');
        return {
          version: pkg.version || '',
          commit: '',
          branch: '',
          context: '',
        };
      } catch (_) {
        return null;
      }
    }
  }

  function renderBuildInfo(info) {
    const nodes = document.querySelectorAll('[data-build-info]');
    const parts = [];
    if (info?.version) {
      parts.push(`v${info.version}`);
    }
    if (info?.commit) {
      parts.push(info.commit);
    }
    const text = parts.length ? `Version ${parts.join(' · ')}` : 'Version unavailable';

    nodes.forEach((node) => {
      node.textContent = text;
      if (info?.branch) {
        node.title = `branch: ${info.branch}${info.context ? ` / ${info.context}` : ''}`;
      }
    });
  }

  async function initBuildInfo() {
    renderBuildInfo(await loadBuildInfo());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBuildInfo, { once: true });
  } else {
    initBuildInfo();
  }
})();
