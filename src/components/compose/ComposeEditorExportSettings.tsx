import {
  bitratePresetIdFromKbps,
  PLATFORM_EXPORT_PRESETS,
  TIMELINE_EXPORT_BITRATE_PRESETS,
  TIMELINE_EXPORT_FPS_OPTIONS,
  TIMELINE_EXPORT_RESOLUTIONS,
  type PlatformExportPreset,
  type TimelineExportEncodeSettings,
  type TimelineExportResolution,
} from "@/lib/compose/timelineExportEncode";
import {
  exportFormatSupportsBitrate,
  type TimelineExportFormat,
} from "@/lib/compose/timelineExportFormat";

type Props = {
  format: TimelineExportFormat;
  encode: TimelineExportEncodeSettings;
  onChange: (next: TimelineExportEncodeSettings) => void;
  disabled?: boolean;
};

function presetChipLabel(p: PlatformExportPreset): string {
  return p.label;
}

export function ComposeEditorExportSettings({ format, encode, onChange, disabled }: Props) {
  const bitratePreset = bitratePresetIdFromKbps(encode.videoBitrateKbps ?? 0);

  return (
    <div className="composeEditorExportSettings" role="group" aria-label="导出编码设置">
      {/* 平台预设快捷入口 */}
      <div className="composeEditorExportSettingsPresets">
        {PLATFORM_EXPORT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="composeEditorExportSettingsPresetChip"
            disabled={disabled}
            title={p.hint}
            onClick={() =>
              onChange({
                resolution: p.resolution,
                videoBitrateKbps: p.bitrateKbps,
                fps: p.fps,
              })
            }
          >
            {presetChipLabel(p)}
          </button>
        ))}
      </div>

      <label className="composeEditorExportSettingsField">
        <span>分辨率</span>
        <select
          value={encode.resolution ?? "source"}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...encode,
              resolution: e.target.value as TimelineExportResolution,
            })
          }
        >
          {TIMELINE_EXPORT_RESOLUTIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label className="composeEditorExportSettingsField">
        <span>帧率</span>
        <select
          value={encode.fps ?? "source"}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...encode,
              fps: e.target.value as TimelineExportEncodeSettings["fps"],
            })
          }
        >
          {TIMELINE_EXPORT_FPS_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      {exportFormatSupportsBitrate(format) ? (
        <label className="composeEditorExportSettingsField">
          <span>码率</span>
          <select
            value={bitratePreset === "custom" ? "auto" : bitratePreset}
            disabled={disabled}
            onChange={(e) => {
              const preset = TIMELINE_EXPORT_BITRATE_PRESETS.find((p) => p.id === e.target.value);
              onChange({
                ...encode,
                videoBitrateKbps: preset?.kbps ?? 0,
              });
            }}
          >
            {TIMELINE_EXPORT_BITRATE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className="composeEditorExportSettingsHint">GIF 固定 12fps · 无音轨</span>
      )}
    </div>
  );
}
