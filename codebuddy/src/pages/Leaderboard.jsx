import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOnline } from '../context/SocketContext';
import Avatar from '../components/Avatar';
import { Flag, Flame } from 'lucide-react';
import Spinner from '../components/Spinner';
import { Empty } from '../components/Modal';
import { levelFromXp } from '../lib/utils';

export default function Leaderboard() {
  const { user } = useAuth();
  const online = useOnline();
  const [period, setPeriod] = useState('week');
  const [rows, setRows] = useState(null);

  useEffect(() => {
    setRows(null);
    api.get(`/leaderboard?period=${period}`).then(setRows).catch((e) => toast.error(e.message));
  }, [period, user.xp]);

  const podium = rows?.slice(0, 3) || [];

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="muted">Earn XP by asking questions, solving challenges, taking quizzes and helping others.</p>
        </div>
        <div className="segmented">
          <button className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>
            This week
          </button>
          <button className={period === 'all' ? 'active' : ''} onClick={() => setPeriod('all')}>
            All time
          </button>
        </div>
      </div>

      {!rows && <Spinner />}
      {rows?.length === 0 && <Empty icon={Flag} title="No XP this week yet">Ask the AI tutor a question to get on the board!</Empty>}

      {podium.length > 0 && (
        <div className="podium">
          {[1, 0, 2].map((i) =>
            podium[i] ? (
              <div key={podium[i].id} className={`podium-spot p${i + 1}`}>
                <div className={`medal m${i + 1}`}>{i + 1}</div>
                <Avatar name={podium[i].name} size={i === 0 ? 64 : 52} online={online.some((o) => o.id === podium[i].id)} />
                <strong className="truncate">{podium[i].name}</strong>
                <span>{podium[i].xp} XP</span>
                <div className="podium-bar" />
              </div>
            ) : (
              <div key={i} />
            )
          )}
        </div>
      )}

      {rows?.length > 0 && (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                {period === 'all' && <th>Level</th>}
                <th>Streak</th>
                <th className="right">XP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={r.id === user.id ? 'me-row' : ''}>
                  <td>{i + 1}</td>
                  <td>
                    <div className="row gap-sm">
                      <Avatar name={r.name} size={28} online={online.some((o) => o.id === r.id)} />
                      {r.name}
                    </div>
                  </td>
                  {period === 'all' && <td>Lv {levelFromXp(r.xp).level}</td>}
                  <td>
                    <span className="row gap-sm">
                      <Flame size={14} className="ico-flame" /> {r.streak}
                    </span>
                  </td>
                  <td className="right">
                    <strong>{r.xp}</strong>
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
