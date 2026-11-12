import { Router } from 'express';
import { q, one } from '../db.js';
import { h, fail, clean, intId, ROOM_IDS } from '../util.js';
import { emitTo, onlineUsers } from '../socket.js';
import { awardXp, XP } from '../xp.js';

export const communityRouter = Router();

const room = (id) => {
  if (!ROOM_IDS.includes(id)) fail(404, 'Room not found');
  return id;
};

const SELECT = (viewerParam) => `select m.id, m.room, m.user_id as "userId", u.name as "userName", u.role as "userRole",
  m.text, m.shared_question as "sharedQuestion", m.created_at as "createdAt",
  (select count(*)::int from room_upvotes v where v.message_id = m.id) as upvotes,
  exists(select 1 from room_upvotes v where v.message_id = m.id and v.user_id = ${viewerParam}) as upvoted
  from room_messages m join users u on u.id = m.user_id`;

communityRouter.get('/online', h(async () => onlineUsers()));

communityRouter.get(
  '/rooms/:room/messages',
  h(async (req) =>
    q(`select * from (${SELECT('$2')} where m.room = $1 order by m.id desc limit 150) x order by id`, [room(req.params.room), req.user.id])
  )
);

communityRouter.post(
  '/rooms/:room/messages',
  h(async (req) => {
    const r = room(req.params.room);
    const text = clean(req.body.text, 6000);
    if (!text) fail(400, 'Message is empty.');
    const sharedQuestion = req.body.sharedQuestion ? clean(req.body.sharedQuestion, 500) : null;
    const { id } = await one('insert into room_messages (room, user_id, text, shared_question) values ($1,$2,$3,$4) returning id', [
      r, req.user.id, text, sharedQuestion,
    ]);
    const msg = await one(`${SELECT('$2')} where m.id = $1`, [id, -1]);
    emitTo(`room:${r}`, 'room:new', msg);
    await awardXp(req.user.id, XP.post, { reason: 'Community post', stat: 'posts' });
    return { ...msg, upvoted: false };
  })
);

// Toggle upvote; the author earns XP for helpful replies
communityRouter.post(
  '/messages/:id/upvote',
  h(async (req) => {
    const id = intId(req.params.id);
    const msg = await one('select id, room, user_id from room_messages where id = $1', [id]);
    if (!msg) fail(404, 'Message not found');
    const removed = await one('delete from room_upvotes where message_id = $1 and user_id = $2 returning 1', [id, req.user.id]);
    if (!removed) {
      await q('insert into room_upvotes (message_id, user_id) values ($1, $2) on conflict do nothing', [id, req.user.id]);
      if (msg.user_id !== req.user.id) await awardXp(msg.user_id, XP.upvote, { reason: 'Upvoted reply', streak: false });
    }
    const { upvotes } = await one('select count(*)::int as upvotes from room_upvotes where message_id = $1', [id]);
    emitTo(`room:${msg.room}`, 'room:update', { id, upvotes });
    return { id, upvotes, upvoted: !removed };
  })
);

// Authors can delete their own messages; mentors/admins can moderate any message
communityRouter.delete(
  '/messages/:id',
  h(async (req) => {
    const id = intId(req.params.id);
    const msg = await one('select id, room, user_id from room_messages where id = $1', [id]);
    if (!msg) fail(404, 'Message not found');
    const staff = ['mentor', 'admin'].includes(req.user.role);
    if (msg.user_id !== req.user.id && !staff) fail(403, 'You can only delete your own messages.');
    await q('delete from room_messages where id = $1', [id]);
    emitTo(`room:${msg.room}`, 'room:delete', { id });
  })
);
