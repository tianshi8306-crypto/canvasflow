import type { RefObject } from "react";
import type { ScriptBeat } from "@/lib/types";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
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
        rows={rows}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onPersistRows={onPersistRows}
        projectPath={projectPath}
        onStatusText={onStatusText}
      />
      <button
        type="button"
        className="btn"
        style={{ marginTop: 8 }}
        onClick={() => onPersistRows([...rows, normalizeScriptBeat({ id: crypto.randomUUID() })])}
      >
        添加一条镜头
      </button>
    </div>
  );
}
