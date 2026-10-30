import { state, summary, onChange, replaceState } from './store.js';
import { API_URL } from './config.js';

const BASE = API_URL.replace(/\/+$/, '') + '/api';

const TOKEN_KEY = 'gimrit:token';
export const session = { token: null, user: null, online: false, connecting: true, remote: !!API_URL, notifications: [], unread: 0, incoming: 0 };
try { session.token = localStorage.getItem(TOKEN_KEY); } catch { /* ignore */ }

async function req(method, path, body, timeout = 20000) {
  const res = await fetch(BASE + path, {
    method,
    signal: AbortSignal.timeout(timeout),
    headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: 'Bearer ' + session.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && session.token) setToken(null);
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function setToken(t) {
  session.token = t;
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  if (!t) session.user = null;
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b || {}),
  del: (p) => req('DELETE', p),
};

export async function init() {
  try {
    // A free-tier server may be asleep; waking it can take close to a minute
    await req('GET', '/health', null, API_URL ? 90000 : 5000);
    session.online = true;
  } catch {
    session.online = false;
    return;
  } finally {
    session.connecting = false;
  }
  if (session.token) {
    try {
      const { user } = await req('GET', '/me');
      session.user = user;
      await pullState();
      pollNotifications();
    } catch { /* token expired */ }
  }
}

async function pullState() {
  const { state: remote } = await req('GET', '/state');
  if (remote && (remote.xp || 0) >= (state.xp || 0)) replaceState(remote);
  else pushNow();
}

export async function signup(username, password) {
  const { token, user } = await req('POST', '/signup', {
    username, password,
    displayName: state.profile.name || username,
    avatar: state.profile.avatar, color: state.profile.color,
  });
  setToken(token);
  session.user = user;
  await pushNow();
  pollNotifications();
}

export async function login(username, password) {
  const { token, user } = await req('POST', '/login', { username, password });
  setToken(token);
  session.user = user;
  await pullState();
  pollNotifications();
}

export async function logout() {
  try { await req('POST', '/logout'); } catch { /* ignore */ }
  setToken(null);
}

// ---------- Progress sync ----------
let timer;
async function pushNow() {
  if (!session.user) return;
  try {
    await req('PUT', '/state', {
      state, summary: summary(),
      profile: { displayName: state.profile.name, avatar: state.profile.avatar, color: state.profile.color },
    });
  } catch { /* retry on next change */ }
}
onChange(() => {
  if (!session.user) return;
  clearTimeout(timer);
  timer = setTimeout(pushNow, 1500);
});

export function postActivity(type, text) {
  if (session.user) api.post('/activity', { type, text }).catch(() => {});
}

// ---------- Notifications ----------
let pollTimer;
const notifyListeners = new Set();
export const onNotifications = (fn) => notifyListeners.add(fn);

export async function pollNotifications() {
  clearTimeout(pollTimer);
  if (!session.user) return;
  try {
    const { notifications, incoming } = await req('GET', '/notifications');
    session.notifications = notifications;
    session.incoming = incoming;
    session.unread = notifications.filter((n) => !n.read).length;
    notifyListeners.forEach((fn) => fn(session));
  } catch { /* offline */ }
  pollTimer = setTimeout(pollNotifications, 45000);
}
