import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useOnline } from '../context/SocketContext';
import Avatar from './Avatar';
import { levelFromXp } from '../lib/utils';

const NAV = [
  { section: 'Learn' },
  { to: '/', icon: '🏠', label: 'Dashboard', end: true },
  { to: '/tutor', icon: '🤖', label: 'AI Tutor' },
  { to: '/editor', icon: '💻', label: 'Code Editor' },
  { to: '/quiz', icon: '🧠', label: 'Quiz' },
  { to: '/roadmaps', icon: '🗺️', label: 'Roadmaps' },
  { section: 'Collaborate' },
  { to: '/projects', icon: '👥', label: 'Projects' },
  { to: '/community', icon: '💬', label: 'Community' },
  { to: '/leaderboard', icon: '🏆', label: 'Leaderboard' },
  { section: 'You' },
  { to: '/notes', icon: '🔖', label: 'Saved Notes' },
  { to: '/profile', icon: '👤', label: 'Profile' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
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
                <span className="nav-icon">{n.icon}</span>
                {n.label}
              </NavLink>
            )
          )}
          {isAdmin && (
            <NavLink to="/admin" className="nav-link">
              <span className="nav-icon">🛡️</span>Admin
            </NavLink>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="online-pill">
            <span className="status-dot on" /> {online.length} online now
          </div>
          <button className="nav-link logout-link" onClick={logout}>
            <span className="nav-icon">🚪</span>Log out
          </button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Menu">
            ☰
          </button>
          <div className="topbar-spacer" />
          <div className="chip" title={`Best streak: ${user.streak?.best || 0} days`}>
            🔥 <strong>{user.streak?.count || 0}</strong> <span className="hide-sm">day streak</span>
          </div>
          <div className="chip xp-chip" title={`${lvl.toNext} XP to level ${lvl.level + 1}`}>
            ⚡ <strong>{user.xp}</strong> XP
            <span className="lvl">Lv {lvl.level}</span>
          </div>
          <button className="icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
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
