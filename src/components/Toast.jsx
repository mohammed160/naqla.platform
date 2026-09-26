import { useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className={`toast ${type}`} role="status">
      <span>{type === 'success' ? '✓' : '!'}</span>
      <p>{message}</p>
      <button type="button" onClick={onClose}>×</button>
    </div>
  );
}
