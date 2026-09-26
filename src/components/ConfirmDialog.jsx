export default function ConfirmDialog({ open, title, text, confirmText = 'تأكيد', danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={onCancel}>
      <div className="dialog-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-icon">!</div>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="dialog-actions">
          <button className="btn ghost" type="button" onClick={onCancel}>إلغاء</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} type="button" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
