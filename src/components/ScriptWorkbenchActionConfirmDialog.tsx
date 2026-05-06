type Props = {
  open: boolean;
  title: string;
  lines: string[];
  onClose: () => void;
  onConfirm: () => void;
};

export function ScriptWorkbenchActionConfirmDialog({
  open,
  title,
  lines,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;
  return (
    <div className="scriptActionConfirmBackdrop" role="presentation" onClick={onClose}>
      <div
        className="scriptActionConfirmPanel"
        role="dialog"
        aria-modal="true"
        aria-label={title || "确认操作"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="scriptActionConfirmTitle">{title || "确认操作"}</div>
        <div className="scriptActionConfirmBody">
          {lines.map((line, idx) => (
            <div key={`${idx}-${line}`} className="scriptActionConfirmLine">
              {line}
            </div>
          ))}
        </div>
        <div className="scriptActionConfirmActions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btnDanger" onClick={onConfirm}>
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
}
