import type { Dispatch, SetStateAction } from "react";
import type { ScriptBeat } from "@/lib/types";
import { parseCharacters, patchRowCharacters, serializeCharacters, type ScriptBeatsTableVariant } from "@/lib/scriptBeatsTableModel";
import { ScriptRolePopoverEditor } from "@/components/ScriptRolePopoverEditor";

type Props = {
  beat: ScriptBeat;
  rowIndex: number;
  variant: ScriptBeatsTableVariant;
  descRows: number;
  normRows: ScriptBeat[];
  projectPath?: string | null;
  onStatusText?: (msg: string) => void;
  onPersistRows: (next: ScriptBeat[]) => void;
  roleEditorRowId: string | null;
  setRoleEditorRowId: Dispatch<SetStateAction<string | null>>;
};

export function ScriptCharactersCell({
  beat,
  rowIndex,
  variant,
  descRows,
  normRows,
  projectPath,
  onStatusText,
  onPersistRows,
  roleEditorRowId,
  setRoleEditorRowId,
}: Props) {
  if (variant === "fullscreen") {
    const roles = beat.characters ?? [];
    return (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="btn"
          style={{ padding: "4px 8px", fontSize: 11 }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setRoleEditorRowId((cur) => (cur === beat.id ? null : beat.id));
          }}
        >
          角色编辑（{roles.length}）
        </button>
        {roleEditorRowId === beat.id ? (
          <ScriptRolePopoverEditor
            beat={beat}
            rowIndex={rowIndex}
            normRows={normRows}
            projectPath={projectPath}
            onStatusText={onStatusText}
            onPersistRows={onPersistRows}
            onClose={() => setRoleEditorRowId(null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <textarea
      rows={descRows}
      className="mono"
      placeholder="每行一个角色：name | desc | imagePath | action | emotion | lines"
      value={serializeCharacters(beat.characters)}
      onChange={(e) => onPersistRows(patchRowCharacters(normRows, rowIndex, parseCharacters(e.target.value)))}
    />
  );
}
