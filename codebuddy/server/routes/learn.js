import { Router } from 'express';
import { q, one } from '../db.js';
import { h, fail, clean, pickLang, pickLevel, intId, dayStr, LANG_LABEL, TZ } from '../util.js';
import { gemini } from '../ai.js';
import { quizPrompt, dailyPrompt, checkPrompt } from '../prompts.js';
import { awardXp, XP } from '../xp.js';
import { PROFILE_COLS, toProfile, requireRole } from '../auth.js';

export const learnRouter = Router();

// ---------- Profile ----------
learnRouter.put(
  '/me',
  h(async (req) => {
    const name = clean(req.body.name, 40);
    const bio = clean(req.body.bio, 300);
    if (name.length < 2) fail(400, 'Name too short.');
    return toProfile(await one(`update users set name = $1, bio = $2 where id = $3 returning ${PROFILE_COLS}`, [name, bio, req.user.id]));
  })
);

learnRouter.get(
  '/me/stats',
  h(async (req) => {
    const uid = req.user.id;
    const [activity, languages, weekly, roadmap, solvedToday, weekXp] = await Promise.all([
      q(`select day, count from activity_log where user_id = $1 and day >= $2::date order by day`, [uid, dayStr(-120)]),
      q(`select language, count from language_usage where user_id = $1 order by count desc`, [uid]),
      q(
        `select to_char((created_at at time zone $2)::date, 'YYYY-MM-DD') as day, sum(amount)::int as xp
         from xp_events where user_id = $1 and created_at >= now() - interval '7 days' group by 1 order by 1`,
        [uid, TZ]
      ),
      q(`select language, topic_id as "topicId" from roadmap_progress where user_id = $1`, [uid]),
      one(`select 1 from daily_solves where user_id = $1 and day = $2::date`, [uid, dayStr(0)]),
      one(`select coalesce(sum(amount), 0)::int as xp from xp_events where user_id = $1 and created_at >= date_trunc('week', now())`, [uid]),
    ]);
    return { activity, languages, weekly, roadmap, solvedToday: Boolean(solvedToday), weekXp: weekXp.xp };
  })
);

// ---------- Daily challenge (generated once per day, shared by everyone) ----------
async function todaysChallenge() {
  const day = dayStr(0);
  let row = await one('select data from daily_challenges where day = $1::date', [day]);
  if (!row) {
    const data = await gemini({ system: 'You write fun, clear coding challenges. Output strict JSON only.', messages: [{ role: 'user', content: dailyPrompt({ date: day }) }], json: true });
    await q('insert into daily_challenges (day, data) values ($1::date, $2) on conflict (day) do nothing', [day, data]);
    row = await one('select data from daily_challenges where day = $1::date', [day]);
  }
  return { day, ...row.data };
}

learnRouter.get(
  '/daily',
  h(async (req) => {
    const challenge = await todaysChallenge();
    const solved = await one('select language from daily_solves where user_id = $1 and day = $2::date', [req.user.id, challenge.day]);
    const solvers = await one('select count(*)::int as n from daily_solves where day = $1::date', [challenge.day]);
    return { challenge, solved: Boolean(solved), solvers: solvers.n };
  })
);

learnRouter.post(
  '/daily/check',
  h(async (req) => {
    const code = clean(req.body.code, 10000);
    if (!code) fail(400, 'Write your solution first.');
    const language = pickLang(req.body.language);
    const challenge = await todaysChallenge();
    const result = await gemini({
      system: checkPrompt({ challenge: JSON.stringify(challenge), language: LANG_LABEL[language] }),
      messages: [{ role: 'user', content: code }],
      json: true,
    });
    let xp = 0;
    if (result.correct) {
      const first = await one(
        'insert into daily_solves (user_id, day, language) values ($1, $2::date, $3) on conflict do nothing returning 1',
        [req.user.id, challenge.day, language]
      );
      if (first) {
        xp = XP.daily;
        await awardXp(req.user.id, xp, { reason: 'Daily challenge', stat: 'solved', language });
      }
    }
    return { correct: Boolean(result.correct), feedback: result.feedback || '', xp };
  })
);

// ---------- Quiz ----------
learnRouter.post(
  '/quiz',
  h(async (req) => {
    const topic = clean(req.body.topic, 100) || 'loops';
    const language = pickLang(req.body.language);
    const quiz = await gemini({
      system: 'You write accurate programming quizzes. Output strict JSON only.',
      messages: [{ role: 'user', content: quizPrompt({ topic, language: LANG_LABEL[language], level: pickLevel(req.body.level) }) }],
      json: true,
    });
    if (!Array.isArray(quiz.questions) || !quiz.questions.length) fail(502, 'Quiz generation failed. Try again.');
    quiz.questions = quiz.questions.slice(0, 5).filter((x) => Array.isArray(x.options) && x.options.length >= 2);
    return quiz;
  })
);

learnRouter.post(
  '/quiz/complete',
  h(async (req) => {
    const total = Math.min(Math.max(intId(req.body.total || 1), 1), 10);
    const score = Math.min(Math.max(Number.parseInt(req.body.score, 10) || 0, 0), total);
    const xp = score * XP.quizCorrect;
    const profile = await awardXp(req.user.id, xp, { reason: 'Quiz', stat: 'quizzes', language: pickLang(req.body.language) });
    return { xp, profile };
  })
);

// ---------- Roadmaps ----------
learnRouter.post(
  '/roadmap/toggle',
  h(async (req) => {
    const language = pickLang(req.body.language);
    const topicId = clean(req.body.topicId, 40);
    if (!topicId) fail(400, 'Topic required');
    const removed = await one(
      'delete from roadmap_progress where user_id = $1 and language = $2 and topic_id = $3 returning 1',
      [req.user.id, language, topicId]
    );
    if (!removed) {
      await q('insert into roadmap_progress (user_id, language, topic_id) values ($1,$2,$3)', [req.user.id, language, topicId]);
      await awardXp(req.user.id, XP.roadmap, { reason: 'Roadmap topic', language });
    }
    return { done: !removed };
  })
);

// ---------- Leaderboard ----------
learnRouter.get(
  '/leaderboard',
  h(async (req) => {
    if (req.query.period === 'all') {
      return q(`select id, name, role, xp, streak_count as streak from users order by xp desc, id limit 25`);
    }
    return q(
      `select u.id, u.name, u.role, sum(e.amount)::int as xp, u.streak_count as streak
       from xp_events e join users u on u.id = e.user_id
       where e.created_at >= date_trunc('week', now())
       group by u.id order by xp desc limit 25`
    );
  })
);

// ---------- Bookmarked notes (CRUD) ----------
learnRouter.get(
  '/notes',
  h(async (req) => q('select id, title, content, source, created_at as "createdAt" from notes where user_id = $1 order by id desc', [req.user.id]))
);

learnRouter.post(
  '/notes',
  h(async (req) => {
    const content = clean(req.body.content, 20000);
    if (!content) fail(400, 'Nothing to save.');
    return one(
      'insert into notes (user_id, title, content, source) values ($1,$2,$3,$4) returning id, title, content, source, created_at as "createdAt"',
      [req.user.id, clean(req.body.title, 120), content, clean(req.body.source, 40) || 'AI Tutor']
    );
  })
);

learnRouter.delete(
  '/notes/:id',
  h(async (req) => {
    await q('delete from notes where id = $1 and user_id = $2', [intId(req.params.id), req.user.id]);
  })
);

// ---------- Admin (RBAC: admin only) ----------
learnRouter.get(
  '/admin/users',
  requireRole('admin'),
  h(async () =>
    q(`select id, name, email, role, xp, questions, posts, created_at as "createdAt", last_seen as "lastSeen" from users order by id`)
  )
);

learnRouter.put(
  '/admin/users/:id/role',
  requireRole('admin'),
  h(async (req) => {
    const id = intId(req.params.id);
    const role = req.body.role;
    if (!['student', 'mentor', 'admin'].includes(role)) fail(400, 'Invalid role');
    if (id === req.user.id) fail(400, "You can't change your own role.");
    const row = await one('update users set role = $1 where id = $2 returning id, role', [role, id]);
    if (!row) fail(404, 'User not found');
    return row;
  })
);

learnRouter.get(
  '/admin/overview',
  requireRole('admin'),
  h(async () =>
    one(`select (select count(*)::int from users) as users, (select count(*)::int from projects) as projects,
      (select count(*)::int from chat_messages where role = 'user') as questions,
      (select count(*)::int from room_messages) as posts`)
  )
);
