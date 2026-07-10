import type { Dispatch, SetStateAction } from "react";
import type { ScriptBeat } from "@/lib/types";
import {
  type ScriptBeatsTableVariant,
  type TableColKey,
} from "@/lib/scriptBeatsTableModel";
import { ScriptCharactersCell } from "@/components/ScriptCharactersCell";
import { ScriptBeatsRoleFieldCell } from "@/components/ScriptBeatsRoleFieldCell";
import { ScriptBeatsScalarFieldCell } from "@/components/ScriptBeatsScalarFieldCell";

type Props = {
  beat: ScriptBeat;
  rowIndex: number;
  /** 表内可见序号（筛选后从 1 计） */
  displayIndex: number;
  colKey: TableColKey;
  variant: ScriptBeatsTableVariant;
  descRows: number;
  normRows: ScriptBeat[];
  projectPath?: string | null;
  onStatusText?: (msg: string) => void;
  onPersistRows: (next: ScriptBeat[]) => void;
  roleEditorRowId?: string | null;
  setRoleEditorRowId?: Dispatch<SetStateAction<string | null>>;
  readOnly?: boolean;
  basicTable?: boolean;
};

export function ScriptBeatsTableCellRenderer({
  beat,
  rowIndex,
  displayIndex,
  colKey,
  variant,
  descRows,
  normRows,
  projectPath,
  onStatusText,
  onPersistRows,
  roleEditorRowId,
  setRoleEditorRowId,
  readOnly = false,
  basicTable = false,
}: Props) {
  if (colKey === "rowIndex") {
    return <span className="scriptTableRowIndex mono">{displayIndex}</span>;
  }

  if (colKey.startsWith("roleName:") || colKey.startsWith("roleDesc:") || colKey.startsWith("roleImage:")) {
    return (
      <ScriptBeatsRoleFieldCell
        beat={beat}
        rowIndex={rowIndex}
        normRows={normRows}
        colKey={colKey}
        projectPath={projectPath}
        onStatusText={onStatusText}
        onPersistRows={onPersistRows}
        readOnly={readOnly}
      />
    );
  }

  if (colKey === "characters") {
    return (
      <ScriptCharactersCell
        beat={beat}
        rowIndex={rowIndex}
        variant={variant}
        descRows={descRows}
        normRows={normRows}
        projectPath={projectPath}
        onStatusText={onStatusText}
        onPersistRows={onPersistRows}
        roleEditorRowId={roleEditorRowId ?? null}
        setRoleEditorRowId={setRoleEditorRowId ?? (() => {})}
        readOnly={readOnly}
      />
    );
  }

  return (
    <ScriptBeatsScalarFieldCell
      beat={beat}
      rowIndex={rowIndex}
      normRows={normRows}
      colKey={colKey}
      variant={variant}
      descRows={descRows}
      projectPath={projectPath}
      onStatusText={onStatusText}
      onPersistRows={onPersistRows}
      readOnly={readOnly || (basicTable && colKey === "storyboardPrompt")}
      basicTable={basicTable}
    />
  );
}
