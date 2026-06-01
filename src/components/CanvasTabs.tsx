import { useCallback, useEffect } from "react";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { useShallow } from "zustand/react/shallow";
import {
  defaultTabViewport,
  persistActiveTabSnapshot,
  restoreProjectFromTab,
  syncActiveTabUnsaved,
} from "@/lib/canvasTabSync";

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
  const addTab = useCanvasUiStore((s) => s.addTab);
  const removeTab = useCanvasUiStore((s) => s.removeTab);
  const openConfirmDialog = useCanvasUiStore.getState().openConfirmDialog;

  const projectDirty = useProjectStore((s) => s.projectDirty);

  useEffect(() => {
    syncActiveTabUnsaved(projectDirty);
  }, [projectDirty]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) return;
      persistActiveTabSnapshot();

      const targetTab = tabs.find((t) => t.id === tabId);
      if (!targetTab) return;

      setActiveTab(tabId);
      restoreProjectFromTab(targetTab);
    },
    [activeTabId, tabs, setActiveTab],
  );

  const handleNewTab = useCallback(() => {
    if (tabs.length >= 20) return;
    persistActiveTabSnapshot();
    const ok = addTab({
      name: `画布 ${tabs.length + 1}`,
      projectPath: null,
      unsaved: false,
      nodes: [],
      edges: [],
      viewport: defaultTabViewport(),
    });
    if (!ok) return;
    const next = useCanvasUiStore.getState().tabs.find(
      (t) => t.id === useCanvasUiStore.getState().activeTabId,
    );
    if (next) restoreProjectFromTab(next);
  }, [tabs.length, addTab]);

  const handleCloseTab = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;

      const doRemove = () => {
        const wasActive = id === activeTabId;
        removeTab(id);
        if (!wasActive) return;
        const nextId = useCanvasUiStore.getState().activeTabId;
        const nextTab = useCanvasUiStore.getState().tabs.find((t) => t.id === nextId);
        if (nextTab) restoreProjectFromTab(nextTab);
        else {
          restoreProjectFromTab({
            id: "",
            name: "未命名画布",
            projectPath: null,
            unsaved: false,
            nodes: [],
            edges: [],
            viewport: defaultTabViewport(),
          });
        }
      };

      if (tab.unsaved) {
        openConfirmDialog({
          title: "关闭画布？",
          message: "该标签页有未保存的改动，关闭后内存中的改动将丢失。",
          onConfirm: doRemove,
          onCancel: () => {},
        });
        return;
      }
      doRemove();
    },
    [tabs, activeTabId, removeTab, openConfirmDialog],
  );

  if (tabs.length === 0) return null;

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
        <button type="button" className="canvasTabAdd" onClick={handleNewTab} title="新建画布标签">
          <IconAdd />
        </button>
      )}
    </div>
  );
}
