import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { dateKey, daysAgo, levelFromXp } from '../lib/utils';
import Spinner from '../components/Spinner';
import Avatar from '../components/Avatar';
import { Zap, Flame, MessageCircleQuestion, CircleCheck, Target, TrendingUp, Rocket, Trophy, Bot, Code2, Users, Brain, Map, User, ArrowRight } from 'lucide-react';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [daily, setDaily] = useState(null);
  const [dailyErr, setDailyErr] = useState('');
  const [stats, setStats] = useState(null);
  const [board, setBoard] = useState([]);
  const lvl = levelFromXp(user.xp);

  useEffect(() => {
    api.get('/daily').then(setDaily).catch((e) => setDailyErr(e.message));
    api.get('/leaderboard?period=week').then((b) => setBoard(b.slice(0, 5))).catch(() => {});
  }, []);
  useEffect(() => {
    api.get('/me/stats').then(setStats).catch(() => {});
  }, [user.xp]);

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = daysAgo(6 - i);
    const key = dateKey(d);
    return { day: d.toLocaleDateString([], { weekday: 'short' }), xp: stats?.weekly.find((w) => w.day === key)?.xp || 0 };
  });

  const cards = [
    { icon: Zap, label: 'Total XP', value: user.xp, sub: `Level ${lvl.level}` },
    { icon: Flame, label: 'Streak', value: `${user.streak?.count || 0}d`, sub: `Best ${user.streak?.best || 0} days` },
    { icon: MessageCircleQuestion, label: 'Questions asked', value: user.stats.questions, sub: 'to CodeBuddy' },
    { icon: CircleCheck, label: 'Challenges solved', value: user.stats.solved, sub: `${user.stats.quizzes} quizzes taken` },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className="muted">Ready to level up your coding today?</p>
        </div>
        <div className="level-box">
          <div className="row between small">
            <span>Level {lvl.level}</span>
            <span className="muted">{lvl.toNext} XP to next</span>
          </div>
          <div className="progress">
            <div style={{ width: `${lvl.progress}%` }} />
          </div>
        </div>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="card stat">
            <span className="stat-icon">
              <c.icon size={22} strokeWidth={1.8} />
            </span>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
              <small className="muted">{c.sub}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card daily">
          <div className="row between">
            <h2 className="h-ico">
              <Target size={18} /> Daily Challenge
            </h2>
            {daily?.solved && <span className="badge badge-success">Solved</span>}
          </div>
          {!daily && !dailyErr && <Spinner label="Generating today's challenge…" />}
          {dailyErr && <p className="error-text">{dailyErr}</p>}
          {daily && (
            <>
              <h3>{daily.challenge.title}</h3>
              <div className="row gap-sm wrap">
                <span className={`badge badge-${daily.challenge.difficulty === 'Easy' ? 'success' : 'warn'}`}>{daily.challenge.difficulty}</span>
                <span className="badge">{daily.challenge.topic}</span>
                <span className="badge">
                  <Users size={12} /> {daily.solvers} solved today
                </span>
              </div>
              <p className="clamp-3">{daily.challenge.statement}</p>
              <button className="btn btn-primary" onClick={() => navigate('/editor', { state: { daily: true } })}>
                {daily.solved ? 'Practice again' : 'Solve now · +20 XP'}
              </button>
            </>
          )}
        </div>

        <div className="card">
          <h2 className="h-ico">
            <TrendingUp size={18} /> Your XP this week
          </h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={week}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                <Tooltip cursor={{ fill: 'var(--hover)' }} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }} />
                <Bar dataKey="xp" fill="url(#xpGrad)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 className="h-ico">
            <Rocket size={18} /> Quick actions
          </h2>
          <div className="quick-grid">
            {[
              ['/tutor', Bot, 'Ask AI Tutor'],
              ['/editor', Code2, 'Open Editor'],
              ['/projects', Users, 'Team Projects'],
              ['/quiz', Brain, 'Take a Quiz'],
              ['/learning-paths', Map, 'Learning Paths'],
              ['/profile', User, 'My Progress'],
            ].map(([to, Icon, label]) => (
              <Link key={to} to={to} className="quick">
                <Icon size={24} strokeWidth={1.7} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="row between">
            <h2 className="h-ico">
              <Trophy size={18} /> Top this week
            </h2>
            <Link to="/leaderboard" className="small row gap-sm">
              See all <ArrowRight size={14} />
            </Link>
          </div>
          {board.length === 0 && <p className="muted">No XP earned yet this week. Be the first!</p>}
          <ol className="mini-board">
            {board.map((b, i) => (
              <li key={b.id} className={b.id === user.id ? 'me-row' : ''}>
                <span className={`rank r${i + 1}`}>{i + 1}</span>
                <Avatar name={b.name} size={28} />
                <span className="grow">{b.name}</span>
                <strong>{b.xp} XP</strong>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
