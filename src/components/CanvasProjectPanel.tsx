import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { isTauri } from "@tauri-apps/api/core";
import { clampContextMenuPosition } from "@/lib/clampFloatingUi";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import "./CanvasProjectPanel.css";

const PANEL_WIDTH = 260;
const PANEL_MAX_HEIGHT = 320;

type Props = {
  /** 左侧 Dock「画布项目」触发钮，用于锚定浮层位置 */
  anchorRef: RefObject<HTMLElement | null>;
};

function IconNew() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconOpen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSave() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSaveAs() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 21v-8H7v8M7 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 12h6M17 9l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSaveAndClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PanelRow({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="cppPanelRow" disabled={disabled} onClick={onClick}>
      <span className="cppPanelRowIcon">{icon}</span>
      <span className="cppPanelRowLabel">{label}</span>
    </button>
  );
}

function anchorPanelPosition(anchor: HTMLElement): { left: number; top: number } {
  const rect = anchor.getBoundingClientRect();
  const gap = 8;
  const rawLeft = rect.right + gap;
  const rawTop = rect.top;
  const clamped = clampContextMenuPosition(rawLeft, rawTop, PANEL_WIDTH, PANEL_MAX_HEIGHT);
  return { left: clamped.x, top: clamped.y };
}

export function CanvasProjectPanel({ anchorRef }: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const newProject = useProjectStore((s) => s.newProject);
  const openProject = useProjectStore((s) => s.openProject);
  const saveProject = useProjectStore((s) => s.saveProject);
  const saveProjectAs = useProjectStore((s) => s.saveProjectAs);
  const projectPanelOpen = useCanvasUiStore((s) => s.projectPanelOpen);
  const setProjectPanelOpen = useCanvasUiStore((s) => s.setProjectPanelOpen);

  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(null);

  const syncPanelPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    setPanelPos(anchorPanelPosition(anchor));
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!projectPanelOpen) {
      setPanelPos(null);
      return;
    }
    syncPanelPosition();
    window.addEventListener("resize", syncPanelPosition);
    window.addEventListener("scroll", syncPanelPosition, true);
    return () => {
      window.removeEventListener("resize", syncPanelPosition);
      window.removeEventListener("scroll", syncPanelPosition, true);
    };
  }, [projectPanelOpen, syncPanelPosition]);

  const handleNew = useCallback(async () => {
    setProjectPanelOpen(false);
    await newProject();
  }, [newProject, setProjectPanelOpen]);

  const handleOpen = useCallback(async () => {
    setProjectPanelOpen(false);
    await openProject();
  }, [openProject, setProjectPanelOpen]);

  const handleSave = useCallback(async () => {
    setProjectPanelOpen(false);
    await saveProject();
  }, [saveProject, setProjectPanelOpen]);

  const handleSaveAs = useCallback(async () => {
    setProjectPanelOpen(false);
    await saveProjectAs();
  }, [saveProjectAs, setProjectPanelOpen]);

  const handleSaveAndClose = useCallback(async () => {
    setProjectPanelOpen(false);
    if (projectPath) {
      await saveProject();
    }
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
  }, [projectPath, saveProject, setProjectPanelOpen]);

  const projectName = projectPath ? projectPath.split(/[/\\]/).pop() : null;

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!projectPanelOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setProjectPanelOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProjectPanelOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchorRef, projectPanelOpen, setProjectPanelOpen]);

  return createPortal(
    projectPanelOpen && panelPos ? (
      <div
        ref={panelRef}
        className="canvasProjectPanel open"
        role="dialog"
        aria-label="画布项目"
        style={{ left: panelPos.left, top: panelPos.top }}
      >
        {projectName && (
          <div className="cppProjectName">
            <span className="cppProjectNameLabel">当前工程</span>
            <span className="cppProjectNameValue" title={projectPath ?? undefined}>
              {projectName}
            </span>
          </div>
        )}
        <div className="cppPanelRows">
          <PanelRow icon={<IconNew />} label="新建画布" onClick={handleNew} />
          <PanelRow icon={<IconOpen />} label="打开本地项目" onClick={handleOpen} />
          <PanelRow icon={<IconSave />} label="保存" disabled={!projectPath} onClick={handleSave} />
          <PanelRow icon={<IconSaveAs />} label="另存为本地项目" disabled={!projectPath} onClick={handleSaveAs} />
          <PanelRow icon={<IconSaveAndClose />} label="保存并关闭" disabled={!projectPath} onClick={handleSaveAndClose} />
        </div>
      </div>
    ) : null,
    document.body,
  );
}
