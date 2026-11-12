import { Router } from 'express';
import { q, one } from '../db.js';
import { h, fail, clean, pickLang, pickLevel, intId, LANG_LABEL } from '../util.js';
import { gemini } from '../ai.js';
import { tutorSystemPrompt, comparePrompt } from '../prompts.js';
import { awardXp, XP } from '../xp.js';

export const tutorRouter = Router();
const MODES = ['chat', 'explain', 'debug', 'linebyline', 'optimize', 'practice'];

// ----- Chat history (CRUD) -----
tutorRouter.get(
  '/chats',
  h(async (req) =>
    q(
      `select id, title, language, level, updated_at as "updatedAt" from chats
       where user_id = $1 order by updated_at desc limit 50`,
      [req.user.id]
    )
  )
);

tutorRouter.get(
  '/chats/:id',
  h(async (req) => {
    const id = intId(req.params.id);
    const chat = await one(
      'select id, title, language, level from chats where id = $1 and user_id = $2',
      [id, req.user.id]
    );
    if (!chat) fail(404, 'Chat not found');
    chat.messages = await q(
      `select id, role, content, mode, created_at as "createdAt" from chat_messages where chat_id = $1 order by id`,
      [id]
    );
    return chat;
  })
);

tutorRouter.put(
  '/chats/:id',
  h(async (req) => {
    const title = clean(req.body.title, 80);
    if (!title) fail(400, 'Title required');
    await q('update chats set title = $1 where id = $2 and user_id = $3', [title, intId(req.params.id), req.user.id]);
  })
);

tutorRouter.delete(
  '/chats/:id',
  h(async (req) => {
    await q('delete from chats where id = $1 and user_id = $2', [intId(req.params.id), req.user.id]);
  })
);

// ----- Ask the AI tutor -----
tutorRouter.post(
  '/ask',
  h(async (req) => {
    const content = clean(req.body.content, 15000);
    if (!content) fail(400, 'Type a question first.');
    const mode = MODES.includes(req.body.mode) ? req.body.mode : 'chat';
    const language = pickLang(req.body.language);
    const level = pickLevel(req.body.level);
    const eli5 = Boolean(req.body.eli5);

    let chatId = req.body.chatId ? intId(req.body.chatId) : null;
    if (chatId) {
      const owns = await one('select 1 from chats where id = $1 and user_id = $2', [chatId, req.user.id]);
      if (!owns) fail(404, 'Chat not found');
    } else {
      const title = content.split('\n')[0].slice(0, 60) || 'New chat';
      chatId = (await one('insert into chats (user_id, title, language, level) values ($1,$2,$3,$4) returning id', [req.user.id, title, language, level])).id;
    }

    const history = await q(
      'select role, content from (select id, role, content from chat_messages where chat_id = $1 order by id desc limit 10) t order by id',
      [chatId]
    );
    const reply = await gemini({
      system: tutorSystemPrompt({ language: LANG_LABEL[language], level, mode, eli5 }),
      messages: [...history, { role: 'user', content }],
    });

    const userMsg = await one(
      `insert into chat_messages (chat_id, role, content, mode) values ($1, 'user', $2, $3)
       returning id, role, content, mode, created_at as "createdAt"`,
      [chatId, content, mode]
    );
    const aiMsg = await one(
      `insert into chat_messages (chat_id, role, content, mode) values ($1, 'assistant', $2, $3)
       returning id, role, content, mode, created_at as "createdAt"`,
      [chatId, reply, mode]
    );
    await q('update chats set updated_at = now(), language = $2, level = $3 where id = $1', [chatId, language, level]);
    await awardXp(req.user.id, XP.question, { reason: 'AI question', stat: 'questions', language });
    return { chatId, userMsg, aiMsg };
  })
);

// ----- Compare two solutions -----
tutorRouter.post(
  '/compare',
  h(async (req) => {
    const a = clean(req.body.a, 8000);
    const b = clean(req.body.b, 8000);
    if (!a || !b) fail(400, 'Paste both solutions first.');
    const language = pickLang(req.body.language);
    const reply = await gemini({
      system: comparePrompt({ language: LANG_LABEL[language], level: pickLevel(req.body.level) }),
      messages: [{ role: 'user', content: `Solution A:\n${a}\n\nSolution B:\n${b}` }],
    });
    await awardXp(req.user.id, XP.question, { reason: 'Code comparison', stat: 'questions', language });
    return { reply };
  })
);

// ----- Run code (Judge0 sandbox) -----
const JUDGE_IDS = { python: 71, java: 62, c: 50, cpp: 54, javascript: 63 };

tutorRouter.post(
  '/run',
  h(async (req) => {
    const language = pickLang(req.body.language);
    const base = (process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.JUDGE0_RAPIDAPI_KEY) {
      headers['X-RapidAPI-Key'] = process.env.JUDGE0_RAPIDAPI_KEY;
      headers['X-RapidAPI-Host'] = new URL(base).host;
    }
    const b64 = (s) => Buffer.from(String(s ?? ''), 'utf8').toString('base64');
    const un = (s) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');
    let r;
    try {
      r = await fetch(`${base}/submissions?base64_encoded=true&wait=true`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          language_id: JUDGE_IDS[language],
          source_code: b64(String(req.body.code || '').slice(0, 50000)),
          stdin: b64(String(req.body.stdin || '').slice(0, 5000)),
        }),
      });
    } catch {
      fail(502, 'Code runner is unreachable right now.');
    }
    if (!r.ok) fail(502, `Code runner unavailable (${r.status}). Try again shortly.`);
    const d = await r.json();
    return {
      status: d.status?.description || 'Unknown',
      ok: d.status?.id === 3,
      stdout: un(d.stdout),
      stderr: un(d.stderr),
      compileOutput: un(d.compile_output),
      message: un(d.message),
      time: d.time,
      memory: d.memory,
    };
  })
);
