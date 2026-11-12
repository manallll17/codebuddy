import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOnline } from '../context/SocketContext';
import { timeAgo } from '../lib/utils';
import Avatar from '../components/Avatar';
import Spinner from '../components/Spinner';

export default function Admin() {
  const { user } = useAuth();
  const online = useOnline();
  const [users, setUsers] = useState(null);
  const [overview, setOverview] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/admin/users').then(setUsers).catch((e) => toast.error(e.message));
    api.get('/admin/overview').then(setOverview).catch(() => {});
  }, []);

  const setRole = async (id, role) => {
    try {
      await api.put(`/admin/users/${id}/role`, { role });
      setUsers((u) => u.map((x) => (x.id === id ? { ...x, role } : x)));
      toast.success('Role updated');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const s = search.toLowerCase();
  const shown = users?.filter((u) => !s || u.name.toLowerCase().includes(s) || u.email.includes(s));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>🛡️ Admin panel</h1>
          <p className="muted">Role-based access control: promote students to mentors or admins.</p>
        </div>
        <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search users…" />
      </div>
      {overview && (
        <div className="stat-grid">
          {[
            ['👤', 'Users', overview.users],
            ['🟢', 'Online now', online.length],
            ['📁', 'Projects', overview.projects],
            ['❓', 'AI questions', overview.questions],
          ].map(([i, l, v]) => (
            <div key={l} className="card stat">
              <span className="stat-icon">{i}</span>
              <div>
                <div className="stat-value">{v}</div>
                <div className="stat-label">{l}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!users ? (
        <Spinner />
      ) : (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>XP</th>
                <th>Last seen</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row gap-sm">
                      <Avatar name={u.name} size={28} online={online.some((o) => o.id === u.id)} /> {u.name}
                    </div>
                  </td>
                  <td className="muted">{u.email}</td>
                  <td>{u.xp}</td>
                  <td className="muted">{online.some((o) => o.id === u.id) ? 'Online' : timeAgo(u.lastSeen)}</td>
                  <td>
                    <select value={u.role} disabled={u.id === user.id} onChange={(e) => setRole(u.id, e.target.value)}>
                      <option value="student">Student</option>
                      <option value="mentor">Mentor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
