import type { RefObject } from "react";
import type { ScriptBeat } from "@/lib/types";
import { ScriptBeatsEditorTable } from "@/components/ScriptBeatsEditorTable";

type Props = {
  containerRef: RefObject<HTMLDivElement>;
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
  rows,
  selectedIds,
  projectPath,
  onToggleSelect,
  onPersistRows,
  onStatusText,
  onScrollTopChange,
}: Props) {
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
        readOnly
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
