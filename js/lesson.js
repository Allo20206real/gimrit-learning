import { UNITS, LANGS, allWords, allSentences } from './data.js';
import { state, course, loseHeart, gainHeart, reviewWord, addMistake, clearMistake, dueWords, unitsCompleted, currentLesson, MAX_HEARTS, save } from './store.js';
import { say, sfx, canSpeak, canListen, listen } from './audio.js';
import { $, $$, esc, shuffle, pick, sample, tokens, normalize, stripArticle, grade, modal, mascot } from './ui.js';

const L = () => state.lang;
const T = (item) => item.t[L()];
const langName = () => LANGS[L()].name;
const audioOn = () => canSpeak && state.settings.listening;
const speakOn = () => canListen && state.settings.speaking;

// ---------------------------------------------------------------------------
// Exercise generators
// ---------------------------------------------------------------------------
const wordRef = (w) => ({ type: 'word', id: w.id });
const sentRef = (s) => ({ type: 'sent', id: s.id });

function distractorWords(word, pool, n) {
  const seen = new Set([normalize(T(word)), normalize(word.en)]);
  const out = [];
  for (const w of shuffle(pool)) {
    const a = normalize(T(w)), b = normalize(w.en);
    if (seen.has(a) || seen.has(b)) continue;
    seen.add(a); seen.add(b);
    out.push(w);
    if (out.length === n) break;
  }
  return out;
}

const ex = {
  picture: (w, pool, isNew) => ({
    type: 'picture', ref: wordRef(w), isNew,
    prompt: `Which one is “${w.en}”?`,
    options: shuffle([w, ...distractorWords(w, pool.filter((p) => UNITS[p.unit].pic), 3)]),
    answer: w.id,
    solution: T(w),
  }),
  en2t: (w, pool) => ({
    type: 'choice', ref: wordRef(w),
    prompt: `How do you say “${w.en}”?`,
    options: shuffle([T(w), ...distractorWords(w, pool, 2).map(T)]),
    answer: T(w), optLang: L(),
  }),
  t2en: (w, pool) => ({
    type: 'choice', ref: wordRef(w),
    prompt: 'What does this mean?', target: T(w),
    options: shuffle([w.en, ...distractorWords(w, pool, 2).map((d) => d.en)]),
    answer: w.en, solution: w.en,
  }),
  listenWord: (w, pool) => ({
    type: 'choice', ref: wordRef(w), audio: T(w), listen: true,
    prompt: 'What do you hear?',
    options: shuffle([T(w), ...distractorWords(w, pool, 3).map(T)]),
    answer: T(w), optLang: L(),
  }),
  typeWord: (w) => ({
    type: 'type', ref: wordRef(w),
    prompt: `Write “${w.en}” in ${langName()}`, emoji: UNITS[w.unit].pic ? w.e : '',
    answers: [T(w), stripArticle(T(w))], solution: T(w), inputLang: L(),
  }),
  match: (words) => ({
    type: 'match', refs: words.map(wordRef),
    prompt: 'Tap the matching pairs',
    pairs: words.map((w) => ({ id: w.id, left: T(w), right: w.en })),
  }),
  buildT: (s, pool) => ({
    type: 'build', ref: sentRef(s),
    prompt: 'Translate this sentence', source: s.en,
    answer: tokens(T(s)), bank: bankFor(tokens(T(s)), pool.map((p) => tokens(T(p)))),
    solution: T(s), answerLang: L(),
  }),
  buildEn: (s, pool) => ({
    type: 'build', ref: sentRef(s),
    prompt: 'Translate this sentence', source: T(s), sourceLang: L(),
    answer: tokens(s.en), bank: bankFor(tokens(s.en), pool.map((p) => tokens(p.en))),
    solution: s.en,
  }),
  listenBuild: (s, pool) => ({
    type: 'build', ref: sentRef(s), listen: true,
    prompt: 'Tap what you hear', audio: T(s),
    answer: tokens(T(s)), bank: bankFor(tokens(T(s)), pool.map((p) => tokens(T(p)))),
    solution: T(s), answerLang: L(),
  }),
  dictation: (s) => ({
    type: 'type', ref: sentRef(s), listen: true,
    prompt: 'Type what you hear', audio: T(s),
    answers: [T(s)], solution: T(s), inputLang: L(), long: true,
  }),
  fill: (s, pool) => {
    const toks = tokens(T(s));
    const candidates = toks.map((t, i) => [t, i]).filter(([t]) => t.length > 2);
    const [word, idx] = candidates.length ? pick(candidates) : [toks[0], 0];
    const others = [...new Set(pool.flatMap((p) => tokens(T(p))))].filter((t) => normalize(t) !== normalize(word) && t.length > 2);
    return {
      type: 'choice', ref: sentRef(s), fill: true,
      prompt: 'Fill in the blank', hint: s.en,
      sentence: T(s).split(/\s+/).map((t, i) => (i === idx ? '___' : t)).join(' '),
      options: shuffle([word, ...sample(others, 2)]),
      answer: word, optLang: L(), solution: T(s),
    };
  },
  speak: (s) => ({
    type: 'speak', ref: sentRef(s),
    prompt: 'Speak this sentence', text: T(s), en: s.en,
  }),
};

function bankFor(answer, otherSentences) {
  const ans = new Set(answer.map((t) => normalize(t)));
  const extra = [...new Set(otherSentences.flat())].filter((t) => !ans.has(normalize(t)));
  return shuffle([...answer, ...sample(extra, Math.min(4, Math.max(2, 7 - answer.length)))]);
}

const wordsOfUnits = (units) => units.flatMap((u) => UNITS[u].words.map((w) => ({ ...w, unit: u })));
const sentsOfUnits = (units) => units.flatMap((u) => UNITS[u].sentences.map((s, i) => ({ ...s, unit: u, id: `${UNITS[u].id}:${i}` })));
const range = (n) => [...Array(n).keys()];

function randomWordEx(w, pool, hard = false) {
  const opts = hard ? [ex.typeWord, ex.en2t, ex.typeWord] : [ex.en2t, ex.t2en, ex.typeWord];
  if (audioOn()) opts.push(ex.listenWord);
  return pick(opts)(w, pool);
}
function randomSentEx(s, pool, hard = false) {
  const opts = hard ? [ex.buildT, ex.buildT, ex.fill] : [ex.buildT, ex.buildEn, ex.fill];
  if (audioOn()) opts.push(hard ? ex.dictation : ex.listenBuild);
  if (speakOn() && !hard) opts.push(ex.speak);
  return pick(opts)(s, pool);
}

export function buildLesson(u, l) {
  const unit = UNITS[u];
  const kinds = ['words', 'words', 'sentences', 'review', 'challenge'];
  const kind = kinds[l];
  const uWords = wordsOfUnits([u]);
  const pool = wordsOfUnits(range(u + 1));
  const sents = sentsOfUnits([u]);
  const sentPool = sentsOfUnits(range(u + 1));
  const list = [];

  if (kind === 'words') {
    const focus = uWords.slice(l * 4, l * 4 + 4);
    focus.forEach((w) => list.push(unit.pic ? ex.picture(w, pool, true) : { ...ex.en2t(w, pool), isNew: true }));
    shuffle(focus).forEach((w) => list.push(randomWordEx(w, pool)));
    const known = l === 1 ? uWords.slice(0, 4) : pool.filter((p) => p.unit < u);
    list.push(ex.match([...focus, ...sample(known.length ? known : uWords.slice(4), 1)]));
    sample(focus, 2).forEach((w) => list.push(ex.typeWord(w)));
    if (audioOn()) list.push(ex.listenWord(pick(focus), pool));
  } else if (kind === 'sentences') {
    sents.forEach((s) => list.push(ex.buildT(s, sentPool)));
    sample(sents, 2).forEach((s) => list.push(ex.buildEn(s, sentPool)));
    list.push(ex.fill(pick(sents), sentPool));
    if (audioOn()) list.push(ex.listenBuild(pick(sents), sentPool));
    if (speakOn()) list.push(ex.speak(pick(sents)));
    list.push(ex.match(sample(uWords, 5)));
  } else if (kind === 'review') {
    sample(uWords, 5).forEach((w) => list.push(randomWordEx(w, pool)));
    sample(sents, 3).forEach((s) => list.push(randomSentEx(s, sentPool)));
    list.push(ex.match(sample(uWords, 5)));
    if (u > 0) sample(pool.filter((p) => p.unit < u), 2).forEach((w) => list.push(randomWordEx(w, pool)));
  } else {
    sample(uWords, 6).forEach((w) => list.push(randomWordEx(w, pool, true)));
    sents.forEach((s) => list.push(randomSentEx(s, sentPool, true)));
    list.push(ex.match(sample(uWords, 5)));
    if (audioOn()) list.push(ex.dictation(pick(sents)));
  }
  // keep the "new word" intros first, shuffle the rest lightly
  const intro = list.filter((e) => e.isNew);
  return [...intro, ...shuffle(list.filter((e) => !e.isNew))];
}

// Units the learner has reached in the current course
function reachedUnits() {
  const cur = currentLesson();
  const maxU = cur ? cur.u : UNITS.length - 1;
  return range(Math.max(1, maxU + (cur && cur.l > 0 ? 1 : 0)));
}

export function buildPractice(mode) {
  const units = reachedUnits();
  const pool = wordsOfUnits(units);
  const sentPool = sentsOfUnits(units);
  const list = [];
  if (mode === 'review') {
    const due = dueWords().filter((w) => units.includes(w.unit));
    const focus = [...due, ...shuffle(pool)].filter((w, i, a) => a.findIndex((x) => x.id === w.id) === i).slice(0, 6);
    focus.forEach((w) => list.push(randomWordEx(w, pool)));
    sample(sentPool, 3).forEach((s) => list.push(randomSentEx(s, sentPool)));
    list.push(ex.match(sample(focus, Math.min(5, focus.length))));
  } else if (mode === 'mistakes') {
    const words = allWords(), sents = allSentences();
    course().mistakes.slice(-10).forEach((m) => {
      if (m.type === 'word') {
        const w = words.find((x) => x.id === m.id);
        if (w) list.push(randomWordEx(w, pool.length > 3 ? pool : words));
      } else {
        const s = sents.find((x) => x.id === m.id);
        if (s) list.push(randomSentEx(s, sentPool.length > 3 ? sentPool : sents));
      }
    });
  } else if (mode === 'listening') {
    sample(pool, 5).forEach((w) => list.push(ex.listenWord(w, pool)));
    sample(sentPool, 3).forEach((s) => list.push(ex.listenBuild(s, sentPool)));
    sample(sentPool, 2).forEach((s) => list.push(ex.dictation(s)));
  } else if (mode === 'speaking') {
    sample(sentPool, 6).forEach((s) => list.push(ex.speak(s)));
  } else if (mode === 'sentences') {
    sample(sentPool, 8).forEach((s) => list.push(pick([ex.buildT, ex.buildEn, ex.fill])(s, sentPool)));
  }
  return shuffle(list);
}

export const practiceAvailable = () => unitsCompleted() > 0 || Object.keys(course().done).length > 0;

// ---------------------------------------------------------------------------
// Exercise views
// ---------------------------------------------------------------------------
const speakerBtn = (text, cls = '') => `<button class="speaker ${cls}" data-say="${esc(text)}" aria-label="Play audio">🔊</button>`;

function langAttr(code) { return code ? ` lang="${LANGS[code]?.tts || code}"` : ''; }

const views = {
  choice(e) {
    let head = `<h2 class="ex-prompt">${esc(e.prompt)}</h2>`;
    if (e.audio) head += `<div class="audio-big">${speakerBtn(e.audio, 'big')}<button class="speaker slow" data-say-slow="${esc(e.audio)}" aria-label="Play slowly">🐢</button></div>`;
    if (e.target) head += `<div class="bubble-row">${mascot('happy', 84)}<div class="bubble"${langAttr(L())}>${speakerBtn(e.target)} <b>${esc(e.target)}</b></div></div>`;
    if (e.fill) head += `<div class="bubble-row">${mascot('wow', 84)}<div class="bubble"><div class="fill-sentence"${langAttr(L())}>${esc(e.sentence)}</div><div class="muted small">${esc(e.hint)}</div></div></div>`;
    const opts = e.options.map((o, i) => `<button class="option" data-opt="${esc(o)}"${langAttr(e.optLang)}><kbd>${i + 1}</kbd><span>${esc(o)}</span></button>`).join('');
    return `${head}<div class="options">${opts}</div>`;
  },
  picture(e) {
    const opts = e.options.map((w, i) => `<button class="option card-opt" data-opt="${esc(w.id)}" data-speak="${esc(T(w))}"><span class="pic">${w.e}</span><span${langAttr(L())}>${esc(T(w))}</span><kbd>${i + 1}</kbd></button>`).join('');
    return `${e.isNew ? '<span class="new-badge">✨ New word</span>' : ''}<h2 class="ex-prompt">${esc(e.prompt)}</h2><div class="options pictures">${opts}</div>`;
  },
  type(e) {
    let head = `<h2 class="ex-prompt">${esc(e.prompt)}</h2>`;
    if (e.audio) head += `<div class="audio-big">${speakerBtn(e.audio, 'big')}<button class="speaker slow" data-say-slow="${esc(e.audio)}" aria-label="Play slowly">🐢</button></div>`;
    if (e.emoji) head += `<div class="type-emoji">${e.emoji}</div>`;
    const chars = LANGS[e.inputLang]?.chars || [];
    const input = e.long
      ? `<textarea class="answer-input" rows="3" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type in ${langName()}"${langAttr(e.inputLang)}></textarea>`
      : `<input class="answer-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type in ${langName()}"${langAttr(e.inputLang)}>`;
    return `${head}${input}<div class="char-keys">${chars.map((c) => `<button class="char" data-char="${c}">${c}</button>`).join('')}</div>`;
  },
  build(e) {
    let head = `<h2 class="ex-prompt">${esc(e.prompt)}</h2>`;
    if (e.audio) head += `<div class="audio-big">${speakerBtn(e.audio, 'big')}<button class="speaker slow" data-say-slow="${esc(e.audio)}" aria-label="Play slowly">🐢</button></div>`;
    else head += `<div class="bubble-row">${mascot('happy', 84)}<div class="bubble"${langAttr(e.sourceLang)}>${e.sourceLang ? speakerBtn(e.source) + ' ' : ''}<b>${esc(e.source)}</b></div></div>`;
    const bank = e.bank.map((t, i) => `<button class="tile" data-i="${i}"${langAttr(e.answerLang)}>${esc(t)}</button>`).join('');
    return `${head}<div class="answer-line" aria-label="Your answer"></div><div class="bank">${bank}</div>`;
  },
  match(e) {
    const left = shuffle(e.pairs).map((p) => `<button class="option match-opt" data-side="l" data-id="${p.id}"${langAttr(L())}>${esc(p.left)}</button>`).join('');
    const right = shuffle(e.pairs).map((p) => `<button class="option match-opt" data-side="r" data-id="${p.id}">${esc(p.right)}</button>`).join('');
    return `<h2 class="ex-prompt">${esc(e.prompt)}</h2><div class="match"><div>${left}</div><div>${right}</div></div>`;
  },
  speak(e) {
    return `<h2 class="ex-prompt">${esc(e.prompt)}</h2>
      <div class="bubble-row">${mascot('cheer', 84)}<div class="bubble"${langAttr(L())}>${speakerBtn(e.text)} <b>${esc(e.text)}</b><div class="muted small">${esc(e.en)}</div></div></div>
      <button class="mic-btn" aria-label="Start speaking">🎙️<span>Tap to speak</span></button><div class="heard muted"></div>`;
  },
};

// Wire up interactivity. `ctl` = { ready(bool), autoCheck(), finishMatch(ok) }
const mounts = {
  choice(el, e, ctl) {
    let sel = null;
    const opts = $$('.option', el);
    opts.forEach((b) => b.addEventListener('click', () => {
      opts.forEach((o) => o.classList.remove('selected'));
      b.classList.add('selected');
      sel = b.dataset.opt;
      sfx('tap');
      if (e.optLang && state.settings.listening && canSpeak && !e.audio) say(sel);
      if (b.dataset.speak) say(b.dataset.speak);
      ctl.ready(true);
    }));
    if (e.audio && audioOn()) setTimeout(() => say(e.audio), 350);
    if (e.target && audioOn()) setTimeout(() => say(e.target), 350);
    return {
      value: () => sel,
      check: () => ({ ok: sel === e.answer, solution: e.solution || e.answer }),
      key: (k) => { const b = opts[Number(k) - 1]; if (b) b.click(); },
    };
  },
  picture(el, e, ctl) {
    return mounts.choice(el, { ...e, answer: e.answer }, ctl);
  },
  type(el, e, ctl) {
    const input = $('.answer-input', el);
    input.addEventListener('input', () => ctl.ready(input.value.trim().length > 0));
    $$('.char', el).forEach((b) => b.addEventListener('click', () => {
      const { selectionStart: a, selectionEnd: z, value } = input;
      input.value = value.slice(0, a) + b.dataset.char + value.slice(z);
      input.focus();
      input.selectionStart = input.selectionEnd = a + 1;
      ctl.ready(true);
    }));
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); ctl.enter(); } });
    setTimeout(() => input.focus(), 50);
    if (e.audio && audioOn()) setTimeout(() => say(e.audio), 350);
    return {
      value: () => input.value,
      check: () => {
        const g = grade(input.value, e.answers);
        input.disabled = true;
        const notes = { accent: 'Watch out for accents!', typo: 'You have a typo.' };
        return { ok: g !== 'wrong', solution: e.solution, note: notes[g] };
      },
      typing: true,
    };
  },
  build(el, e, ctl) {
    const line = $('.answer-line', el);
    const chosen = [];
    const sync = () => ctl.ready(chosen.length > 0);
    $$('.bank .tile', el).forEach((b) => b.addEventListener('click', () => {
      if (b.classList.contains('used')) return;
      sfx('tap');
      if (e.answerLang && audioOn()) say(b.textContent, e.answerLang);
      b.classList.add('used');
      const t = document.createElement('button');
      t.className = 'tile';
      t.textContent = b.textContent;
      if (e.answerLang) t.lang = LANGS[e.answerLang].tts;
      const item = { i: Number(b.dataset.i), el: t };
      chosen.push(item);
      t.addEventListener('click', () => {
        chosen.splice(chosen.indexOf(item), 1);
        t.remove();
        b.classList.remove('used');
        sync();
      });
      line.append(t);
      sync();
    }));
    if (e.audio && audioOn()) setTimeout(() => say(e.audio), 350);
    if (e.sourceLang && audioOn()) setTimeout(() => say(e.source), 350);
    return {
      value: () => chosen.map((c) => e.bank[c.i]).join(' '),
      check: () => {
        const got = normalize(chosen.map((c) => e.bank[c.i]).join(' '));
        return { ok: got === normalize(e.answer.join(' ')), solution: e.solution };
      },
    };
  },
  match(el, e, ctl) {
    let sel = null, left = e.pairs.length, errors = 0;
    $$('.match-opt', el).forEach((b) => b.addEventListener('click', () => {
      if (b.classList.contains('done')) return;
      if (b.dataset.side === 'l' && audioOn()) say(b.textContent);
      if (!sel || sel.dataset.side === b.dataset.side) {
        if (sel) sel.classList.remove('selected');
        sel = b; b.classList.add('selected'); sfx('tap');
        return;
      }
      if (sel.dataset.id === b.dataset.id) {
        [sel, b].forEach((x) => { x.classList.remove('selected'); x.classList.add('done'); });
        sfx('match');
        if (--left === 0) setTimeout(() => ctl.finishMatch(errors === 0), 300);
      } else {
        errors++;
        const a = sel;
        [a, b].forEach((x) => x.classList.add('shake-wrong'));
        sfx('wrong');
        setTimeout(() => [a, b].forEach((x) => x.classList.remove('shake-wrong', 'selected')), 500);
      }
      sel = null;
    }));
    return { value: () => null, check: () => ({ ok: true }), noCheck: true };
  },
  speak(el, e, ctl) {
    const btn = $('.mic-btn', el), heard = $('.heard', el);
    let result = null, ok = false;
    btn.addEventListener('click', async () => {
      btn.classList.add('listening');
      btn.querySelector('span').textContent = 'Listening…';
      try {
        const alts = await listen();
        const target = normalize(e.text).split(' ');
        let best = 0;
        for (const a of alts) {
          const got = new Set(normalize(a).split(' '));
          best = Math.max(best, target.filter((t) => got.has(t)).length / target.length);
        }
        result = alts[0] || '';
        ok = best >= 0.6;
        heard.textContent = result ? `We heard: “${result}”` : 'We didn’t catch that — try again.';
        if (result) { ctl.ready(true); ctl.enter(); }
      } catch (err) {
        heard.textContent = err.message === 'not-allowed' ? 'Microphone permission was blocked.' : 'Speech recognition failed — try again or skip.';
      }
      btn.classList.remove('listening');
      btn.querySelector('span').textContent = 'Tap to speak';
    });
    return { value: () => result, check: () => ({ ok, solution: e.text }), spoken: true };
  },
};

// ---------------------------------------------------------------------------
// Session runner
// ---------------------------------------------------------------------------
/**
 * @param {HTMLElement} root
 * @param {{title:string, exercises:object[], useHearts:boolean, onFinish:(r:object)=>void, onQuit:()=>void, mistakesMode?:boolean}} cfg
 */
export function runSession(root, cfg) {
  const queue = cfg.exercises.map((e) => ({ ...e }));
  const total = queue.length;
  const r = { correct: 0, answered: 0, mistakes: 0, combo: 0, bestCombo: 0, listened: 0, spoken: 0, start: Date.now(), cleared: 0 };
  let idx = 0, phase = 'idle', cur = null;

  root.innerHTML = `<div class="lesson">
    <header class="lesson-top">
      <button class="icon-btn quit" aria-label="Quit">✕</button>
      <div class="progress"><div class="progress-fill"></div><span class="combo-badge"></span></div>
      ${cfg.useHearts ? '<span class="hearts-pill">❤️ <b class="hearts-n"></b></span>' : '<span class="hearts-pill practice-pill">∞</span>'}
    </header>
    <main class="lesson-body"><div class="ex"></div></main>
    <footer class="lesson-foot"><div class="foot-inner">
      <button class="btn ghost skip">Skip</button>
      <div class="feedback"></div>
      <button class="btn primary check" disabled>Check</button>
    </div></footer>
  </div>`;

  const body = $('.ex', root), foot = $('.lesson-foot', root), checkBtn = $('.check', root), skipBtn = $('.skip', root), fb = $('.feedback', root);

  const updateTop = () => {
    $('.progress-fill', root).style.width = `${(r.cleared / total) * 100}%`;
    const cb = $('.combo-badge', root);
    cb.textContent = r.combo >= 3 ? `🔥 ${r.combo} in a row` : '';
    cb.classList.toggle('show', r.combo >= 3);
    if (cfg.useHearts) $('.hearts-n', root).textContent = state.hearts;
  };

  const ctl = {
    ready: (v) => { if (phase === 'idle') checkBtn.disabled = !v; },
    enter: () => onPrimary(),
    finishMatch: (perfect) => {
      r.answered++; r.correct++;
      if (perfect) bumpCombo(); else r.combo = 0;
      cur.e.refs.forEach((ref) => reviewWord(ref.id, perfect));
      showResult({ ok: true, note: perfect ? 'Perfect matching!' : 'All matched!' }, true);
    },
  };

  function bumpCombo() {
    r.combo++;
    r.bestCombo = Math.max(r.bestCombo, r.combo);
  }

  function show() {
    if (idx >= queue.length) return finish();
    const e = queue[idx];
    phase = 'idle';
    foot.className = 'lesson-foot';
    fb.innerHTML = '';
    checkBtn.textContent = 'Check';
    checkBtn.disabled = true;
    skipBtn.style.visibility = e.type === 'match' ? 'hidden' : 'visible';
    skipBtn.textContent = e.listen ? 'Can’t listen now' : e.type === 'speak' ? 'Can’t speak now' : 'Skip';
    body.innerHTML = views[e.type](e);
    body.classList.remove('enter');
    void body.offsetWidth;
    body.classList.add('enter');
    $$('[data-say]', body).forEach((b) => b.addEventListener('click', () => say(b.dataset.say)));
    $$('[data-say-slow]', body).forEach((b) => b.addEventListener('click', () => say(b.dataset.saySlow, L(), true)));
    cur = { e, m: mounts[e.type](body, e, ctl) };
    checkBtn.style.display = cur.m.noCheck ? 'none' : '';
    updateTop();
  }

  function showResult(res, autoContinue = false) {
    phase = 'result';
    const { ok } = res;
    foot.className = `lesson-foot ${ok ? 'good' : 'bad'}`;
    const praise = pick(['Nice!', 'Great job!', 'Excellent!', 'You got it!', 'Brilliant!', 'Awesome!']);
    fb.innerHTML = ok
      ? `<div class="fb-title">✅ ${praise}</div>${res.note ? `<div class="fb-note">${esc(res.note)}</div>` : ''}${res.note && res.solution ? `<div class="fb-sol">${esc(res.solution)}</div>` : ''}`
      : `<div class="fb-title">❌ Correct answer:</div><div class="fb-sol">${esc(res.solution || '')}</div>${res.note ? `<div class="fb-note">${esc(res.note)}</div>` : ''}`;
    skipBtn.style.visibility = 'hidden';
    checkBtn.style.display = '';
    checkBtn.disabled = false;
    checkBtn.textContent = 'Continue';
    checkBtn.focus();
    sfx(ok ? 'correct' : 'wrong');
    if (ok) r.cleared++;
    updateTop();
    if (ok && cur.e.ref?.type === 'sent' && (cur.e.answerLang || cur.e.inputLang) && audioOn()) say(res.solution);
    if (autoContinue) checkBtn.focus();
  }

  function onPrimary() {
    if (phase === 'idle') {
      if (checkBtn.disabled || cur.m.noCheck) return;
      const res = cur.m.check();
      r.answered++;
      if (cur.e.listen) r.listened++;
      if (cur.m.spoken) r.spoken++;
      const firstTry = !cur.e.retry;
      if (res.ok) {
        r.correct++;
        bumpCombo();
        if (cfg.mistakesMode && cur.e.ref) clearMistake(cur.e.ref);
      } else {
        r.mistakes++;
        r.combo = 0;
        if (cur.e.ref) addMistake(cur.e.ref);
        if (cfg.useHearts) loseHeart();
        // retry later in the session
        if (cfg.useHearts || !cur.e.retry) queue.push({ ...cur.e, retry: true });
      }
      if (cur.e.ref?.type === 'word' && firstTry) reviewWord(cur.e.ref.id, res.ok);
      if (res.ok && !cur.e.retry && !cfg.useHearts && state.hearts < MAX_HEARTS && Math.random() < 0.15) gainHeart();
      $$('.option', body).forEach((o) => {
        if (o.dataset.opt === (cur.e.answer)) o.classList.add('right');
        else if (o.classList.contains('selected') && !res.ok) o.classList.add('wrong');
        o.disabled = true;
      });
      $$('.tile', body).forEach((t) => (t.disabled = true));
      showResult(res);
      save();
    } else {
      if (cfg.useHearts && state.hearts <= 0) return outOfHearts();
      idx++;
      show();
    }
  }

  async function outOfHearts() {
    const canBuy = state.gems >= 350;
    const v = await modal(`<div class="center">${mascot('sad', 110)}<h2>You ran out of hearts</h2>
      <p class="muted">Hearts refill over time (one every 30 minutes). You can also practice to earn them back.</p>
      <div class="stack">
        <button class="btn primary" data-value="buy" ${canBuy ? '' : 'disabled'}>Refill hearts · 💎 350</button>
        <button class="btn" data-value="practice">Practice to earn hearts</button>
        <button class="btn ghost" data-value="quit">End lesson</button>
      </div></div>`, { dismissable: false });
    if (v === 'buy' && state.gems >= 350) {
      state.gems -= 350;
      state.hearts = MAX_HEARTS;
      save();
      sfx('coin');
      idx++;
      show();
    } else if (v === 'practice') {
      location.hash = '#/practice';
    } else cfg.onQuit();
  }

  function skip() {
    const e = queue[idx];
    if (e.listen || e.type === 'speak') {
      // Don't penalise: drop this exercise and similar ones for the rest of the session
      const isSpeak = e.type === 'speak';
      for (let i = queue.length - 1; i > idx; i--) if (isSpeak ? queue[i].type === 'speak' : queue[i].listen) queue.splice(i, 1);
      r.cleared++;
      idx++;
      show();
      return;
    }
    const res = { ok: false, solution: e.solution || e.answer || '' };
    r.answered++; r.mistakes++; r.combo = 0;
    if (e.ref) addMistake(e.ref);
    if (cfg.useHearts) loseHeart();
    queue.push({ ...e, retry: true });
    phase = 'idle';
    showResult(res);
    save();
  }

  function finish() {
    document.removeEventListener('keydown', onKey);
    const secs = Math.round((Date.now() - r.start) / 1000);
    cfg.onFinish({ ...r, total, secs, perfect: r.mistakes === 0, accuracy: r.answered ? r.correct / r.answered : 1 });
  }

  async function quit() {
    const v = await modal(`<div class="center">${mascot('sad', 100)}<h2>Wait, don’t go!</h2><p class="muted">You’ll lose your progress in this ${cfg.useHearts ? 'lesson' : 'session'}.</p>
      <div class="stack"><button class="btn primary" data-value="stay">Keep learning</button><button class="btn ghost danger-text" data-value="quit">End session</button></div></div>`);
    if (v === 'quit') { document.removeEventListener('keydown', onKey); cfg.onQuit(); }
  }

  function onKey(ev) {
    if (document.querySelector('.modal-back')) return;
    if (ev.key === 'Enter' && !(cur?.m.typing && phase === 'idle')) { ev.preventDefault(); onPrimary(); }
    else if (/^[1-9]$/.test(ev.key) && phase === 'idle' && cur?.m.key) cur.m.key(ev.key);
  }

  checkBtn.addEventListener('click', onPrimary);
  skipBtn.addEventListener('click', skip);
  $('.quit', root).addEventListener('click', quit);
  document.addEventListener('keydown', onKey);
  cfg.cleanup = () => document.removeEventListener('keydown', onKey);
  show();
  return cfg;
}
