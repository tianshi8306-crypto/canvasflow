import { TtvAspectWireframe } from "@/components/nodes/TtvAspectWireframe";
import { MULTIMODAL_LIMITS } from "@/lib/seedance/validation";
import {
  TEXT_TO_VIDEO_ASPECT_IDS,
  TEXT_TO_VIDEO_ASPECT_LABEL,
  type TextToVideoAspectId,
} from "@/lib/videoNodeTypes";

export type VideoOutputSettingsSections = {
  aspect?: boolean;
  resolution?: boolean;
  duration?: boolean;
  durationSmart?: boolean;
  audio?: boolean;
  watermark?: boolean;
  noSubtitles?: boolean;
};

const DEFAULT_SECTIONS: Required<VideoOutputSettingsSections> = {
  aspect: true,
  resolution: true,
  duration: true,
  durationSmart: true,
  audio: true,
  watermark: true,
  noSubtitles: false,
};

type Props = {
  aspect: TextToVideoAspectId;
  resolution: string;
  durationSec: number;
  isSmartDuration: boolean;
  watermark: boolean;
  generateAudio?: boolean;
  noSubtitles?: boolean;
  supportedResolutions?: readonly ("480P" | "720P" | "1080P")[];
  durationMinSec?: number;
  durationMaxSec?: number;
  sections?: VideoOutputSettingsSections;
  onAspect: (id: TextToVideoAspectId) => void;
  onResolution: (r: "480P" | "720P" | "1080P") => void;
  onSmartDurationToggle: () => void;
  onDuration: (sec: number) => void;
  onWatermarkToggle: () => void;
  onGenerateAudioToggle?: () => void;
  onNoSubtitlesToggle?: () => void;
};

/** 视频输出参数浮层内容（比例网格 + 清晰度 + 时长 + 水印 + 生成音频） */
export function VideoOutputSettingsContent({
  aspect,
  resolution,
  durationSec,
  isSmartDuration,
  watermark,
  generateAudio = true,
  noSubtitles = false,
  supportedResolutions = ["480P", "720P", "1080P"],
  durationMinSec = MULTIMODAL_LIMITS.OUTPUT_DURATION_MIN,
  durationMaxSec = MULTIMODAL_LIMITS.OUTPUT_DURATION_MAX,
  sections,
  onAspect,
  onResolution,
  onSmartDurationToggle,
  onDuration,
  onWatermarkToggle,
  onGenerateAudioToggle,
  onNoSubtitlesToggle,
}: Props) {
  const s = { ...DEFAULT_SECTIONS, ...sections };

  return (
    <>
      {s.aspect ? (
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
      ) : null}

      {s.resolution ? (
        <section className="vos-section">
          <div className="vos-heading">清晰度</div>
          <div className="vos-res-row">
            {(["480P", "720P", "1080P"] as const).map((r) => {
              const supported = supportedResolutions.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  className={`vos-res-btn ${resolution === r ? "vos-res-btn--active" : ""}${!supported ? " vos-res-btn--disabled" : ""}`}
                  disabled={!supported}
                  title={!supported ? "当前模型不支持该清晰度" : undefined}
                  onClick={() => supported && onResolution(r)}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {s.durationSmart || s.duration ? (
        <section className="vos-section">
          <div className="vos-heading">{s.durationSmart && !s.duration ? "时长与水印" : "时长"}</div>
          {s.durationSmart ? (
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
          ) : null}
          {s.duration ? (
            <>
              <div className="vos-row">
                <span className="vos-row-label">视频时长</span>
                <span className="vos-duration-val">{isSmartDuration ? "智能" : `${durationSec}s`}</span>
              </div>
              <input
                type="range"
                className="vos-slider"
                min={durationMinSec}
                max={durationMaxSec}
                step={1}
                value={isSmartDuration ? durationMinSec : durationSec}
                disabled={isSmartDuration}
                onChange={(e) => onDuration(Number(e.target.value))}
              />
            </>
          ) : null}
          {s.watermark ? (
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
          ) : null}
          {s.audio && onGenerateAudioToggle ? (
            <div className="vos-row">
              <span className="vos-row-label">生成音频</span>
              <button
                type="button"
                className={`vos-toggle ${generateAudio ? "vos-toggle--on" : ""}`}
                onClick={onGenerateAudioToggle}
                aria-pressed={generateAudio}
              >
                <span className="vos-toggle-thumb" />
              </button>
            </div>
          ) : null}
          {s.noSubtitles && onNoSubtitlesToggle ? (
            <div className="vos-row">
              <span className="vos-row-label">去字幕</span>
              <button
                type="button"
                className={`vos-toggle ${noSubtitles ? "vos-toggle--on" : ""}`}
                onClick={onNoSubtitlesToggle}
                aria-pressed={noSubtitles}
              >
                <span className="vos-toggle-thumb" />
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {s.noSubtitles && onNoSubtitlesToggle && !s.duration && !s.durationSmart && !s.watermark && !s.audio ? (
        <section className="vos-section">
          <div className="vos-heading">去字幕</div>
          <div className="vos-row">
            <span className="vos-row-label">生成时去字幕</span>
            <button
              type="button"
              className={`vos-toggle ${noSubtitles ? "vos-toggle--on" : ""}`}
              onClick={onNoSubtitlesToggle}
              aria-pressed={noSubtitles}
            >
              <span className="vos-toggle-thumb" />
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
