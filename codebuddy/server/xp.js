import { tx } from './db.js';
import { dayStr } from './util.js';
import { emitTo } from './socket.js';
import { PROFILE_COLS, toProfile } from './auth.js';

export const XP = { question: 2, projectQuestion: 2, quizCorrect: 2, daily: 20, roadmap: 5, post: 1, upvote: 2 };
const STATS = ['questions', 'solved', 'quizzes', 'posts'];

/**
 * Awards XP on the server (users can't fake it), updates streak, activity heatmap,
 * language usage and the weekly leaderboard, then pushes the new profile over Socket.io.
 */
export async function awardXp(userId, amount, { reason = 'activity', stat, language, streak = true } = {}) {
  const today = dayStr(0);
  const yesterday = dayStr(-1);
  const statSql = STATS.includes(stat) ? `, ${stat} = ${stat} + 1` : '';
  const streakExpr = `(case when streak_last = $3::date then streak_count
                            when streak_last = $4::date then streak_count + 1 else 1 end)`;

  const profile = await tx(async (c) => {
    const { rows } = streak
      ? await c.query(
          `update users set xp = xp + $2, streak_count = ${streakExpr},
             streak_best = greatest(streak_best, ${streakExpr}), streak_last = $3::date ${statSql}
           where id = $1 returning ${PROFILE_COLS}`,
          [userId, amount, today, yesterday]
        )
      : await c.query(`update users set xp = xp + $2 ${statSql} where id = $1 returning ${PROFILE_COLS}`, [userId, amount]);

    if (streak) {
      await c.query(
        `insert into activity_log (user_id, day, count) values ($1, $2, 1)
         on conflict (user_id, day) do update set count = activity_log.count + 1`,
        [userId, today]
      );
    }
    if (language) {
      await c.query(
        `insert into language_usage (user_id, language, count) values ($1, $2, 1)
         on conflict (user_id, language) do update set count = language_usage.count + 1`,
        [userId, language]
      );
    }
    if (amount > 0) await c.query('insert into xp_events (user_id, amount, reason) values ($1, $2, $3)', [userId, amount, reason]);
    return toProfile(rows[0]);
  });

  emitTo(`user:${userId}`, 'xp', { amount, reason, profile });
  return profile;
}
