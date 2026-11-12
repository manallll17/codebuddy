import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { LANGUAGES, langById, ROLE_INFO } from '../lib/constants';
import { timeAgo } from '../lib/utils';
import { useSocketEvent } from '../context/SocketContext';
import Modal, { Empty } from '../components/Modal';
import Spinner from '../components/Spinner';
import { RoleBadge } from '../components/Avatar';
import { FolderOpen, Plus, Users, Bot } from 'lucide-react';

export default function Projects() {
  const [projects, setProjects] = useState(null);
  const [creating, setCreating] = useState(false);
  const load = () => api.get('/projects').then(setProjects).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);
  useSocketEvent('project:invited', load);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Team Projects</h1>
          <p className="muted">Create a project, invite teammates, ask AI together and discuss changes in real time.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> New project
        </button>
      </div>

      <div className="role-legend">
        {Object.entries(ROLE_INFO).map(([r, d]) => (
          <div key={r}>
            <RoleBadge role={r} /> <span className="muted small">{d}</span>
          </div>
        ))}
      </div>

      {!projects && <Spinner />}
      {projects?.length === 0 && (
        <Empty icon={FolderOpen} title="No projects yet">
          Start one for your assignment or mini-project and invite your teammates by email.
        </Empty>
      )}
      <div className="project-grid">
        {projects?.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card project-card">
            <div className="row between">
              <span className="lang-pill">{langById(p.language).label}</span>
              <RoleBadge role={p.role} />
            </div>
            <h3>{p.name}</h3>
            <p className="muted clamp-2">{p.description || 'No description'}</p>
            <div className="row between small muted">
              <span className="row gap-sm">
                <Users size={13} /> {p.memberCount} member{p.memberCount === 1 ? '' : 's'} <Bot size={13} /> {p.aiCount} AI answers
              </span>
              <span>{timeAgo(p.createdAt)}</span>
            </div>
          </Link>
        ))}
      </div>
      {creating && <CreateProject onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateProject({ onClose }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', language: 'python', description: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await api.post('/projects', form);
      toast.success('Project created');
      navigate(`/projects/${p.id}`);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal title="Create a project" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label>
          Project name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Library Management System" required />
        </label>
        <label>
          Main language
          <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Description <small className="muted">(the AI uses this as context for every answer)</small>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="A Java console app to issue/return books, track members and fines. Uses OOP and ArrayLists."
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create project'}
        </button>
      </form>
    </Modal>
  );
}
