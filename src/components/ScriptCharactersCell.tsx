import type { Dispatch, SetStateAction } from "react";
import type { ScriptBeat } from "@/lib/types";
import { parseCharacters, patchRowCharacters, serializeCharacters, type ScriptBeatsTableVariant } from "@/lib/scriptBeatsTableModel";
import { ScriptRolePopoverEditor } from "@/components/ScriptRolePopoverEditor";
import { ScriptBeatRoleSummary } from "@/components/script/ScriptBeatRoleSummary";
import { getBeatRoles } from "@/lib/scriptBeatsTableModel";

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
    const roles = getBeatRoles(beat);
    return (
      <div className="scriptCharsCellWrap">
        <button
          type="button"
          className="btn scriptCharsCellBtn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setRoleEditorRowId((cur) => (cur === beat.id ? null : beat.id));
          }}
          title="编辑角色（与卡片视图同步）"
        >
          <ScriptBeatRoleSummary beat={beat} projectPath={projectPath ?? null} maxAvatars={2} />
          <span className="scriptCharsCellCount mono">（{roles.length}）</span>
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
