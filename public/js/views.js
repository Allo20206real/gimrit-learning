import { UNITS, LESSONS, LANGS, LANG_ORDER, STORIES, AVATARS, PREMIUM_AVATARS, COLORS, THEMES, allWords } from './data.js';
import {
  state, save, tick, course, level, recordActivity, markLesson, lessonDone, currentLesson, isUnlocked, unitDone,
  courseProgress, learnedWords, dueWords, wordStrength, todayXp, practicedToday, nextHeartIn, MAX_HEARTS, MAX_FREEZES,
  claimQuest, claimQuestChest, ACHIEVEMENTS, checkAchievements, spend, doubleXpActive, today, addDays, streakNotice,
  clearStreakNotice, resetState, unitsCompleted, reviewWord,
} from './store.js';
import { buildLesson, buildPractice, runSession, practiceAvailable } from './lesson.js';
import { say, sfx, canSpeak, canListen } from './audio.js';
import { session, api, signup, login, logout, postActivity, pollNotifications, onNotifications } from './api.js';
import { $, $$, esc, shuffle, sample, fmt, toast, modal, confetti, mascot, avatar, ring, timeAgo } from './ui.js';

const app = () => $('#app');
let cleanup = null;

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
export function applyTheme() {
  const t = THEMES.find((x) => x.id === state.settings.theme) || THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent2', t.accent2);
  root.style.setProperty('--accent-light', `color-mix(in srgb, ${t.accent} 55%, white)`);
  const dark = state.settings.dark === 'dark' || (state.settings.dark === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
const NAV = [
  { id: 'learn', icon: '🏠', label: 'Learn', mobile: true },
  { id: 'practice', icon: '🏋️', label: 'Practice', mobile: true },
  { id: 'stories', icon: '📖', label: 'Stories' },
  { id: 'leaderboard', icon: '🏆', label: 'Leaderboard', mobile: true },
  { id: 'friends', icon: '👥', label: 'Friends', mobile: true },
  { id: 'quests', icon: '🎯', label: 'Quests' },
  { id: 'shop', icon: '🛍️', label: 'Shop' },
  { id: 'profile', icon: '👤', label: 'Profile', mobile: true },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

function shell(active, content, { rail = true } = {}) {
  const lang = LANGS[state.lang];
  const nav = NAV.map((n) => `<a href="#/${n.id}" class="nav-item ${n.id === active ? 'active' : ''} ${n.mobile ? 'm' : ''}" data-nav="${n.id}">
    <span class="nav-icon">${n.icon}</span><span class="nav-label">${n.label}</span>${n.id === 'friends' ? '<span class="nav-dot" hidden></span>' : ''}</a>`).join('');
  app().innerHTML = `<div class="shell ${rail ? '' : 'no-rail'}">
    <nav class="sidebar"><a class="logo" href="#/learn">${mascot('happy', 38)}<span>gimrit</span></a>${nav}</nav>
    <div class="main">
      <header class="topbar">
        <button class="chip course-chip" title="Switch course">${lang.flag}<span class="hide-sm">${lang.name}</span></button>
        <div class="top-stats">
          <a href="#/profile" class="chip streak-chip ${practicedToday() ? 'lit' : ''}" title="Day streak">🔥<b>${state.streak.count}</b></a>
          <a href="#/shop" class="chip" title="Gems">💎<b>${fmt(state.gems)}</b></a>
          <span class="chip hearts-chip" title="Hearts">❤️<b>${state.hearts}</b></span>
          ${session.user ? `<button class="chip bell" title="Notifications">🔔<span class="badge" ${session.unread ? '' : 'hidden'}>${session.unread}</span></button>` : ''}
        </div>
      </header>
      <div class="page">${content}</div>
    </div>
    ${rail ? `<aside class="rail">${railHtml()}</aside>` : ''}
  </div>`;
  $('.course-chip').addEventListener('click', courseSwitcher);
  $('.hearts-chip').addEventListener('click', heartsInfo);
  $('.bell')?.addEventListener('click', showNotifications);
  updateFriendDot();
}

function updateFriendDot() {
  const dot = $('.nav-dot');
  if (dot) dot.hidden = !session.incoming;
}

function railHtml() {
  const goal = state.settings.goal, xpToday = todayXp();
  const qs = state.quests.list;
  const days = weekDots();
  return `
    <div class="card widget">
      <div class="widget-row">${ring(xpToday / goal, 64, 7, xpToday >= goal ? '✓' : `${Math.round((xpToday / goal) * 100)}%`)}
        <div><div class="widget-title">Daily goal</div><div class="muted">${xpToday} / ${goal} XP today</div>${doubleXpActive() ? '<div class="boost-tag">⚡ 2× XP active</div>' : ''}</div></div>
    </div>
    <div class="card widget">
      <div class="widget-title">🔥 ${state.streak.count} day streak</div>
      <div class="week">${days}</div>
      <div class="muted small">${practicedToday() ? 'You’re on fire! Come back tomorrow.' : 'Finish a lesson today to keep your streak.'} · 🧊 ${state.streak.freezes} freeze${state.streak.freezes === 1 ? '' : 's'}</div>
    </div>
    <div class="card widget">
      <div class="widget-head"><span class="widget-title">Daily quests</span><a href="#/quests" class="link">View all</a></div>
      ${qs.map((q) => `<div class="mini-quest"><span>${q.icon}</span><div class="grow"><div class="small">${esc(q.text)}</div>${bar(q.progress / q.target)}</div></div>`).join('')}
    </div>
    ${session.user || !session.online ? '' : `<div class="card widget promo"><div class="widget-title">Learn with friends</div><p class="muted small">Create a free profile to add friends, compete on leaderboards and sync your progress.</p><a class="btn primary sm" href="#/account">Create a profile</a></div>`}
    <div class="rail-foot muted small">Gimrit · Learn languages your way</div>`;
}

function weekDots() {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  return labels.map((lb, i) => {
    const d = addDays(today(), i - dow);
    const cls = state.history[d] ? 'on' : state.streak.frozen.includes(d) ? 'frozen' : d === today() ? 'today' : '';
    return `<span class="day ${cls}"><i>${state.history[d] ? '🔥' : state.streak.frozen.includes(d) ? '🧊' : ''}</i>${lb}</span>`;
  }).join('');
}

const bar = (pct, cls = '') => `<div class="bar ${cls}"><div style="width:${Math.max(0, Math.min(1, pct)) * 100}%"></div></div>`;

async function courseSwitcher() {
  const started = Object.keys(state.courses);
  const rows = LANG_ORDER.map((l) => {
    const c = state.courses[l];
    return `<button class="lang-row ${l === state.lang ? 'current' : ''}" data-value="${l}"><span class="flag">${LANGS[l].flag}</span>
      <span class="grow"><b>${LANGS[l].name}</b><span class="muted small">${c ? `${fmt(c.xp)} XP · ${Math.round(courseProgress(l) * 100)}% complete` : 'Start learning'}</span></span>${l === state.lang ? '✓' : started.includes(l) ? '' : '<span class="tag">New</span>'}</button>`;
  }).join('');
  const v = await modal(`<h2>Your courses</h2><div class="lang-list">${rows}</div>`);
  if (v && v !== state.lang) {
    state.lang = v;
    course(v);
    checkAchievements();
    save();
    toast(`Switched to ${LANGS[v].name}`, LANGS[v].flag);
    route();
  }
}

function heartsInfo() {
  const mins = Math.ceil(nextHeartIn() / 60000);
  modal(`<div class="center"><div class="big-emoji">❤️</div><h2>${state.hearts} / ${MAX_HEARTS} hearts</h2>
    <p class="muted">You lose a heart for each mistake in a lesson. ${state.hearts < MAX_HEARTS ? `Next heart in ${mins} min.` : 'You’re fully stocked!'}</p>
    <div class="stack"><a class="btn primary" href="#/practice" data-value="x">Practice to earn hearts</a><a class="btn" href="#/shop" data-value="x">Refill in the shop</a></div></div>`);
}

async function showNotifications() {
  const list = session.notifications;
  const icons = { request: '🤝', accepted: '🎉', nudge: '👉', cheer: '👏' };
  modal(`<h2>Notifications</h2>${list.length ? `<div class="notif-list">${list.map((n) => `<div class="notif ${n.read ? '' : 'unread'}"><span class="big">${icons[n.type] || '🔔'}</span><div class="grow"><div>${esc(n.text)}</div><div class="muted small">${timeAgo(n.at)}</div></div></div>`).join('')}</div>` : `<div class="empty">${mascot('happy', 80)}<p class="muted">No notifications yet.</p></div>`}`);
  if (session.unread) {
    await api.post('/notifications/read').catch(() => {});
    session.notifications.forEach((n) => (n.read = true));
    session.unread = 0;
    $('.bell .badge')?.setAttribute('hidden', '');
  }
}

onNotifications(() => {
  const b = $('.bell .badge');
  if (b) { b.textContent = session.unread; b.hidden = !session.unread; }
  updateFriendDot();
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------
function onboarding(step = 0) {
  const o = state.onboardingDraft || (state.onboardingDraft = { lang: null, goal: 20, name: '', avatar: AVATARS[0], color: COLORS[0] });
  let body = '';
  if (step === 0) {
    body = `<div class="hero">
      <div class="hero-art">${mascot('cheer', 200)}<div class="floaty f1">¡Hola!</div><div class="floaty f2">Bonjour</div><div class="floaty f3">Ciao</div><div class="floaty f4">Hallo</div></div>
      <div class="hero-copy"><h1>Learn a language.<br><span class="grad">Have a blast doing it.</span></h1>
        <p class="lead">Bite-sized lessons, stories, speaking practice, streaks and friends — Gimrit turns a few minutes a day into real progress.</p>
        <div class="stack narrow"><button class="btn primary lg" data-step="1">Get started</button>
        ${session.online ? '<a class="btn lg" href="#/account?mode=login">I already have a profile</a>' : ''}</div>
        <div class="feature-pills"><span>🧩 9 exercise types</span><span>🎧 Listening</span><span>🎙️ Speaking</span><span>📖 Stories</span><span>🔥 Streaks</span><span>🏆 Leaderboards</span></div>
      </div></div>`;
  } else if (step === 1) {
    body = `<div class="ob"><div class="ob-head">${mascot('happy', 70)}<div class="bubble">What do you want to learn?</div></div>
      <div class="lang-grid">${LANG_ORDER.map((l) => `<button class="lang-card ${o.lang === l ? 'selected' : ''}" data-lang="${l}"><span class="flag-xl">${LANGS[l].flag}</span><b>${LANGS[l].name}</b><span class="muted small">${LANGS[l].native}</span></button>`).join('')}</div>
      <div class="ob-foot"><button class="btn ghost" data-step="0">Back</button><button class="btn primary" data-step="2" ${o.lang ? '' : 'disabled'}>Continue</button></div></div>`;
  } else if (step === 2) {
    const goals = [[10, 'Casual', '5 min / day'], [20, 'Regular', '10 min / day'], [30, 'Serious', '15 min / day'], [50, 'Intense', '20+ min / day']];
    body = `<div class="ob"><div class="ob-head">${mascot('wow', 70)}<div class="bubble">What’s your daily goal?</div></div>
      <div class="goal-list">${goals.map(([xp, n, d]) => `<button class="goal-row ${o.goal === xp ? 'selected' : ''}" data-goal="${xp}"><b>${n}</b><span class="muted">${d}</span><span class="tag">${xp} XP</span></button>`).join('')}</div>
      <div class="ob-foot"><button class="btn ghost" data-step="1">Back</button><button class="btn primary" data-step="3">Continue</button></div></div>`;
  } else {
    body = `<div class="ob"><div class="ob-head">${mascot('cheer', 70)}<div class="bubble">Last step — make it yours!</div></div>
      <div class="card pad">
        <label class="field"><span>Your name</span><input id="ob-name" maxlength="24" placeholder="e.g. Alex" value="${esc(o.name)}"></label>
        <div class="field"><span>Pick an avatar</span><div class="avatar-grid">${AVATARS.map((a) => `<button class="av-pick ${o.avatar === a ? 'selected' : ''}" data-av="${a}">${a}</button>`).join('')}</div></div>
        <div class="field"><span>Favorite color</span><div class="color-grid">${COLORS.map((c) => `<button class="color-pick ${o.color === c ? 'selected' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
      </div>
      <div class="ob-foot"><button class="btn ghost" data-step="2">Back</button><button class="btn primary" data-finish>Start learning 🚀</button></div></div>`;
  }
  app().innerHTML = `<div class="onboarding"><div class="ob-top"><span class="logo">${mascot('happy', 34)}<span>gimrit</span></span>${step ? `<div class="ob-progress">${bar(step / 3)}</div>` : ''}</div>${body}</div>`;

  $$('[data-step]').forEach((b) => b.addEventListener('click', () => { o.name = $('#ob-name')?.value ?? o.name; onboarding(Number(b.dataset.step)); }));
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => { o.lang = b.dataset.lang; say(LANGS[o.lang].native, o.lang); onboarding(1); }));
  $$('[data-goal]').forEach((b) => b.addEventListener('click', () => { o.goal = Number(b.dataset.goal); onboarding(2); }));
  $$('[data-av]').forEach((b) => b.addEventListener('click', () => { o.name = $('#ob-name').value; o.avatar = b.dataset.av; onboarding(3); }));
  $$('[data-color]').forEach((b) => b.addEventListener('click', () => { o.name = $('#ob-name').value; o.color = b.dataset.color; onboarding(3); }));
  $('[data-finish]')?.addEventListener('click', () => {
    const name = $('#ob-name').value.trim();
    if (!name) { toast('Tell us your name first!', '✏️'); $('#ob-name').focus(); return; }
    Object.assign(state.profile, { name, avatar: o.avatar, color: o.color });
    state.lang = o.lang;
    state.settings.goal = o.goal;
    course(o.lang);
    state.onboarded = true;
    delete state.onboardingDraft;
    state.quests.date = null;
    tick();
    save();
    sfx('complete');
    confetti();
    location.hash = '#/learn';
  });
}

// ---------------------------------------------------------------------------
// Learn path
// ---------------------------------------------------------------------------
const OFFSETS = [0, 46, 70, 46, 0, -46, -70, -46];

function learn() {
  const cur = currentLesson();
  const units = UNITS.map((u, ui) => {
    const locked = cur ? ui > cur.u : false;
    let nodeI = 0;
    const nodes = [];
    LESSONS.forEach((les, li) => {
      if (li === 3) nodes.push(chestNode(ui, nodeI++));
      const done = lessonDone(ui, li);
      const open = isUnlocked(ui, li);
      const isCur = cur && cur.u === ui && cur.l === li;
      const icon = li === 4 ? '👑' : done ? (done.perfect ? '⭐' : '✓') : ['📘', '📗', '💬', '🏋️'][li];
      nodes.push(`<div class="node-wrap" style="--x:${OFFSETS[nodeI++ % OFFSETS.length]}px">
        ${isCur ? '<div class="start-bubble">START</div>' : ''}
        <button class="node ${done ? 'done' : ''} ${isCur ? 'current' : ''} ${open ? '' : 'locked'} ${li === 4 ? 'boss' : ''}" data-u="${ui}" data-l="${li}" style="--uc:${u.color}" aria-label="${esc(les.title)}">
          ${isCur ? ring(0.0001, 96, 8) : ''}<span>${open ? icon : '🔒'}</span></button></div>`);
    });
    return `<section class="unit ${locked ? 'locked' : ''}" id="unit-${ui}">
      <div class="unit-banner" style="--uc:${u.color}">
        <div><div class="unit-kicker">Unit ${ui + 1}${unitDone(ui) ? ' · Complete 🏆' : ''}</div><h2>${u.icon} ${esc(u.title)}</h2><p>${esc(u.desc)}</p></div>
        <button class="btn on-color" data-guide="${ui}">📒 Guidebook</button>
      </div>
      <div class="path">${nodes.join('')}<div class="path-mascot" style="--side:${ui % 2 ? -1 : 1}">${mascot(ui % 2 ? 'wow' : 'happy', 110)}</div></div>
    </section>`;
  }).join('');
  const pct = Math.round(courseProgress() * 100);
  shell('learn', `<div class="learn">
    <div class="course-head card"><span class="flag-xl">${LANGS[state.lang].flag}</span><div class="grow"><b>${LANGS[state.lang].name} course</b><div class="muted small">${pct}% complete · ${learnedWords().length} words learned</div>${bar(pct / 100)}</div></div>
    ${units}
    <div class="course-end card center">${mascot('cheer', 90)}<h3>More units coming soon!</h3><p class="muted">Finished everything? Keep your skills sharp in Practice and Stories.</p></div>
  </div>`);
  $$('.node').forEach((b) => b.addEventListener('click', (e) => lessonPopover(e.currentTarget)));
  $$('[data-guide]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/guide/${b.dataset.guide}`; }));
  $$('.chest').forEach((b) => b.addEventListener('click', () => openChest(Number(b.dataset.u))));
  const target = cur ? $(`.node.current`) : null;
  if (target) setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
}

function chestNode(ui, nodeI) {
  const c = course();
  c.chests ||= {};
  const ready = [0, 1, 2].every((l) => lessonDone(ui, l));
  const opened = c.chests[ui];
  return `<div class="node-wrap" style="--x:${OFFSETS[nodeI % OFFSETS.length]}px"><button class="chest ${ready && !opened ? 'ready' : ''} ${opened ? 'opened' : ''}" data-u="${ui}" aria-label="Treasure chest">${opened ? '📭' : '🎁'}</button></div>`;
}

function openChest(ui) {
  const c = course();
  c.chests ||= {};
  if (c.chests[ui]) return toast('Already opened — keep going!', '📭');
  if (![0, 1, 2].every((l) => lessonDone(ui, l))) return toast('Finish the lessons above to open this chest', '🔒');
  const gems = 20 + Math.floor(Math.random() * 31);
  c.chests[ui] = true;
  state.gems += gems;
  save();
  sfx('coin');
  confetti(80);
  modal(`<div class="center"><div class="big-emoji bounce">🎁</div><h2>You found ${gems} gems!</h2><p class="muted">Spend them in the shop on power-ups and themes.</p><button class="btn primary" data-value="ok">Sweet!</button></div>`).then(learn);
}

function lessonPopover(btn) {
  $$('.popover').forEach((p) => p.remove());
  const u = Number(btn.dataset.u), l = Number(btn.dataset.l);
  const les = LESSONS[l], unit = UNITS[u];
  const open = isUnlocked(u, l), done = lessonDone(u, l);
  const pop = document.createElement('div');
  pop.className = 'popover';
  pop.style.setProperty('--uc', open ? unit.color : '#9aa0b4');
  pop.innerHTML = open
    ? `<b>${esc(les.title)}</b><div class="small">Lesson ${l + 1} of ${LESSONS.length}${done ? ` · completed ${done.count}×` : ''}</div>
       <button class="btn on-color full">${done ? `Practice again +${l === 4 ? 10 : 5} XP` : `Start +${l === 4 ? 20 : 10} XP`}</button>`
    : `<b>${esc(les.title)}</b><div class="small">Complete all levels above to unlock this!</div><button class="btn full" disabled>Locked</button>`;
  btn.parentElement.append(pop);
  pop.querySelector('.btn:not([disabled])')?.addEventListener('click', () => { location.hash = `#/lesson/${u}/${l}`; });
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close); }
  }), 0);
}

function guide(ui) {
  const u = UNITS[ui];
  if (!u) return learn();
  shell('learn', `<div class="guide">
    <a href="#/learn" class="back">← Back to path</a>
    <div class="unit-banner" style="--uc:${u.color}"><div><div class="unit-kicker">Unit ${ui + 1} guidebook</div><h2>${u.icon} ${esc(u.title)}</h2><p>${esc(u.desc)}</p></div></div>
    <div class="card pad tip">💡 <b>Tip:</b> ${esc(u.tip)}</div>
    <h3>Key phrases</h3>
    <div class="phrase-list">${u.sentences.map((s) => `<div class="phrase card"><button class="speaker" data-say="${esc(s.t[state.lang])}">🔊</button><div><b>${esc(s.t[state.lang])}</b><div class="muted">${esc(s.en)}</div></div></div>`).join('')}</div>
    <h3>Vocabulary</h3>
    <div class="vocab-grid">${u.words.map((w) => `<button class="vocab card" data-say="${esc(w.t[state.lang])}"><span class="pic">${w.e}</span><b>${esc(w.t[state.lang])}</b><span class="muted">${esc(w.en)}</span>${bar(wordStrength(w.id))}</button>`).join('')}</div>
  </div>`);
  $$('[data-say]').forEach((b) => b.addEventListener('click', () => say(b.dataset.say)));
}

// ---------------------------------------------------------------------------
// Lesson & results
// ---------------------------------------------------------------------------
function lesson(u, l) {
  u = Number(u); l = Number(l);
  if (!UNITS[u] || !LESSONS[l] || !isUnlocked(u, l)) { location.hash = '#/learn'; return; }
  tick();
  if (state.hearts <= 0) {
    modal(`<div class="center">${mascot('sad', 100)}<h2>No hearts left</h2><p class="muted">Practice to earn hearts, wait for a refill, or buy one in the shop.</p><div class="stack"><a class="btn primary" href="#/practice" data-value="x">Practice</a><a class="btn" href="#/shop" data-value="x">Shop</a></div></div>`);
    location.hash = '#/learn';
    return;
  }
  const replay = !!lessonDone(u, l);
  const cfg = runSession(app(), {
    title: LESSONS[l].title,
    exercises: buildLesson(u, l),
    useHearts: true,
    onQuit: () => { location.hash = '#/learn'; },
    onFinish: (r) => {
      markLesson(u, l, r.perfect);
      const base = (l === 4 ? 20 : 10) / (replay ? 2 : 1);
      const xp = base + (r.perfect ? 5 : 0) + Math.floor(r.bestCombo / 5);
      const res = recordActivity({ xp, kind: 'lesson', perfect: r.perfect, combo: r.bestCombo, correct: r.correct, answered: r.answered, listened: r.listened, spoken: r.spoken });
      if (unitDone(u) && l === 4 && !replay) postActivity('unit', `completed the ${LANGS[state.lang].name} unit “${UNITS[u].title}” 🏆`);
      results(r, res, '#/learn');
    },
  });
  cleanup = cfg.cleanup;
}

function practiceSession(mode) {
  const titles = { review: 'Smart review', mistakes: 'Fix mistakes', listening: 'Listening lab', speaking: 'Speaking studio', sentences: 'Sentence builder' };
  const exercises = buildPractice(mode);
  if (!exercises.length) { toast('Nothing to practice here yet!', '🤷'); location.hash = '#/practice'; return; }
  const cfg = runSession(app(), {
    title: titles[mode],
    exercises,
    useHearts: false,
    mistakesMode: mode === 'mistakes',
    onQuit: () => { location.hash = '#/practice'; },
    onFinish: (r) => {
      const gainedHeart = state.hearts < MAX_HEARTS;
      if (gainedHeart) state.hearts++;
      const res = recordActivity({ xp: 10 + Math.floor(r.bestCombo / 5), kind: 'practice', combo: r.bestCombo, correct: r.correct, answered: r.answered, listened: r.listened, spoken: r.spoken, perfect: r.perfect });
      results(r, res, '#/practice', gainedHeart);
    },
  });
  cleanup = cfg.cleanup;
}

async function results(r, res, back, gainedHeart = false) {
  cleanup = null;
  if (res.extended) await streakCelebration(res.streak);
  sfx('complete');
  confetti();
  const mm = Math.floor(r.secs / 60), ss = String(r.secs % 60).padStart(2, '0');
  app().innerHTML = `<div class="results">
    ${mascot('cheer', 160)}
    <h1>${r.perfect ? 'Perfect lesson!' : 'Lesson complete!'}</h1>
    <p class="muted">${r.perfect ? 'Not a single mistake. Incredible!' : 'Every session makes you stronger.'}</p>
    <div class="stat-cards">
      <div class="stat-card gold"><div class="sc-label">Total XP</div><div class="sc-val">⚡ ${res.xp}${res.mult > 1 ? ' <small>2×</small>' : ''}</div></div>
      <div class="stat-card green"><div class="sc-label">Accuracy</div><div class="sc-val">🎯 ${Math.round(r.accuracy * 100)}%</div></div>
      <div class="stat-card blue"><div class="sc-label">Time</div><div class="sc-val">⏱️ ${mm}:${ss}</div></div>
      <div class="stat-card orange"><div class="sc-label">Best combo</div><div class="sc-val">🔥 ${r.bestCombo}</div></div>
    </div>
    <div class="reward-row"><span class="chip">💎 +${res.gems} gems</span>${gainedHeart ? '<span class="chip">❤️ +1 heart</span>' : ''}${res.goalJustMet ? '<span class="chip">🏁 Daily goal reached!</span>' : ''}</div>
    <button class="btn primary lg continue">Continue</button>
  </div>`;
  if (res.goalJustMet) postActivity('goal', `hit their daily goal of ${state.settings.goal} XP 🏁`);
  const cont = $('.continue');
  cont.focus();
  cont.addEventListener('click', async () => {
    if (res.levelUp) {
      sfx('levelup');
      postActivity('level', `reached level ${res.levelUp} ⭐`);
      await modal(`<div class="center"><div class="big-emoji bounce">⭐</div><h2>Level ${res.levelUp}!</h2><p class="muted">You leveled up. Keep climbing!</p><button class="btn primary" data-value="ok">Awesome</button></div>`);
    }
    for (const a of res.achievements) {
      sfx('coin');
      postActivity('achievement', `unlocked “${a.name}” ${a.icon}`);
      await modal(`<div class="center"><div class="ach-badge big unlocked">${a.icon}</div><div class="kicker">Achievement unlocked</div><h2>${esc(a.name)}</h2><p class="muted">${esc(a.desc)} · +25 💎</p><button class="btn primary" data-value="ok">Collect</button></div>`);
    }
    location.hash = back;
  });
}

function streakCelebration(n) {
  return new Promise((resolve) => {
    sfx('levelup');
    if (n > 1 && [3, 7, 14, 30, 50, 100, 365].includes(n)) postActivity('streak', `is on a ${n} day streak 🔥`);
    app().innerHTML = `<div class="results streak-screen">
      <div class="flame">🔥</div><div class="streak-num">${n}</div><h1>day streak!</h1>
      <div class="week big">${weekDots()}</div>
      <p class="muted">${n === 1 ? 'Day one! Come back tomorrow to build your streak.' : 'You’re building a habit. Practice each day so your streak doesn’t reset!'}</p>
      <button class="btn primary lg">Continue</button></div>`;
    $('.streak-screen .btn').addEventListener('click', resolve);
    $('.streak-screen .btn').focus();
  });
}

// ---------------------------------------------------------------------------
// Practice hub
// ---------------------------------------------------------------------------
function practice() {
  const due = dueWords().length, mistakes = course().mistakes.length, learned = learnedWords().length;
  const ok = practiceAvailable();
  const cards = [
    { href: '#/practice/review', icon: '🧠', title: 'Smart review', desc: due ? `${due} words are due for review` : 'Strengthen what you’ve learned', color: '#7c5cff', on: ok },
    { href: '#/practice/mistakes', icon: '🩹', title: 'Fix mistakes', desc: mistakes ? `${mistakes} items to fix` : 'No mistakes to review — nice!', color: '#ff4f8b', on: mistakes > 0 },
    { href: '#/flashcards', icon: '🃏', title: 'Flashcards', desc: 'Flip, recall, repeat. Spaced repetition.', color: '#1fa2ff', on: true },
    { href: '#/speed', icon: '⏱️', title: 'Speed round', desc: `60 seconds. How many can you get? Best: ${state.stats.speedBest}`, color: '#ff7a45', on: ok },
    { href: '#/practice/listening', icon: '🎧', title: 'Listening lab', desc: canSpeak ? 'Train your ear with audio drills' : 'Audio isn’t supported in this browser', color: '#00b8a9', on: ok && canSpeak },
    { href: '#/practice/speaking', icon: '🎙️', title: 'Speaking studio', desc: canListen ? 'Practice pronunciation out loud' : 'Speech recognition needs Chrome, Edge or Safari', color: '#f5b400', on: ok && canListen },
    { href: '#/practice/sentences', icon: '🧩', title: 'Sentence builder', desc: 'Assemble full sentences from word tiles', color: '#20b26b', on: ok },
    { href: '#/stories', icon: '📖', title: 'Stories', desc: 'Short interactive dialogues', color: '#9b59ff', on: true },
    { href: '#/words', icon: '📚', title: 'My words', desc: `${learned} words learned — browse & listen`, color: '#5b6b8c', on: true },
  ];
  shell('practice', `<div class="page-head"><h1>Practice</h1><p class="muted">Practice sessions never cost hearts — and they earn them back. ❤️</p></div>
    ${ok ? '' : `<div class="card pad notice">${mascot('wow', 60)}<div>Finish your first lesson to unlock most practice modes.</div><a class="btn primary sm" href="#/learn">Go to lessons</a></div>`}
    <div class="hub-grid">${cards.map((c) => `<a class="hub-card ${c.on ? '' : 'disabled'}" href="${c.on ? c.href : '#/practice'}" style="--cc:${c.color}"><span class="hub-icon">${c.icon}</span><b>${c.title}</b><span class="muted small">${esc(c.desc)}</span></a>`).join('')}</div>`);
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------
function flashcards() {
  let deck = dueWords();
  if (deck.length < 5) deck = [...deck, ...shuffle(learnedWords()).filter((w) => !deck.includes(w))];
  if (deck.length < 5) deck = [...deck, ...UNITS[0].words.map((w) => ({ ...w, unit: 0 })).filter((w) => !deck.some((d) => d.id === w.id))];
  deck = deck.slice(0, 12);
  let i = 0, right = 0;
  const draw = () => {
    if (i >= deck.length) {
      const res = recordActivity({ xp: 5 + right, kind: 'practice', correct: right, answered: deck.length });
      state.stats.flashcards += deck.length;
      save();
      return results({ secs: 0, accuracy: right / deck.length, bestCombo: right, perfect: right === deck.length }, res, '#/practice');
    }
    const w = deck[i];
    app().innerHTML = `<div class="lesson"><header class="lesson-top"><a class="icon-btn" href="#/practice">✕</a><div class="progress"><div class="progress-fill" style="width:${(i / deck.length) * 100}%"></div></div><span class="hearts-pill practice-pill">${i + 1}/${deck.length}</span></header>
      <main class="lesson-body"><div class="flash-wrap"><div class="flashcard" tabindex="0">
        <div class="face front"><span class="muted small">${LANGS[state.lang].name}</span><b>${esc(w.t[state.lang])}</b><button class="speaker" data-say>🔊</button><span class="muted small">Tap to flip</span></div>
        <div class="face back"><span class="pic">${w.e}</span><b>${esc(w.en)}</b><span class="muted small">${esc(w.t[state.lang])}</span></div>
      </div></div>
      <div class="flash-actions" hidden><button class="btn bad-btn" data-r="0">😕 Still learning</button><button class="btn good-btn" data-r="1">😎 Got it</button></div></main></div>`;
    const card = $('.flashcard');
    const flip = () => { card.classList.toggle('flipped'); $('.flash-actions').hidden = false; };
    card.addEventListener('click', (e) => { if (!e.target.closest('[data-say]')) flip(); });
    $('[data-say]').addEventListener('click', () => say(w.t[state.lang]));
    if (canSpeak && state.settings.listening) setTimeout(() => say(w.t[state.lang]), 300);
    $$('[data-r]').forEach((b) => b.addEventListener('click', () => {
      const ok = b.dataset.r === '1';
      reviewWord(w.id, ok);
      if (ok) right++;
      sfx(ok ? 'correct' : 'tap');
      i++;
      draw();
    }));
    const onKey = (e) => {
      if (!document.contains(card)) return document.removeEventListener('keydown', onKey);
      if (e.key === ' ') { e.preventDefault(); flip(); }
      if (!$('.flash-actions').hidden && (e.key === '1' || e.key === '2')) { document.removeEventListener('keydown', onKey); $(`[data-r="${Number(e.key) - 1}"]`).click(); }
    };
    document.addEventListener('keydown', onKey);
  };
  draw();
}

// ---------------------------------------------------------------------------
// Speed round
// ---------------------------------------------------------------------------
function speed() {
  const cur = currentLesson();
  const maxU = cur ? cur.u : UNITS.length - 1;
  const pool = allWords().filter((w) => w.unit <= maxU && w.t[state.lang].toLowerCase() !== w.en);
  let score = 0, timeLeft = 60, streak = 0, timer;
  app().innerHTML = `<div class="lesson speed"><header class="lesson-top"><a class="icon-btn quit-speed" href="#/practice">✕</a><div class="progress timer"><div class="progress-fill"></div></div><span class="hearts-pill">⏱️ <b class="t">60</b></span></header>
    <main class="lesson-body"><div class="speed-score">Score <b class="sc">0</b> <span class="sp-streak"></span></div><div class="ex speed-ex"></div></main></div>`;
  const next = () => {
    const w = pool[Math.floor(Math.random() * pool.length)];
    const others = sample(pool.filter((p) => p.en !== w.en), 3);
    const opts = shuffle([w, ...others]);
    $('.speed-ex').innerHTML = `<div class="speed-word" lang="${LANGS[state.lang].tts}">${esc(w.t[state.lang])}</div><div class="options grid2">${opts.map((o, i) => `<button class="option" data-ok="${o.en === w.en}"><kbd>${i + 1}</kbd>${esc(o.en)}</button>`).join('')}</div>`;
    $$('.speed-ex .option').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.ok === 'true') { score++; streak++; sfx('correct'); if (streak % 5 === 0) { timeLeft += 3; toast('+3 seconds!', '⏱️'); } }
      else { streak = 0; timeLeft = Math.max(0, timeLeft - 3); sfx('wrong'); $('.speed').classList.add('flash-bad'); setTimeout(() => $('.speed')?.classList.remove('flash-bad'), 250); }
      $('.sc').textContent = score;
      $('.sp-streak').textContent = streak >= 3 ? `🔥${streak}` : '';
      next();
    }));
  };
  const onKey = (e) => { if (/^[1-4]$/.test(e.key)) $$('.speed-ex .option')[Number(e.key) - 1]?.click(); };
  document.addEventListener('keydown', onKey);
  const end = () => {
    clearInterval(timer);
    document.removeEventListener('keydown', onKey);
    const best = score > state.stats.speedBest;
    state.stats.speedBest = Math.max(state.stats.speedBest, score);
    const res = recordActivity({ xp: Math.max(3, score), kind: 'practice', correct: score, answered: score });
    if (best && score >= 10) postActivity('speed', `set a new Speed Round record: ${score} ⏱️`);
    app().innerHTML = `<div class="results">${mascot(score >= 10 ? 'cheer' : 'happy', 140)}<h1>${best ? 'New record!' : 'Time’s up!'}</h1>
      <div class="stat-cards"><div class="stat-card orange"><div class="sc-label">Score</div><div class="sc-val">🏁 ${score}</div></div><div class="stat-card gold"><div class="sc-label">XP</div><div class="sc-val">⚡ ${res.xp}</div></div><div class="stat-card blue"><div class="sc-label">Best</div><div class="sc-val">🏆 ${state.stats.speedBest}</div></div></div>
      <div class="stack narrow"><button class="btn primary lg again">Play again</button><a class="btn lg" href="#/practice">Back to practice</a></div></div>`;
    sfx('complete');
    if (best) confetti();
    $('.again').addEventListener('click', speed);
    res.achievements.forEach((a) => toast(`Achievement: ${a.name}`, a.icon));
  };
  timer = setInterval(() => {
    if (!document.querySelector('.speed')) { clearInterval(timer); document.removeEventListener('keydown', onKey); return; }
    timeLeft--;
    $('.t').textContent = timeLeft;
    $('.timer .progress-fill').style.width = `${(timeLeft / 60) * 100}%`;
    if (timeLeft <= 0) end();
  }, 1000);
  $('.timer .progress-fill').style.width = '100%';
  next();
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------
function words() {
  const learned = new Set(learnedWords().map((w) => w.id));
  shell('practice', `<a href="#/practice" class="back">← Practice</a><div class="page-head"><h1>My words</h1><p class="muted">${learned.size} of ${allWords().length} words learned in ${LANGS[state.lang].name}. Tap any word to hear it.</p></div>
    ${UNITS.map((u) => `<h3>${u.icon} ${esc(u.title)}</h3><div class="vocab-grid">${u.words.map((w) => `<button class="vocab card ${learned.has(w.id) ? '' : 'unlearned'}" data-say="${esc(w.t[state.lang])}"><span class="pic">${w.e}</span><b>${esc(w.t[state.lang])}</b><span class="muted">${esc(w.en)}</span>${bar(wordStrength(w.id))}</button>`).join('')}</div>`).join('')}`);
  $$('[data-say]').forEach((b) => b.addEventListener('click', () => say(b.dataset.say)));
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------
function stories() {
  const reached = unitsCompleted();
  const c = course();
  shell('stories', `<div class="page-head"><h1>Stories</h1><p class="muted">Read and listen to short conversations, then answer questions. Unlock more by finishing units.</p></div>
    <div class="story-grid">${STORIES.map((s) => {
      const open = reached >= s.unlock;
      const done = c.stories[s.id];
      return `<a class="story-card ${open ? '' : 'locked'}" href="${open ? `#/story/${s.id}` : '#/stories'}"><span class="story-cover">${open ? s.icon : '🔒'}</span><b>${esc(s.title)}</b>
        <span class="muted small">${open ? (done ? `✓ Read ${done}× · +5 XP` : 'New · +15 XP') : `Complete ${s.unlock} unit${s.unlock > 1 ? 's' : ''} to unlock`}</span></a>`;
    }).join('')}</div>`);
}

function story(id) {
  const s = STORIES.find((x) => x.id === id);
  if (!s || unitsCompleted() < s.unlock) { location.hash = '#/stories'; return; }
  const L = state.lang;
  let step = 0, right = 0, asked = 0;
  const items = [];
  s.lines.forEach((ln, i) => {
    items.push({ kind: 'line', ln });
    s.questions.filter((q) => q.after === i).forEach((q) => items.push({ kind: 'q', q }));
  });
  app().innerHTML = `<div class="lesson story-mode"><header class="lesson-top"><a class="icon-btn" href="#/stories">✕</a><div class="progress"><div class="progress-fill"></div></div><span class="hearts-pill practice-pill">${s.icon}</span></header>
    <main class="lesson-body"><h2 class="story-title">${esc(s.title)}</h2><div class="story-lines"></div></main>
    <footer class="lesson-foot"><div class="foot-inner"><span></span><div class="feedback"></div><button class="btn primary check">Continue</button></div></footer></div>`;
  const lines = $('.story-lines'), btn = $('.check'), fb = $('.feedback'), foot = $('.lesson-foot');
  const advance = () => {
    foot.className = 'lesson-foot'; fb.innerHTML = '';
    if (step >= items.length) return finish();
    const it = items[step++];
    $('.progress-fill').style.width = `${(step / items.length) * 100}%`;
    if (it.kind === 'line') {
      const el = document.createElement('div');
      el.className = `story-line ${it.ln.who === 'A' ? 'left' : 'right'}`;
      el.innerHTML = `<span class="story-av">${s.cast[it.ln.who]}</span><div class="bubble"><button class="speaker">🔊</button> <span lang="${LANGS[L].tts}">${esc(it.ln.t[L])}</span><div class="translation muted small" hidden>${esc(it.ln.en)}</div><button class="link small reveal">Show translation</button></div>`;
      lines.append(el);
      el.querySelector('.speaker').addEventListener('click', () => say(it.ln.t[L]));
      el.querySelector('.reveal').addEventListener('click', (e) => { el.querySelector('.translation').hidden = false; e.target.remove(); });
      if (canSpeak && state.settings.listening) say(it.ln.t[L]);
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
      btn.disabled = false;
    } else {
      asked++;
      const el = document.createElement('div');
      el.className = 'story-q card';
      el.innerHTML = `<b>❓ ${esc(it.q.q)}</b><div class="options">${it.q.options.map((o, i) => `<button class="option" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
      lines.append(el);
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
      btn.disabled = true;
      $$('.option', el).forEach((o) => o.addEventListener('click', () => {
        const ok = Number(o.dataset.i) === it.q.a;
        $$('.option', el).forEach((x) => { x.disabled = true; if (Number(x.dataset.i) === it.q.a) x.classList.add('right'); });
        if (!ok) o.classList.add('wrong');
        if (ok) right++;
        sfx(ok ? 'correct' : 'wrong');
        foot.className = `lesson-foot ${ok ? 'good' : 'bad'}`;
        fb.innerHTML = `<div class="fb-title">${ok ? '✅ Correct!' : '❌ Not quite'}</div>`;
        btn.disabled = false;
        btn.focus();
      }));
    }
  };
  const finish = () => {
    const c = course();
    const first = !c.stories[s.id];
    c.stories[s.id] = (c.stories[s.id] || 0) + 1;
    if (first) { state.stats.stories++; postActivity('story', `finished the story “${s.title}” 📖`); }
    const res = recordActivity({ xp: first ? 15 : 5, kind: 'practice', correct: right, answered: asked, perfect: right === asked });
    results({ secs: 0, accuracy: asked ? right / asked : 1, bestCombo: right, perfect: right === asked }, res, '#/stories');
  };
  btn.addEventListener('click', () => { if (!btn.disabled) advance(); });
  advance();
}

// ---------------------------------------------------------------------------
// Social: account, leaderboard, friends, profiles
// ---------------------------------------------------------------------------
function needAccount(active, title, blurb) {
  const offline = !session.online;
  shell(active, `<div class="page-head"><h1>${title}</h1></div>
    <div class="card pad center social-gate">${mascot('wow', 120)}
      <h2>${offline ? 'Friends & leaderboards are coming soon' : 'Create a profile to unlock this'}</h2>
      <p class="muted">${offline ? 'This version of Gimrit doesn’t have friends and leaderboards switched on yet. Everything else — lessons, practice, stories, streaks, quests and the shop — works right now, and your progress is saved in this browser.' : esc(blurb)}</p>
      ${offline ? '' : '<div class="stack narrow"><a class="btn primary" href="#/account">Create a profile</a><a class="btn" href="#/account?mode=login">Log in</a></div>'}
    </div>`);
}

function account(params) {
  let mode = params.get('mode') === 'login' ? 'login' : 'signup';
  if (session.user) { location.hash = '#/profile'; return; }
  if (!session.online) return needAccount('profile', 'Profile', '');
  const render = () => {
    const html = `<div class="auth card pad">
      <div class="center">${mascot('happy', 90)}<h1>${mode === 'signup' ? 'Create your profile' : 'Welcome back!'}</h1>
      <p class="muted">${mode === 'signup' ? 'Your current progress will be saved to your new profile.' : 'Log in to sync your progress and see your friends.'}</p></div>
      <form class="stack">
        <label class="field"><span>Username</span><input name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" placeholder="letters, numbers, _"></label>
        <label class="field"><span>Password</span><input name="password" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required minlength="6"></label>
        <div class="form-error" hidden></div>
        <button class="btn primary lg" type="submit">${mode === 'signup' ? 'Create profile' : 'Log in'}</button>
      </form>
      <p class="center muted small">${mode === 'signup' ? 'Already have a profile? <a href="#" class="switch">Log in</a>' : 'New here? <a href="#" class="switch">Create a profile</a>'}</p>
    </div>`;
    shell('profile', html, { rail: false });
    $('.switch').addEventListener('click', (e) => { e.preventDefault(); mode = mode === 'signup' ? 'login' : 'signup'; render(); });
    $('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const err = $('.form-error');
      err.hidden = true;
      try {
        if (mode === 'signup') await signup(f.get('username'), f.get('password'));
        else await login(f.get('username'), f.get('password'));
        state.onboarded = true;
        save();
        toast(mode === 'signup' ? 'Profile created! Now add some friends.' : `Welcome back, ${state.profile.name || session.user.displayName}!`, '🎉');
        applyTheme();
        location.hash = mode === 'signup' ? '#/friends' : '#/learn';
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  };
  render();
}

function weekCountdown() {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ((8 - (now.getUTCDay() || 7)) % 7 || 7)));
  const h = Math.floor((end - now) / 3600000);
  return h >= 24 ? `${Math.floor(h / 24)} days` : `${h} hours`;
}

async function leaderboard(params) {
  if (!session.user) return needAccount('leaderboard', 'Leaderboard', 'Compete with friends and learners everywhere on the weekly XP leaderboard.');
  const scope = params.get('scope') || 'global';
  shell('leaderboard', `<div class="page-head"><h1>Weekly leaderboard</h1><p class="muted">Resets in ${weekCountdown()} · Earn XP to climb the ranks.</p></div>
    <div class="tabs"><a href="#/leaderboard?scope=global" class="tab ${scope === 'global' ? 'active' : ''}">🌍 Everyone</a><a href="#/leaderboard?scope=friends" class="tab ${scope === 'friends' ? 'active' : ''}">👥 Friends</a></div>
    <div class="lb card"><div class="loading">Loading…</div></div>`);
  try {
    const { rows, me } = await api.get(`/leaderboard?scope=${scope}`);
    const medal = (i) => ['🥇', '🥈', '🥉'][i] || i + 1;
    $('.lb').innerHTML = rows.length ? rows.map((u, i) => `<a class="lb-row ${u.username === session.user.username ? 'me' : ''} ${i < 3 ? 'top' : ''}" href="#/u/${esc(u.username)}">
      <span class="rank">${medal(i)}</span>${avatar(u.avatar, u.color, 40)}<span class="grow"><b>${esc(u.displayName)}</b><span class="muted small">@${esc(u.username)} · 🔥 ${u.streak}</span></span><span class="lb-xp">${fmt(u.weeklyXp)} XP</span></a>`).join('')
      + (me && me.rank > rows.length ? `<div class="lb-gap">⋯</div><div class="lb-row me"><span class="rank">${me.rank}</span>${avatar(state.profile.avatar, state.profile.color, 40)}<span class="grow"><b>You</b></span><span class="lb-xp">${fmt(me.weeklyXp)} XP</span></div>` : '')
      : `<div class="empty">${mascot('happy', 80)}<p class="muted">${scope === 'friends' ? 'Add friends to compete with them here!' : 'No one has earned XP this week yet. Be the first!'}</p></div>`;
  } catch (e) {
    $('.lb').innerHTML = `<div class="empty muted">Couldn’t load the leaderboard: ${esc(e.message)}</div>`;
  }
}

async function friends() {
  if (!session.user) return needAccount('friends', 'Friends', 'Add friends, follow their progress, cheer them on and nudge them to keep their streaks alive.');
  shell('friends', `<div class="page-head"><h1>Friends</h1><p class="muted">Learning is better together. Your username: <b>@${esc(session.user.username)}</b> <button class="link copy-name">Copy</button></p></div>
    <div class="card pad add-friend"><form class="row"><input name="q" placeholder="Search by username or name" autocomplete="off" maxlength="30"><button class="btn primary">Search</button></form><div class="search-results"></div></div>
    <div class="friends-body"><div class="loading">Loading…</div></div>`);
  $('.copy-name').addEventListener('click', () => { navigator.clipboard?.writeText(session.user.username); toast('Username copied — share it with friends!', '📋'); });
  $('.add-friend form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get('q').trim();
    const out = $('.search-results');
    if (q.length < 2) { out.innerHTML = '<p class="muted small">Type at least 2 characters.</p>'; return; }
    try {
      const { users } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      out.innerHTML = users.length ? users.map((u) => `<div class="friend-row">${avatar(u.avatar, u.color, 40)}<span class="grow"><b>${esc(u.displayName)}</b><span class="muted small">@${esc(u.username)} · ${fmt(u.xp)} XP</span></span>
        ${u.relation === 'friend' ? '<span class="tag">Friends</span>' : u.relation === 'outgoing' ? '<span class="tag">Requested</span>' : u.relation === 'incoming' ? `<button class="btn primary sm" data-accept="${esc(u.username)}">Accept</button>` : `<button class="btn primary sm" data-add="${esc(u.username)}">+ Add</button>`}</div>`).join('')
        : '<p class="muted small">No learners found with that name.</p>';
      bindFriendActions(out);
    } catch (err) { out.innerHTML = `<p class="muted small">${esc(err.message)}</p>`; }
  });
  loadFriends();
}

async function loadFriends() {
  const body = $('.friends-body');
  if (!body) return;
  try {
    const [{ friends: list, incoming, outgoing, me }, { feed }] = await Promise.all([api.get('/friends'), api.get('/feed')]);
    session.user = me;
    session.incoming = incoming.length;
    updateFriendDot();
    const teamXp = list.reduce((a, f) => a + f.weeklyXp, 0) + me.weeklyXp;
    const goal = 500 + list.length * 250;
    body.innerHTML = `
      ${incoming.length ? `<h3>Friend requests</h3><div class="card">${incoming.map((u) => `<div class="friend-row">${avatar(u.avatar, u.color, 44)}<span class="grow"><b>${esc(u.displayName)}</b><span class="muted small">@${esc(u.username)} wants to be friends</span></span><button class="btn primary sm" data-accept="${esc(u.username)}">Accept</button><button class="btn ghost sm" data-decline="${esc(u.username)}">Decline</button></div>`).join('')}</div>` : ''}
      <div class="card pad friend-quest"><div class="widget-head"><b>🤝 Friends quest</b><span class="muted small">Ends in ${weekCountdown()}</span></div><p class="small">Earn ${fmt(goal)} XP together with your friends this week.</p>${bar(teamXp / goal, 'thick')}<div class="muted small">${fmt(teamXp)} / ${fmt(goal)} XP</div></div>
      <h3>Your friends (${list.length})</h3>
      ${list.length ? `<div class="friend-grid">${list.map((f) => `<div class="friend-card card">
        <a href="#/u/${esc(f.username)}" class="fc-top">${avatar(f.avatar, f.color, 56)}<b>${esc(f.displayName)}</b><span class="muted small">@${esc(f.username)}</span></a>
        <div class="fc-stats"><span>🔥 ${f.streak}</span><span>⚡ ${fmt(f.xp)}</span><span>${(f.langs || []).map((l) => LANGS[l.l]?.flag || '').join('')}</span></div>
        <div class="muted small">${f.practicedToday ? '✅ Practiced today' : `Active ${f.lastActive ? timeAgo(f.lastActive) : 'never'}`}</div>
        <button class="btn sm" data-nudge="${esc(f.username)}" ${f.practicedToday ? 'disabled' : ''}>${f.practicedToday ? 'On track' : '👉 Nudge'}</button></div>`).join('')}</div>`
        : `<div class="card pad center">${mascot('happy', 80)}<p class="muted">No friends yet. Search for a username above, or share yours!</p></div>`}
      ${outgoing.length ? `<h3>Pending</h3><div class="card">${outgoing.map((u) => `<div class="friend-row">${avatar(u.avatar, u.color, 40)}<span class="grow"><b>${esc(u.displayName)}</b><span class="muted small">Request sent</span></span><button class="btn ghost sm" data-cancel="${esc(u.username)}">Cancel</button></div>`).join('')}</div>` : ''}
      <h3>Activity</h3>
      ${feed.length ? `<div class="card feed">${feed.map((a) => `<div class="feed-row">${avatar(a.avatar, a.color, 40)}<div class="grow"><div><b>${a.username === session.user.username ? 'You' : esc(a.displayName)}</b> ${esc(a.text)}</div><div class="muted small">${timeAgo(a.at)}</div></div>
        ${a.username === session.user.username ? (a.cheers ? `<span class="muted small">👏 ${a.cheers}</span>` : '') : `<button class="btn sm ${a.cheered ? 'cheered' : ''}" data-cheer="${a.id}" ${a.cheered ? 'disabled' : ''}>👏 ${a.cheers || ''}</button>`}</div>`).join('')}</div>`
        : '<div class="card pad muted">No activity yet. Finish a lesson to get things going!</div>'}`;
    state.stats.friends = list.length;
    if (checkAchievements().length) toast('Achievement unlocked: Better Together', '🤝');
    save();
    bindFriendActions(body);
  } catch (e) {
    body.innerHTML = `<div class="card pad muted">Couldn’t load friends: ${esc(e.message)}</div>`;
  }
}

function bindFriendActions(root) {
  const act = (sel, fn) => $$(sel, root).forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await fn(b); } catch (e) { toast(e.message, '⚠️'); b.disabled = false; }
  }));
  act('[data-add]', async (b) => { await api.post('/friends/request', { username: b.dataset.add }); b.outerHTML = '<span class="tag">Requested</span>'; toast('Friend request sent!', '📨'); loadFriends(); });
  act('[data-accept]', async (b) => { await api.post('/friends/respond', { username: b.dataset.accept, accept: true }); toast('You are now friends!', '🎉'); sfx('coin'); loadFriends(); pollNotifications(); });
  act('[data-decline]', async (b) => { await api.post('/friends/respond', { username: b.dataset.decline, accept: false }); loadFriends(); pollNotifications(); });
  act('[data-cancel]', async (b) => { await api.del(`/friends/${encodeURIComponent(b.dataset.cancel)}`); loadFriends(); });
  act('[data-nudge]', async (b) => { await api.post('/friends/nudge', { username: b.dataset.nudge }); b.textContent = 'Nudged!'; toast('Nudge sent!', '👉'); });
  act('[data-cheer]', async (b) => { const r = await api.post(`/feed/${b.dataset.cheer}/cheer`); b.textContent = `👏 ${r.cheers}`; b.classList.add('cheered'); sfx('tap'); });
}

async function userProfile(username) {
  if (!session.user) return needAccount('friends', 'Profile', 'Create a profile to view other learners.');
  if (username === session.user.username) { location.hash = '#/profile'; return; }
  shell('friends', '<div class="loading">Loading…</div>');
  try {
    const { user: u } = await api.get(`/users/${encodeURIComponent(username)}`);
    const me = { xp: state.xp, streak: state.streak.count, words: learnedWords().length, lessons: state.stats.lessons };
    const cmp = (label, a, b) => `<div class="cmp-row"><span class="${a >= b ? 'win' : ''}">${fmt(a)}</span><span class="muted">${label}</span><span class="${b >= a ? 'win' : ''}">${fmt(b)}</span></div>`;
    $('.page').innerHTML = `<a href="#/friends" class="back">← Friends</a>
      <div class="profile-head card pad">${avatar(u.avatar, u.color, 96)}<div class="grow"><h1>${esc(u.displayName)}</h1><div class="muted">@${esc(u.username)} · Joined ${new Date(u.created).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
        <div class="flags">${(u.langs || []).map((l) => `<span class="chip">${LANGS[l.l]?.flag} ${LANGS[l.l]?.name} · ${fmt(l.xp)} XP</span>`).join('')}</div></div>
        <div class="stack">${u.relation === 'friend' ? `<button class="btn" data-nudge="${esc(u.username)}">👉 Nudge</button><button class="btn ghost danger-text" data-remove>Remove friend</button>` : u.relation === 'none' ? `<button class="btn primary" data-add="${esc(u.username)}">+ Add friend</button>` : `<span class="tag">${u.relation === 'outgoing' ? 'Request sent' : 'Wants to be friends'}</span>`}</div></div>
      <div class="stats-grid">
        <div class="stat card"><span>🔥</span><b>${u.streak}</b><small>Day streak</small></div>
        <div class="stat card"><span>⚡</span><b>${fmt(u.xp)}</b><small>Total XP</small></div>
        <div class="stat card"><span>⭐</span><b>${u.level}</b><small>Level</small></div>
        <div class="stat card"><span>🏅</span><b>${u.achievements}</b><small>Achievements</small></div>
      </div>
      <h3>Head to head</h3>
      <div class="card pad cmp"><div class="cmp-row head"><span>${avatar(state.profile.avatar, state.profile.color, 40)} You</span><span></span><span>${esc(u.displayName)} ${avatar(u.avatar, u.color, 40)}</span></div>
        ${cmp('Total XP', me.xp, u.xp)}${cmp('Day streak', me.streak, u.streak)}${cmp('Words learned', me.words, u.words || 0)}${cmp('Lessons', me.lessons, u.lessons || 0)}</div>`;
    bindFriendActions($('.page'));
    $('[data-remove]')?.addEventListener('click', async () => {
      const v = await modal(`<div class="center"><h2>Remove ${esc(u.displayName)}?</h2><p class="muted">You can always add them again later.</p><div class="stack"><button class="btn danger" data-value="yes">Remove</button><button class="btn ghost" data-value="no">Cancel</button></div></div>`);
      if (v === 'yes') { await api.del(`/friends/${encodeURIComponent(u.username)}`); toast('Friend removed', '👋'); location.hash = '#/friends'; }
    });
  } catch (e) {
    $('.page').innerHTML = `<a href="#/friends" class="back">← Friends</a><div class="card pad muted">${esc(e.message)}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------
function quests() {
  tick();
  const qs = state.quests.list;
  const allClaimed = qs.every((q) => q.claimed);
  const now = new Date(), midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
  const hrs = Math.ceil((midnight - now) / 3600000);
  const earned = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
  shell('quests', `<div class="page-head"><h1>Quests</h1><p class="muted">New daily quests in ${hrs} hour${hrs === 1 ? '' : 's'}.</p></div>
    <div class="quest-hero card">${mascot('cheer', 90)}<div><b>Complete all 3 quests</b><p class="muted small">…to open today’s bonus chest!</p></div>
      <button class="chest big ${allClaimed && !state.quests.chest ? 'ready' : ''} ${state.quests.chest ? 'opened' : ''}" data-chest>${state.quests.chest ? '📭' : '🎁'}</button></div>
    <div class="quest-list">${qs.map((q, i) => `<div class="quest card"><span class="q-icon">${q.icon}</span><div class="grow"><b>${esc(q.text)}</b>${bar(q.progress / q.target, 'thick')}<span class="muted small">${q.progress} / ${q.target}</span></div>
      ${q.claimed ? '<span class="tag">Claimed ✓</span>' : `<button class="btn ${q.progress >= q.target ? 'primary' : ''} sm" data-claim="${i}" ${q.progress >= q.target ? '' : 'disabled'}>💎 ${q.reward}</button>`}</div>`).join('')}</div>
    <h3>Achievements · ${earned}/${ACHIEVEMENTS.length}</h3>${achievementsGrid()}`);
  $$('[data-claim]').forEach((b) => b.addEventListener('click', () => {
    const g = claimQuest(Number(b.dataset.claim));
    if (g) { sfx('coin'); toast(`+${g} gems!`, '💎'); quests(); }
  }));
  $('[data-chest]').addEventListener('click', () => {
    const g = claimQuestChest();
    if (g) {
      sfx('levelup'); confetti();
      modal(`<div class="center"><div class="big-emoji bounce">🎁</div><h2>Daily chest: ${g} gems!</h2><p class="muted">Come back tomorrow for new quests.</p><button class="btn primary" data-value="ok">Yay!</button></div>`).then(quests);
    } else toast(state.quests.chest ? 'Already opened today' : 'Claim all quests first!', '🎁');
  });
}

function achievementsGrid() {
  return `<div class="ach-grid">${ACHIEVEMENTS.map((a) => {
    const got = state.achievements[a.id];
    return `<div class="ach card ${got ? '' : 'locked'}" title="${esc(a.desc)}"><span class="ach-badge ${got ? 'unlocked' : ''}">${got ? a.icon : '🔒'}</span><b>${esc(a.name)}</b><span class="muted small">${esc(a.desc)}</span></div>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------
function shop() {
  const items = [
    { id: 'freeze', icon: '🧊', name: 'Streak Freeze', desc: `Protects your streak if you miss a day. Equipped: ${state.streak.freezes}/${MAX_FREEZES}`, price: 200, disabled: state.streak.freezes >= MAX_FREEZES, label: state.streak.freezes >= MAX_FREEZES ? 'Max equipped' : null },
    { id: 'hearts', icon: '❤️', name: 'Heart Refill', desc: 'Get full hearts so you can keep learning.', price: 350, disabled: state.hearts >= MAX_HEARTS, label: state.hearts >= MAX_HEARTS ? 'Full' : null },
    { id: 'double', icon: '⚡', name: 'Double XP (15 min)', desc: doubleXpActive() ? `Active — ${Math.ceil((state.boosts.doubleXpUntil - Date.now()) / 60000)} min left` : 'Earn twice the XP for 15 minutes.', price: 150, disabled: false },
  ];
  shell('shop', `<div class="page-head row-between"><div><h1>Shop</h1><p class="muted">Spend gems you earn from lessons, quests and chests.</p></div><div class="gem-balance">💎 ${fmt(state.gems)}</div></div>
    <h3>Power-ups</h3><div class="shop-list">${items.map((it) => `<div class="shop-item card"><span class="shop-icon">${it.icon}</span><div class="grow"><b>${it.name}</b><span class="muted small">${esc(it.desc)}</span></div>
      <button class="btn ${it.disabled ? '' : 'primary'}" data-buy="${it.id}" data-price="${it.price}" ${it.disabled ? 'disabled' : ''}>${it.label || `💎 ${it.price}`}</button></div>`).join('')}</div>
    <h3>Themes</h3><div class="theme-grid">${THEMES.map((t) => {
      const owned = state.owned.includes(t.id), active = state.settings.theme === t.id;
      return `<div class="theme-card card ${active ? 'active' : ''}"><div class="swatch" style="background:linear-gradient(135deg, ${t.accent}, ${t.accent2})"></div><b>${t.name}</b>
        <button class="btn sm ${owned ? '' : 'primary'}" data-buy-theme="${t.id}" data-price="${t.price}" ${active ? 'disabled' : ''}>${active ? 'Equipped' : owned ? 'Equip' : `💎 ${t.price}`}</button></div>`;
    }).join('')}</div>
    <h3>Premium avatars</h3><div class="theme-grid">${PREMIUM_AVATARS.map((a) => {
      const owned = state.owned.includes('av:' + a.id), active = state.profile.avatar === a.e;
      return `<div class="theme-card card ${active ? 'active' : ''}"><div class="swatch av">${a.e}</div><b>${a.id[0].toUpperCase() + a.id.slice(1)}</b>
        <button class="btn sm ${owned ? '' : 'primary'}" data-av="${a.id}" data-price="${a.price}" ${active ? 'disabled' : ''}>${active ? 'Equipped' : owned ? 'Equip' : `💎 ${a.price}`}</button></div>`;
    }).join('')}</div>`);

  const buy = (price) => {
    if (!spend(price)) { sfx('wrong'); toast('Not enough gems — complete lessons and quests to earn more!', '💎'); return false; }
    sfx('coin');
    return true;
  };
  $$('[data-buy]').forEach((b) => b.addEventListener('click', () => {
    if (!buy(Number(b.dataset.price))) return;
    if (b.dataset.buy === 'freeze') { state.streak.freezes++; toast('Streak Freeze equipped!', '🧊'); }
    if (b.dataset.buy === 'hearts') { state.hearts = MAX_HEARTS; toast('Hearts refilled!', '❤️'); }
    if (b.dataset.buy === 'double') { state.boosts.doubleXpUntil = Math.max(Date.now(), state.boosts.doubleXpUntil) + 15 * 60000; toast('Double XP activated!', '⚡'); }
    save();
    shop();
  }));
  $$('[data-buy-theme]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.buyTheme;
    if (!state.owned.includes(id)) { if (!buy(Number(b.dataset.price))) return; state.owned.push(id); }
    state.settings.theme = id;
    save(); applyTheme(); shop();
  }));
  $$('[data-av]').forEach((b) => b.addEventListener('click', () => {
    const a = PREMIUM_AVATARS.find((x) => x.id === b.dataset.av);
    if (!state.owned.includes('av:' + a.id)) { if (!buy(a.price)) return; state.owned.push('av:' + a.id); }
    state.profile.avatar = a.e;
    save(); shop();
  }));
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
function profile() {
  const lv = level();
  const p = state.profile;
  const langs = Object.entries(state.courses);
  // Last 7 days XP chart
  const days = [...Array(7)].map((_, i) => addDays(today(), i - 6));
  const max = Math.max(state.settings.goal, ...days.map((d) => state.history[d] || 0));
  const chart = days.map((d) => {
    const v = state.history[d] || 0;
    return `<div class="col" title="${d}: ${v} XP"><span class="col-v">${v || ''}</span><div class="col-bar ${v >= state.settings.goal ? 'met' : ''}" style="height:${(v / max) * 100}%"></div><span class="col-l">${new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>`;
  }).join('');
  // 5-week calendar heatmap
  const dow = (new Date().getDay() + 6) % 7;
  const start = addDays(today(), -dow - 28);
  const cal = [...Array(35)].map((_, i) => {
    const d = addDays(start, i);
    const v = state.history[d] || 0;
    const lvl = v === 0 ? 0 : v < state.settings.goal / 2 ? 1 : v < state.settings.goal ? 2 : 3;
    const future = d > today();
    return `<span class="cal-cell l${lvl} ${state.streak.frozen.includes(d) ? 'frozen' : ''} ${future ? 'future' : ''} ${d === today() ? 'today' : ''}" title="${d}: ${v} XP"></span>`;
  }).join('');

  shell('profile', `<div class="profile-head card pad">${avatar(p.avatar, p.color, 96)}<div class="grow"><h1>${esc(p.name || 'Learner')}</h1>
      <div class="muted">${session.user ? `@${esc(session.user.username)} · ` : ''}Joined ${new Date(state.created + 'T12:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
      <div class="flags">${langs.map(([l, c]) => `<span class="chip">${LANGS[l].flag} ${fmt(c.xp)} XP</span>`).join('')}</div></div>
      <div class="stack"><button class="btn" data-edit>✏️ Edit profile</button>${session.user ? '<a class="btn" href="#/friends">👥 Friends</a>' : session.online ? '<a class="btn primary" href="#/account">Create a profile</a>' : ''}</div></div>
    <div class="card pad level-card"><div class="row-between"><b>Level ${lv.lvl}</b><span class="muted small">${lv.into} / ${lv.need} XP to level ${lv.lvl + 1}</span></div>${bar(lv.into / lv.need, 'thick')}</div>
    <div class="stats-grid">
      <div class="stat card"><span>🔥</span><b>${state.streak.count}</b><small>Day streak</small></div>
      <div class="stat card"><span>🏔️</span><b>${state.streak.longest}</b><small>Longest streak</small></div>
      <div class="stat card"><span>⚡</span><b>${fmt(state.xp)}</b><small>Total XP</small></div>
      <div class="stat card"><span>📘</span><b>${state.stats.lessons}</b><small>Lessons</small></div>
      <div class="stat card"><span>🧠</span><b>${learnedWords().length}</b><small>Words learned</small></div>
      <div class="stat card"><span>🎯</span><b>${state.stats.answered ? Math.round((state.stats.correct / state.stats.answered) * 100) : 0}%</b><small>Accuracy</small></div>
    </div>
    <div class="two-col">
      <div class="card pad"><b>XP this week</b><div class="chart">${chart}</div></div>
      <div class="card pad"><b>Streak calendar</b><div class="cal-head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span>${x}</span>`).join('')}</div><div class="cal">${cal}</div>
        <div class="muted small legend"><span class="cal-cell l0"></span>none <span class="cal-cell l1"></span><span class="cal-cell l2"></span><span class="cal-cell l3"></span>goal met <span class="cal-cell frozen"></span>freeze</div></div>
    </div>
    <h3>Achievements · ${Object.keys(state.achievements).length}/${ACHIEVEMENTS.length}</h3>${achievementsGrid()}`);
  $('[data-edit]').addEventListener('click', editProfile);
}

async function editProfile() {
  const p = state.profile;
  const owned = PREMIUM_AVATARS.filter((a) => state.owned.includes('av:' + a.id)).map((a) => a.e);
  let av = p.avatar, col = p.color;
  const v = await modal(`<h2>Edit profile</h2>
    <label class="field"><span>Name</span><input id="ep-name" maxlength="24" value="${esc(p.name)}"></label>
    <div class="field"><span>Avatar</span><div class="avatar-grid">${[...AVATARS, ...owned].map((a) => `<button class="av-pick ${a === av ? 'selected' : ''}" data-av="${a}">${a}</button>`).join('')}</div></div>
    <div class="field"><span>Color</span><div class="color-grid">${COLORS.map((c) => `<button class="color-pick ${c === col ? 'selected' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div></div>
    <div class="row-end"><button class="btn ghost" data-value="cancel">Cancel</button><button class="btn primary" data-value="save">Save</button></div>`, {
    onOpen: (el) => {
      $$('[data-av]', el).forEach((b) => b.addEventListener('click', () => { av = b.dataset.av; $$('[data-av]', el).forEach((x) => x.classList.toggle('selected', x === b)); }));
      $$('[data-color]', el).forEach((b) => b.addEventListener('click', () => { col = b.dataset.color; $$('[data-color]', el).forEach((x) => x.classList.toggle('selected', x === b)); }));
      $('#ep-name', el).addEventListener('input', (e) => { p._draft = e.target.value; });
    },
  });
  if (v === 'save') {
    const name = (p._draft ?? p.name).trim();
    Object.assign(p, { name: name || p.name, avatar: av, color: col });
    delete p._draft;
    save();
    toast('Profile updated', '✨');
    profile();
  } else delete p._draft;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function settings() {
  const s = state.settings;
  const toggle = (key, label, desc, disabled = false) => `<label class="setting"><div class="grow"><b>${label}</b><span class="muted small">${desc}</span></div><input type="checkbox" class="switch" data-set="${key}" ${s[key] ? 'checked' : ''} ${disabled ? 'disabled' : ''}></label>`;
  shell('settings', `<div class="page-head"><h1>Settings</h1></div>
    <h3>Learning</h3><div class="card">
      <div class="setting"><div class="grow"><b>Daily goal</b><span class="muted small">How much XP you aim for each day</span></div>
        <select data-goal>${[10, 20, 30, 50].map((g) => `<option value="${g}" ${s.goal === g ? 'selected' : ''}>${g} XP</option>`).join('')}</select></div>
      ${toggle('listening', 'Listening exercises', canSpeak ? 'Include audio exercises in lessons' : 'Not supported in this browser', !canSpeak)}
      ${toggle('speaking', 'Speaking exercises', canListen ? 'Include pronunciation exercises (uses your microphone)' : 'Needs Chrome, Edge or Safari', !canListen)}
      <div class="setting"><div class="grow"><b>Speech speed</b><span class="muted small">How fast the audio is spoken</span></div>
        <input type="range" min="0.6" max="1.2" step="0.1" value="${s.speechRate}" data-rate><button class="btn sm" data-test-voice>🔊 Test</button></div>
    </div>
    <h3>Appearance & sound</h3><div class="card">
      <div class="setting"><div class="grow"><b>Dark mode</b><span class="muted small">Match your device, or choose</span></div>
        <select data-dark>${[['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${s.dark === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="setting"><div class="grow"><b>Theme</b><span class="muted small">Unlock more in the shop</span></div>
        <select data-theme-sel>${THEMES.filter((t) => state.owned.includes(t.id)).map((t) => `<option value="${t.id}" ${s.theme === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>
      ${toggle('sound', 'Sound effects', 'Dings, buzzes and fanfares')}
    </div>
    <h3>Courses</h3><div class="card">${LANG_ORDER.map((l) => `<div class="setting"><span class="flag">${LANGS[l].flag}</span><div class="grow"><b>${LANGS[l].name}</b><span class="muted small">${state.courses[l] ? `${fmt(state.courses[l].xp)} XP · ${Math.round(courseProgress(l) * 100)}%` : 'Not started'}</span></div>
      <button class="btn sm ${l === state.lang ? '' : 'primary'}" data-lang="${l}" ${l === state.lang ? 'disabled' : ''}>${l === state.lang ? 'Current' : state.courses[l] ? 'Switch' : 'Start'}</button></div>`).join('')}</div>
    <h3>Account</h3><div class="card">
      ${session.user ? `<div class="setting"><div class="grow"><b>Signed in as @${esc(session.user.username)}</b><span class="muted small">Progress syncs automatically</span></div><button class="btn sm" data-logout>Log out</button></div>`
        : session.online ? `<div class="setting"><div class="grow"><b>Guest mode</b><span class="muted small">Progress is saved on this device only</span></div><a class="btn primary sm" href="#/account">Create profile</a><a class="btn sm" href="#/account?mode=login">Log in</a></div>`
          : '<div class="setting"><div class="grow"><b>Offline mode</b><span class="muted small">Server unavailable — progress is saved on this device</span></div></div>'}
      <div class="setting"><div class="grow"><b>Export progress</b><span class="muted small">Download a backup of your data</span></div><button class="btn sm" data-export>Download</button></div>
      <div class="setting"><div class="grow"><b>Reset progress</b><span class="muted small">Start over from scratch on this device</span></div><button class="btn sm danger" data-reset>Reset</button></div>
    </div>`);
  $$('[data-set]').forEach((i) => i.addEventListener('change', () => { s[i.dataset.set] = i.checked; save(); }));
  $('[data-goal]').addEventListener('change', (e) => { s.goal = Number(e.target.value); save(); toast('Daily goal updated', '🏁'); });
  $('[data-rate]').addEventListener('change', (e) => { s.speechRate = Number(e.target.value); save(); });
  $('[data-test-voice]').addEventListener('click', () => say(UNITS[0].sentences[0].t[state.lang]));
  $('[data-dark]').addEventListener('change', (e) => { s.dark = e.target.value; save(); applyTheme(); });
  $('[data-theme-sel]').addEventListener('change', (e) => { s.theme = e.target.value; save(); applyTheme(); });
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => { state.lang = b.dataset.lang; course(); checkAchievements(); save(); toast(`Now learning ${LANGS[state.lang].name}`, LANGS[state.lang].flag); settings(); }));
  $('[data-logout]')?.addEventListener('click', async () => { await logout(); toast('Logged out. Your progress stays on this device.', '👋'); settings(); });
  $('[data-export]').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.download = `gimrit-progress-${today()}.json`;
    a.click();
  });
  $('[data-reset]').addEventListener('click', async () => {
    const v = await modal(`<div class="center">${mascot('sad', 90)}<h2>Reset all progress?</h2><p class="muted">This deletes your XP, streak, gems and course progress on this device. This can’t be undone.</p><div class="stack"><button class="btn danger" data-value="yes">Yes, reset everything</button><button class="btn ghost" data-value="no">Cancel</button></div></div>`);
    if (v === 'yes') { if (session.user) await logout(); resetState(); applyTheme(); location.hash = '#/'; route(); }
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export function route() {
  cleanup?.();
  cleanup = null;
  window.speechSynthesis?.cancel();
  $$('.popover').forEach((p) => p.remove());
  tick();
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query || '');
  const [name, a, b] = path.split('/');
  if (!state.onboarded && name !== 'account') return onboarding(0);
  window.scrollTo(0, 0);
  switch (name) {
    case 'lesson': return lesson(a, b);
    case 'guide': return guide(Number(a));
    case 'practice': return a ? practiceSession(a) : practice();
    case 'flashcards': return flashcards();
    case 'speed': return speed();
    case 'words': return words();
    case 'stories': return stories();
    case 'story': return story(a);
    case 'leaderboard': return leaderboard(params);
    case 'friends': return friends();
    case 'u': return userProfile(decodeURIComponent(a || ''));
    case 'quests': return quests();
    case 'shop': return shop();
    case 'profile': return profile();
    case 'settings': return settings();
    case 'account': return account(params);
    default: return learn();
  }
}

export function startupNotices() {
  if (!state.onboarded || !streakNotice) return;
  const n = streakNotice;
  clearStreakNotice();
  if (n.type === 'frozen') toast(`Streak Freeze saved your streak! (${n.days} day${n.days > 1 ? 's' : ''})`, '🧊');
  else if (n.count > 1) modal(`<div class="center">${mascot('sad', 110)}<h2>Your ${n.count} day streak ended</h2><p class="muted">It happens to everyone. Start a new one today — and grab a Streak Freeze in the shop to protect it next time.</p><a class="btn primary" href="#/learn" data-value="ok">Start a new streak</a></div>`);
}
