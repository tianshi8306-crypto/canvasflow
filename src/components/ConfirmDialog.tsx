import { useEffect } from "react";
import { useCanvasUiStore } from "@/store/canvasUiStore";

export function ConfirmDialog() {
  const confirmDialog = useCanvasUiStore((s) => s.confirmDialog);
  const closeConfirmDialog = useCanvasUiStore((s) => s.closeConfirmDialog);

  useEffect(() => {
    if (!confirmDialog?.open) return;

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeConfirmDialog();
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [confirmDialog?.open, closeConfirmDialog]);

  if (!confirmDialog?.open) return null;

  const confirmLabel = confirmDialog.confirmLabel ?? "删除";
  const saveLabel = confirmDialog.saveLabel;
  const onSave = confirmDialog.onSave;

  return (
    <>
      <div className="confirmDialogOverlay" onClick={closeConfirmDialog} />
      <div className="confirmDialog" role="dialog" aria-modal="true">
        <h3 className="confirmDialogTitle">{confirmDialog.title}</h3>
        <p className="confirmDialogMessage">{confirmDialog.message}</p>
        <div className="confirmDialogBtns">
          <button
            type="button"
            className="confirmDialogBtn confirmDialogBtn--cancel"
            onClick={() => {
              confirmDialog.onCancel();
              closeConfirmDialog();
            }}
          >
            取消
          </button>
          {onSave && saveLabel ? (
            <button
              type="button"
              className="confirmDialogBtn confirmDialogBtn--primary"
              onClick={() => {
                void Promise.resolve(onSave()).finally(() => closeConfirmDialog());
              }}
            >
              {saveLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={
              confirmLabel === "关闭"
                ? "confirmDialogBtn confirmDialogBtn--confirm"
                : "confirmDialogBtn confirmDialogBtn--danger"
            }
            onClick={() => {
              confirmDialog.onConfirm();
              closeConfirmDialog();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
