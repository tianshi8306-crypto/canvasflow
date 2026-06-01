type Props = {
  label: string;
  onCancel: () => void;
  cancelling?: boolean;
};

/** 图片面板正中胶囊：左进度文案，右停止（对齐 VGP VideoGenerationCenterCapsule） */
export function ImageGenerationCenterCapsule({ label, onCancel, cancelling = false }: Props) {
  return (
    <div className="igpGenCenterCapsuleOverlay" aria-live="polite">
      <div className="igpGenCenterCapsule">
        <span className="igpGenCenterCapsule-label">{label}</span>
        <button
          type="button"
          className="igpGenCenterCapsule-stop nodrag nopan"
          onClick={onCancel}
          disabled={cancelling}
        >
          {cancelling ? "停止中" : "停止"}
        </button>
      </div>
    </div>
  );
}
