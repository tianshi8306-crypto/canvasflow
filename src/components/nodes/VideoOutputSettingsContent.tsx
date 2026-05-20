import { TtvAspectWireframe } from "@/components/nodes/TtvAspectWireframe";
import { MULTIMODAL_LIMITS } from "@/lib/seedance/validation";
import {
  TEXT_TO_VIDEO_ASPECT_IDS,
  TEXT_TO_VIDEO_ASPECT_LABEL,
  type TextToVideoAspectId,
} from "@/lib/videoNodeTypes";

type Props = {
  aspect: TextToVideoAspectId;
  resolution: string;
  durationSec: number;
  isSmartDuration: boolean;
  watermark: boolean;
  onAspect: (id: TextToVideoAspectId) => void;
  onResolution: (r: "480P" | "720P" | "1080P") => void;
  onSmartDurationToggle: () => void;
  onDuration: (sec: number) => void;
  onWatermarkToggle: () => void;
};

/** 视频输出参数浮层内容（图二：比例网格 + 清晰度 + 时长 + 水印） */
export function VideoOutputSettingsContent({
  aspect,
  resolution,
  durationSec,
  isSmartDuration,
  watermark,
  onAspect,
  onResolution,
  onSmartDurationToggle,
  onDuration,
  onWatermarkToggle,
}: Props) {
  return (
    <>
      <section className="vos-section">
        <div className="vos-heading">比例</div>
        <div className="vos-ratio-grid">
          {TEXT_TO_VIDEO_ASPECT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`vos-ratio-btn ${aspect === id ? "vos-ratio-btn--active" : ""}`}
              onClick={() => onAspect(id)}
            >
              <TtvAspectWireframe id={id} />
              <span>{TEXT_TO_VIDEO_ASPECT_LABEL[id]}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="vos-section">
        <div className="vos-heading">清晰度</div>
        <div className="vos-res-row">
          {(["480P", "720P", "1080P"] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`vos-res-btn ${resolution === r ? "vos-res-btn--active" : ""}`}
              onClick={() => onResolution(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </section>
      <section className="vos-section">
        <div className="vos-row">
          <span className="vos-row-label">智能时长</span>
          <button
            type="button"
            className={`vos-toggle ${isSmartDuration ? "vos-toggle--on" : ""}`}
            onClick={onSmartDurationToggle}
            aria-pressed={isSmartDuration}
          >
            <span className="vos-toggle-thumb" />
          </button>
        </div>
        <div className="vos-row">
          <span className="vos-row-label">视频时长</span>
          <span className="vos-duration-val">{isSmartDuration ? "智能" : `${durationSec}s`}</span>
        </div>
        <input
          type="range"
          className="vos-slider"
          min={MULTIMODAL_LIMITS.OUTPUT_DURATION_MIN}
          max={MULTIMODAL_LIMITS.OUTPUT_DURATION_MAX}
          step={1}
          value={isSmartDuration ? 5 : durationSec}
          disabled={isSmartDuration}
          onChange={(e) => onDuration(Number(e.target.value))}
        />
        <div className="vos-row">
          <span className="vos-row-label">水印</span>
          <button
            type="button"
            className={`vos-toggle ${watermark ? "vos-toggle--on" : ""}`}
            onClick={onWatermarkToggle}
            aria-pressed={watermark}
          >
            <span className="vos-toggle-thumb" />
          </button>
        </div>
      </section>
    </>
  );
}
