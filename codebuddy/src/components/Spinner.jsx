export default function Spinner({ full, label }) {
  return (
    <div className={full ? 'spinner-full' : 'spinner-inline'}>
      <div className="spinner" />
      {label && <span className="muted">{label}</span>}
    </div>
  );
}

export function TypingDots() {
  return (
    <span className="typing-dots">
      <i />
      <i />
      <i />
    </span>
  );
}
