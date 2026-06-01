import { useCallback, useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { isTauri } from "@tauri-apps/api/core";
import {
  loadLocalWorkflows,
  mergeWorkflowListItems,
  workflowToListItem,
  type CanvasWorkflowListItem,
} from "@/lib/canvasWorkflowSnapshot";
import { listProjectWorkflows } from "@/shared/api/workflows";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";

type Props = {
  projectPath: string | null;
  onClose: () => void;
};

function sourceLabel(item: CanvasWorkflowListItem): string {
  const parts: string[] = [];
  if (item.local) parts.push("本机");
  if (item.relPath) parts.push("工程");
  return parts.length ? parts.join(" · ") : "";
}

export function CanvasWorkflowLibrarySection({ projectPath, onClose }: Props) {
  const insertWorkflow = useProjectStore((s) => s.insertWorkflow);
  const deleteWorkflow = useProjectStore((s) => s.deleteWorkflow);
  const openConfirmDialog = useCanvasUiStore((s) => s.openConfirmDialog);
  const { screenToFlowPosition } = useReactFlow();
  const [items, setItems] = useState<CanvasWorkflowListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const merged: CanvasWorkflowListItem[] = [];
      if (projectPath && isTauri()) {
        const projectItems = await listProjectWorkflows(projectPath);
        merged.push(...projectItems);
      }
      const localItems = loadLocalWorkflows().map((w) =>
        workflowToListItem(w, { local: true }),
      );
      setItems(mergeWorkflowListItems([...merged, ...localItems]));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q);
  });

  const onInsert = (item: CanvasWorkflowListItem) => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    void insertWorkflow(item.id, center, item.relPath);
    onClose();
  };

  const onDelete = (item: CanvasWorkflowListItem) => {
    openConfirmDialog({
      title: "删除工作流",
      message: `确定删除「${item.name}」？${item.local && item.relPath ? "将同时删除本机与工程中的副本。" : ""}`,
      onConfirm: () => {
        void deleteWorkflow(item.id, { local: item.local, relPath: item.relPath }).then(() =>
          refresh(),
        );
      },
    });
  };

  if (loading && items.length === 0) {
    return <p className="leftAddDockFootNote">正在加载工作流…</p>;
  }

  return (
    <div className="workflowLibrarySection">
      {items.length > 0 ? (
        <input
          type="search"
          className="workflowLibrarySearch"
          placeholder="搜索工作流…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜索工作流"
        />
      ) : null}
      {items.length === 0 ? (
        <p className="leftAddDockFootNote">
          暂无工作流。框选节点后点「保存为工作流」，或从分组工具栏保存。
        </p>
      ) : filtered.length === 0 ? (
        <p className="leftAddDockFootNote">没有匹配的工作流。</p>
      ) : (
        <div className="leftAddDockToolboxList">
          {filtered.map((item) => (
            <div key={`${item.id}-${item.relPath ?? "local"}`} className="workflowLibraryRow">
              <button
                type="button"
                className="leftAddDockRow leftAddDockToolboxRow workflowLibraryRowMain"
                onClick={() => onInsert(item)}
                title={item.relPath ?? "本机工作流"}
              >
                <span className="leftAddDockRowLabel">{item.name}</span>
                <span className="workflowLibraryRowMeta">
                  {item.nodeCount} 节点 · {item.edgeCount} 连线
                  {sourceLabel(item) ? ` · ${sourceLabel(item)}` : ""}
                </span>
              </button>
              <button
                type="button"
                className="workflowLibraryRowDelete"
                title="删除"
                aria-label={`删除 ${item.name}`}
                onClick={() => onDelete(item)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
