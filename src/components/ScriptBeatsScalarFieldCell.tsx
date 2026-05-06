import type { ScriptBeat } from "@/lib/types";
import { extractCameraMove, toSceneTags } from "@/lib/scriptWorkbenchSceneTags";
import { importSingleProjectMedia } from "@/lib/scriptMediaImport";
import {
  CAMERA_MOVE_OPTIONS,
  EMOTION_OPTIONS,
  patchRow,
  SHOT_TYPE_OPTIONS,
  TEXTAREA_KEYS,
  type ScriptBeatStringKey,
  type ScriptBeatsTableVariant,
  type TableColKey,
} from "@/lib/scriptBeatsTableModel";

type Props = {
  beat: ScriptBeat;
  rowIndex: number;
  normRows: ScriptBeat[];
  colKey: TableColKey;
  variant: ScriptBeatsTableVariant;
  descRows: number;
  projectPath?: string | null;
  onStatusText?: (msg: string) => void;
  onPersistRows: (next: ScriptBeat[]) => void;
};

export function ScriptBeatsScalarFieldCell({
  beat,
  rowIndex,
  normRows,
  colKey,
  variant,
  descRows,
  projectPath,
  onStatusText,
  onPersistRows,
}: Props) {
  const fieldKey = colKey as ScriptBeatStringKey;
  const value = (beat[fieldKey] ?? "") as string;

  if (TEXTAREA_KEYS.has(fieldKey)) {
    return (
      <textarea
        rows={descRows}
        value={value}
        onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}
      />
    );
  }

  if (fieldKey === "shotSize") {
    return (
      <select value={value} onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}>
        <option value="">选择景别</option>
        {SHOT_TYPE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (fieldKey === "emotion") {
    return (
      <select value={value} onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}>
        <option value="">选择情绪</option>
        {EMOTION_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (fieldKey === "sceneTags") {
    return (
      <select
        value={extractCameraMove(value)}
        onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, toSceneTags(e.target.value)))}
      >
        <option value="">选择运镜</option>
        {CAMERA_MOVE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  const mono =
    fieldKey === "shotNumber" ||
    fieldKey === "durationHint" ||
    String(fieldKey).endsWith("Image") ||
    fieldKey === "reference";
  const canImportMedia = variant === "fullscreen" && (String(fieldKey).endsWith("Image") || fieldKey === "reference");
  const importLabel = String(fieldKey).endsWith("Image") ? "选图" : "选视频";
  const importKind = String(fieldKey).endsWith("Image") ? "image" : "video";

  const importForCell = () => {
    if (!canImportMedia) return;
    void (async () => {
      const relPath = await importSingleProjectMedia(projectPath, importKind, onStatusText);
      if (!relPath) return;
      onPersistRows(patchRow(normRows, rowIndex, fieldKey, relPath));
    })();
  };

  if (canImportMedia) {
    return (
      <div className="scriptTableMediaCell">
        <input
          className={mono ? "mono" : undefined}
          value={value}
          onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}
        />
        <button type="button" className="btn" onClick={importForCell} title="选择文件并自动导入到 assets">
          {importLabel}
        </button>
      </div>
    );
  }

  return (
    <input
      className={mono ? "mono" : undefined}
      value={value}
      onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}
    />
  );
}
