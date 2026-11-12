import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { langById } from '../lib/constants';
import { dateKey, daysAgo, levelFromXp } from '../lib/utils';
import Avatar from '../components/Avatar';
import { Pencil, Zap, Flame, Medal, MessageCircleQuestion, CircleCheck, Brain, Map, CalendarDays, PieChart as PieIcon } from 'lucide-react';
import Spinner from '../components/Spinner';

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

function StreakCalendar({ activity }) {
  const map = Object.fromEntries(activity.map((a) => [a.day, a.count]));
  const weeks = 16;
  const start = daysAgo(weeks * 7 - 1 + new Date().getDay());
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dateKey(d);
    return { key, count: map[key] || 0, future: d > new Date() };
  });
  const lvl = (c) => (c === 0 ? 0 : c < 3 ? 1 : c < 6 ? 2 : c < 10 ? 3 : 4);
  return (
    <div className="calendar">
      {cells.map((c) => (
        <span key={c.key} className={`cal-cell l${c.future ? 'x' : lvl(c.count)}`} title={`${c.key}: ${c.count} activities`} />
      ))}
    </div>
  );
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user.name, bio: user.bio });
  const lvl = levelFromXp(user.xp);

  useEffect(() => {
    api.get('/me/stats').then(setStats).catch((e) => toast.error(e.message));
  }, [user.xp]);

  const save = async (e) => {
    e.preventDefault();
    try {
      setUser(await api.put('/me', form));
      setEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const langData = stats?.languages.map((l) => ({ name: langById(l.language).label, value: l.count })) || [];

  return (
    <div className="page">
      <div className="card profile-head">
        <Avatar name={user.name} size={84} />
        <div className="grow">
          {editing ? (
            <form className="stack-sm" onSubmit={save}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
              <textarea rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="A line about you" />
              <div className="row gap-sm">
                <button className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="row gap-sm wrap">
                <h1>{user.name}</h1>
              </div>
              <p className="muted">{user.bio || user.email}</p>
              <p className="small muted">Member since {new Date(user.createdAt).toLocaleDateString()}</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                <Pencil size={13} /> Edit profile
              </button>
            </>
          )}
        </div>
        <div className="level-ring" style={{ '--p': lvl.progress }}>
          <div>
            <strong>Lv {lvl.level}</strong>
            <small>{user.xp} XP</small>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        {[
          [Zap, 'XP this week', stats?.weekXp ?? '–'],
          [Flame, 'Current streak', `${user.streak.count} days`],
          [Medal, 'Best streak', `${user.streak.best} days`],
          [MessageCircleQuestion, 'Questions asked', user.stats.questions],
          [CircleCheck, 'Challenges solved', user.stats.solved],
          [Brain, 'Quizzes taken', user.stats.quizzes],
          [Map, 'Path topics done', stats?.roadmap.length ?? '–'],
        ].map(([Icon, l, v]) => (
          <div key={l} className="card stat">
            <span className="stat-icon">
              <Icon size={22} strokeWidth={1.8} />
            </span>
            <div>
              <div className="stat-value">{v}</div>
              <div className="stat-label">{l}</div>
            </div>
          </div>
        ))}
      </div>

      {!stats ? (
        <Spinner />
      ) : (
        <div className="grid-2">
          <div className="card">
            <h2 className="h-ico">
              <CalendarDays size={18} /> Activity calendar
            </h2>
            <p className="muted small">Each square is a day – darker means more coding.</p>
            <StreakCalendar activity={stats.activity} />
            <div className="cal-legend small muted">
              Less <span className="cal-cell l0" />
              <span className="cal-cell l1" />
              <span className="cal-cell l2" />
              <span className="cal-cell l3" />
              <span className="cal-cell l4" /> More
            </div>
          </div>
          <div className="card">
            <h2 className="h-ico">
              <PieIcon size={18} /> Languages used
            </h2>
            {langData.length === 0 ? (
              <p className="muted">Ask the tutor a question to see your language mix.</p>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={langData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {langData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
