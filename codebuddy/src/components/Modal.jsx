import { useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

export default function Modal({ title, onClose, children, width = 480 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon: Icon = Sparkles, title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={30} strokeWidth={1.6} />
      </div>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}
