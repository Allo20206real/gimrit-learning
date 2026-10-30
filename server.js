// Gimrit server: serves the web app and a small JSON API for accounts, sync, friends and leaderboards.
// Run with `node server.js`. Data is kept in data/db.json, or in Postgres when DATABASE_URL is set.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DATABASE_URL = process.env.DATABASE_URL;
// Sites allowed to call the API from a browser, comma separated ('*' = any)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map((o) => o.trim());
const PUBLIC = path.join(__dirname, 'public');
const TOKEN_TTL = 60 * 24 * 3600 * 1000;
const MAX_BODY = 512 * 1024;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
let db = { users: {}, tokens: {}, activity: [] };
let pool = null;
const written = new Map(); // Postgres row key -> last JSON written, so only changed rows are saved

async function loadDb() {
  if (!DATABASE_URL) {
    try {
      db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
    } catch (e) {
      if (e.code !== 'ENOENT') throw new Error('Could not read database: ' + e.message);
    }
    return;
  }
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
  await pool.query('CREATE TABLE IF NOT EXISTS gimrit_kv (k text PRIMARY KEY, v jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
  const { rows } = await pool.query('SELECT k, v FROM gimrit_kv');
  for (const r of rows) {
    if (r.k === 'tokens') db.tokens = r.v;
    else if (r.k === 'activity') db.activity = r.v;
    else if (r.k.startsWith('user:')) db.users[r.k.slice(5)] = r.v;
    written.set(r.k, JSON.stringify(r.v));
  }
}

function writeFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

async function writePostgres() {
  const rows = [['tokens', db.tokens], ['activity', db.activity], ...Object.values(db.users).map((u) => ['user:' + u.key, u])];
  for (const [k, v] of rows) {
    const json = JSON.stringify(v);
    if (written.get(k) === json) continue;
    await pool.query('INSERT INTO gimrit_kv (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = now()', [k, json]);
    written.set(k, json);
  }
}

let saveTimer = null;
let saving = Promise.resolve();
function save() {
  saveTimer = null;
  saving = saving.then(() => (pool ? writePostgres() : writeFile())).catch((e) => console.error('Save failed:', e.message));
  return saving;
}
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, pool ? 1000 : 250);
}
async function shutdown() {
  if (saveTimer) { clearTimeout(saveTimer); await save(); } else await saving;
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const now = () => Date.now();
const id = () => crypto.randomBytes(9).toString('base64url');
const key = (u) => String(u || '').toLowerCase();

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t - y) / 86400000 + 1) / 7)}`;
}

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
function checkPassword(pw, rec) {
  const h = crypto.scryptSync(pw, rec.salt, 64);
  return crypto.timingSafeEqual(h, Buffer.from(rec.hash, 'hex'));
}

const weeklyXp = (u) => (u.weekly && u.weekly.week === isoWeek() ? u.weekly.xp : 0);
const localDay = (u) => u.summary?.today;

function publicUser(u, viewer) {
  const s = u.summary || {};
  let relation = 'none';
  if (viewer) {
    if (viewer.friends.includes(u.key)) relation = 'friend';
    else if (viewer.outgoing.includes(u.key)) relation = 'outgoing';
    else if (viewer.incoming.includes(u.key)) relation = 'incoming';
  }
  return {
    username: u.username, displayName: u.displayName, avatar: u.avatar, color: u.color, created: u.created,
    xp: s.xp || 0, streak: s.streak || 0, longestStreak: s.longestStreak || 0, level: s.level || 1,
    lang: s.lang, langs: s.langs || [], achievements: s.achievements || 0, lessons: s.lessons || 0, words: s.words || 0,
    weeklyXp: weeklyXp(u), lastActive: u.lastActive || null,
    practicedToday: !!(u.lastActive && now() - u.lastActive < 20 * 3600 * 1000 && localDay(u) && u.practicedOn === localDay(u)),
    relation,
  };
}

function notify(u, type, from, text) {
  u.notifications.unshift({ id: id(), type, from: from && from.username, text, at: now(), read: false });
  u.notifications = u.notifications.slice(0, 50);
}

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
const EMOJI_RE = /^[\p{Extended_Pictographic}‍️\p{Emoji_Component}]{1,8}$/u;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

// Simple in-memory rate limiting for auth endpoints
const attempts = new Map();
function limited(ip) {
  const t = now();
  const rec = attempts.get(ip) || { n: 0, reset: t + 15 * 60000 };
  if (t > rec.reset) { rec.n = 0; rec.reset = t + 15 * 60000; }
  rec.n++;
  attempts.set(ip, rec);
  return rec.n > 30;
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------
class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

// Hosts like Render sit behind a proxy, so the visitor's address is in X-Forwarded-For
const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function auth(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  const t = m && db.tokens[m[1]];
  if (!t || now() - t.created > TOKEN_TTL) throw new HttpError(401, 'Please log in again');
  const u = db.users[t.u];
  if (!u) throw new HttpError(401, 'Please log in again');
  return u;
}

function findUser(name) {
  const u = db.users[key(name)];
  if (!u) throw new HttpError(404, 'User not found');
  return u;
}

function issueToken(u) {
  const token = crypto.randomBytes(32).toString('hex');
  db.tokens[token] = { u: u.key, created: now() };
  // prune expired tokens
  for (const [t, v] of Object.entries(db.tokens)) if (now() - v.created > TOKEN_TTL) delete db.tokens[t];
  return token;
}

const me = (u) => ({ ...publicUser(u), weeklyXp: weeklyXp(u) });

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const routes = [];
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

on('GET', '/api/health', () => ({ ok: true }));

on('POST', '/api/signup', async (req) => {
  if (limited(clientIp(req))) throw new HttpError(429, 'Too many attempts — try again later');
  const b = await readBody(req);
  const username = clean(b.username, 20);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new HttpError(400, 'Username must be 3–20 letters, numbers or _');
  if (typeof b.password !== 'string' || b.password.length < 6 || b.password.length > 200) throw new HttpError(400, 'Password must be at least 6 characters');
  if (db.users[key(username)]) throw new HttpError(409, 'That username is taken');
  const u = {
    key: key(username), username,
    displayName: clean(b.displayName, 24) || username,
    avatar: EMOJI_RE.test(b.avatar || '') ? b.avatar : '🦊',
    color: COLOR_RE.test(b.color || '') ? b.color : '#7c5cff',
    pass: hashPassword(b.password), created: now(), lastActive: now(),
    state: null, summary: {}, weekly: { week: isoWeek(), xp: 0 }, lastXp: 0,
    friends: [], incoming: [], outgoing: [], notifications: [],
  };
  db.users[u.key] = u;
  persist();
  return { token: issueToken(u), user: me(u) };
});

on('POST', '/api/login', async (req) => {
  if (limited(clientIp(req))) throw new HttpError(429, 'Too many attempts — try again later');
  const b = await readBody(req);
  const u = db.users[key(clean(b.username, 20))];
  if (!u || typeof b.password !== 'string' || !checkPassword(b.password, u.pass)) throw new HttpError(401, 'Wrong username or password');
  const token = issueToken(u);
  persist();
  return { token, user: me(u) };
});

on('POST', '/api/logout', (req) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (m) delete db.tokens[m[1]];
  persist();
  return { ok: true };
});

on('GET', '/api/me', (req) => ({ user: me(auth(req)) }));

on('GET', '/api/state', (req) => ({ state: auth(req).state }));

on('PUT', '/api/state', async (req) => {
  const u = auth(req);
  const b = await readBody(req);
  if (!b.state || typeof b.state !== 'object') throw new HttpError(400, 'Missing state');
  const s = b.summary || {};
  const xp = Math.max(0, Math.floor(Number(s.xp) || 0));
  // Weekly leaderboard XP is the growth in total XP during the current ISO week
  const week = isoWeek();
  if (!u.weekly || u.weekly.week !== week) u.weekly = { week, xp: 0 };
  const delta = xp - (u.lastXp || 0);
  if (delta > 0 && delta < 5000) u.weekly.xp += delta;
  if (delta > 0) { u.lastActive = now(); u.practicedOn = b.state?.streak?.last || null; }
  u.lastXp = xp;
  u.state = b.state;
  u.summary = {
    xp, streak: Number(s.streak) || 0, longestStreak: Number(s.longestStreak) || 0, level: Number(s.level) || 1,
    lang: clean(s.lang, 5), langs: Array.isArray(s.langs) ? s.langs.slice(0, 10).map((l) => ({ l: clean(l.l, 5), xp: Number(l.xp) || 0 })) : [],
    achievements: Number(s.achievements) || 0, lessons: Number(s.lessons) || 0, words: Number(s.words) || 0,
    today: b.state?.streak?.last || null,
  };
  const p = b.profile || {};
  if (p.displayName) u.displayName = clean(p.displayName, 24);
  if (EMOJI_RE.test(p.avatar || '')) u.avatar = p.avatar;
  if (COLOR_RE.test(p.color || '')) u.color = p.color;
  persist();
  return { ok: true, user: me(u) };
});

on('GET', '/api/users/search', (req, url) => {
  const viewer = auth(req);
  const q = key(clean(url.searchParams.get('q'), 30));
  if (q.length < 2) return { users: [] };
  const users = Object.values(db.users)
    .filter((u) => u.key !== viewer.key && (u.key.includes(q) || key(u.displayName).includes(q)))
    .sort((a, b) => (a.key.startsWith(q) ? -1 : 0) - (b.key.startsWith(q) ? -1 : 0))
    .slice(0, 10)
    .map((u) => publicUser(u, viewer));
  return { users };
});

on('GET', '/api/users/:name', (req, url, p) => {
  const viewer = auth(req);
  return { user: publicUser(findUser(decodeURIComponent(p.name)), viewer) };
});

on('GET', '/api/friends', (req) => {
  const u = auth(req);
  const list = (keys) => keys.map((k) => db.users[k]).filter(Boolean).map((f) => publicUser(f, u));
  return {
    friends: list(u.friends).sort((a, b) => b.weeklyXp - a.weeklyXp),
    incoming: list(u.incoming),
    outgoing: list(u.outgoing),
    me: me(u),
  };
});

on('POST', '/api/friends/request', async (req) => {
  const u = auth(req);
  const { username } = await readBody(req);
  const f = findUser(clean(username, 20));
  if (f.key === u.key) throw new HttpError(400, 'You can’t add yourself');
  if (u.friends.includes(f.key)) throw new HttpError(409, 'You’re already friends');
  if (u.incoming.includes(f.key)) return acceptFriend(u, f);
  if (u.outgoing.includes(f.key)) return { ok: true };
  if (u.friends.length >= 200) throw new HttpError(400, 'Friend limit reached');
  u.outgoing.push(f.key);
  f.incoming.push(u.key);
  notify(f, 'request', u, `${u.displayName} (@${u.username}) sent you a friend request`);
  persist();
  return { ok: true };
});

function acceptFriend(u, f) {
  u.incoming = u.incoming.filter((k) => k !== f.key);
  f.outgoing = f.outgoing.filter((k) => k !== u.key);
  if (!u.friends.includes(f.key)) u.friends.push(f.key);
  if (!f.friends.includes(u.key)) f.friends.push(u.key);
  notify(f, 'accepted', u, `${u.displayName} accepted your friend request`);
  persist();
  return { ok: true };
}

on('POST', '/api/friends/respond', async (req) => {
  const u = auth(req);
  const { username, accept } = await readBody(req);
  const f = findUser(clean(username, 20));
  if (!u.incoming.includes(f.key)) throw new HttpError(404, 'No pending request from that user');
  if (accept) return acceptFriend(u, f);
  u.incoming = u.incoming.filter((k) => k !== f.key);
  f.outgoing = f.outgoing.filter((k) => k !== u.key);
  persist();
  return { ok: true };
});

on('DELETE', '/api/friends/:name', (req, url, p) => {
  const u = auth(req);
  const f = findUser(decodeURIComponent(p.name));
  const drop = (arr, k) => arr.filter((x) => x !== k);
  u.friends = drop(u.friends, f.key); f.friends = drop(f.friends, u.key);
  u.outgoing = drop(u.outgoing, f.key); f.incoming = drop(f.incoming, u.key);
  persist();
  return { ok: true };
});

on('POST', '/api/friends/nudge', async (req) => {
  const u = auth(req);
  const { username } = await readBody(req);
  const f = findUser(clean(username, 20));
  if (!u.friends.includes(f.key)) throw new HttpError(403, 'You can only nudge friends');
  const recent = f.notifications.find((n) => n.type === 'nudge' && n.from === u.username && now() - n.at < 12 * 3600 * 1000);
  if (recent) throw new HttpError(429, `You already nudged ${f.displayName} recently`);
  notify(f, 'nudge', u, `${u.displayName} nudged you — time for a lesson! 🔥`);
  persist();
  return { ok: true };
});

on('GET', '/api/notifications', (req) => {
  const u = auth(req);
  return { notifications: u.notifications, incoming: u.incoming.length };
});
on('POST', '/api/notifications/read', (req) => {
  const u = auth(req);
  u.notifications.forEach((n) => (n.read = true));
  persist();
  return { ok: true };
});

on('POST', '/api/activity', async (req) => {
  const u = auth(req);
  const b = await readBody(req);
  const type = clean(b.type, 20), text = clean(b.text, 140);
  if (!type || !text) throw new HttpError(400, 'Missing activity');
  db.activity.unshift({ id: id(), u: u.key, type, text, at: now(), cheers: [] });
  db.activity = db.activity.slice(0, 2000);
  persist();
  return { ok: true };
});

on('GET', '/api/feed', (req) => {
  const u = auth(req);
  const circle = new Set([u.key, ...u.friends]);
  const feed = db.activity.filter((a) => circle.has(a.u)).slice(0, 40).map((a) => {
    const owner = db.users[a.u];
    return owner && {
      id: a.id, username: owner.username, displayName: owner.displayName, avatar: owner.avatar, color: owner.color,
      type: a.type, text: a.text, at: a.at, cheers: a.cheers.length, cheered: a.cheers.includes(u.key),
    };
  }).filter(Boolean);
  return { feed };
});

on('POST', '/api/feed/:id/cheer', (req, url, p) => {
  const u = auth(req);
  const a = db.activity.find((x) => x.id === p.id);
  if (!a) throw new HttpError(404, 'Activity not found');
  if (a.u !== u.key && !u.friends.includes(a.u)) throw new HttpError(403, 'You can only cheer friends');
  if (!a.cheers.includes(u.key) && a.u !== u.key) {
    a.cheers.push(u.key);
    const owner = db.users[a.u];
    if (owner) notify(owner, 'cheer', u, `${u.displayName} cheered: “${a.text}”`);
    persist();
  }
  return { cheers: a.cheers.length };
});

on('GET', '/api/leaderboard', (req, url) => {
  const u = auth(req);
  const scope = url.searchParams.get('scope') === 'friends' ? 'friends' : 'global';
  const pool = scope === 'friends' ? [u, ...u.friends.map((k) => db.users[k]).filter(Boolean)] : Object.values(db.users);
  const ranked = pool.map((x) => publicUser(x, u)).filter((x) => x.weeklyXp > 0 || x.username === u.username)
    .sort((a, b) => b.weeklyXp - a.weeklyXp || b.xp - a.xp);
  const rank = ranked.findIndex((x) => x.username === u.username) + 1;
  return { rows: ranked.slice(0, 50), me: { rank, weeklyXp: weeklyXp(u) } };
});

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) {
      // SPA fallback
      return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': TYPES['.html'] });
        res.end(html);
      });
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return serveStatic(req, res, url);
  }
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    for (const r of routes) {
      const m = r.method === req.method && r.re.exec(url.pathname);
      if (m) return send(res, 200, await r.fn(req, url, m.groups || {}));
    }
    throw new HttpError(404, 'Not found');
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(res, e.status || 500, { error: e instanceof HttpError ? e.message : 'Server error' });
  }
});

if (require.main === module) {
  loadDb().then(() => {
    server.listen(PORT, () => console.log(`Gimrit running at http://localhost:${PORT} (${pool ? 'Postgres' : 'file'} storage)`));
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
module.exports = { server, isoWeek };
