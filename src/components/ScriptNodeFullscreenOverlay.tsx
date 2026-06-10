import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { isTauri } from "@tauri-apps/api/core";
import {
  SCRIPT_AI_PARSE_BUSY_LABEL,
  SCRIPT_AI_REPARSE_BUTTON_LABEL,
} from "@/lib/scriptNodeActionLabels";
import { preflightScriptNodeLlm, scriptNodeLlmInvokeParams } from "@/lib/scriptNodeLlmParams";
import type { ScriptBeat } from "@/lib/types";
import { normalizeScriptBeat, normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  buildScriptNodeExportPayload,
  downloadScriptNodeExportJson,
} from "@/lib/scriptNodeExport";
import { ScriptBeatsEditorTable } from "@/components/ScriptBeatsEditorTable";
import { ScriptCreativeViewGrid } from "@/components/ScriptCreativeViewGrid";
import { useProjectStore } from "@/store/projectStore";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { scriptNodeDispatchAgentRuntime } from "@/lib/nodeAgentRuntime/dagnodeDispatchAgents";
import { scriptStoryboardGenerateAgentRuntime } from "@/lib/nodeAgentRuntime/scriptStoryboardAgent";
import { resolveStoryboardBeatScope } from "@/lib/scriptStoryboardScope";
import { scriptParseCompleteStatus } from "@/lib/scriptNodeFeedback";
import { useScriptNodeTaskState } from "@/hooks/useScriptNodeTaskState";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { importStoryboardImageForBeat } from "@/lib/scriptStoryboardImageImport";
import { formatUserError } from "@/lib/errors";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { ScriptDocumentImportButton } from "@/components/script/ScriptDocumentImportButton";

/** 脚本节点全屏：脚本表格（只读） / 创意分镜缩略图网格（保留选图功能） */
export function ScriptNodeFullscreenOverlay() {
  const nodeId = useProjectStore((s) => s.scriptFullscreenNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const projectPath = useProjectStore((s) => s.projectPath);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const closeScriptFullscreen = useProjectStore((s) => s.closeScriptFullscreen);
  const runNodeSubgraph = useProjectStore((s) => s.runNodeSubgraph);

  const [tab, setTab] = useState<"script" | "creative">("script");
  const [exportBusy, setExportBusy] = useState(false);
  const [highlightBeatId, setHighlightBeatId] = useState<string | null>(null);
  const pendingPickBeatIdRef = useRef<string | null>(null);
  const creativeImageInputRef = useRef<HTMLInputElement | null>(null);
  const inspectorStoryboardFocus = useCanvasUiStore((s) => s.inspectorStoryboardFocus);
  const setInspectorStoryboardFocus = useCanvasUiStore((s) => s.setInspectorStoryboardFocus);
  const node = useMemo(() => nodes.find((n) => n.id === nodeId) ?? null, [nodes, nodeId]);
  const { isBusy, isStoryboardBusy, isGraphRunning, panelFeedback } = useScriptNodeTaskState(
    nodeId ?? "",
  );

  useEffect(() => {
    if (nodeId && !nodes.some((n) => n.id === nodeId)) {
      closeScriptFullscreen();
    }
  }, [nodeId, nodes, closeScriptFullscreen]);

  const beats = node?.data.scriptBeats ?? [];
  const storedSelection = node?.data.scriptBeatSelection;
  const themePrompt = node?.data.prompt ?? "";
  const nodeParams =
    node?.data.params && typeof node.data.params === "object"
      ? (node.data.params as Record<string, unknown>)
      : undefined;
  const llmParams = useMemo(() => scriptNodeLlmInvokeParams(nodeParams), [nodeParams]);
  const displayTitle =
    node?.data.label?.trim() || (themePrompt.trim() ? themePrompt.slice(0, 80) : "脚本生成器");

  const rows = useMemo(() => normalizeScriptBeats(beats.length ? beats : []), [beats]);
  const selectedIds = useMemo(
    () => (storedSelection ?? []).filter((id) => rows.some((r) => r.id === id)),
    [storedSelection, rows],
  );

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

  const focusBeatInCreative = useCallback(
    (beatId: string) => {
      const beat = rows.find((b) => b.id === beatId);
      if (!beat) {
        setTab("creative");
        setStatusText("已切换到创意视图");
        return;
      }
      setTab("creative");
      setHighlightBeatId(beatId);
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-beat-id="${beatId}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      setStatusText(`已在创意视图聚焦镜号 ${beat.shotNumber || "—"}`);
    },
    [rows, setStatusText],
  );

  useEffect(() => {
    if (!nodeId || !inspectorStoryboardFocus || inspectorStoryboardFocus.scriptNodeId !== nodeId) {
      return;
    }
    const beatId = inspectorStoryboardFocus.beatId;
    setInspectorStoryboardFocus(null);
    focusBeatInCreative(beatId);
  }, [
    focusBeatInCreative,
    inspectorStoryboardFocus,
    nodeId,
    setInspectorStoryboardFocus,
  ]);

  const applyImportedImage = useCallback(
    (beatId: string, filePaths: string[]) => {
      if (!nodeId || !projectPath?.trim() || filePaths.length === 0) return;
      void (async () => {
        try {
          const latestNode = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
          const latestShots = latestNode?.data.storyboardShots;
          const result = await importStoryboardImageForBeat(
            projectPath,
            filePaths,
            latestShots,
            beatId,
          );
          if (!result) return;
          updateNodeData(nodeId, { storyboardShots: result.shots });
          setStatusText(`已关联分镜图：${result.relPath}`);
        } catch (e) {
          setStatusText(`导入分镜图失败：${formatUserError(e)}`);
        }
      })();
    },
    [nodeId, projectPath, setStatusText, updateNodeData],
  );

  const onPickCreativeImage = useCallback(
    (beatId: string) => {
      if (!projectPath?.trim()) {
        setStatusText("请先打开工程后再关联分镜图");
        return;
      }
      pendingPickBeatIdRef.current = beatId;
      void (async () => {
        if (isTauri()) {
          const paths = await pickImagePathsForImport(false);
          if (paths?.length) applyImportedImage(beatId, paths);
          pendingPickBeatIdRef.current = null;
        } else {
          creativeImageInputRef.current?.click();
        }
      })();
    },
    [applyImportedImage, projectPath, setStatusText],
  );

  if (!nodeId || !node) return null;

  const failedShotCount = (node.data.storyboardShots ?? []).filter((s) => s.status === "failed").length;

  const locateBeatInScript = (beatId: string) => {
    setTab("script");
    setHighlightBeatId(beatId);
    const beat = rows.find((b) => b.id === beatId);
    setStatusText(
      beat
        ? `已定位到脚本表：镜号 ${beat.shotNumber || "—"}（可参考后重新生成分镜）`
        : "已切换到脚本视图",
    );
  };

  const onCreativeImageFiles = (ev: ChangeEvent<HTMLInputElement>) => {
    const beatId = pendingPickBeatIdRef.current;
    const input = ev.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    pendingPickBeatIdRef.current = null;
    if (!beatId || files.length === 0) return;
    const paths = files
      .map((f) => (f as File & { path?: string }).path)
      .filter((p): p is string => Boolean(p && typeof p === "string"));
    if (paths.length === 0) {
      setStatusText("未拿到本地文件路径：请在 Tauri 桌面端选择文件");
      return;
    }
    applyImportedImage(beatId, paths);
  };

  const selectAllBeats = () => setSelection(rows.map((r) => r.id));
  const clearBeatSelection = () => setSelection([]);

  const taskLocked = isBusy || exportBusy;
  const parseBusy = isGraphRunning || (isBusy && !isStoryboardBusy);
  const canRegen = Boolean(projectPath?.trim() && themePrompt.trim() && !taskLocked);
  const canStoryboard = Boolean(projectPath?.trim() && rows.length > 0 && !taskLocked);
  const canExport = Boolean(rows.length > 0 && !exportBusy);

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
      try {
        if (!(await preflightScriptNodeLlm(nodeParams, setStatusText))) return;
        setStatusText("脚本节点正在 AI 解析中，请稍候…");
        await runNodeTaskAgent(
          scriptNodeDispatchAgentRuntime,
          { prompt: promptText, dispatch: runNodeSubgraph },
          { nodeId, projectPath, updateNodeData, setStatusText },
        );
        const latestNode = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
        const latestBeats = normalizeScriptBeats(latestNode?.data.scriptBeats ?? []);
        setStatusText(scriptParseCompleteStatus(latestBeats.length));
      } catch {
        /* runNodeTaskAgent 已写入状态 */
      }
    })();
  };

  const onGenerateStoryboard = () => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程后再生成分镜");
      return;
    }
    if (rows.length === 0) {
      setStatusText("请先 AI 解析脚本镜头后再生成分镜");
      return;
    }
    const scopeResult = resolveStoryboardBeatScope(rows, storedSelection);
    if (!scopeResult.ok) {
      setStatusText(scopeResult.message);
      return;
    }
    const picked = scopeResult.scope.beats;
    void (async () => {
      try {
        if (!(await preflightScriptNodeLlm(nodeParams, setStatusText))) return;
        await runNodeTaskAgent(
          scriptStoryboardGenerateAgentRuntime,
          {
            targetBeats: picked,
            themePrompt,
            prevShots: node.data.storyboardShots,
            llmParams,
          },
          { nodeId, projectPath, updateNodeData, setStatusText },
        );
        setTab("creative");
      } catch {
        /* runNodeTaskAgent 已写入状态 */
      }
    })();
  };

  const onExport = () => {
    if (rows.length === 0) {
      setStatusText("暂无可导出的脚本镜头");
      return;
    }
    void (async () => {
      setExportBusy(true);
      try {
        const payload = buildScriptNodeExportPayload({
          nodeId,
          label: node.data.label,
          themePrompt,
          beats: rows,
          storyboardShots: node.data.storyboardShots,
        });
        const file = downloadScriptNodeExportJson(payload);
        setStatusText(`已导出：${file}`);
      } finally {
        setExportBusy(false);
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
            title={`${SCRIPT_AI_REPARSE_BUTTON_LABEL}（使用底栏所选模型）`}
          >
            <span className="scriptLibFloatActionIco" aria-hidden>
              ↻
            </span>
            {parseBusy ? SCRIPT_AI_PARSE_BUSY_LABEL : SCRIPT_AI_REPARSE_BUTTON_LABEL}
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
          {nodeId ? (
            <ScriptDocumentImportButton
              scriptNodeId={nodeId}
              disabled={parseBusy || isStoryboardBusy}
              className="scriptLibFloatActionBtn"
            />
          ) : null}
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

        {panelFeedback ? (
          <div
            className={`scriptLibFeedback igp-feedback igp-feedback--${panelFeedback.tone === "error" ? "block" : panelFeedback.tone === "warn" ? "warn" : "info"}`}
            role={panelFeedback.tone === "error" ? "alert" : "status"}
          >
            {panelFeedback.message}
          </div>
        ) : null}

        <div className="scriptLibFullscreenBody">
          {tab === "creative" ? (
            <div className="scriptCreativeWrap">
              <input
                ref={creativeImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                style={{ display: "none" }}
                onChange={onCreativeImageFiles}
              />
              <div className="scriptCreativeToolbar" role="status">
                <span>
                  已选 {selectedIds.length} / {rows.length} 镜（与脚本表、生成分镜勾选一致）
                </span>
                <div className="scriptCreativeToolbarActions">
                  {selectedIds.length < rows.length ? (
                    <button type="button" className="btn" onClick={selectAllBeats}>
                      全选
                    </button>
                  ) : null}
                  {selectedIds.length > 0 ? (
                    <button type="button" className="btn" onClick={clearBeatSelection}>
                      清空勾选
                    </button>
                  ) : null}
                </div>
              </div>
              {failedShotCount > 0 ? (
                <p className="scriptCreativeFailedBar" role="status">
                  {failedShotCount} 条分镜失败 — 点击「定位镜头」回到脚本表修改，或在创意视图「聚焦镜头」后重试
                </p>
              ) : null}
              <ScriptCreativeViewGrid
                beats={rows}
                shots={node.data.storyboardShots}
                projectPath={projectPath}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                highlightBeatId={highlightBeatId}
                onLocateBeatInScript={locateBeatInScript}
                onPickImage={onPickCreativeImage}
                onFocusStoryboardBeat={focusBeatInCreative}
              />
            </div>
          ) : (
            <div className="scriptTableWrap scriptTableWrapFullscreenInner">
              <ScriptBeatsEditorTable
                variant="fullscreen"
                readOnly
                rows={rows}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onPersistRows={persistBeats}
                projectPath={projectPath}
                onStatusText={setStatusText}
                highlightBeatId={highlightBeatId}
                onHighlightDone={() => setHighlightBeatId(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
