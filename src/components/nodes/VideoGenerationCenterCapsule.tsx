type Props = {
  label: string;
  onCancel: () => void;
  cancelling?: boolean;
  showCancel?: boolean;
};

/** 面板正中胶囊条：左进度文案，右取消 */
export function VideoGenerationCenterCapsule({
  label,
  onCancel,
  cancelling = false,
  showCancel = true,
}: Props) {
  return (
    <div className="videoGenCenterCapsuleOverlay" aria-live="polite">
      <div className="videoGenCenterCapsule">
        <span className="videoGenCenterCapsule-label">{label}</span>
        {showCancel ? (
          <button
            type="button"
            className="videoGenCenterCapsule-cancel"
            onClick={onCancel}
            disabled={cancelling}
          >
            {cancelling ? "取消中" : "取消"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
