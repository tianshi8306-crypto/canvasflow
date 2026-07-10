import type { RefObject } from "react";
import type { ScriptBeat } from "@/lib/types";
import type { ScriptBeatsTableLayout } from "@/lib/scriptBeatsTableModel";
import { ScriptBeatsEditorTable } from "@/components/ScriptBeatsEditorTable";

type Props = {
  containerRef: RefObject<HTMLDivElement>;
  tableLayout: ScriptBeatsTableLayout;
  rows: ScriptBeat[];
  selectedIds: string[];
  projectPath: string | null;
  onToggleSelect: (id: string) => void;
  onPersistRows: (next: ScriptBeat[]) => void;
  onStatusText: (msg: string) => void;
  onScrollTopChange: (top: number) => void;
};

export function ScriptWorkbenchTableView({
  containerRef,
  tableLayout,
  rows,
  selectedIds,
  projectPath,
  onToggleSelect,
  onPersistRows,
  onStatusText,
  onScrollTopChange,
}: Props) {
  const isBasic = tableLayout === "basic";

  return (
    <div
      ref={containerRef}
      className="scriptTableWrap"
      onScroll={(e) => {
        onScrollTopChange(e.currentTarget.scrollTop);
      }}
    >
      <ScriptBeatsEditorTable
        variant="inline"
        tableMode={tableLayout}
        inlineContext={isBasic ? "workbench" : undefined}
        readOnly={!isBasic}
        rows={rows}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onPersistRows={onPersistRows}
        projectPath={projectPath}
        onStatusText={onStatusText}
      />
    </div>
  );
}
