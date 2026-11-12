import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { LANGUAGES, LEVELS } from '../lib/constants';
import Spinner from '../components/Spinner';
import { CircleCheck, CircleX, Trophy, PartyPopper, Dumbbell } from 'lucide-react';

const TOPICS = ['Loops', 'Functions', 'Arrays', 'Strings', 'OOP', 'Recursion', 'Pointers', 'Sorting'];

export default function Quiz() {
  const location = useLocation();
  const { language, setLanguage, level, setLevel } = useSettings();
  const [topic, setTopic] = useState(location.state?.topic || '');
  const [quiz, setQuiz] = useState(null);
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(null);

  const start = async (t = topic) => {
    if (!t.trim()) return toast.error('Pick or type a topic');
    setBusy(true);
    setQuiz(null);
    setDone(null);
    try {
      setQuiz(await api.post('/quiz', { topic: t, language, level }));
      setIdx(0);
      setPicked(null);
      setScore(0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const q = quiz?.questions[idx];
  const choose = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answerIndex) setScore((s) => s + 1);
  };
  const next = async () => {
    if (idx + 1 < quiz.questions.length) {
      setIdx(idx + 1);
      setPicked(null);
      return;
    }
    try {
      const r = await api.post('/quiz/complete', { score, total: quiz.questions.length, language });
      setDone({ score, total: quiz.questions.length, xp: r.xp });
    } catch (e) {
      toast.error(e.message);
      setDone({ score, total: quiz.questions.length, xp: 0 });
    }
  };

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>Quiz Mode</h1>
          <p className="muted">5 AI-generated questions on any topic. Earn 2 XP for every correct answer.</p>
        </div>
      </div>

      {!quiz && !busy && (
        <div className="card stack">
          <div className="row gap-sm wrap">
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <div className="segmented">
              {LEVELS.map((l) => (
                <button key={l.id} className={level === l.id ? 'active' : ''} onClick={() => setLevel(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row gap-sm">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Any topic, e.g. while loops" onKeyDown={(e) => e.key === 'Enter' && start()} />
            <button className="btn btn-primary" onClick={() => start()}>
              Start quiz
            </button>
          </div>
          <div className="row gap-sm wrap">
            {TOPICS.map((t) => (
              <button key={t} className="chip-btn" onClick={() => start(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {busy && (
        <div className="card">
          <Spinner label="Writing your quiz…" />
        </div>
      )}

      {quiz && !done && q && (
        <div className="card quiz">
          <div className="row between">
            <strong>{quiz.title}</strong>
            <span className="muted">
              Question {idx + 1} / {quiz.questions.length} · Score {score}
            </span>
          </div>
          <div className="progress">
            <div style={{ width: `${(idx / quiz.questions.length) * 100}%` }} />
          </div>
          <h2>{q.question}</h2>
          {q.code && <pre className="out">{q.code}</pre>}
          <div className="options">
            {q.options.map((o, i) => {
              const state = picked === null ? '' : i === q.answerIndex ? 'correct' : i === picked ? 'wrong' : 'dim';
              return (
                <button key={i} className={`option ${state}`} onClick={() => choose(i)}>
                  <span className="opt-letter">{'ABCD'[i]}</span> {o}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className={`verdict ${picked === q.answerIndex ? 'ok' : 'bad'}`}>
              <strong className="h-ico">
                {picked === q.answerIndex ? <CircleCheck size={17} /> : <CircleX size={17} />}
                {picked === q.answerIndex ? 'Correct!' : 'Not quite'}
              </strong>
              <p className="small">{q.explanation}</p>
            </div>
          )}
          <button className="btn btn-primary" disabled={picked === null} onClick={next}>
            {idx + 1 < quiz.questions.length ? 'Next question →' : 'Finish quiz'}
          </button>
        </div>
      )}

      {done && (
        <div className="card center stack">
          <div className="big-icon">
            {done.score === done.total ? <Trophy size={44} /> : done.score >= done.total / 2 ? <PartyPopper size={44} /> : <Dumbbell size={44} />}
          </div>
          <h2>
            You scored {done.score} / {done.total}
          </h2>
          <p className="muted">+{done.xp} XP earned</p>
          <div className="row gap-sm center-x">
            <button className="btn btn-primary" onClick={() => start()}>
              Try another on “{topic || quiz.title}”
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setQuiz(null);
                setDone(null);
              }}
            >
              New topic
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
