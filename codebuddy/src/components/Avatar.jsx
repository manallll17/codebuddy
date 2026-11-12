import { initials, colorFor } from '../lib/utils';

export default function Avatar({ name, size = 34, online }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: colorFor(name) }} title={name}>
      {initials(name)}
      {online !== undefined && <span className={`status-dot ${online ? 'on' : ''}`} />}
    </span>
  );
}

const LABELS = { mentor: '🎓 Mentor', admin: '🛡️ Admin', owner: '👑 Owner', editor: '✏️ Editor', viewer: '👁️ Viewer' };

export function RoleBadge({ role }) {
  if (!role || role === 'student') return null;
  return <span className={`badge badge-${role}`}>{LABELS[role] || role}</span>;
}
