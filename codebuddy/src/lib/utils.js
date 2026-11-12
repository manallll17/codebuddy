// Strip control characters and cap length before sending (input sanitising).
// React escapes all text by default and Markdown is rendered with raw HTML disabled (XSS protection).
export function cleanText(text, max = 6000) {
  return String(text ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, max)
    .trim();
}

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const toMs = (ts) => (typeof ts === 'number' ? ts : new Date(ts).getTime());

export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - toMs(ts)) / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} d ago` : new Date(toMs(ts)).toLocaleDateString();
}

export const clock = (ts) => new Date(toMs(ts)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const initials = (name = '?') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// Stable colour per user name for avatars
export const colorFor = (name = '') => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 52%)`;
};

export const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const readFileText = (file) =>
  new Promise((resolve, reject) => {
    if (file.size > 200 * 1024) return reject(new Error('File too large (max 200 KB)'));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsText(file);
  });

// XP → level curve: level n needs 25·(n-1)² XP
export const levelFromXp = (xp = 0) => {
  const level = Math.floor(Math.sqrt(xp / 25)) + 1;
  const curr = 25 * (level - 1) ** 2;
  const next = 25 * level ** 2;
  return { level, progress: Math.round(((xp - curr) / (next - curr)) * 100), next, toNext: next - xp };
};

// Pull the first fenced code block out of a Markdown answer
export const firstCodeBlock = (md = '') => {
  const m = md.match(/```(\w+)?\n([\s\S]*?)```/);
  return m ? { lang: m[1] || '', code: m[2] } : null;
};
