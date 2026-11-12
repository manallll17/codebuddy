import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Bot, Users, Code2, Trophy, Sun, Moon } from 'lucide-react';

const FEATURES = [
  [Bot, 'AI tutor', 'Explain, debug and optimise code in 5 languages'],
  [Users, 'Team projects', 'Ask AI together and discuss in real time'],
  [Code2, 'Run code', 'VS Code-style editor right in your browser'],
  [Trophy, 'Stay motivated', 'Daily challenges, XP, streaks & leaderboard'],
];

export default function AuthPage() {
  const { login, signup } = useAuth();
  const { theme, toggleTheme } = useSettings();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await signup(form.name, form.email, form.password);
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <button className="icon-btn auth-theme" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <section className="auth-hero">
        <div className="brand big">
          <img src="/logo.svg" alt="" />
          <strong>CodeBuddy</strong>
        </div>
        <h1>
          Learn to code with an <span className="grad">AI buddy</span> and your team.
        </h1>
        <p className="muted">
          An AI-powered programming tutor and collaborative coding workspace for students.
        </p>
        <div className="feature-grid">
          {FEATURES.map(([Icon, t, d]) => (
            <div key={t} className="feature">
              <span className="feature-icon">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <div>
                <strong>{t}</strong>
                <small>{d}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="auth-card card">
        <div className="tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Log in
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Sign up
          </button>
        </div>
        <form onSubmit={submit} className="stack">
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          {mode === 'signup' && (
            <label>
              Full name
              <input value={form.name} onChange={set('name')} placeholder="e.g. Shreeja Kadarla" required minLength={2} />
            </label>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@college.edu" required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
          <p className="muted center small">
            {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
            <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
