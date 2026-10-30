import { UNITS, LESSONS, allWords } from './data.js';

const KEY = 'gimrit:v1';
export const MAX_HEARTS = 5;
export const HEART_REFILL_MS = 30 * 60 * 1000;
export const MAX_FREEZES = 2;

export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return today(d);
};
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

const fresh = () => ({
  v: 1,
  onboarded: false,
  profile: { name: '', avatar: '🦊', color: '#7c5cff' },
  settings: { sound: true, dark: 'auto', goal: 20, speechRate: 0.9, speaking: true, listening: true, theme: 'violet', notifications: true },
  lang: 'es',
  courses: {},
  xp: 0,
  gems: 100,
  hearts: MAX_HEARTS,
  heartsAt: Date.now(),
  streak: { count: 0, last: null, longest: 0, freezes: 1, frozen: [] },
  history: {},
  stats: { lessons: 0, perfect: 0, bestCombo: 0, listened: 0, spoken: 0, speedBest: 0, stories: 0, flashcards: 0, practice: 0, purchases: 0, correct: 0, answered: 0 },
  quests: { date: null, list: [] },
  achievements: {},
  boosts: { doubleXpUntil: 0 },
  owned: ['violet'],
  created: today(),
});

export const state = load();
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(fresh(), JSON.parse(raw));
  } catch { /* storage unavailable */ }
  return fresh();
}

function merge(base, saved) {
  for (const k of Object.keys(saved)) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k])) {
      base[k] = merge(base[k], saved[k]);
    } else base[k] = saved[k];
  }
  return base;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn(state));
}

export function replaceState(next) {
  const merged = merge(fresh(), next);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, merged);
  tick();
  save();
}

export function resetState() {
  replaceState(fresh());
}

export function course(lang = state.lang) {
  if (!state.courses[lang]) state.courses[lang] = { done: {}, words: {}, mistakes: [], stories: {}, xp: 0, started: today() };
  return state.courses[lang];
}

// ---------- Time-based upkeep (hearts refill, streak freezes, quests) ----------
export function tick() {
  refillHearts();
  checkStreak();
  ensureQuests();
}

function refillHearts() {
  if (state.hearts >= MAX_HEARTS) { state.heartsAt = Date.now(); return; }
  const gained = Math.floor((Date.now() - state.heartsAt) / HEART_REFILL_MS);
  if (gained > 0) {
    state.hearts = Math.min(MAX_HEARTS, state.hearts + gained);
    state.heartsAt += gained * HEART_REFILL_MS;
  }
}
export const nextHeartIn = () => (state.hearts >= MAX_HEARTS ? 0 : HEART_REFILL_MS - (Date.now() - state.heartsAt));

export function loseHeart() {
  if (state.hearts >= MAX_HEARTS) state.heartsAt = Date.now();
  state.hearts = Math.max(0, state.hearts - 1);
}
export function gainHeart() {
  state.hearts = Math.min(MAX_HEARTS, state.hearts + 1);
}

// Returns info about what happened so the UI can tell the user (e.g. freeze used)
export let streakNotice = null;
function checkStreak() {
  const st = state.streak;
  if (!st.last || st.count === 0) return;
  const gap = daysBetween(st.last, today());
  if (gap <= 1) return;
  const missed = gap - 1;
  if (st.freezes >= missed) {
    st.freezes -= missed;
    for (let i = 1; i <= missed; i++) st.frozen.push(addDays(st.last, i));
    st.last = addDays(today(), -1);
    streakNotice = { type: 'frozen', days: missed };
  } else {
    streakNotice = { type: 'lost', count: st.count };
    st.count = 0;
  }
}
export const clearStreakNotice = () => { streakNotice = null; };

export const practicedToday = () => state.streak.last === today();
export const todayXp = () => state.history[today()] || 0;
export const doubleXpActive = () => state.boosts.doubleXpUntil > Date.now();

// ---------- XP & activity ----------
export function level(xp = state.xp) {
  let lvl = 1, need = 50, acc = 0;
  while (xp >= acc + need) { acc += need; lvl++; need = Math.round(need * 1.25); }
  return { lvl, into: xp - acc, need };
}

/**
 * Record a finished activity. Returns a summary used by the results screen.
 * @param {{xp:number, kind:string, perfect?:boolean, combo?:number, correct?:number, answered?:number, listened?:number, spoken?:number}} a
 */
export function recordActivity(a) {
  const before = { streak: state.streak.count, level: level().lvl, goalMet: todayXp() >= state.settings.goal };
  const mult = doubleXpActive() ? 2 : 1;
  const xp = Math.round(a.xp * mult);
  state.xp += xp;
  course().xp += xp;
  const d = today();
  state.history[d] = (state.history[d] || 0) + xp;

  const st = state.streak;
  let extended = false;
  if (st.last !== d) {
    st.count = st.last === addDays(d, -1) ? st.count + 1 : 1;
    st.last = d;
    st.longest = Math.max(st.longest, st.count);
    extended = true;
  }

  const s = state.stats;
  if (a.kind === 'lesson') s.lessons++;
  else s.practice++;
  if (a.perfect && a.kind === 'lesson') s.perfect++;
  s.bestCombo = Math.max(s.bestCombo, a.combo || 0);
  s.listened += a.listened || 0;
  s.spoken += a.spoken || 0;
  s.correct += a.correct || 0;
  s.answered += a.answered || 0;

  bumpQuest('xp', xp);
  if (a.kind === 'lesson') bumpQuest('lessons', 1);
  if (a.perfect) bumpQuest('perfect', 1);
  if (a.kind !== 'lesson') bumpQuest('practice', 1);
  if (a.listened) bumpQuest('listen', a.listened);
  if (a.combo) setQuestMax('combo', a.combo);
  if (todayXp() >= state.settings.goal) setQuestMax('goal', 1);

  const gems = a.kind === 'lesson' ? (a.perfect ? 10 : 5) : 2;
  state.gems += gems;

  const newAch = checkAchievements();
  const after = level().lvl;
  save();
  return {
    xp, gems, mult, extended, streak: st.count,
    goalJustMet: !before.goalMet && todayXp() >= state.settings.goal,
    levelUp: after > before.level ? after : 0,
    achievements: newAch,
  };
}

// ---------- Lessons progress ----------
export const lessonKey = (u, l) => `${u}:${l}`;
export function lessonDone(u, l, lang) { return course(lang).done[lessonKey(u, l)]; }

export function markLesson(u, l, perfect) {
  const c = course();
  const k = lessonKey(u, l);
  const prev = c.done[k] || { count: 0, perfect: false };
  c.done[k] = { count: prev.count + 1, perfect: prev.perfect || perfect, at: today() };
}

// The first not-yet-completed lesson across the course
export function currentLesson(lang) {
  for (let u = 0; u < UNITS.length; u++) {
    for (let l = 0; l < LESSONS.length; l++) if (!lessonDone(u, l, lang)) return { u, l };
  }
  return null;
}
export function isUnlocked(u, l, lang) {
  if (lessonDone(u, l, lang)) return true;
  const cur = currentLesson(lang);
  return cur && cur.u === u && cur.l === l;
}
export function unitDone(u, lang) { return LESSONS.every((_, l) => lessonDone(u, l, lang)); }
export function unitsCompleted(lang) { return UNITS.filter((_, u) => unitDone(u, lang)).length; }
export function courseProgress(lang) {
  const total = UNITS.length * LESSONS.length;
  return Object.keys(course(lang).done).length / total;
}

// ---------- Spaced repetition (Leitner boxes) ----------
const BOX_DAYS = [0, 1, 2, 4, 8, 16, 32];
export function reviewWord(id, correct, lang) {
  const c = course(lang);
  const w = c.words[id] || { box: 0, due: today(), seen: 0, right: 0 };
  w.seen++;
  if (correct) { w.right++; w.box = Math.min(BOX_DAYS.length - 1, w.box + 1); }
  else w.box = Math.max(1, Math.floor(w.box / 2));
  w.due = addDays(today(), BOX_DAYS[w.box]);
  c.words[id] = w;
}
export function learnedWords(lang) {
  const ids = new Set(Object.keys(course(lang).words));
  return allWords().filter((w) => ids.has(w.id));
}
export function dueWords(lang) {
  const c = course(lang);
  return allWords().filter((w) => c.words[w.id] && c.words[w.id].due <= today());
}
export function wordStrength(id, lang) {
  const w = course(lang).words[id];
  return w ? w.box / (BOX_DAYS.length - 1) : 0;
}

export function addMistake(ref) {
  const c = course();
  if (!c.mistakes.some((m) => m.type === ref.type && m.id === ref.id)) c.mistakes.push(ref);
  if (c.mistakes.length > 60) c.mistakes.shift();
}
export function clearMistake(ref) {
  const c = course();
  c.mistakes = c.mistakes.filter((m) => !(m.type === ref.type && m.id === ref.id));
}

// ---------- Daily quests ----------
const QUEST_POOL = [
  { id: 'xp', make: (g) => ({ target: g * 2, text: `Earn ${g * 2} XP`, icon: '⚡', reward: 20 }) },
  { id: 'lessons', make: () => ({ target: 2, text: 'Complete 2 lessons', icon: '📘', reward: 20 }) },
  { id: 'perfect', make: () => ({ target: 1, text: 'Finish a lesson with no mistakes', icon: '🎯', reward: 30 }) },
  { id: 'combo', make: () => ({ target: 8, text: 'Get 8 correct answers in a row', icon: '🔥', reward: 25 }) },
  { id: 'listen', make: () => ({ target: 6, text: 'Complete 6 listening exercises', icon: '🎧', reward: 20 }) },
  { id: 'practice', make: () => ({ target: 1, text: 'Finish a practice session', icon: '🏋️', reward: 20 }) },
  { id: 'goal', make: () => ({ target: 1, text: 'Hit your daily goal', icon: '🏁', reward: 25 }) },
];

function seeded(seed) {
  let x = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return () => ((x = (x * 1103515245 + 12345) >>> 0) / 2 ** 32);
}

function ensureQuests() {
  if (state.quests.date === today()) return;
  const rnd = seeded(today() + state.profile.name);
  const pool = QUEST_POOL.filter((q) => q.id !== 'goal');
  const picks = [];
  while (picks.length < 2) {
    const q = pool[Math.floor(rnd() * pool.length)];
    if (!picks.includes(q)) picks.push(q);
  }
  picks.push(QUEST_POOL.find((q) => q.id === 'goal'));
  state.quests = {
    date: today(),
    chest: false,
    list: picks.map((q) => ({ id: q.id, progress: 0, claimed: false, ...q.make(state.settings.goal) })),
  };
}
function bumpQuest(id, n) {
  ensureQuests();
  state.quests.list.forEach((q) => { if (q.id === id) q.progress = Math.min(q.target, q.progress + n); });
}
function setQuestMax(id, v) {
  ensureQuests();
  state.quests.list.forEach((q) => { if (q.id === id) q.progress = Math.min(q.target, Math.max(q.progress, v)); });
}
export function claimQuest(i) {
  const q = state.quests.list[i];
  if (!q || q.claimed || q.progress < q.target) return 0;
  q.claimed = true;
  state.gems += q.reward;
  save();
  return q.reward;
}
export function claimQuestChest() {
  if (state.quests.chest || !state.quests.list.every((q) => q.claimed)) return 0;
  state.quests.chest = true;
  const reward = 50 + Math.floor(Math.random() * 51);
  state.gems += reward;
  save();
  return reward;
}

// ---------- Achievements ----------
export const ACHIEVEMENTS = [
  { id: 'first', icon: '🌱', name: 'First Steps', desc: 'Complete your first lesson', test: (s) => s.stats.lessons >= 1 },
  { id: 'lessons10', icon: '📚', name: 'Bookworm', desc: 'Complete 10 lessons', test: (s) => s.stats.lessons >= 10 },
  { id: 'lessons40', icon: '🎓', name: 'Scholar', desc: 'Complete 40 lessons', test: (s) => s.stats.lessons >= 40 },
  { id: 'streak3', icon: '🔥', name: 'On Fire', desc: 'Reach a 3 day streak', test: (s) => s.streak.longest >= 3 },
  { id: 'streak7', icon: '🌋', name: 'Week Warrior', desc: 'Reach a 7 day streak', test: (s) => s.streak.longest >= 7 },
  { id: 'streak30', icon: '☄️', name: 'Unstoppable', desc: 'Reach a 30 day streak', test: (s) => s.streak.longest >= 30 },
  { id: 'xp100', icon: '⚡', name: 'Charged Up', desc: 'Earn 100 XP', test: (s) => s.xp >= 100 },
  { id: 'xp1000', icon: '💫', name: 'XP Machine', desc: 'Earn 1,000 XP', test: (s) => s.xp >= 1000 },
  { id: 'perfect', icon: '🎯', name: 'Sharpshooter', desc: 'Finish a lesson with zero mistakes', test: (s) => s.stats.perfect >= 1 },
  { id: 'perfect10', icon: '🏹', name: 'Flawless', desc: 'Finish 10 perfect lessons', test: (s) => s.stats.perfect >= 10 },
  { id: 'combo15', icon: '🌀', name: 'Combo Master', desc: 'Get 15 answers right in a row', test: (s) => s.stats.bestCombo >= 15 },
  { id: 'words25', icon: '🧠', name: 'Word Collector', desc: 'Learn 25 words', test: () => learnedWords().length >= 25 },
  { id: 'unit', icon: '🏆', name: 'Unit Conqueror', desc: 'Complete a whole unit', test: () => unitsCompleted() >= 1 },
  { id: 'story', icon: '📖', name: 'Storyteller', desc: 'Finish a story', test: (s) => s.stats.stories >= 1 },
  { id: 'speed', icon: '⏱️', name: 'Speed Demon', desc: 'Score 15+ in a Speed Round', test: (s) => s.stats.speedBest >= 15 },
  { id: 'speaker', icon: '🎙️', name: 'Chatterbox', desc: 'Complete 10 speaking exercises', test: (s) => s.stats.spoken >= 10 },
  { id: 'polyglot', icon: '🌍', name: 'Polyglot', desc: 'Start a second language', test: (s) => Object.values(s.courses).filter((c) => c.xp > 0).length >= 2 },
  { id: 'shopper', icon: '🛍️', name: 'Treat Yourself', desc: 'Buy something in the shop', test: (s) => s.stats.purchases >= 1 },
  { id: 'social', icon: '🤝', name: 'Better Together', desc: 'Add your first friend', test: (s) => (s.stats.friends || 0) >= 1 },
  { id: 'night', icon: '🦉', name: 'Night Owl', desc: 'Finish a lesson after 10 PM', test: () => new Date().getHours() >= 22 },
  { id: 'early', icon: '🐓', name: 'Early Bird', desc: 'Finish a lesson before 7 AM', test: () => new Date().getHours() < 7 },
];

export function checkAchievements() {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements[a.id] && a.test(state)) {
      state.achievements[a.id] = today();
      state.gems += 25;
      unlocked.push(a);
    }
  }
  return unlocked;
}

// ---------- Shop ----------
export function spend(price) {
  if (state.gems < price) return false;
  state.gems -= price;
  state.stats.purchases++;
  checkAchievements();
  save();
  return true;
}

// Compact numbers shared with the server for leaderboards and friend profiles
export function summary() {
  return {
    xp: state.xp,
    streak: state.streak.count,
    longestStreak: state.streak.longest,
    level: level().lvl,
    lang: state.lang,
    langs: Object.entries(state.courses).filter(([, c]) => c.xp > 0).map(([l, c]) => ({ l, xp: c.xp })),
    achievements: Object.keys(state.achievements).length,
    lessons: state.stats.lessons,
    words: learnedWords().length,
  };
}

tick();
