import { useCallback } from "react";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { useShallow } from "zustand/react/shallow";

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconAdd() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type TabProps = {
  tab: { id: string; name: string; unsaved: boolean };
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
};

function Tab({ tab, isActive, onClick, onClose }: TabProps) {
  return (
    <div className={`canvasTab${isActive ? " canvasTab--active" : ""}`} onClick={onClick}>
      <span className="canvasTabName">
        {tab.unsaved && <span className="canvasTabUnsavedDot" />}
        {tab.name}
      </span>
      {!isActive && (
        <button
          type="button"
          className="canvasTabClose"
          onClick={onClose}
          aria-label={`关闭 ${tab.name}`}
        >
          <IconClose />
        </button>
      )}
    </div>
  );
}

export function CanvasTabs() {
  const tabs = useCanvasUiStore(useShallow((s) => s.tabs));
  const activeTabId = useCanvasUiStore((s) => s.activeTabId);
  const setActiveTab = useCanvasUiStore((s) => s.setActiveTab);
  const updateTab = useCanvasUiStore((s) => s.updateTab);
  const openConfirmDialog = useCanvasUiStore.getState().openConfirmDialog;

  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore(useShallow((s) => s.nodes));
  const edges = useProjectStore(useShallow((s) => s.edges));
  const viewport = useProjectStore((s) => s.viewport);
  const newProject = useProjectStore((s) => s.newProject);
  const loadGraph = useProjectStore((s) => s.loadGraph);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) return;

      if (activeTab && projectPath) {
        updateTab(activeTab.id, {
          nodes,
          edges,
          viewport,
          unsaved: activeTab.unsaved,
        });
      }

      const targetTab = tabs.find((t) => t.id === tabId);
      if (!targetTab) return;

      setActiveTab(tabId);

      if (targetTab.projectPath) {
        loadGraph(targetTab.nodes, targetTab.edges, targetTab.viewport);
      } else {
        loadGraph([], [], { x: 0, y: 0, zoom: 1 });
      }
    },
    [activeTabId, activeTab, projectPath, nodes, edges, viewport, tabs, updateTab, setActiveTab, loadGraph],
  );

  const handleNewTab = useCallback(async () => {
    if (tabs.length >= 20) return;
    await newProject();
  }, [tabs.length, newProject]);

  const handleCloseTab = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;

      openConfirmDialog({
        title: `删除未保存画布？`,
        message: "当前画布有未保存的改动，删除后这些改动将消失。",
        onConfirm: () => {
          const store = useCanvasUiStore.getState();
          store.removeTab(id);
        },
        onCancel: () => {},
      });
    },
    [tabs, openConfirmDialog],
  );

  return (
    <div className="canvasTabs">
      {activeTab && (
        <Tab
          tab={activeTab}
          isActive={true}
          onClick={() => {}}
          onClose={() => {}}
        />
      )}
      {tabs
        .filter((t) => t.id !== activeTabId)
        .map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            isActive={false}
            onClick={() => handleSwitchTab(tab.id)}
            onClose={(e) => handleCloseTab(tab.id, e)}
          />
        ))}
      {tabs.length < 20 && (
        <button type="button" className="canvasTabAdd" onClick={handleNewTab} title="新建画布">
          <IconAdd />
        </button>
      )}
    </div>
  );
}