import { useCallback, useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { isTauri } from "@tauri-apps/api/core";
import type { CanvasGroupTemplateListItem } from "@/lib/canvasGroupTemplate";
import { loadLocalGroupTemplates } from "@/lib/canvasGroupTemplate";
import { listProjectGroupTemplates } from "@/shared/api/groupTemplates";
import { useProjectStore } from "@/store/projectStore";
type Props = {
  projectPath: string | null;
  onClose: () => void;
};

export function CanvasGroupToolboxSection({ projectPath, onClose }: Props) {
  const insertGroupTemplate = useProjectStore((s) => s.insertGroupTemplate);
  const { screenToFlowPosition } = useReactFlow();
  const [items, setItems] = useState<CanvasGroupTemplateListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (projectPath && isTauri()) {
        const projectItems = await listProjectGroupTemplates(projectPath);
        const local = loadLocalGroupTemplates().map((t) => ({
          id: t.id,
          name: t.name,
          createdAt: t.createdAt,
        }));
        const seen = new Set(projectItems.map((p) => p.id));
        setItems([...projectItems, ...local.filter((l) => !seen.has(l.id))]);
      } else {
        setItems(
          loadLocalGroupTemplates().map((t) => ({
            id: t.id,
            name: t.name,
            createdAt: t.createdAt,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onInsert = (item: CanvasGroupTemplateListItem) => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    void insertGroupTemplate(item.id, center, item.relPath);
    onClose();
  };

  if (loading && items.length === 0) {
    return <p className="leftAddDockFootNote">正在加载工具箱…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="leftAddDockFootNote">
        暂无分组模板。选中分组后点「添加到工具箱」保存。
      </p>
    );
  }

  return (
    <div className="leftAddDockToolboxList">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="leftAddDockRow leftAddDockToolboxRow"
          onClick={() => onInsert(item)}
          title={item.relPath ? `工程模板 ${item.relPath}` : "本机缓存模板"}
        >
          <span className="leftAddDockRowLabel">{item.name}</span>
        </button>
      ))}
    </div>
  );
}
