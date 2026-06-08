import { isTauri } from "@tauri-apps/api/core";
import { useMemo, useEffect, useState } from "react";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { CanvasTabs } from "./CanvasTabs";
import { WorkspaceMenu } from "./WorkspaceMenu";
import type { StylePreset } from "@/lib/styleLibrary/types";
import { STYLE_CATEGORY_META } from "@/lib/styleLibrary/types";
import { fetchStyleLibrary, getStylePreset } from "@/lib/styleLibrary";

export function AppTopBar() {
  const statusText = useProjectStore((s) => s.statusText);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);
  const lastRunId = useProjectStore((s) => s.lastRunId);
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectDirty = useProjectStore((s) => s.projectDirty);
  const nodeCount = useProjectStore((s) => s.nodes.length);
  const activeStyleId = useProjectStore((s) => s.activeStyleId);
  const setActiveStyleId = useProjectStore((s) => s.setActiveStyleId);
  const toggleStylePanel = useCanvasUiStore((s) => s.toggleStyleLibraryPanel);
  const [library, setLibrary] = useState<StylePreset[] | null>(null);
  const activeStyle = activeStyleId && library ? getStylePreset(activeStyleId, library) : null;
  useEffect(() => { fetchStyleLibrary().then(setLibrary).catch(() => {}); }, []);

  const savedShort = useMemo(() => {
    if (!lastSavedAt) return "";
    const d = new Date(lastSavedAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastSavedAt]);

  const saveBadge = useMemo(() => {
    if (!projectPath) return projectDirty ? "未保存" : "";
    if (projectDirty) return "未保存";
    if (savedShort) return `已保存 ${savedShort}`;
    return "";
  }, [projectDirty, projectPath, savedShort]);

  const statusShort = useMemo(() => {
    const t = statusText.trim();
    if (!t) return "";
    if (t.length <= 32) return t;
    return `${t.slice(0, 30)}…`;
  }, [statusText]);

  const statusDetailTitle = useMemo(() => {
    const lines: string[] = [];
    if (projectPath?.trim()) lines.push(projectPath);
    if (statusText.trim()) lines.push(statusText);
    if (savedShort && saveBadge.startsWith("已保存")) lines.push(saveBadge);
    if (lastRunId) lines.push(`Run ${lastRunId}`);
    return lines.join("\n");
  }, [lastRunId, projectPath, saveBadge, savedShort, statusText]);

  return (
    <header className="appTopChrome">
      <div className="appTopChromeRow">
        <div className="appTopLead">
          <WorkspaceMenu />
          {!isTauri() ? (
            <span className="appTopWarn" title={DESKTOP_SHELL_HINT}>
              浏览器预览
            </span>
          ) : null}
        </div>

        <div className="appTopTabs">
          <CanvasTabs />
        </div>

        <div className="appTopChromeSpacer" aria-hidden />

        <div className="appTopTrail">
          {activeStyle ? (
            <button
              className="appTopBadge appTopBadge--style"
              style={{ "--style-color": STYLE_CATEGORY_META[activeStyle.category].color } as React.CSSProperties}
              onClick={toggleStylePanel}
              title={`当前风格：${activeStyle.title}（点击切换）`}
            >
              <span className="appTopStyleDot" />
              {activeStyle.title.slice(0, 12)}
              {activeStyle.title.length > 12 ? "…" : ""}
              <span className="appTopStyleClear" onClick={(e) => { e.stopPropagation(); setActiveStyleId(null); }} title="清除风格">×</span>
            </button>
          ) : null}
          {!projectPath && nodeCount > 0 ? (
            <span
              className="appTopBadge appTopBadge--warn"
              title="内容仅保存在内存中；请从顶栏打开或新建工程以写入本地目录。"
            >
              临时画布
            </span>
          ) : null}
          {saveBadge ? (
            <span
              className={`appTopBadge${
                projectDirty ? " appTopBadge--unsaved" : " appTopBadge--saved"
              }`}
            >
              {saveBadge}
            </span>
          ) : null}
          {statusShort ? (
            <span className="appTopBadge appTopBadge--status" title={statusDetailTitle || statusShort}>
              {statusShort}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
