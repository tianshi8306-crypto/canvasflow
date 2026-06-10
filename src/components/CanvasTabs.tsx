import { useCallback, useEffect } from "react";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { useShallow } from "zustand/react/shallow";
import {
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

type TabProps = {
  tab: { id: string; name: string; unsaved: boolean };
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  closable: boolean;
};

function Tab({ tab, isActive, onClick, onClose, closable }: TabProps) {
  return (
    <div className={`canvasTab${isActive ? " canvasTab--active" : ""}`} onClick={onClick}>
      <span className="canvasTabName">
        {tab.unsaved && <span className="canvasTabUnsavedDot" />}
        {tab.name}
      </span>
      {closable && (
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
  const removeTab = useCanvasUiStore((s) => s.removeTab);
  const openConfirmDialog = useCanvasUiStore.getState().openConfirmDialog;

  const projectDirty = useProjectStore((s) => s.projectDirty);

  useEffect(() => {
    syncActiveTabUnsaved(projectDirty);
  }, [projectDirty]);

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
            viewport: { x: 0, y: 0, zoom: 1 },
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

  const canCloseAny = tabs.length > 1;

  return (
    <div className="canvasTabs">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onClick={() => handleSwitchTab(tab.id)}
          onClose={(e) => handleCloseTab(tab.id, e)}
          closable={canCloseAny}
        />
      ))}
    </div>
  );
}
