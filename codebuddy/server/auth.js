import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { one } from './db.js';
import { h, fail, clean } from './util.js';

const SECRET = () => process.env.JWT_SECRET || 'dev-only-secret-change-me';
export const signToken = (user) => jwt.sign({ id: user.id }, SECRET(), { expiresIn: '7d' });
export const verifyToken = (token) => jwt.verify(token, SECRET());

export const PROFILE_COLS = `id, name, email, bio, xp, streak_count, streak_best, streak_last,
  questions, solved, quizzes, created_at`;

export const toProfile = (u) =>
  u && {
    id: u.id,
    name: u.name,
    email: u.email,
    bio: u.bio,
    xp: u.xp,
    streak: { count: u.streak_count, best: u.streak_best, last: u.streak_last },
    stats: { questions: u.questions, solved: u.solved, quizzes: u.quizzes },
    createdAt: u.created_at,
  };

// ---------- Authentication middleware: who are you? ----------
// (Authorization – what you may do – is handled per project by owner/editor/viewer roles.)
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please log in first.' });
    const { id } = verifyToken(token);
    const user = await one('select id, name, email from users where id = $1', [id]);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// ---------- Routes ----------
export const authRouter = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, message: { error: 'Too many attempts. Try again later.' } });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

authRouter.post(
  '/signup',
  authLimiter,
  h(async (req) => {
    const name = clean(req.body.name, 40);
    const email = clean(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2) fail(400, 'Please enter your name.');
    if (!EMAIL_RE.test(email)) fail(400, 'Please enter a valid email.');
    if (password.length < 6) fail(400, 'Password must be at least 6 characters.');
    if (await one('select 1 from users where email = $1', [email])) fail(409, 'An account with this email already exists.');

    const hash = await bcrypt.hash(password, 10); // passwords are never stored in plain text
    const user = await one(
      `insert into users (name, email, password_hash) values ($1, $2, $3) returning ${PROFILE_COLS}`,
      [name, email, hash]
    );
    return { token: signToken(user), user: toProfile(user) };
  })
);

authRouter.post(
  '/login',
  authLimiter,
  h(async (req) => {
    const email = clean(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || '');
    const row = await one(`select password_hash, ${PROFILE_COLS} from users where email = $1`, [email]);
    if (!row || !(await bcrypt.compare(password, row.password_hash))) fail(401, 'Wrong email or password.');
    return { token: signToken(row), user: toProfile(row) };
  })
);

authRouter.get(
  '/me',
  requireAuth,
  h(async (req) => ({ user: toProfile(await one(`select ${PROFILE_COLS} from users where id = $1`, [req.user.id])) }))
);
