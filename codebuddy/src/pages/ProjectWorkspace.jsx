import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useChannel, useOnline, useSocket, useSocketEvent } from '../context/SocketContext';
import { LANGUAGES, langById, ROLE_INFO } from '../lib/constants';
import { clock, copy, timeAgo } from '../lib/utils';
import Markdown from '../components/Markdown';
import CodeEditor from '../components/CodeEditor';
import Avatar, { RoleBadge } from '../components/Avatar';
import Spinner, { TypingDots } from '../components/Spinner';
import Modal, { Empty } from '../components/Modal';
import { Bot, Folder, FolderOpen, Activity, Users, MessagesSquare, Pin, FileCode, Copy, Send, X, Trash2, Eye, Pencil, Plus, Sparkles } from 'lucide-react';

const RANK = { viewer: 1, editor: 2, owner: 3 };

export default function ProjectWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const online = useOnline();
  const onlineIds = useMemo(() => new Set(online.map((o) => o.id)), [online]);

  const [project, setProject] = useState(null);
  const [ai, setAi] = useState([]);
  const [team, setTeam] = useState([]);
  const [files, setFiles] = useState([]);
  const [activity, setActivity] = useState([]);
  const [tab, setTab] = useState('ai');
  const [thinking, setThinking] = useState(null);
  const [typing, setTyping] = useState({});
  const [discuss, setDiscuss] = useState(null);
  const [attachFileId, setAttachFileId] = useState('');
  const [mobileTeam, setMobileTeam] = useState(false);

  const role = project?.myRole;
  const canEdit = RANK[role] >= RANK.editor;
  const isOwner = role === 'owner';

  // Initial load
  useEffect(() => {
    let alive = true;
    const base = `/projects/${projectId}`;
    Promise.all([api.get(base), api.get(`${base}/ai`), api.get(`${base}/team`), api.get(`${base}/files`), api.get(`${base}/activity`)])
      .then(([p, a, t, f, act]) => {
        if (!alive) return;
        setProject(p);
        setAi(a);
        setTeam(t);
        setFiles(f);
        setActivity(act);
      })
      .catch((e) => {
        toast.error(e.message);
        navigate('/projects');
      });
    return () => {
      alive = false;
    };
  }, [projectId, navigate]);

  // ---------- Real-time updates ----------
  useChannel('project', projectId);
  const mine = (d) => String(d?.projectId ?? projectId) === String(projectId);
  useSocketEvent('ai:new', (m) => {
    setAi((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    setThinking(null);
  });
  useSocketEvent('ai:thinking', (d) => setThinking(d));
  useSocketEvent('ai:failed', () => setThinking(null));
  useSocketEvent('ai:update', ({ id, pinned }) => setAi((prev) => prev.map((m) => (m.id === id ? { ...m, pinned } : m))));
  useSocketEvent('team:new', (m) => {
    setTeam((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    setTyping((t) => {
      const n = { ...t };
      delete n[m.userId];
      return n;
    });
  });
  useSocketEvent('typing', (d) => mine(d) && d.userId !== user.id && setTyping((t) => ({ ...t, [d.userId]: { name: d.name, at: Date.now() } })));
  useSocketEvent('file:update', (f) => setFiles((prev) => [...prev.filter((x) => x.id !== f.id), f].sort((a, b) => a.name.localeCompare(b.name))));
  useSocketEvent('file:delete', ({ id }) => setFiles((prev) => prev.filter((x) => x.id !== id)));
  useSocketEvent('activity:new', (a) => setActivity((prev) => [a, ...prev].slice(0, 60)));
  useSocketEvent('members:update', (members) =>
    setProject((p) => p && { ...p, members, myRole: members.find((m) => m.id === user.id)?.role || p.myRole })
  );
  useSocketEvent('project:update', (d) => setProject((p) => p && { ...p, ...d }));
  useSocketEvent('project:deleted', () => {
    toast('This project was deleted');
    navigate('/projects');
  });
  useSocketEvent('project:removed', (d) => {
    if (String(d.projectId) !== String(projectId)) return;
    toast('You were removed from this project');
    navigate('/projects');
  });

  // Expire "typing…" after 3 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setTyping((t) => {
        const now = Date.now();
        const n = Object.fromEntries(Object.entries(t).filter(([, v]) => now - v.at < 3000));
        return Object.keys(n).length === Object.keys(t).length ? t : n;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const emitTyping = useRef(0);
  const onTyping = useCallback(() => {
    if (Date.now() - emitTyping.current > 1500) {
      emitTyping.current = Date.now();
      socket?.emit('typing', { projectId: Number(projectId) });
    }
  }, [socket, projectId]);

  if (!project) return <Spinner full />;

  const startDiscussion = (m) => {
    setDiscuss(m);
    setMobileTeam(true);
  };
  const jumpToAi = (id) => {
    setTab('ai');
    setTimeout(() => document.getElementById(`ai-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };
  const askAboutFile = (fileId) => {
    setAttachFileId(String(fileId));
    setTab('ai');
  };

  const onlineMembers = project.members.filter((m) => onlineIds.has(m.id));

  return (
    <div className="workspace">
      <header className="ws-head card">
        <div className="grow">
          <div className="row gap-sm wrap">
            <h1>{project.name}</h1>
            <span className="lang-pill">{langById(project.language).label}</span>
            <RoleBadge role={role} />
          </div>
          <p className="muted small clamp-2">{project.description || 'No description yet.'}</p>
        </div>
        <div className="ws-members" onClick={() => setTab('members')} title="Members">
          <div className="avatar-stack">
            {project.members.slice(0, 5).map((m) => (
              <Avatar key={m.id} name={m.name} size={32} online={onlineIds.has(m.id)} />
            ))}
          </div>
          <small className="muted">
            {onlineMembers.length}/{project.members.length} online
          </small>
        </div>
        <button className="btn btn-ghost btn-sm team-toggle" onClick={() => setMobileTeam((v) => !v)}>
          <MessagesSquare size={15} /> Team chat
        </button>
      </header>

      <div className={`ws-body ${mobileTeam ? 'show-team' : ''}`}>
        <section className="ws-main card">
          <div className="tabs">
            {[
              ['ai', Bot, 'Shared AI chat'],
              ['files', Folder, `Files (${files.length})`],
              ['activity', Activity, 'Activity'],
              ['members', Users, `Members (${project.members.length})`],
            ].map(([id, Icon, label]) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          {tab === 'ai' && (
            <AiPanel
              projectId={projectId}
              project={project}
              messages={ai}
              files={files}
              canEdit={canEdit}
              thinking={thinking}
              attachFileId={attachFileId}
              setAttachFileId={setAttachFileId}
              onDiscuss={startDiscussion}
            />
          )}
          {tab === 'files' && <FilesPanel projectId={projectId} files={files} canEdit={canEdit} onAsk={askAboutFile} />}
          {tab === 'activity' && <ActivityPanel items={activity} />}
          {tab === 'members' && <MembersPanel project={project} isOwner={isOwner} onlineIds={onlineIds} me={user.id} />}
        </section>

        <TeamChat
          projectId={projectId}
          messages={team}
          me={user.id}
          typing={Object.values(typing)}
          onTyping={onTyping}
          discuss={discuss}
          clearDiscuss={() => setDiscuss(null)}
          jumpToAi={jumpToAi}
          onlineIds={onlineIds}
          close={() => setMobileTeam(false)}
        />
      </div>
    </div>
  );
}

// ---------- Shared AI chat ----------
function AiPanel({ projectId, project, messages, files, canEdit, thinking, attachFileId, setAttachFileId, onDiscuss }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const bottom = useRef(null);
  const pinned = messages.filter((m) => m.pinned);
  const list = showPinned ? pinned : messages;
  const navigate = useNavigate();

  useEffect(() => {
    if (!showPinned) bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, thinking, showPinned]);

  const ask = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      await api.post(`/projects/${projectId}/ai`, { question: q, fileId: attachFileId || undefined });
      setQ('');
      setAttachFileId('');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pin = (m) => api.put(`/projects/${projectId}/ai/${m.id}/pin`).catch((e) => toast.error(e.message));

  return (
    <div className="panel">
      <div className="row between pinned-bar">
        <span className="muted small">Everyone in the project sees these questions and answers live.</span>
        <button className={`chip-btn ${showPinned ? 'active' : ''}`} onClick={() => setShowPinned((v) => !v)}>
          <Pin size={13} /> Pinned ({pinned.length})
        </button>
      </div>
      <div className="panel-scroll">
        {list.length === 0 && (
          <Empty icon={showPinned ? Pin : Bot} title={showPinned ? 'No pinned answers yet' : 'Ask the first question'}>
            {showPinned ? 'Pin the best AI answers so the whole team can find them.' : 'The AI already knows your project description and language.'}
          </Empty>
        )}
        {list.map((m) => (
          <article key={m.id} id={`ai-${m.id}`} className={`ai-card ${m.pinned ? 'pinned' : ''}`}>
            <div className="ai-q">
              <Avatar name={m.userName} size={28} />
              <div className="grow">
                <div className="small">
                  <strong>{m.userName}</strong> <span className="muted">asked · {timeAgo(m.createdAt)}</span>
                  {m.fileName && (
                    <span className="badge">
                      <FileCode size={11} /> {m.fileName}
                    </span>
                  )}
                </div>
                <div className="question">{m.question}</div>
              </div>
              {m.pinned && <Pin size={16} className="pin-mark" />}
            </div>
            <div className="ai-a">
              <Markdown onOpenCode={(code, lang) => navigate('/editor', { state: { code, language: LANGUAGES.some((l) => l.id === lang) ? lang : project.language } })}>
                {m.answer}
              </Markdown>
            </div>
            <div className="msg-actions">
              <button onClick={() => onDiscuss(m)}>
                <MessagesSquare size={13} /> Discuss this
              </button>
              {canEdit && (
                <button onClick={() => pin(m)}>
                  <Pin size={13} /> {m.pinned ? 'Unpin' : 'Pin'}
                </button>
              )}
              <button onClick={async () => toast.success((await copy(m.answer)) ? 'Copied' : 'Copy failed')}>
                <Copy size={13} /> Copy
              </button>
            </div>
          </article>
        ))}
        {thinking && (
          <div className="thinking-banner">
            <Bot size={15} /> <strong>{thinking.userName}</strong> asked: “{thinking.question.slice(0, 80)}” <TypingDots />
          </div>
        )}
        <div ref={bottom} />
      </div>
      {canEdit ? (
        <div className="composer-box">
          <textarea
            value={q}
            rows={2}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Ask CodeBuddy about ${project.name}…`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
          />
          <div className="composer-actions">
            <select value={attachFileId} onChange={(e) => setAttachFileId(e.target.value)} title="Attach a project file">
              <option value="">No file attached</option>
              {files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <div className="grow" />
            <button className="btn btn-primary" onClick={ask} disabled={busy || !q.trim()}>
              {busy ? 'Asking…' : <>Ask AI <Send size={14} /></>}
            </button>
          </div>
        </div>
      ) : (
        <div className="readonly-note">
          <Eye size={15} /> You are a viewer – you can read everything and join the team chat, but only editors can ask the AI.
        </div>
      )}
    </div>
  );
}

// ---------- Team discussion chat ----------
function TeamChat({ projectId, messages, me, typing, onTyping, discuss, clearDiscuss, jumpToAi, onlineIds, close }) {
  const [text, setText] = useState('');
  const bottom = useRef(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typing.length]);

  const send = async () => {
    if (!text.trim()) return;
    const body = { text, refAiId: discuss?.id };
    setText('');
    clearDiscuss();
    try {
      await api.post(`/projects/${projectId}/team`, body);
    } catch (e) {
      toast.error(e.message);
      setText(body.text);
    }
  };

  return (
    <aside className="team-chat card">
      <div className="row between team-head">
        <h3 className="h-ico">
          <MessagesSquare size={17} /> Team discussion
        </h3>
        <button className="icon-btn tiny team-close" onClick={close}>
          <X size={15} />
        </button>
      </div>
      <div className="panel-scroll">
        {messages.length === 0 && <p className="muted small center">Discuss AI answers, plan changes and split work here.</p>}
        {messages.map((m, i) => {
          const own = m.userId === me;
          const grouped = messages[i - 1]?.userId === m.userId && !m.refAiId;
          return (
            <div key={m.id} className={`tmsg ${own ? 'own' : ''} ${grouped ? 'grouped' : ''}`}>
              {!grouped && !own && <Avatar name={m.userName} size={26} online={onlineIds.has(m.userId)} />}
              <div className="tbubble">
                {!grouped && !own && <div className="tname">{m.userName}</div>}
                {m.refAiId && (
                  <button className="quote" onClick={() => jumpToAi(m.refAiId)}>
                    Re: {m.refQuestion?.slice(0, 90) || 'an AI answer'}
                  </button>
                )}
                <div className="ttext">{m.text}</div>
                <div className="ttime">{clock(m.createdAt)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <div className="typing-line">
        {typing.length > 0 && (
          <>
            {typing.map((t) => t.name.split(' ')[0]).join(', ')} {typing.length > 1 ? 'are' : 'is'} typing <TypingDots />
          </>
        )}
      </div>
      {discuss && (
        <div className="discuss-chip">
          <span className="truncate">Discussing: {discuss.question}</span>
          <button className="icon-btn tiny" onClick={clearDiscuss}>
            <X size={13} />
          </button>
        </div>
      )}
      <div className="team-input">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={discuss ? 'What do you think about this answer?' : 'Message your team…'}
        />
        <button className="btn btn-primary btn-sm" onClick={send} disabled={!text.trim()}>
          <Send size={15} />
        </button>
      </div>
    </aside>
  );
}

// ---------- Shared files ----------
function FilesPanel({ projectId, files, canEdit, onAsk }) {
  const [activeId, setActiveId] = useState(files[0]?.id || null);
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);
  const active = files.find((f) => f.id === activeId);

  useEffect(() => {
    if (active && !dirty) setDraft(active.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, active?.updatedAt]);

  const open = (f) => {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    setDirty(false);
    setActiveId(f.id);
    setDraft(f.content);
  };
  const save = async () => {
    try {
      await api.put(`/projects/${projectId}/files/${active.id}`, { content: draft });
      setDirty(false);
      toast.success('Saved – your team sees it instantly');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const remove = async () => {
    if (!confirm(`Delete ${active.name}?`)) return;
    await api.del(`/projects/${projectId}/files/${active.id}`).catch((e) => toast.error(e.message));
    setActiveId(null);
  };

  return (
    <div className="panel files">
      <div className="file-list">
        {canEdit && (
          <button className="btn btn-ghost btn-sm btn-block" onClick={() => setCreating(true)}>
            <Plus size={14} /> New file
          </button>
        )}
        {files.length === 0 && <p className="muted small center">No files yet.</p>}
        {files.map((f) => (
          <button key={f.id} className={`file-item ${f.id === activeId ? 'active' : ''}`} onClick={() => open(f)}>
            <FileCode size={14} /> <span className="truncate">{f.name}</span>
          </button>
        ))}
      </div>
      <div className="file-view">
        {!active ? (
          <Empty icon={FolderOpen} title="Shared code files">
            Keep your project's code here. Everyone can open it, and you can ask the AI about any file.
          </Empty>
        ) : (
          <>
            <div className="editor-toolbar">
              <strong>{active.name}</strong>
              <small className="muted">
                {dirty ? '• unsaved changes' : `saved ${timeAgo(active.updatedAt)}${active.updatedBy ? ` by ${active.updatedBy}` : ''}`}
              </small>
              <div className="grow" />
              <button className="btn btn-ghost btn-sm" onClick={() => onAsk(active.id)}>
                <Sparkles size={14} /> Ask AI about this file
              </button>
              {canEdit && (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={remove}>
                    <Trash2 size={14} />
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={save} disabled={!dirty}>
                    Save
                  </button>
                </>
              )}
            </div>
            <CodeEditor
              value={draft}
              onChange={(v) => {
                setDraft(v);
                setDirty(true);
              }}
              language={active.language}
              readOnly={!canEdit}
              height="calc(100% - 48px)"
            />
          </>
        )}
      </div>
      {creating && (
        <NewFile
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={(f) => {
            setCreating(false);
            setActiveId(f.id);
            setDraft(f.content);
          }}
        />
      )}
    </div>
  );
}

function NewFile({ projectId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('python');
  const submit = async (e) => {
    e.preventDefault();
    try {
      const f = await api.post(`/projects/${projectId}/files`, { name, language, content: langById(language).starter });
      onCreated(f);
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <Modal title="New file" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label>
          File name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main.java" required />
        </label>
        <label>
          Language
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary">Create file</button>
      </form>
    </Modal>
  );
}

// ---------- Activity feed ----------
function ActivityPanel({ items }) {
  return (
    <div className="panel">
      <div className="panel-scroll">
        {items.length === 0 && <p className="muted center">No activity yet.</p>}
        <ul className="timeline">
          {items.map((a) => (
            <li key={a.id}>
              <span className="dot" />
              <div>
                <div>{a.text}</div>
                <small className="muted">{timeAgo(a.createdAt)}</small>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- Members & roles (RBAC) ----------
function MembersPanel({ project, isOwner, onlineIds, me }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [editing, setEditing] = useState(false);
  const base = `/projects/${project.id}`;

  const invite = async (e) => {
    e.preventDefault();
    try {
      await api.post(`${base}/members`, { email, role });
      setEmail('');
      toast.success('Member added');
    } catch (err) {
      toast.error(err.message);
    }
  };
  const changeRole = (uid, r) => api.put(`${base}/members/${uid}`, { role: r }).catch((e) => toast.error(e.message));
  const remove = async (m) => {
    const self = m.id === me;
    if (!confirm(self ? 'Leave this project?' : `Remove ${m.name}?`)) return;
    try {
      await api.del(`${base}/members/${m.id}`);
      if (self) navigate('/projects');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const deleteProject = async () => {
    if (!confirm('Delete this project for everyone? This cannot be undone.')) return;
    await api.del(base).catch((e) => toast.error(e.message));
    navigate('/projects');
  };

  return (
    <div className="panel">
      <div className="panel-scroll stack">
        {isOwner && (
          <form className="invite" onSubmit={invite}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" required />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="btn btn-primary">Invite</button>
          </form>
        )}
        <div className="member-list">
          {project.members.map((m) => (
            <div key={m.id} className="member">
              <Avatar name={m.name} size={36} online={onlineIds.has(m.id)} />
              <div className="grow">
                <div>
                  <strong>{m.name}</strong> {m.id === me && <span className="muted small">(you)</span>}
                </div>
                <small className="muted">
                  {onlineIds.has(m.id) ? 'Online now' : `Last seen ${timeAgo(m.lastSeen)}`} · {m.email}
                </small>
              </div>
              {isOwner && m.role !== 'owner' ? (
                <>
                  <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button className="icon-btn tiny" onClick={() => remove(m)} title="Remove">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <RoleBadge role={m.role} />
              )}
            </div>
          ))}
        </div>
        <div className="role-legend">
          {Object.entries(ROLE_INFO).map(([r, d]) => (
            <div key={r}>
              <RoleBadge role={r} /> <span className="muted small">{d}</span>
            </div>
          ))}
        </div>
        <div className="row gap-sm wrap">
          {isOwner ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                <Pencil size={13} /> Edit details
              </button>
              <button className="btn btn-danger btn-sm" onClick={deleteProject}>
                Delete project
              </button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => remove({ id: me })}>
              Leave project
            </button>
          )}
        </div>
      </div>
      {editing && <EditProject project={project} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditProject({ project, onClose }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/projects/${project.id}`, { name, description });
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <Modal title="Edit project" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Description (AI context)
          <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button className="btn btn-primary">Save</button>
      </form>
    </Modal>
  );
}
