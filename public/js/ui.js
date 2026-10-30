export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const sample = (arr, n) => shuffle(arr).slice(0, n);
export const fmt = (n) => Number(n || 0).toLocaleString();

export function toast(msg, icon = '✨') {
  let wrap = $('#toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toasts';
    document.body.append(wrap);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${esc(msg)}</span>`;
  wrap.append(el);
  setTimeout(() => el.classList.add('out'), 2800);
  setTimeout(() => el.remove(), 3300);
}

/** Opens a modal; returns a promise resolved with the value of the clicked [data-value] button. */
export function modal(html, { dismissable = true, className = '', onOpen } = {}) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${className}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.append(back);
    requestAnimationFrame(() => back.classList.add('in'));
    const close = (v) => {
      back.classList.remove('in');
      setTimeout(() => back.remove(), 200);
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(null); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-value]');
      if (b) close(b.dataset.value);
      else if (e.target === back && dismissable) close(null);
    });
    onOpen?.(back.firstElementChild, close);
  });
}

export function confetti(count = 140) {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.append(c);
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const colors = ['#7c5cff', '#ff7a45', '#20b26b', '#ff4f8b', '#1fa2ff', '#f5b400'];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200,
    y: innerHeight / 3,
    vx: (Math.random() - 0.5) * 14,
    vy: Math.random() * -14 - 4,
    r: Math.random() * 6 + 4,
    rot: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.3,
    col: colors[Math.floor(Math.random() * colors.length)],
  }));
  let frame = 0;
  (function step() {
    g.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.col; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      g.restore();
    });
    if (++frame < 160) requestAnimationFrame(step);
    else c.remove();
  })();
}

// Gim, the Gimrit mascot: a friendly comet-blob
export function mascot(mood = 'happy', size = 120) {
  const mouths = {
    happy: '<path d="M44 70 Q60 84 76 70" stroke="#2b1b5a" stroke-width="5" fill="none" stroke-linecap="round"/>',
    wow: '<ellipse cx="60" cy="74" rx="8" ry="10" fill="#2b1b5a"/>',
    sad: '<path d="M46 78 Q60 68 74 78" stroke="#2b1b5a" stroke-width="5" fill="none" stroke-linecap="round"/>',
    cheer: '<path d="M42 68 Q60 92 78 68 Z" fill="#2b1b5a"/><path d="M50 76 Q60 84 70 76" fill="#ff7aa8"/>',
  };
  return `<svg class="mascot mascot-${mood}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
    <defs><linearGradient id="gimg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent-light, #a48bff)"/><stop offset="1" stop-color="var(--accent, #7c5cff)"/></linearGradient></defs>
    <path d="M18 34 Q8 10 30 18 Q40 6 50 20" fill="var(--accent2, #ff7a45)" opacity=".9"/>
    <ellipse cx="60" cy="104" rx="30" ry="6" fill="#000" opacity=".08"/>
    <path d="M60 14 C92 14 104 40 104 62 C104 88 86 100 60 100 C34 100 16 88 16 62 C16 40 28 14 60 14 Z" fill="url(#gimg)"/>
    <circle cx="44" cy="52" r="12" fill="#fff"/><circle cx="76" cy="52" r="12" fill="#fff"/>
    <circle class="pupil" cx="46" cy="54" r="6" fill="#2b1b5a"/><circle class="pupil" cx="78" cy="54" r="6" fill="#2b1b5a"/>
    <circle cx="48" cy="51" r="2" fill="#fff"/><circle cx="80" cy="51" r="2" fill="#fff"/>
    <circle cx="32" cy="70" r="6" fill="#ff7aa8" opacity=".5"/><circle cx="88" cy="70" r="6" fill="#ff7aa8" opacity=".5"/>
    ${mouths[mood] || mouths.happy}
  </svg>`;
}

export function avatar(av, color, size = 44) {
  return `<span class="avatar" style="--av:${esc(color || '#7c5cff')};width:${size}px;height:${size}px;font-size:${size * 0.55}px">${esc(av || '🦊')}</span>`;
}

export function ring(pct, size = 56, stroke = 6, label = '') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `<span class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>
    <span class="ring-label">${label}</span></span>`;
}

// Answer comparison helpers
export const normalize = (s, lenient = true) => {
  let t = String(s).toLowerCase().replace(/[’`]/g, "'").replace(/[.,!?¿¡;:"«»()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (lenient) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/œ/g, 'oe');
  return t;
};
export const tokens = (s) => s.split(/\s+/).map((t) => t.replace(/^[¿¡"«(]+|[.,!?;:"»)]+$/g, '')).filter(Boolean);

const ARTICLES = ['el', 'la', 'los', 'las', 'le', 'les', 'der', 'die', 'das', 'il', 'lo', 'o', 'a', 'os', 'as', 'un', 'una', 'une', 'ein', 'eine'];
export function stripArticle(s) {
  const t = s.trim();
  const m = t.match(/^l'(.+)$/i);
  if (m) return m[1];
  const [first, ...rest] = t.split(' ');
  return rest.length && ARTICLES.includes(first.toLowerCase()) ? rest.join(' ') : t;
}

export function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** Grades a typed answer: 'exact' | 'accent' (right but missing accents) | 'typo' | 'wrong' */
export function grade(input, answers) {
  const strict = normalize(input, false);
  const loose = normalize(input, true);
  for (const ans of answers) {
    if (normalize(ans, false) === strict) return 'exact';
  }
  for (const ans of answers) {
    if (normalize(ans, true) === loose) return 'accent';
  }
  for (const ans of answers) {
    const n = normalize(ans, true);
    if (n.length > 4 && levenshtein(n, loose) === 1) return 'typo';
  }
  return 'wrong';
}

export const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
