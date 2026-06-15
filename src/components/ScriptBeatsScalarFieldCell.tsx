import type { ScriptBeat } from "@/lib/types";
import { importSingleProjectMedia } from "@/lib/scriptMediaImport";
import {
  CAMERA_MOVE_OPTIONS,
  BGM_MOOD_OPTIONS,
  DIALOGUE_TYPE_OPTIONS,
  EMOTION_OPTIONS,
  patchRow,
  SHOT_SIZE_OPTIONS,
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
  /** 只读模式：所有字段展示为纯文本；图片字段保留选图功能 */
  readOnly?: boolean;
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
  readOnly = false,
}: Props) {
  const fieldKey = colKey as ScriptBeatStringKey;
  const value = (beat[fieldKey] ?? "") as string;

  const canImportMedia = variant === "fullscreen" && String(fieldKey).endsWith("Image");

  const importForCell = () => {
    if (!canImportMedia) return;
    void (async () => {
      const relPath = await importSingleProjectMedia(projectPath, "image", onStatusText);
      if (!relPath) return;
      onPersistRows(patchRow(normRows, rowIndex, fieldKey, relPath));
    })();
  };

  // 只读模式：全部展示为纯文本（参考图上传除外）
  if (readOnly) {
    if (canImportMedia) {
      return (
        <div className="scriptTableMediaCell">
          <input className="mono" value={value} readOnly />
          <button type="button" className="btn" onClick={importForCell} title="选择文件并自动导入到 assets">
            选图
          </button>
        </div>
      );
    }
    return <span className="scriptTableCellReadonly">{value || "—"}</span>;
  }

  if (TEXTAREA_KEYS.has(fieldKey)) {
    return (
      <textarea
        rows={descRows}
        value={value}
        onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}
      />
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

  if (fieldKey === "shotSize") {
    return (
      <select
        value={value}
        onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}
      >
        <option value="">选择景别</option>
        {SHOT_SIZE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (fieldKey === "cameraMove") {
    return (
      <select
        value={value}
        onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}
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

  if (fieldKey === "dialogueType") {
    return (
      <select
        value={value}
        onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}
      >
        <option value="">对白类型</option>
        {DIALOGUE_TYPE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (fieldKey === "bgmHint") {
    return (
      <select
        value={value}
        onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}
      >
        <option value="">BGM 氛围</option>
        {BGM_MOOD_OPTIONS.map((opt) => (
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
    String(fieldKey).endsWith("Image");

  if (canImportMedia) {
    return (
      <div className="scriptTableMediaCell">
        <input
          className={mono ? "mono" : undefined}
          value={value}
          onChange={(e) => onPersistRows(patchRow(normRows, rowIndex, fieldKey, e.target.value))}
        />
        <button type="button" className="btn" onClick={importForCell} title="选择文件并自动导入到 assets">
          选图
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
