import type { CanvasTab } from "@/store/canvasUiStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

/** 从工程目录路径生成 Tab 显示名 */
export function tabNameFromProjectPath(projectPath: string | null): string {
  if (!projectPath?.trim()) return "未命名画布";
  const normalized = projectPath.replace(/\\/g, "/");
  const name = normalized.split("/").filter(Boolean).pop();
  return name || projectPath;
}

/** 将当前 projectStore 快照写入活动 Tab（切换 / 新建 Tab 前调用） */
export function persistActiveTabSnapshot(): void {
  const { nodes, edges, viewport, projectPath, projectDirty } = useProjectStore.getState();
  const { activeTabId, tabs } = useCanvasUiStore.getState();
  if (!activeTabId) return;
  const current = tabs.find((t) => t.id === activeTabId);
  if (!current) return;
  useCanvasUiStore.getState().updateTab(activeTabId, {
    nodes,
    edges,
    viewport: { ...viewport },
    projectPath,
    unsaved: projectDirty,
    name: tabNameFromProjectPath(projectPath) || current.name,
  });
}

/** 工程打开 / 新建 / 关闭后，与活动 Tab 对齐 */
export function bindActiveTabToProject(): void {
  const { nodes, edges, viewport, projectPath, projectDirty } = useProjectStore.getState();
  const ui = useCanvasUiStore.getState();
  const payload: Omit<CanvasTab, "id"> = {
    name: tabNameFromProjectPath(projectPath),
    projectPath,
    unsaved: projectDirty,
    nodes,
    edges,
    viewport: { ...viewport },
  };

  if (!ui.activeTabId || ui.tabs.length === 0) {
    ui.addTab(payload);
    return;
  }

  ui.updateTab(ui.activeTabId, payload);
}

/** 仅同步未保存标记（避免频繁拷贝整图） */
export function syncActiveTabUnsaved(unsaved: boolean): void {
  const { activeTabId } = useCanvasUiStore.getState();
  if (!activeTabId) return;
  useCanvasUiStore.getState().updateTabUnsaved(activeTabId, unsaved);
}

/** 将 Tab 快照恢复到 projectStore（切换 Tab / 关闭 Tab 后激活邻居） */
export function restoreProjectFromTab(tab: CanvasTab): void {
  useProjectStore.getState().restoreCanvasTab({
    nodes: tab.nodes,
    edges: tab.edges,
    viewport: tab.viewport,
    projectPath: tab.projectPath,
    projectDirty: tab.unsaved,
    statusText: tab.projectPath ? `工程：${tab.projectPath}` : "未打开工程",
  });
}
