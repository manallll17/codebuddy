import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { LANGUAGES, LEVELS, MODES, ROOMS, CODE_EXTENSIONS, langFromFile, langById } from '../lib/constants';
import { cleanText, copy, readFileText, timeAgo } from '../lib/utils';
import Markdown from '../components/Markdown';
import Modal, { Empty } from '../components/Modal';
import { TypingDots } from '../components/Spinner';

const SUGGESTIONS = [
  { mode: 'explain', text: 'What is recursion? Show a simple example.' },
  { mode: 'explain', text: 'Difference between a list and a tuple' },
  { mode: 'practice', text: 'Arrays' },
  { mode: 'chat', text: 'How should I start learning DSA?' },
];

export default function Tutor() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, level, setLevel, eli5, setEli5 } = useSettings();

  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState('chat');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [share, setShare] = useState(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const autoSent = useRef(false);

  const loadChats = () => api.get('/tutor/chats').then(setChats).catch(() => {});
  useEffect(() => {
    loadChats();
  }, []);

  // Load a saved conversation
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    setLoadingChat(true);
    api
      .get(`/tutor/chats/${chatId}`)
      .then((c) => {
        setMessages(c.messages);
        setLanguage(c.language);
        setLevel(c.level);
      })
      .catch((e) => {
        toast.error(e.message);
        navigate('/tutor');
      })
      .finally(() => setLoadingChat(false));
    setShowHistory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Pre-filled questions from other pages (Editor "Fix with CodeBuddy", Roadmaps "Learn with AI")
  useEffect(() => {
    const s = location.state;
    if (!s?.prefill || autoSent.current) return;
    autoSent.current = true;
    if (s.mode) setMode(s.mode);
    if (s.language) setLanguage(s.language);
    if (s.autoSend) send(s.prefill, s.mode || 'chat', null, s.language);
    else setInput(s.prefill);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text = input, m = mode, currentChat = chatId, langOverride) {
    const content = cleanText(text, 15000);
    if (!content || busy) return;
    setInput('');
    setBusy(true);
    const temp = { id: `tmp-${Date.now()}`, role: 'user', content, mode: m, createdAt: Date.now() };
    setMessages((prev) => [...prev, temp]);
    try {
      const res = await api.post('/tutor/ask', { chatId: currentChat || null, content, mode: m, language: langOverride || language, level, eli5 });
      setMessages((prev) => [...prev.filter((x) => x.id !== temp.id), res.userMsg, res.aiMsg]);
      if (!currentChat) navigate(`/tutor/${res.chatId}`, { replace: true });
      loadChats();
    } catch (e) {
      toast.error(e.message);
      setMessages((prev) => prev.filter((x) => x.id !== temp.id));
      setInput(content);
    } finally {
      setBusy(false);
    }
  }

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readFileText(file);
      const lang = langFromFile(file.name);
      if (lang) setLanguage(lang);
      setInput((prev) => `${prev ? prev + '\n\n' : ''}File: ${file.name}\n\`\`\`${lang || ''}\n${text}\n\`\`\``);
      if (mode === 'chat') setMode('debug');
      toast.success(`${file.name} attached – pick an action and send`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const bookmark = async (msg, i) => {
    const question = messages[i - 1]?.content || '';
    try {
      await api.post('/notes', { title: question.slice(0, 100), content: msg.content, source: 'AI Tutor' });
      toast.success('Saved to Notes 🔖');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const removeChat = async (id) => {
    if (!confirm('Delete this conversation?')) return;
    await api.del(`/tutor/chats/${id}`).catch((e) => toast.error(e.message));
    loadChats();
    if (String(id) === chatId) navigate('/tutor');
  };

  const openInEditor = (code, lang) =>
    navigate('/editor', { state: { code, language: LANGUAGES.some((l) => l.id === lang) ? lang : language } });

  const activeMode = MODES.find((m) => m.id === mode);

  return (
    <div className="tutor">
      <aside className={`history ${showHistory ? 'open' : ''}`}>
        <button className="btn btn-primary btn-block" onClick={() => navigate('/tutor')}>
          + New chat
        </button>
        <div className="history-list">
          {chats.length === 0 && <p className="muted small center">Your conversations will appear here.</p>}
          {chats.map((c) => (
            <div key={c.id} className={`history-item ${String(c.id) === chatId ? 'active' : ''}`} onClick={() => navigate(`/tutor/${c.id}`)}>
              <div className="grow">
                <div className="truncate">{c.title}</div>
                <small className="muted">
                  {langById(c.language).label} · {timeAgo(c.updatedAt)}
                </small>
              </div>
              <button
                className="icon-btn tiny"
                onClick={(e) => {
                  e.stopPropagation();
                  removeChat(c.id);
                }}
                title="Delete"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="chat-panel">
        <div className="chat-toolbar">
          <button className="btn btn-ghost btn-sm history-toggle" onClick={() => setShowHistory((v) => !v)}>
            🕘 History
          </button>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language">
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
          <label className="toggle" title="Explain like I'm 5">
            <input type="checkbox" checked={eli5} onChange={(e) => setEli5(e.target.checked)} />
            <span className="toggle-track" />
            🧒 ELI5
          </label>
        </div>

        <div className="messages">
          {loadingChat && <TypingDots />}
          {!loadingChat && messages.length === 0 && (
            <Empty icon="🤖" title="Hi! I'm CodeBuddy, your AI programming tutor.">
              Ask me to explain a concept, debug your code, walk through it line by line, optimise it, or give you a practice question.
              <span className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s.text} className="suggestion" onClick={() => send(s.text, s.mode)}>
                    {MODES.find((m) => m.id === s.mode).label.split(' ')[0]} {s.text}
                  </button>
                ))}
              </span>
            </Empty>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={m.id} className="msg user">
                {m.mode !== 'chat' && <span className="mode-tag">{MODES.find((x) => x.id === m.mode)?.label}</span>}
                <Markdown>{m.content}</Markdown>
              </div>
            ) : (
              <div key={m.id} className="msg ai">
                <div className="msg-avatar">🤖</div>
                <div className="msg-body">
                  <Markdown onOpenCode={openInEditor}>{m.content}</Markdown>
                  <div className="msg-actions">
                    <button onClick={async () => toast.success((await copy(m.content)) ? 'Copied' : 'Copy failed')}>📋 Copy</button>
                    <button onClick={() => bookmark(m, i)}>🔖 Save</button>
                    <button onClick={() => setShare({ answer: m.content, question: messages[i - 1]?.content || '' })}>📣 Share</button>
                    <button onClick={() => send(`Explain your previous answer like I'm 5.`, 'chat')}>🧒 Simpler</button>
                  </div>
                </div>
              </div>
            )
          )}
          {busy && (
            <div className="msg ai">
              <div className="msg-avatar">🤖</div>
              <div className="msg-body thinking">
                CodeBuddy is thinking <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <div className="mode-chips">
            {MODES.map((m) => (
              <button key={m.id} className={`chip-btn ${mode === m.id ? 'active' : ''}`} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="composer-box">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeMode.placeholder}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <div className="composer-actions">
              <input ref={fileRef} type="file" accept={CODE_EXTENSIONS} hidden onChange={onUpload} />
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()} title="Upload a code file">
                📎 Upload code
              </button>
              <span className="muted small hide-sm">Enter to send · Shift+Enter for new line</span>
              <button className="btn btn-primary" onClick={() => send()} disabled={busy || !input.trim()}>
                {busy ? '…' : 'Send ➤'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {share && <ShareModal data={share} defaultRoom={language} onClose={() => setShare(null)} />}
    </div>
  );
}

export function ShareModal({ data, defaultRoom, onClose }) {
  const [room, setRoom] = useState(ROOMS.some((r) => r.id === defaultRoom) ? defaultRoom : 'general');
  const [note, setNote] = useState('');
  const navigate = useNavigate();
  const submit = async () => {
    try {
      const text = `${note ? note + '\n\n' : ''}${data.answer}`;
      await api.post(`/community/rooms/${room}/messages`, { text, sharedQuestion: data.question.slice(0, 500) });
      toast.success('Shared to community');
      onClose();
      navigate(`/community/${room}`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal title="📣 Share AI answer to community" onClose={onClose}>
      <div className="stack">
        <label>
          Room
          <select value={room} onChange={(e) => setRoom(e.target.value)}>
            {ROOMS.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Add a note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. This helped me understand recursion!" />
        </label>
        <div className="quote clamp-3">{data.question}</div>
        <button className="btn btn-primary" onClick={submit}>
          Share
        </button>
      </div>
    </Modal>
  );
}
