import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { copy, timeAgo } from '../lib/utils';
import Markdown from '../components/Markdown';
import Spinner from '../components/Spinner';
import { Empty } from '../components/Modal';

export default function Notes() {
  const [notes, setNotes] = useState(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get('/notes').then(setNotes).catch((e) => toast.error(e.message));
  }, []);

  const remove = async (id) => {
    if (!confirm('Delete this note?')) return;
    await api.del(`/notes/${id}`).catch((e) => toast.error(e.message));
    setNotes((n) => n.filter((x) => x.id !== id));
  };

  const s = search.toLowerCase();
  const shown = notes?.filter((n) => !s || n.title.toLowerCase().includes(s) || n.content.toLowerCase().includes(s));

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>🔖 Saved Notes</h1>
          <p className="muted">AI answers you bookmarked, saved in one place for revision.</p>
        </div>
        <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search notes…" />
      </div>
      {!notes && <Spinner />}
      {notes?.length === 0 && <Empty icon="🔖" title="No saved notes yet">Tap “🔖 Save” on any AI answer to keep it here.</Empty>}
      <div className="stack">
        {shown?.map((n) => (
          <div key={n.id} className="card note">
            <div className="row between" onClick={() => setOpen(open === n.id ? null : n.id)} style={{ cursor: 'pointer' }}>
              <div className="grow">
                <strong>{n.title || 'Untitled note'}</strong>
                <div className="muted small">
                  {n.source} · {timeAgo(n.createdAt)}
                </div>
              </div>
              <span>{open === n.id ? '▴' : '▾'}</span>
            </div>
            {open === n.id && (
              <>
                <Markdown>{n.content}</Markdown>
                <div className="msg-actions">
                  <button onClick={async () => toast.success((await copy(n.content)) ? 'Copied' : 'Copy failed')}>📋 Copy</button>
                  <button onClick={() => remove(n.id)}>🗑 Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
