import { useCallback, useState } from "react";
import {
  downloadAndInstallAppUpdate,
  markUpdateSkipped,
  type PendingAppUpdate,
} from "@/lib/appUpdater";
import "./AppUpdateDialog.css";

type Props = {
  pending: PendingAppUpdate;
  onClose: () => void;
};

export function AppUpdateDialog({ pending, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSkip = useCallback(() => {
    if (busy) return;
    markUpdateSkipped(pending.version);
    onClose();
  }, [busy, onClose, pending.version]);

  const onInstall = useCallback(() => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    void downloadAndInstallAppUpdate(pending.update, setProgress).catch((err) => {
      setBusy(false);
      setProgress(null);
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [busy, pending.update]);

  return (
    <div className="appUpdateDialogRoot" role="dialog" aria-modal="true" aria-label="软件更新">
      <div className="appUpdateDialogOverlay" aria-hidden />
      <div className="appUpdateDialogPanel">
        <h3 className="appUpdateDialogTitle">发现新版本</h3>
        <p className="appUpdateDialogMeta">
          当前版本 {pending.currentVersion} → 新版本 {pending.version}
        </p>
        {pending.notes ? (
          <div className="appUpdateDialogNotes">{pending.notes}</div>
        ) : (
          <p className="appUpdateDialogMeta">下载并安装后将自动重启应用。</p>
        )}
        {busy && progress !== null ? (
          <p className="appUpdateDialogProgress">正在下载更新包… {progress}%</p>
        ) : null}
        {busy && progress === null ? (
          <p className="appUpdateDialogProgress">正在下载更新包…</p>
        ) : null}
        {error ? <p className="appUpdateDialogProgress">{error}</p> : null}
        <div className="appUpdateDialogActions">
          <button
            type="button"
            className="appUpdateDialogBtn"
            disabled={busy}
            onClick={onSkip}
          >
            稍后提醒
          </button>
          <button
            type="button"
            className="appUpdateDialogBtn appUpdateDialogBtn--primary"
            disabled={busy}
            onClick={onInstall}
          >
            {busy ? "更新中…" : "下载并更新"}
          </button>
        </div>
      </div>
    </div>
  );
}
