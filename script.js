const SCRIPT_PARTS = [
  './scripts/core.js',
  './scripts/fflogs-data.js',
  './scripts/timeline.js',
  './scripts/app-init.js',
];

function loadScript(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = path;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script part: ${path}`));
    document.body.appendChild(script);
  });
}

(async () => {
  for (const path of SCRIPT_PARTS) {
    await loadScript(path);
  }
})().catch((error) => {
  console.error(error);
  const message = document.getElementById('step1Message');
  if (message) {
    message.textContent = `Script load failed: ${error.message}`;
  }
});
