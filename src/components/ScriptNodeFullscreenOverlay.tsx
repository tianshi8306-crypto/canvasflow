import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ScriptBeat } from "@/lib/types";
import { normalizeScriptBeat, normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { ScriptBeatsEditorTable } from "@/components/ScriptBeatsEditorTable";
import { ScriptCreativeViewGrid } from "@/components/ScriptCreativeViewGrid";
import { useProjectStore } from "@/store/projectStore";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { scriptNodeDispatchAgentRuntime } from "@/lib/nodeAgentRuntime/dagnodeDispatchAgents";
import { scriptStoryboardGenerateAgentRuntime } from "@/lib/nodeAgentRuntime/scriptStoryboardAgent";

/** 脚本节点全屏：脚本表格 / 创意分镜缩略图网格 */
export function ScriptNodeFullscreenOverlay() {
  const nodeId = useProjectStore((s) => s.scriptFullscreenNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const projectPath = useProjectStore((s) => s.projectPath);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const closeScriptFullscreen = useProjectStore((s) => s.closeScriptFullscreen);
  const runNodeSubgraph = useProjectStore((s) => s.runNodeSubgraph);
  const isGraphRunning = useProjectStore((s) => s.isGraphRunning);

  const [tab, setTab] = useState<"script" | "creative">("script");
  const [busy, setBusy] = useState<null | "regen" | "storyboard" | "export">(null);
  const lastExportUrlRef = useRef<string | null>(null);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId) ?? null, [nodes, nodeId]);

  useEffect(() => {
    if (nodeId && !nodes.some((n) => n.id === nodeId)) {
      closeScriptFullscreen();
    }
  }, [nodeId, nodes, closeScriptFullscreen]);

  const beats = node?.data.scriptBeats ?? [];
  const storedSelection = node?.data.scriptBeatSelection;
  const themePrompt = node?.data.prompt ?? "";
  const displayTitle =
    node?.data.label?.trim() || (themePrompt.trim() ? themePrompt.slice(0, 80) : "脚本生成器");

  const rows = useMemo(() => normalizeScriptBeats(beats.length ? beats : []), [beats]);
  const selectedIds = useMemo(
    () => (storedSelection ?? []).filter((id) => rows.some((r) => r.id === id)),
    [storedSelection, rows],
  );

  useEffect(() => {
    return () => {
      if (lastExportUrlRef.current) URL.revokeObjectURL(lastExportUrlRef.current);
      lastExportUrlRef.current = null;
    };
  }, []);

  const persistBeats = (next: ScriptBeat[]) => {
    if (!nodeId) return;
    const normalized = next.map((b) => normalizeScriptBeat(b));
    const valid = new Set(normalized.map((b) => b.id));
    const prunedSel = (storedSelection ?? []).filter((id) => valid.has(id));
    updateNodeData(nodeId, { scriptBeats: normalized, scriptBeatSelection: prunedSel });
  };

  const setSelection = (next: string[]) => {
    if (!nodeId) return;
    const allowed = new Set(rows.map((r) => r.id));
    updateNodeData(nodeId, { scriptBeatSelection: next.filter((id) => allowed.has(id)) });
  };

  const toggleSelect = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    setSelection(next);
  };

  useEffect(() => {
    if (!nodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeScriptFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodeId, closeScriptFullscreen]);

  if (!nodeId || !node) return null;

  const canRegen = Boolean(projectPath?.trim() && themePrompt.trim() && !busy && !isGraphRunning);
  const canStoryboard = Boolean(projectPath?.trim() && rows.length > 0 && !busy);
  const canExport = Boolean(rows.length > 0 && !busy);

  const onRegen = () => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程目录");
      return;
    }
    const promptText = themePrompt.trim();
    if (!promptText) {
      setStatusText("请先填写脚本生成要求或剧本文本");
      return;
    }
    void (async () => {
      setBusy("regen");
      try {
        if (isTauri()) {
          try {
            const settings = await invoke<{ providers?: Array<{ id: string; label: string; enabled: boolean; priority: number }> }>(
              "load_settings",
            );
            const enabledProviders = (settings.providers ?? [])
              .filter((p) => p.enabled)
              .sort((a, b) => a.priority - b.priority);
            const effectiveProvider = enabledProviders[0];
            if (!effectiveProvider) {
              setStatusText("没有可用 Provider，请先到设置中启用一个模型通道");
              return;
            }
            const hasKey = await invoke<boolean>("has_api_key", { providerId: effectiveProvider.id });
            if (!hasKey) {
              setStatusText(`未配置 API Key：${effectiveProvider.label}。请先到顶栏“设置”中填写`);
              return;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setStatusText(`解析前检查失败：${msg}`);
            return;
          }
        }
        setStatusText("脚本节点正在解析中，请稍候…");
        await runNodeTaskAgent(
          scriptNodeDispatchAgentRuntime,
          { prompt: promptText, dispatch: runNodeSubgraph },
          { nodeId, projectPath, updateNodeData, setStatusText },
        );
        const latestNode = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
        const latestBeats = normalizeScriptBeats(latestNode?.data.scriptBeats ?? []);
        setStatusText(
          latestBeats.length > 0 ? `脚本解析完成：共 ${latestBeats.length} 条镜头` : "脚本解析完成：未生成镜头，请调整要求后重试",
        );
      } finally {
        setBusy(null);
      }
    })();
  };

  const onGenerateStoryboard = () => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程后再生成分镜");
      return;
    }
    if (rows.length === 0) {
      setStatusText("请先生成脚本镜头后再生成分镜");
      return;
    }
    const picked = selectedIds.length > 0 ? rows.filter((b) => selectedIds.includes(b.id)) : rows;
    void (async () => {
      setBusy("storyboard");
      try {
        await runNodeTaskAgent(
          scriptStoryboardGenerateAgentRuntime,
          { targetBeats: picked, themePrompt, prevShots: node.data.storyboardShots },
          { nodeId, projectPath, updateNodeData, setStatusText },
        );
        setTab("creative");
      } finally {
        setBusy(null);
      }
    })();
  };

  const onExport = () => {
    if (rows.length === 0) {
      setStatusText("暂无可导出的脚本镜头");
      return;
    }
    void (async () => {
      setBusy("export");
      try {
        const payload = {
          version: 1,
          exportedAt: Date.now(),
          nodeId,
          title: displayTitle,
          themePrompt,
          scriptBeats: rows,
          storyboardShots: node.data.storyboardShots ?? [],
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        if (lastExportUrlRef.current) URL.revokeObjectURL(lastExportUrlRef.current);
        lastExportUrlRef.current = url;
        const safeTitle = (displayTitle || "script")
          .replace(/[\\/:*?"<>|]/g, "_")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 40);
        const file = `${safeTitle || "script"}-export-${new Date().toISOString().slice(0, 10)}.json`;
        const a = document.createElement("a");
        a.href = url;
        a.download = file;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatusText(`已导出：${file}`);
      } finally {
        setBusy(null);
      }
    })();
  };

  return createPortal(
    <div
      className="scriptFullscreenBackdrop scriptLibFullscreenBackdrop"
      role="presentation"
      onClick={() => closeScriptFullscreen()}
    >
      <div
        className="scriptLibFullscreenPanel"
        role="dialog"
        aria-modal="true"
        aria-label="脚本全屏"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="scriptLibFloatActions" role="group" aria-label="脚本快捷操作">
          <button
            type="button"
            className="scriptLibFloatActionBtn"
            disabled={!canRegen}
            onClick={onRegen}
            title="按当前输入与上游素材重新解析脚本镜头"
          >
            <span className="scriptLibFloatActionIco" aria-hidden>
              ↻
            </span>
            重新生成
          </button>
          <button
            type="button"
            className="scriptLibFloatActionBtn"
            disabled={!canStoryboard}
            onClick={onGenerateStoryboard}
            title="为选中镜头（无选中则全部）生成分镜文案，并切换到创意视图"
          >
            <span className="scriptLibFloatActionIco" aria-hidden>
              ⊞
            </span>
            生成分镜
          </button>
          <button
            type="button"
            className="scriptLibFloatActionBtn scriptLibFloatActionBtn--iconOnly"
            disabled={!canExport}
            onClick={onExport}
            title="导出脚本与分镜为 JSON"
            aria-label="导出 JSON"
          >
            <span className="scriptLibFloatActionIco" aria-hidden>
              ↓
            </span>
          </button>
        </div>
        <div className="scriptLibFullscreenHead">
          <div className="scriptLibFullscreenTitleRow">
            <div className="scriptLibFullscreenTitle mono" title={displayTitle}>
              {displayTitle}
            </div>
            <div className="scriptLibFullscreenHeadRight">
              <label className="scriptLibFullscreenSelect">
                <span className="srOnly">视图</span>
                <select
                  value={tab}
                  onChange={(e) => setTab(e.target.value as "script" | "creative")}
                  aria-label="脚本视图或创意视图"
                >
                  <option value="script">脚本视图</option>
                  <option value="creative">创意视图</option>
                </select>
              </label>
              <button
                type="button"
                className="scriptNodeExpandBtn scriptNodeExpandBtn--inHead"
                onClick={() => closeScriptFullscreen()}
                title="退出全屏"
                aria-label="退出全屏"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M9 4 4 4v5M15 4l5 0v5M9 20l-5 0v-5M15 20l5 0v-5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="scriptLibFullscreenSubTabs">
            <button
              type="button"
              className={`scriptLibSubTab${tab === "script" ? " scriptLibSubTab--active" : ""}`}
              onClick={() => setTab("script")}
            >
              脚本视图
            </button>
            <button
              type="button"
              className={`scriptLibSubTab${tab === "creative" ? " scriptLibSubTab--active" : ""}`}
              onClick={() => setTab("creative")}
            >
              创意视图
            </button>
          </div>
        </div>

        <div className="scriptLibFullscreenBody">
          {tab === "creative" ? (
            <div className="scriptCreativeWrap">
              <ScriptCreativeViewGrid
                beats={rows}
                shots={node.data.storyboardShots}
                projectPath={projectPath}
              />
            </div>
          ) : (
            <div className="scriptTableWrap scriptTableWrapFullscreenInner">
              <ScriptBeatsEditorTable
                variant="fullscreen"
                rows={rows}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onPersistRows={persistBeats}
                projectPath={projectPath}
                onStatusText={setStatusText}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
