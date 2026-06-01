import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isTauri } from "@tauri-apps/api/core";
import { clampContextMenuPosition } from "@/lib/clampFloatingUi";
import { projectFolderName, readRecentProjects } from "@/lib/recentProjects";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { useProjectStore } from "@/store/projectStore";
import "./WorkspaceMenu.css";

const PANEL_WIDTH = 272;
const PANEL_MAX_HEIGHT = 420;

function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MenuRow({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="workspaceMenuRow" disabled={disabled} onClick={onClick}>
      <span className="workspaceMenuRowLabel">{label}</span>
      {hint ? <span className="workspaceMenuRowHint">{hint}</span> : null}
    </button>
  );
}

export function WorkspaceMenu() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectDirty = useProjectStore((s) => s.projectDirty);
  const newProject = useProjectStore((s) => s.newProject);
  const openProject = useProjectStore((s) => s.openProject);
  const openProjectAtPath = useProjectStore((s) => s.openProjectAtPath);
  const saveProject = useProjectStore((s) => s.saveProject);
  const saveProjectAs = useProjectStore((s) => s.saveProjectAs);
  const closeProject = useProjectStore((s) => s.closeProject);

  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const syncPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clamped = clampContextMenuPosition(
      rect.left,
      rect.bottom + 6,
      PANEL_WIDTH,
      PANEL_MAX_HEIGHT,
    );
    setPanelPos({ left: clamped.x, top: clamped.y });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    syncPosition();
    setRecent(readRecentProjects());
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [open, syncPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = useCallback((fn: () => void | Promise<void>) => {
    setOpen(false);
    void fn();
  }, []);

  const label = projectPath?.trim()
    ? projectFolderName(projectPath)
    : "打开工程…";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`workspaceMenuTrigger${open ? " workspaceMenuTrigger--open" : ""}${
          projectPath?.trim() ? "" : " workspaceMenuTrigger--empty"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={projectPath?.trim() || "新建或打开本地工程目录"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="workspaceMenuTriggerMark" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </span>
        <span className="workspaceMenuTriggerLabel">{label}</span>
        {projectDirty ? <span className="workspaceMenuDirtyDot" title="有未保存更改" /> : null}
        <IconChevron />
      </button>

      {createPortal(
        open && panelPos ? (
          <div
            ref={panelRef}
            className="workspaceMenuPanel"
            role="menu"
            aria-label="工程"
            style={{ left: panelPos.left, top: panelPos.top }}
          >
            {projectPath?.trim() ? (
              <div className="workspaceMenuCurrent">
                <span className="workspaceMenuCurrentLabel">当前工程</span>
                <span className="workspaceMenuCurrentPath" title={projectPath}>
                  {projectPath}
                </span>
              </div>
            ) : null}

            {!isTauri() ? (
              <p className="workspaceMenuBrowserHint">{DESKTOP_SHELL_HINT}</p>
            ) : null}

            <div className="workspaceMenuSection">
              <MenuRow label="打开工程…" onClick={() => run(openProject)} />
              <MenuRow label="新建工程…" onClick={() => run(newProject)} />
            </div>

            {recent.length > 0 ? (
              <>
                <div className="workspaceMenuSectionTitle">最近工程</div>
                <div className="workspaceMenuRecent">
                  {recent.map((path) => (
                    <MenuRow
                      key={path}
                      label={projectFolderName(path)}
                      hint={path}
                      onClick={() => run(() => openProjectAtPath(path))}
                    />
                  ))}
                </div>
              </>
            ) : null}

            <div className="workspaceMenuDivider" />

            <div className="workspaceMenuSection">
              <MenuRow
                label="保存"
                hint="Ctrl+S"
                disabled={!projectPath}
                onClick={() => run(saveProject)}
              />
              <MenuRow label="另存为…" disabled={!projectPath} onClick={() => run(saveProjectAs)} />
              <MenuRow
                label="关闭工程"
                disabled={!projectPath}
                onClick={() => run(closeProject)}
              />
            </div>
          </div>
        ) : null,
        document.body,
      )}
    </>
  );
}
