export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};

// Wraps async route handlers so thrown errors become JSON responses
export const h = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out ?? { ok: true });
  } catch (e) {
    const status = e.status && e.status < 600 ? e.status : 500;
    if (status === 500) console.error(e);
    res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : e.message });
  }
};

// Remove control characters + cap length (input sanitising)
export const clean = (text, max = 6000) =>
  String(text ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, max)
    .trim();

export const TZ = process.env.APP_TZ || 'Asia/Kolkata';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export const dayStr = (offsetDays = 0) => fmt.format(new Date(Date.now() + offsetDays * 86400000));

export const LANGS = ['python', 'java', 'c', 'cpp', 'javascript'];
export const LANG_LABEL = { python: 'Python', java: 'Java', c: 'C', cpp: 'C++', javascript: 'JavaScript' };
export const LEVELS = ['beginner', 'intermediate', 'advanced'];
export const ROOM_IDS = ['general', 'doubts', 'python', 'java', 'c', 'cpp', 'javascript'];
export const pickLang = (l) => (LANGS.includes(l) ? l : 'python');
export const pickLevel = (l) => (LEVELS.includes(l) ? l : 'beginner');
export const intId = (v) => {
  const n = Number.parseInt(v, 10);
  if (!Number.isInteger(n) || n <= 0) fail(400, 'Invalid id');
  return n;
};
