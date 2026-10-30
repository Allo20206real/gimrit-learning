import { LANGS } from './data.js';
import { state } from './store.js';

let ctx;
function tone(freq, start, dur, type = 'sine', gain = 0.12) {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const SOUNDS = {
  correct: () => { tone(660, 0, 0.12, 'triangle'); tone(990, 0.09, 0.2, 'triangle'); },
  wrong: () => { tone(220, 0, 0.18, 'sawtooth', 0.06); tone(170, 0.12, 0.25, 'sawtooth', 0.06); },
  tap: () => tone(520, 0, 0.06, 'sine', 0.05),
  match: () => tone(880, 0, 0.1, 'triangle', 0.08),
  complete: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle')),
  levelup: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.25, 'square', 0.05)),
  coin: () => { tone(988, 0, 0.08, 'square', 0.05); tone(1319, 0.07, 0.25, 'square', 0.05); },
};

export function sfx(name) {
  if (!state.settings.sound) return;
  try { SOUNDS[name]?.(); } catch { /* audio blocked */ }
}

// ---------- Text to speech ----------
export const canSpeak = 'speechSynthesis' in window;
let voices = [];
if (canSpeak) {
  const load = () => { voices = speechSynthesis.getVoices(); };
  load();
  speechSynthesis.onvoiceschanged = load;
}

export function say(text, lang = state.lang, slow = false) {
  if (!canSpeak) return;
  const code = LANGS[lang]?.tts || lang;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = code;
  const v = voices.find((x) => x.lang === code) || voices.find((x) => x.lang.startsWith(code.slice(0, 2)));
  if (v) u.voice = v;
  u.rate = (state.settings.speechRate || 0.9) * (slow ? 0.6 : 1);
  speechSynthesis.speak(u);
}

// ---------- Speech recognition ----------
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = !!Rec;

export function listen(lang = state.lang) {
  return new Promise((resolve, reject) => {
    if (!Rec) return reject(new Error('unsupported'));
    const r = new Rec();
    r.lang = LANGS[lang]?.tts || lang;
    r.interimResults = false;
    r.maxAlternatives = 5;
    r.onresult = (e) => resolve([...e.results[0]].map((a) => a.transcript));
    r.onerror = (e) => reject(new Error(e.error));
    r.onend = () => resolve([]);
    r.start();
  });
}
