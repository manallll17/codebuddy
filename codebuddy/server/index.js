import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initSchema } from './db.js';
import { authRouter, requireAuth } from './auth.js';
import { initSocket } from './socket.js';
import { tutorRouter } from './routes/tutor.js';
import { projectsRouter } from './routes/projects.js';
import { learnRouter } from './routes/learn.js';

const PORT = process.env.PORT || 5000;
const app = express();
app.set('trust proxy', 1);

// ---------- Security middleware ----------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'], // Monaco editor loads from jsDelivr
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'ws:', 'https://cdn.jsdelivr.net'],
        workerSrc: ["'self'", 'blob:'],
      },
    },
  })
);
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true }));
app.use(express.json({ limit: '300kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
const aiLimiter = rateLimit({ windowMs: 60_000, limit: 15, message: { error: 'Slow down a little – max 15 AI requests per minute.' } });

// ---------- REST API ----------
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, ai: Boolean(process.env.GEMINI_API_KEY), db: Boolean(process.env.DATABASE_URL) })
);
app.use('/api/auth', authRouter);
app.use('/api', requireAuth); // everything below requires a valid JWT
app.use(['/api/tutor/ask', '/api/tutor/compare', '/api/quiz', '/api/daily/check'], aiLimiter);
app.use('/api/tutor', tutorRouter);
app.use('/api/projects', projectsRouter);
app.use('/api', learnRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- Serve the built React app ----------
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
app.use(express.static(dist, { maxAge: '1h', index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html'), (err) => err && res.status(404).send('Run "npm run build" first.')));

// ---------- Start ----------
const server = http.createServer(app);
initSocket(server);

try {
  await initSchema();
  console.log('✔ Database ready');
} catch (e) {
  console.error('✖ Database connection failed – check DATABASE_URL.\n ', e.message);
}
server.listen(PORT, () => console.log(`✔ CodeBuddy running on http://localhost:${PORT}`));
