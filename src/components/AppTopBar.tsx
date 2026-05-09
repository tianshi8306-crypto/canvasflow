import { isTauri } from "@tauri-apps/api/core";
import { useMemo } from "react";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { useProjectStore } from "@/store/projectStore";

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
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconNewProject() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 11v6M9 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconOpenProject() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconRun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 3l14 9-14 9V3z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
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

  const newProject = useProjectStore((s) => s.newProject);
  const openProject = useProjectStore((s) => s.openProject);
  const saveProject = useProjectStore((s) => s.saveProject);
  const runWorkflow = useProjectStore((s) => s.runWorkflow);

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
          <button type="button" className="appTopChip appTopChip--icon" onClick={() => void newProject()} title="新建工程">
            <IconNewProject />
            <span>新建工程</span>
          </button>
          <button type="button" className="appTopChip appTopChip--icon" onClick={() => void openProject()} title="打开工程">
            <IconOpenProject />
            <span>打开工程</span>
          </button>
          <button type="button" className="appTopChip appTopChip--icon" onClick={() => void saveProject()} disabled={!projectPath} title="保存工程">
            <IconSave />
            <span>保存</span>
          </button>
          <button
            type="button"
            className="appTopChip appTopChip--icon appTopChip--primary"
            onClick={() => void runWorkflow()}
            disabled={!projectPath}
            title={!projectPath ? "请先打开工程" : "运行当前工作流"}
          >
            <IconRun />
            <span>运行工作流</span>
          </button>
          <button type="button" className="appTopChip appTopChip--icon" title="打开设置（API Key / 模型）" aria-label="设置" onClick={onOpenSettings}>
            <IconSettings />
            <span>设置</span>
          </button>
          <button
            type="button"
            className="appTopChip appTopChip--icon appTopChip--danger"
            title="关闭窗口"
            aria-label="关闭窗口"
            onClick={closeApp}
          >
            <IconCloseApp />
            <span>关闭</span>
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
