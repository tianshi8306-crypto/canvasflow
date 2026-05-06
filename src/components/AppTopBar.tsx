import { isTauri } from "@tauri-apps/api/core";
import { useMemo } from "react";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { getUndoRedoAvailability } from "@/store/projectStore";
import { useProjectStore } from "@/store/projectStore";

function IconUndo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 14 4 9l5-5M5 9h11a4 4 0 0 1 4 4v1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRedo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m15 10 5 5-5 5M19 15H8a4 4 0 0 1-4-4V10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconPaste() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 4h6l2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M10 11v6M14 11v6M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconGroup() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="13" y="11" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11 9h6M14 6v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCloseApp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v8M7.2 5.8a7.5 7.5 0 1 0 9.6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  onOpenSettings: () => void;
};

export function AppTopBar({ onOpenSettings }: Props) {
  const statusText = useProjectStore((s) => s.statusText);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);
  const lastRunId = useProjectStore((s) => s.lastRunId);
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodeCount = useProjectStore((s) => s.nodes.length);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useProjectStore((s) => s.selectedEdgeIds);
  const flowClipboardCount = useProjectStore((s) => s.flowClipboardCount);

  const newProject = useProjectStore((s) => s.newProject);
  const openProject = useProjectStore((s) => s.openProject);
  const saveProject = useProjectStore((s) => s.saveProject);
  const runWorkflow = useProjectStore((s) => s.runWorkflow);
  const groupSelectedNodes = useProjectStore((s) => s.groupSelectedNodes);
  const copySelection = useProjectStore((s) => s.copySelection);
  const pasteSelection = useProjectStore((s) => s.pasteSelection);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const { canUndo, canRedo } = useMemo(() => getUndoRedoAvailability(), [nodes, edges]);

  const savedShort = useMemo(() => {
    if (!lastSavedAt) return "";
    const d = new Date(lastSavedAt);
    return `已保存 ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }, [lastSavedAt]);

  const statusLine = useMemo(() => {
    const parts = [statusText];
    if (savedShort) parts.push(savedShort);
    if (lastRunId) parts.push(`Run ${lastRunId}`);
    return parts.join(" · ");
  }, [lastRunId, savedShort, statusText]);

  const canCopy = selectedNodeIds.length > 0;
  const canPaste = flowClipboardCount > 0;
  const canDelete = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;
  const canGroup = selectedNodeIds.length >= 2;

  const closeApp = () => {
    void (async () => {
      try {
        if (isTauri()) {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          await getCurrentWindow().close();
          return;
        }
      } catch {
        // fallback below
      }
      if (typeof window !== "undefined") window.close();
    })();
  };

  return (
    <header className="appTopChrome">
      <div className="appTopChromeInner">
        <div className="appTopBrand" title="CanvasFlow AI Studio">
          CanvasFlow AI Studio
        </div>

        {!isTauri() ? (
          <div className="appTopWarn" title={DESKTOP_SHELL_HINT}>
            浏览器预览
          </div>
        ) : null}

        <span className="appTopChromeDivider" aria-hidden />

        <div className="appTopCluster">
          <button type="button" className="appTopChip" onClick={() => void newProject()}>
            新建工程
          </button>
          <button type="button" className="appTopChip" onClick={() => void openProject()}>
            打开工程
          </button>
          <button type="button" className="appTopChip" onClick={() => void saveProject()} disabled={!projectPath}>
            保存
          </button>
          <button
            type="button"
            className="appTopChip appTopChip--primary"
            onClick={() => void runWorkflow()}
            disabled={!projectPath}
            title={!projectPath ? "请先打开工程" : "运行当前工作流"}
          >
            运行工作流
          </button>
          <button type="button" className="appTopChip" title="打开设置（API Key / 模型）" aria-label="设置" onClick={onOpenSettings}>
            <IconSettings />
            <span>设置</span>
          </button>
          <button
            type="button"
            className="leftAddDockFab"
            title="关闭窗口"
            aria-label="关闭窗口"
            onClick={closeApp}
          >
            <IconCloseApp />
          </button>
        </div>

        <span className="appTopChromeDivider" aria-hidden />

        <div className="appTopCluster appTopCluster--icons">
          <button
            type="button"
            className="leftAddDockFab"
            disabled={!canUndo}
            title="撤销 (Ctrl+Z)"
            aria-label="撤销"
            onClick={() => undo()}
          >
            <IconUndo />
          </button>
          <button
            type="button"
            className="leftAddDockFab"
            disabled={!canRedo}
            title="重做 (Ctrl+Shift+Z / Ctrl+Y)"
            aria-label="重做"
            onClick={() => redo()}
          >
            <IconRedo />
          </button>
          <span className="appTopClusterGap" aria-hidden />
          <button
            type="button"
            className="leftAddDockFab"
            disabled={!canCopy}
            title="复制 (Ctrl+C)"
            aria-label="复制"
            onClick={() => copySelection()}
          >
            <IconCopy />
          </button>
          <button
            type="button"
            className="leftAddDockFab"
            disabled={!canPaste}
            title="粘贴 (Ctrl+V)"
            aria-label="粘贴"
            onClick={() => pasteSelection()}
          >
            <IconPaste />
          </button>
          <span className="appTopClusterGap" aria-hidden />
          <button
            type="button"
            className="leftAddDockFab"
            disabled={!canDelete}
            title="删除选中 (Delete)"
            aria-label="删除"
            onClick={() => deleteSelection()}
          >
            <IconTrash />
          </button>
          <button
            type="button"
            className="leftAddDockFab"
            disabled={!canGroup}
            title="打组 (Ctrl+G)"
            aria-label="打组"
            onClick={() => groupSelectedNodes()}
          >
            <IconGroup />
          </button>
        </div>

        <div className="appTopChromeSpacer" />

        <div className="appTopStatusCol">
          {!projectPath && nodeCount > 0 ? (
            <div
              className="appTopTempWarn"
              title="左侧添加的内容仅保存在内存中，整页刷新会丢失；请先新建或打开工程以关联保存目录。"
            >
              临时画布
            </div>
          ) : null}
          <div className="appTopStatusLine" title={[projectPath ?? "", statusLine].filter(Boolean).join("\n")}>
            {statusLine}
          </div>
        </div>
      </div>
    </header>
  );
}
