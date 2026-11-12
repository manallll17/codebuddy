import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { LANGUAGES, langById } from '../lib/constants';
import CodeEditor from '../components/CodeEditor';
import Markdown from '../components/Markdown';
import Spinner from '../components/Spinner';

export default function Playground() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage, level } = useSettings();
  const initial = location.state;
  const [tab, setTab] = useState('editor');
  const [lang, setLang] = useState(initial?.language || language);
  const [code, setCode] = useState(initial?.code || langById(initial?.language || language).starter);
  const [stdin, setStdin] = useState('');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [daily, setDaily] = useState(null);
  const [showDaily, setShowDaily] = useState(Boolean(initial?.daily));
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState(null);

  useEffect(() => {
    if (initial) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showDaily && !daily) api.get('/daily').then(setDaily).catch((e) => toast.error(e.message));
  }, [showDaily, daily]);

  const changeLang = (id) => {
    const isStarter = LANGUAGES.some((l) => l.starter.trim() === code.trim()) || !code.trim();
    setLang(id);
    setLanguage(id);
    if (isStarter) setCode(langById(id).starter);
  };

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      setResult(await api.post('/tutor/run', { language: lang, code, stdin }));
    } catch (e) {
      setResult({ status: 'Error', ok: false, stderr: e.message });
    } finally {
      setRunning(false);
    }
  };

  const errorText = result && !result.ok ? [result.compileOutput, result.stderr, result.message].filter(Boolean).join('\n') : '';

  const askAI = (mode, extra = '') =>
    navigate('/tutor', {
      state: {
        mode,
        language: lang,
        autoSend: true,
        prefill: `\`\`\`${lang}\n${code}\n\`\`\`${extra}`,
      },
    });

  const submitDaily = async () => {
    setChecking(true);
    setVerdict(null);
    try {
      const v = await api.post('/daily/check', { code, language: lang });
      setVerdict(v);
      if (v.correct) setDaily((d) => d && { ...d, solved: true });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="page page-full">
      <div className="page-head">
        <div>
          <h1>💻 Code Editor</h1>
          <p className="muted">Write, run and fix code in your browser. Python, Java, C, C++ and JavaScript supported.</p>
        </div>
        <div className="tabs inline">
          <button className={tab === 'editor' ? 'active' : ''} onClick={() => setTab('editor')}>
            Editor
          </button>
          <button className={tab === 'compare' ? 'active' : ''} onClick={() => setTab('compare')}>
            ⚖️ Compare solutions
          </button>
        </div>
      </div>

      {tab === 'compare' ? (
        <Compare lang={lang} setLang={changeLang} level={level} />
      ) : (
        <div className={`playground ${showDaily ? 'with-daily' : ''}`}>
          {showDaily && (
            <aside className="card daily-panel">
              <div className="row between">
                <h3>🎯 Daily challenge</h3>
                <button className="icon-btn tiny" onClick={() => setShowDaily(false)}>
                  ✕
                </button>
              </div>
              {!daily ? (
                <Spinner />
              ) : (
                <div className="stack-sm">
                  <h4>{daily.challenge.title}</h4>
                  <div className="row gap-sm wrap">
                    <span className="badge">{daily.challenge.difficulty}</span>
                    {daily.solved && <span className="badge badge-success">Solved ✓</span>}
                  </div>
                  <p>{daily.challenge.statement}</p>
                  {daily.challenge.inputFormat && (
                    <p className="small">
                      <strong>Input:</strong> {daily.challenge.inputFormat}
                    </p>
                  )}
                  {daily.challenge.outputFormat && (
                    <p className="small">
                      <strong>Output:</strong> {daily.challenge.outputFormat}
                    </p>
                  )}
                  {daily.challenge.examples?.map((ex, i) => (
                    <div key={i} className="example">
                      <div>
                        <small>Input</small>
                        <pre>{ex.input}</pre>
                      </div>
                      <div>
                        <small>Output</small>
                        <pre>{ex.output}</pre>
                      </div>
                    </div>
                  ))}
                  <details>
                    <summary>💡 Hint</summary>
                    <p className="small">{daily.challenge.hint}</p>
                  </details>
                  <button className="btn btn-primary" onClick={submitDaily} disabled={checking}>
                    {checking ? 'AI is checking…' : 'Submit solution'}
                  </button>
                  {verdict && (
                    <div className={`verdict ${verdict.correct ? 'ok' : 'bad'}`}>
                      <strong>{verdict.correct ? `✅ Correct!${verdict.xp ? ` +${verdict.xp} XP` : ''}` : '❌ Not quite yet'}</strong>
                      <p className="small">{verdict.feedback}</p>
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}

          <div className="editor-col">
            <div className="editor-toolbar">
              <select value={lang} onChange={(e) => changeLang(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              {!showDaily && (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowDaily(true)}>
                  🎯 Daily challenge
                </button>
              )}
              <div className="grow" />
              <button className="btn btn-ghost btn-sm" onClick={() => askAI('linebyline')}>
                📜 Explain
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => askAI('optimize')}>
                ⚡ Optimise
              </button>
              <button className="btn btn-success" onClick={run} disabled={running}>
                {running ? 'Running…' : '▶ Run'}
              </button>
            </div>
            <CodeEditor value={code} onChange={setCode} language={lang} height="min(62vh, 560px)" />
            {lang === 'java' && <small className="muted">Tip: keep your Java class named Main.</small>}
          </div>

          <div className="io-col">
            <div className="card io">
              <h4>Input (stdin)</h4>
              <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Type program input here…" rows={4} />
            </div>
            <div className="card io output">
              <div className="row between">
                <h4>Output</h4>
                {result && (
                  <span className={`badge ${result.ok ? 'badge-success' : 'badge-danger'}`}>
                    {result.status}
                    {result.time ? ` · ${result.time}s` : ''}
                  </span>
                )}
              </div>
              {running && <Spinner label="Running your code…" />}
              {!running && !result && <p className="muted small">Press ▶ Run to see the output here.</p>}
              {result && (
                <>
                  {result.stdout && <pre className="out">{result.stdout}</pre>}
                  {errorText && <pre className="out err">{errorText}</pre>}
                  {!result.stdout && !errorText && <p className="muted small">(no output)</p>}
                  {errorText && (
                    <button
                      className="btn btn-primary btn-block"
                      onClick={() => askAI('debug', `\n\nError message:\n\`\`\`\n${errorText.slice(0, 3000)}\n\`\`\``)}
                    >
                      🤖 Fix with CodeBuddy
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Compare({ lang, setLang, level }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const compare = async () => {
    setBusy(true);
    setReply('');
    try {
      setReply((await api.post('/tutor/compare', { a, b, language: lang, level })).reply);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <div className="editor-toolbar">
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="muted small">Paste two solutions to the same problem – CodeBuddy tells you which is better and why.</span>
        <div className="grow" />
        <button className="btn btn-primary" onClick={compare} disabled={busy || !a.trim() || !b.trim()}>
          {busy ? 'Comparing…' : '⚖️ Compare'}
        </button>
      </div>
      <div className="grid-2">
        <div>
          <h4>Solution A</h4>
          <CodeEditor value={a} onChange={setA} language={lang} height="320px" />
        </div>
        <div>
          <h4>Solution B</h4>
          <CodeEditor value={b} onChange={setB} language={lang} height="320px" />
        </div>
      </div>
      {busy && <Spinner label="CodeBuddy is comparing…" />}
      {reply && (
        <div className="card">
          <Markdown>{reply}</Markdown>
        </div>
      )}
    </div>
  );
}
