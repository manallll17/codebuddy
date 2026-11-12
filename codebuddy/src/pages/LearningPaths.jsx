import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { LANGUAGES, LEARNING_PATHS, langById } from '../lib/constants';
import { Check, Bot, Brain } from 'lucide-react';
import Spinner from '../components/Spinner';

export default function LearningPaths() {
  const navigate = useNavigate();
  const { language, setLanguage } = useSettings();
  const [done, setDone] = useState(null);

  useEffect(() => {
    api
      .get('/me/stats')
      .then((s) => setDone(new Set(s.roadmap.map((r) => `${r.language}:${r.topicId}`))))
      .catch(() => setDone(new Set()));
  }, []);

  const topics = LEARNING_PATHS[language];
  const completed = done ? topics.filter((t) => done.has(`${language}:${t.id}`)).length : 0;
  const pct = Math.round((completed / topics.length) * 100);

  const toggle = async (t) => {
    const key = `${language}:${t.id}`;
    try {
      const r = await api.post('/roadmap/toggle', { language, topicId: t.id });
      setDone((prev) => {
        const n = new Set(prev);
        r.done ? n.add(key) : n.delete(key);
        return n;
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const label = langById(language).label;

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>Learning Paths</h1>
          <p className="muted">Follow a step-by-step path. Tick topics as you learn them (+5 XP each).</p>
        </div>
      </div>
      <div className="tabs inline wrap">
        {LANGUAGES.map((l) => (
          <button key={l.id} className={language === l.id ? 'active' : ''} onClick={() => setLanguage(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="row between">
          <strong>{label} learning path</strong>
          <span className="muted">
            {completed}/{topics.length} topics · {pct}%
          </span>
        </div>
        <div className="progress big">
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>
      {!done ? (
        <Spinner />
      ) : (
        <ol className="roadmap">
          {topics.map((t, i) => {
            const isDone = done.has(`${language}:${t.id}`);
            return (
              <li key={t.id} className={`card road-step ${isDone ? 'done' : ''}`}>
                <button className="check" onClick={() => toggle(t)} aria-label="Mark done">
                  {isDone ? <Check size={18} strokeWidth={3} /> : i + 1}
                </button>
                <div className="grow">
                  <strong>{t.title}</strong>
                  <p className="muted small">{t.desc}</p>
                </div>
                <div className="row gap-sm wrap">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      navigate('/tutor', {
                        state: { mode: 'explain', language, autoSend: true, prefill: `Teach me "${t.title}" in ${label}: ${t.desc}. Include examples.` },
                      })
                    }
                  >
                    <Bot size={14} /> Learn with AI
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/quiz', { state: { topic: `${t.title} in ${label}` } })}>
                    <Brain size={14} /> Quiz me
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
