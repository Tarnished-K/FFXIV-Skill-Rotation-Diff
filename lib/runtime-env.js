function tryReadNetlifyEnv(name) {
  try {
    const netlifyEnv = globalThis?.Netlify?.env;
    if (netlifyEnv && typeof netlifyEnv.get === 'function') {
      return netlifyEnv.get(name);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function readRuntimeEnv(name) {
  const netlifyValue = tryReadNetlifyEnv(name);
  if (netlifyValue !== undefined && netlifyValue !== null && netlifyValue !== '') {
    return String(netlifyValue);
  }

  const processValue = process.env?.[name];
  if (processValue === undefined || processValue === null || processValue === '') {
    return '';
  }

  return String(processValue);
}

module.exports = {
  readRuntimeEnv,
};
