import { ScriptDescriptionHighlight } from "@/components/ScriptDescriptionHighlight";
import { ScriptBasicDisplayEditCell } from "@/components/script/ScriptBasicDisplayEditCell";
import { importSingleProjectMedia } from "@/lib/scriptMediaImport";
import {
  getBasicViewStoryboardPrompt,
  getSeedancePositivePrompt,
} from "@/lib/scriptPromptSynthesis";
import type { ScriptBeat } from "@/lib/types";
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
  readOnly?: boolean;
  basicTable?: boolean;
};

function persistFieldKey(fieldKey: ScriptBeatStringKey, basicTable: boolean): ScriptBeatStringKey {
  if (fieldKey === "storyboardPrompt" && !basicTable) return "seedancePositive";
  return fieldKey;
}

function patchBeatField(
  rows: ScriptBeat[],
  rowIndex: number,
  fieldKey: ScriptBeatStringKey,
  basicTable: boolean,
  value: string,
): ScriptBeat[] {
  return patchRow(rows, rowIndex, persistFieldKey(fieldKey, basicTable), value);
}

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
  basicTable = false,
}: Props) {
  const fieldKey = colKey as ScriptBeatStringKey;
  const rawValue = (beat[fieldKey] ?? "") as string;
  const value =
    fieldKey === "storyboardPrompt"
      ? basicTable
        ? getBasicViewStoryboardPrompt(beat)
        : getSeedancePositivePrompt(beat) || rawValue
      : rawValue;

  const commit = (next: string) => {
    onPersistRows(patchBeatField(normRows, rowIndex, fieldKey, basicTable, next));
  };

  const canImportMedia = variant === "fullscreen" && String(fieldKey).endsWith("Image");

  const importForCell = () => {
    if (!canImportMedia) return;
    void (async () => {
      const relPath = await importSingleProjectMedia(projectPath, "image", onStatusText);
      if (!relPath) return;
      onPersistRows(patchRow(normRows, rowIndex, fieldKey, relPath));
    })();
  };

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
    if (fieldKey === "storyboardPrompt" && !value.trim()) {
      return (
        <span className="scriptTableCellReadonly scriptTableCellReadonly--placeholder">
          {basicTable ? "待生成分镜提示词" : "待填写 Seedance 正向"}
        </span>
      );
    }
    if (fieldKey === "lightingMood" && !value.trim()) {
      return <span className="scriptTableCellReadonly scriptTableCellReadonly--placeholder">—</span>;
    }
    const readonlyClass =
      fieldKey === "storyboardPrompt"
        ? "scriptTableCellReadonly scriptTableField--storyboardPrompt"
        : fieldKey === "description"
          ? "scriptTableCellReadonly scriptTableField--description"
          : fieldKey === "dialogue"
            ? "scriptTableCellReadonly scriptTableField--dialogue"
            : "scriptTableCellReadonly";
    const displayValue = fieldKey === "dialogue" ? value.replace(/\*\*/g, "") : value;
    if (fieldKey === "description" && basicTable && displayValue.trim()) {
      return (
        <span className="scriptTableCellReadonly scriptTableField--description">
          <ScriptDescriptionHighlight beat={beat} text={displayValue} />
        </span>
      );
    }
    return <span className={readonlyClass}>{displayValue || "—"}</span>;
  }

  if (basicTable) {
    if (fieldKey === "description") {
      const displayText = value.replace(/\*\*/g, "");
      return (
        <ScriptBasicDisplayEditCell
          variant="textarea"
          className="scriptTableField--description"
          rows={Math.max(descRows, 4)}
          value={value}
          placeholder="画面描述"
          displayContent={
            displayText.trim() ? (
              <ScriptDescriptionHighlight beat={beat} text={displayText} />
            ) : undefined
          }
          onCommit={commit}
        />
      );
    }

    if (fieldKey === "dialogue") {
      const displayText = value.replace(/\*\*/g, "");
      return (
        <ScriptBasicDisplayEditCell
          variant="textarea"
          className="scriptTableField--dialogue"
          rows={3}
          value={value}
          placeholder="对白·旁白"
          displayContent={displayText.trim() ? displayText : undefined}
          onCommit={commit}
        />
      );
    }

    if (fieldKey === "lightingMood") {
      return (
        <ScriptBasicDisplayEditCell
          variant="textarea"
          rows={3}
          value={value}
          placeholder="如：冷蓝光，压抑疲惫"
          onCommit={commit}
        />
      );
    }

    if (fieldKey === "soundHint") {
      return (
        <ScriptBasicDisplayEditCell
          variant="textarea"
          rows={2}
          value={value}
          placeholder="音效"
          onCommit={commit}
        />
      );
    }

    if (fieldKey === "durationHint") {
      return (
        <ScriptBasicDisplayEditCell
          variant="input"
          className="mono"
          value={value}
          placeholder="时长"
          onCommit={commit}
        />
      );
    }

    if (fieldKey === "shotSize") {
      return (
        <ScriptBasicDisplayEditCell
          variant="select"
          value={value}
          options={SHOT_SIZE_OPTIONS}
          emptyOptionLabel="选择景别"
          placeholder="选择景别"
          onCommit={commit}
        />
      );
    }

    if (fieldKey === "cameraMove") {
      return (
        <ScriptBasicDisplayEditCell
          variant="select"
          value={value}
          options={CAMERA_MOVE_OPTIONS}
          emptyOptionLabel="选择运镜"
          placeholder="选择运镜"
          onCommit={commit}
        />
      );
    }
  }

  if (TEXTAREA_KEYS.has(fieldKey)) {
    const placeholder =
      fieldKey === "storyboardPrompt"
        ? basicTable
          ? "待生成分镜提示词"
          : "Seedance 正向（英文关键词）"
        : fieldKey === "lightingMood"
          ? "如：冷蓝光，压抑疲惫"
          : undefined;
    const textareaRows =
      fieldKey === "storyboardPrompt"
        ? Math.max(descRows, 7)
        : fieldKey === "description"
          ? Math.max(descRows, 6)
          : fieldKey === "lightingMood" || fieldKey === "dialogue"
            ? 3
            : descRows;
    const fieldClass =
      fieldKey === "storyboardPrompt"
        ? "scriptTableField--storyboardPrompt"
        : fieldKey === "description"
          ? "scriptTableField--description"
          : "";
    return (
      <textarea
        className={fieldClass}
        rows={textareaRows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => commit(e.target.value)}
      />
    );
  }

  if (fieldKey === "emotion") {
    return (
      <select value={value} onChange={(e) => commit(e.target.value)}>
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
      <select value={value} onChange={(e) => commit(e.target.value)}>
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
      <select value={value} onChange={(e) => commit(e.target.value)}>
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
      <select value={value} onChange={(e) => commit(e.target.value)}>
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
      <select value={value} onChange={(e) => commit(e.target.value)}>
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
          onChange={(e) => commit(e.target.value)}
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
      onChange={(e) => commit(e.target.value)}
    />
  );
}
