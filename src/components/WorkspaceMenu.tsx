import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";

import { isTauri } from "@tauri-apps/api/core";

import {

  FloatMenuDivider,

  FloatMenuFootnote,

  FloatMenuHeader,

  FloatMenuItem,

  FloatMenuSection,

  FloatMenuShell,

} from "@/components/canvas/CanvasFloatMenu";

import {

  IconCloseProject,

  IconFolderNew,

  IconFolderOpen,

  IconFolderRecent,

  IconSave,

  IconSaveAs,

} from "@/components/canvas/workspaceMenuIcons";

import { clampContextMenuPosition } from "@/lib/clampFloatingUi";

import { isMacPlatform } from "@/lib/canvasModKeys";

import { projectFolderName, readRecentProjects } from "@/lib/recentProjects";

import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";

import { useProjectStore } from "@/store/projectStore";

import "./WorkspaceMenu.css";



const PANEL_WIDTH = 280;

const PANEL_MAX_HEIGHT = 440;



function IconChevron() {

  return (

    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>

      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

    </svg>

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



  const saveKbd = isMacPlatform() ? "⌘S" : "Ctrl+S";



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

    setRecent(readRecentProjects());

  }, [projectPath]);



  useEffect(() => {

    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {

      const target = e.target;

      if (!(target instanceof Node)) return;

      if (triggerRef.current?.contains(target)) return;

      if (panelRef.current?.contains(target)) return;

      setOpen(false);

    };

    const onKey = (e: KeyboardEvent) => {

      if (e.key === "Escape") setOpen(false);

    };

    document.addEventListener("mousedown", onMouseDown);

    document.addEventListener("keydown", onKey);

    return () => {

      document.removeEventListener("mousedown", onMouseDown);

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



  const lastPath = recent[0];

  const moreRecent = lastPath ? recent.slice(1) : [];



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

          <FloatMenuShell

            ref={panelRef}

            className="workspaceMenuPanel"

            aria-label="工程"

            style={{ left: panelPos.left, top: panelPos.top, width: PANEL_WIDTH, maxHeight: PANEL_MAX_HEIGHT }}

          >

            {projectPath?.trim() ? (

              <FloatMenuHeader label="当前工程" detail={projectPath} />

            ) : null}



            {!isTauri() ? <FloatMenuFootnote>{DESKTOP_SHELL_HINT}</FloatMenuFootnote> : null}



            <FloatMenuSection>

              <FloatMenuItem

                icon={<IconFolderOpen />}

                label="打开工程…"

                detail="记住上次文件夹"

                onClick={() => run(openProject)}

              />

              {lastPath ? (

                <FloatMenuItem

                  icon={<IconFolderRecent />}

                  label={`打开上次 · ${projectFolderName(lastPath)}`}

                  detail={lastPath}

                  onClick={() => run(() => openProjectAtPath(lastPath))}

                />

              ) : null}

              <FloatMenuItem

                icon={<IconFolderNew />}

                label="新建工程…"

                onClick={() => run(newProject)}

              />

            </FloatMenuSection>



            {moreRecent.length > 0 ? (

              <FloatMenuSection title="最近工程">

                {moreRecent.map((path) => (

                  <FloatMenuItem

                    key={path}

                    icon={<IconFolderRecent />}

                    label={projectFolderName(path)}

                    detail={path}

                    onClick={() => run(() => openProjectAtPath(path))}

                  />

                ))}

              </FloatMenuSection>

            ) : null}



            <FloatMenuDivider />



            <FloatMenuSection>

              <FloatMenuItem

                icon={<IconSave />}

                label="保存"

                kbd={saveKbd}

                disabled={!projectPath}

                onClick={() => run(saveProject)}

              />

              <FloatMenuItem

                icon={<IconSaveAs />}

                label="另存为…"

                disabled={!projectPath}

                onClick={() => run(saveProjectAs)}

              />

              <FloatMenuItem

                icon={<IconCloseProject />}

                label="关闭工程"

                disabled={!projectPath}

                onClick={() => run(closeProject)}

              />

            </FloatMenuSection>

          </FloatMenuShell>

        ) : null,

        document.body,

      )}

    </>

  );

}


