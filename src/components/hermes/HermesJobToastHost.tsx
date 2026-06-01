import { useEffect } from "react";
import {
  pushHermesJobToast,
  useHermesJobToastStore,
  type HermesJobToastKind,
} from "@/store/hermesJobToastStore";

const AUTO_DISMISS_MS = 5200;

function HermesJobToastItem({
  id,
  kind,
  message,
}: {
  id: string;
  kind: HermesJobToastKind;
  message: string;
}) {
  const dismiss = useHermesJobToastStore((s) => s.dismiss);

  useEffect(() => {
    const t = window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [dismiss, id]);

  return (
    <div
      className={`hermesJobToast hermesJobToast--${kind}`}
      role="status"
      aria-live="polite"
    >
      <span className="hermesJobToastMessage">{message}</span>
      <button
        type="button"
        className="hermesJobToastDismiss"
        aria-label="关闭通知"
        onClick={() => dismiss(id)}
      >
        ×
      </button>
    </div>
  );
}

/** 画布角 ambient toast，不污染聊天区 */
export function HermesJobToastHost() {
  const toasts = useHermesJobToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="hermesJobToastHost nopan nodrag nowheel" aria-live="polite">
      {toasts.map((t) => (
        <HermesJobToastItem key={t.id} id={t.id} kind={t.kind} message={t.message} />
      ))}
    </div>
  );
}

export { pushHermesJobToast };
