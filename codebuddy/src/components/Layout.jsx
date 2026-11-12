import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Bot, Code2, Brain, Map, Users, Trophy, User, LogOut, Sun, Moon, Flame, Zap, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useOnline } from '../context/SocketContext';
import Avatar from './Avatar';
import { levelFromXp } from '../lib/utils';

const NAV = [
  { section: 'Learn' },
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/tutor', icon: Bot, label: 'AI Tutor' },
  { to: '/editor', icon: Code2, label: 'Code Editor' },
  { to: '/quiz', icon: Brain, label: 'Quiz' },
  { to: '/learning-paths', icon: Map, label: 'Learning Paths' },
  { section: 'Collaborate' },
  { to: '/projects', icon: Users, label: 'Projects' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { section: 'You' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useSettings();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const lvl = levelFromXp(user.xp);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand" onClick={() => navigate('/')}>
          <img src="/logo.svg" alt="" />
          <div>
            <strong>CodeBuddy</strong>
            <small>AI coding workspace</small>
          </div>
        </div>
        <nav>
          {NAV.map((n, i) =>
            n.section ? (
              <div key={i} className="nav-section">
                {n.section}
              </div>
            ) : (
              <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
                <n.icon size={18} strokeWidth={1.8} />
                {n.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="online-pill">
            <span className="status-dot on" /> {online.length} online now
          </div>
          <button className="nav-link logout-link" onClick={logout}>
            <LogOut size={18} strokeWidth={1.8} />
            Log out
          </button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
          <div className="topbar-spacer" />
          <div className="chip" title={`Best streak: ${user.streak?.best || 0} days`}>
            <Flame size={15} className="ico-flame" /> <strong>{user.streak?.count || 0}</strong> <span className="hide-sm">day streak</span>
          </div>
          <div className="chip xp-chip" title={`${lvl.toNext} XP to level ${lvl.level + 1}`}>
            <Zap size={15} className="ico-zap" /> <strong>{user.xp}</strong> XP
            <span className="lvl">Lv {lvl.level}</span>
          </div>
          <button className="icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NavLink to="/profile" className="me">
            <Avatar name={user.name} size={32} />
            <span className="hide-sm">{user.name.split(' ')[0]}</span>
          </NavLink>
          <button className="btn btn-ghost btn-sm hide-sm" onClick={logout}>
            Log out
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
