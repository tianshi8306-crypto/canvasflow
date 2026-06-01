import { useState } from "react";
import {
  exportFormatLabel,
  TIMELINE_EXPORT_FORMATS,
  type TimelineExportFormat,
} from "@/lib/compose/timelineExportFormat";
import {
  exportEncodeSummary,
  type TimelineExportEncodeSettings,
} from "@/lib/compose/timelineExportEncode";
import { ComposeEditorExportSettings } from "@/components/compose/ComposeEditorExportSettings";
import { IconExportChevron } from "@/components/compose/composeEditorIcons";

type Props = {
  format: TimelineExportFormat;
  onFormatChange: (format: TimelineExportFormat) => void;
  encode: TimelineExportEncodeSettings;
  onEncodeChange: (next: TimelineExportEncodeSettings) => void;
  onExport: () => void;
  disabled: boolean;
  running: boolean;
  outputTitle: string;
};

export function ComposeEditorExportMenu({
  format,
  onFormatChange,
  encode,
  onEncodeChange,
  onExport,
  disabled,
  running,
  outputTitle,
}: Props) {
  const short = format.toUpperCase();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const encodeHint = exportEncodeSummary(encode);

  return (
    <div className="composeEditorExportWrap">
    <div className="composeEditorExportGroup">
      <button
        type="button"
        className={`composeEditorExportBtn${running ? " composeEditorExportBtn--running" : ""}`}
        onClick={onExport}
        disabled={disabled}
        title={`${outputTitle}\n${encodeHint}`}
      >
        <span>导出 {short}</span>
        <IconExportChevron />
      </button>
      <button
        type="button"
        className={`composeEditorExportGear${settingsOpen ? " composeEditorExportGear--open" : ""}`}
        onClick={() => setSettingsOpen((v) => !v)}
        disabled={disabled || running}
        aria-expanded={settingsOpen}
        aria-label="导出编码设置"
        title={encodeHint}
      >
        设置
      </button>
      <select
        className="composeEditorExportFormat"
        value={format}
        onChange={(e) => onFormatChange(e.target.value as TimelineExportFormat)}
        disabled={disabled || running}
        aria-label="导出格式"
        title={exportFormatLabel(format)}
      >
        {TIMELINE_EXPORT_FORMATS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
    {settingsOpen ? (
      <ComposeEditorExportSettings
        format={format}
        encode={encode}
        onChange={onEncodeChange}
        disabled={disabled || running}
      />
    ) : null}
    </div>
  );
}
