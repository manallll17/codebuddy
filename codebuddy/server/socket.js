import { Server } from 'socket.io';
import { one, q } from './db.js';
import { verifyToken } from './auth.js';
import { ROOM_IDS } from './util.js';

let io = null;
const online = new Map(); // userId -> { id, name, role, sockets }

export const emitTo = (room, event, data) => io?.to(room).emit(event, data);
export const onlineUsers = () => [...online.values()].map(({ id, name, role }) => ({ id, name, role }));
const broadcastPresence = () => io?.emit('presence', onlineUsers());

export async function projectRole(projectId, userId) {
  const row = await one('select role from project_members where project_id = $1 and user_id = $2', [projectId, userId]);
  return row?.role || null;
}

export function initSocket(server) {
  io = new Server(server, { cors: { origin: process.env.ALLOWED_ORIGIN || '*' } });

  // Only logged-in users (valid JWT) can open a real-time connection
  io.use(async (socket, next) => {
    try {
      const { id } = verifyToken(socket.handshake.auth?.token);
      const user = await one('select id, name, role from users where id = $1', [id]);
      if (!user) throw new Error();
      socket.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.user;
    socket.join(`user:${u.id}`);
    const entry = online.get(u.id) || { ...u, sockets: 0 };
    entry.sockets += 1;
    online.set(u.id, entry);
    broadcastPresence();

    socket.on('join', async ({ type, id } = {}, ack) => {
      try {
        if (type === 'project') {
          const pid = Number(id);
          if (!(await projectRole(pid, u.id))) throw new Error('Not a member');
          socket.join(`project:${pid}`);
        } else if (type === 'room') {
          if (!ROOM_IDS.includes(id)) throw new Error('Unknown room');
          socket.join(`room:${id}`);
        }
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: e.message });
      }
    });

    socket.on('leave', ({ type, id } = {}) => socket.leave(`${type}:${id}`));

    // "typing…" indicator inside project team chat
    socket.on('typing', ({ projectId } = {}) => {
      const room = `project:${Number(projectId)}`;
      if (socket.rooms.has(room)) socket.to(room).emit('typing', { projectId: Number(projectId), userId: u.id, name: u.name });
    });

    socket.on('presence:get', (ack) => ack?.(onlineUsers()));

    socket.on('disconnect', () => {
      entry.sockets -= 1;
      if (entry.sockets <= 0) {
        online.delete(u.id);
        q('update users set last_seen = now() where id = $1', [u.id]).catch(() => {});
      }
      broadcastPresence();
    });
  });
  return io;
}
