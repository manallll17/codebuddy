import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useChannel, useOnline, useSocketEvent } from '../context/SocketContext';
import { ROOMS } from '../lib/constants';
import { clock, timeAgo } from '../lib/utils';
import Avatar, { RoleBadge } from '../components/Avatar';
import Markdown from '../components/Markdown';
import Spinner from '../components/Spinner';

export default function Community() {
  const { roomId = 'general' } = useParams();
  const navigate = useNavigate();
  const { user, isStaff } = useAuth();
  const online = useOnline();
  const room = ROOMS.find((r) => r.id === roomId) || ROOMS[0];
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [sort, setSort] = useState('new');
  const bottom = useRef(null);

  useEffect(() => {
    setMessages(null);
    api.get(`/community/rooms/${room.id}/messages`).then(setMessages).catch((e) => toast.error(e.message));
  }, [room.id]);

  useChannel('room', room.id);
  useSocketEvent('room:new', (m) => m.room === room.id && setMessages((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, { ...m, upvoted: false }] : prev)));
  useSocketEvent('room:update', ({ id, upvotes }) => setMessages((prev) => prev?.map((m) => (m.id === id ? { ...m, upvotes } : m))));
  useSocketEvent('room:delete', ({ id }) => setMessages((prev) => prev?.filter((m) => m.id !== id)));

  useEffect(() => {
    if (sort === 'new') bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length, sort]);

  const shown = useMemo(() => {
    if (!messages) return [];
    return sort === 'top' ? [...messages].sort((a, b) => b.upvotes - a.upvotes || b.id - a.id) : messages;
  }, [messages, sort]);

  const send = async () => {
    if (!text.trim()) return;
    const t = text;
    setText('');
    try {
      const m = await api.post(`/community/rooms/${room.id}/messages`, { text: t });
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch (e) {
      toast.error(e.message);
      setText(t);
    }
  };

  const upvote = async (m) => {
    try {
      const r = await api.post(`/community/messages/${m.id}/upvote`);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, upvotes: r.upvotes, upvoted: r.upvoted } : x)));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async (m) => {
    if (!confirm('Delete this message?')) return;
    await api.del(`/community/messages/${m.id}`).catch((e) => toast.error(e.message));
  };

  return (
    <div className="community">
      <aside className="rooms card">
        <h3>Rooms</h3>
        {ROOMS.map((r) => (
          <button key={r.id} className={`room-link ${r.id === room.id ? 'active' : ''}`} onClick={() => navigate(`/community/${r.id}`)}>
            <span>#</span> {r.label}
          </button>
        ))}
      </aside>

      <section className="room card">
        <div className="room-head">
          <div>
            <h2>#{room.label}</h2>
            <small className="muted">{room.desc}</small>
          </div>
          <div className="segmented">
            <button className={sort === 'new' ? 'active' : ''} onClick={() => setSort('new')}>
              Latest
            </button>
            <button className={sort === 'top' ? 'active' : ''} onClick={() => setSort('top')}>
              Top voted
            </button>
          </div>
        </div>
        <div className="panel-scroll">
          {!messages && <Spinner />}
          {messages?.length === 0 && <p className="muted center">No messages yet – start the conversation! 👋</p>}
          {shown.map((m) => {
            const staff = m.userRole === 'mentor' || m.userRole === 'admin';
            return (
              <div key={m.id} className={`cmsg ${staff ? 'staff' : ''}`}>
                <Avatar name={m.userName} size={34} online={online.some((o) => o.id === m.userId)} />
                <div className="grow">
                  <div className="cmeta">
                    <strong>{m.userName}</strong> <RoleBadge role={m.userRole} />
                    <span className="muted small" title={new Date(m.createdAt).toLocaleString()}>
                      {timeAgo(m.createdAt)} · {clock(m.createdAt)}
                    </span>
                  </div>
                  {m.sharedQuestion && <div className="shared-tag">🤖 Shared AI answer to: “{m.sharedQuestion.slice(0, 120)}”</div>}
                  <div className={m.sharedQuestion ? 'shared-body' : ''}>
                    <Markdown>{m.text}</Markdown>
                  </div>
                  <div className="msg-actions">
                    <button className={m.upvoted ? 'voted' : ''} onClick={() => upvote(m)} title={m.userId === user.id ? '' : 'Upvote gives the author +2 XP'}>
                      ▲ {m.upvotes}
                    </button>
                    {(m.userId === user.id || isStaff) && <button onClick={() => remove(m)}>🗑 Delete</button>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
        <div className="team-input">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={`Message #${room.label} – Markdown and \`code\` supported`}
          />
          <button className="btn btn-primary btn-sm" onClick={send} disabled={!text.trim()}>
            Send
          </button>
        </div>
      </section>

      <aside className="online card">
        <h3>🟢 Online ({online.length})</h3>
        {online.map((o) => (
          <div key={o.id} className="online-user">
            <Avatar name={o.name} size={28} online />
            <span className="truncate grow">{o.name}</span>
            <RoleBadge role={o.role} />
          </div>
        ))}
      </aside>
    </div>
  );
}
