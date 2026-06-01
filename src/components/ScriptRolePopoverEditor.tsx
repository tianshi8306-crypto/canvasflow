import type { ScriptBeat } from "@/lib/types";
import { getBeatRoles, patchRowCharacters } from "@/lib/scriptBeatsTableModel";
import { ScriptBeatRolesEditor } from "@/components/script/ScriptBeatRolesEditor";

type Props = {
  beat: ScriptBeat;
  rowIndex: number;
  normRows: ScriptBeat[];
  projectPath?: string | null;
  onStatusText?: (msg: string) => void;
  onPersistRows: (next: ScriptBeat[]) => void;
  onClose: () => void;
};

export function ScriptRolePopoverEditor({
  beat,
  rowIndex,
  normRows,
  projectPath = null,
  onStatusText,
  onPersistRows,
  onClose,
}: Props) {
  const roles = getBeatRoles(beat);

  return (
    <div className="scriptRolePopover" role="dialog" aria-label="角色编辑器" onMouseDown={(e) => e.stopPropagation()}>
      <div className="scriptRolePopoverHead">
        <span>角色编辑器</span>
        <button type="button" className="scriptFieldPopoverLink" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="scriptRolePopoverBody">
        <ScriptBeatRolesEditor
          roles={roles}
          projectPath={projectPath ?? null}
          onStatusText={onStatusText}
          onRolesChange={(next) => onPersistRows(patchRowCharacters(normRows, rowIndex, next))}
        />
      </div>
    </div>
  );
}
