import { isTauri } from "@tauri-apps/api/core";
import { useMemo } from "react";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { useProjectStore } from "@/store/projectStore";
import { CanvasTabs } from "./CanvasTabs";

export function AppTopBar() {
  const statusText = useProjectStore((s) => s.statusText);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);
  const lastRunId = useProjectStore((s) => s.lastRunId);
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodeCount = useProjectStore((s) => s.nodes.length);

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

        <CanvasTabs />

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
