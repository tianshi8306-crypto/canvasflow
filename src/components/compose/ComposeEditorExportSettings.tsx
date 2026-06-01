import {
  bitratePresetIdFromKbps,
  TIMELINE_EXPORT_BITRATE_PRESETS,
  TIMELINE_EXPORT_RESOLUTIONS,
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

export function ComposeEditorExportSettings({ format, encode, onChange, disabled }: Props) {
  const bitratePreset = bitratePresetIdFromKbps(encode.videoBitrateKbps ?? 0);

  return (
    <div className="composeEditorExportSettings" role="group" aria-label="导出编码设置">
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
