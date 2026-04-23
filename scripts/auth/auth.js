import { createClient } from '@supabase/supabase-js';

let _client = null;

async function init() {
  if (_client) return _client;
  try {
    const res = await fetch('/api/supabase-config');
    if (!res.ok) return null;
    const { url, anonKey } = await res.json();
    _client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return _client;
  } catch {
    return null;
  }
}

async function getSession() {
  const client = await init();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session || null;
}

async function getUser() {
  const client = await init();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user || null;
}

async function signInWithEmail(email, password) {
  const client = await init();
  if (!client) return { error: 'Not configured' };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function signUpWithEmail(email, password) {
  const client = await init();
  if (!client) return { error: 'Not configured' };
  const { data, error } = await client.auth.signUp({ email, password });
  return { data, error };
}

async function signInWithGoogle() {
  const client = await init();
  if (!client) return { error: 'Not configured' };
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  return { data, error };
}

async function signOut() {
  const client = await init();
  if (!client) return;
  await client.auth.signOut();
}

function onAuthStateChange(callback) {
  init().then((client) => {
    if (!client) return;
    client.auth.onAuthStateChange((_event, session) => {
      callback(session ? session.user : null);
    });
  });
}

globalThis.AuthModule = {
  init,
  getSession,
  getUser,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut,
  onAuthStateChange,
};
