import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  SCRIPT_AI_PARSE_BUSY_LABEL,
  SCRIPT_AI_REPARSE_BUTTON_LABEL,
} from "@/lib/scriptNodeActionLabels";
import { preflightScriptNodeLlm, scriptNodeLlmInvokeParams } from "@/lib/scriptNodeLlmParams";
import type { ScriptBeat } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  buildScriptNodeExportPayload,
  downloadScriptNodeExportJson,
} from "@/lib/scriptNodeExport";
import { ScriptBeatsEditorTable } from "@/components/ScriptBeatsEditorTable";
import type { ScriptBeatsTableLayout } from "@/lib/scriptBeatsTableModel";
import { patchBeatsWithSynthesizedPrompts } from "@/lib/scriptPromptSynthesis";
import { polishStoryboardPromptsWithLlm } from "@/lib/scriptPromptPolish";
import { useProjectStore } from "@/store/projectStore";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { scriptNodeDispatchAgentRuntime } from "@/lib/nodeAgentRuntime/dagnodeDispatchAgents";
import { scriptStoryboardGenerateAgentRuntime } from "@/lib/nodeAgentRuntime/scriptStoryboardAgent";
import { resolveStoryboardBeatScope } from "@/lib/scriptStoryboardScope";
import { scriptParseCompleteStatus } from "@/lib/scriptNodeFeedback";
import {
  canStartScriptParse,
  resolveScriptParseRequirement,
} from "@/lib/scriptParseDefaults";
import { patchFromScriptBeatsEdit, patchFromStoryboardDraftEdit } from "@/lib/storyboardDraftSync";
import { listScriptUpstreamTextSources } from "@/lib/scriptUpstreamText";
import { useScriptNodeTaskState } from "@/hooks/useScriptNodeTaskState";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { ScriptDocumentImportButton } from "@/components/script/ScriptDocumentImportButton";

/** 脚本节点全屏：基本/专业脚本镜头表 */
export function ScriptNodeFullscreenOverlay() {
  const nodeId = useProjectStore((s) => s.scriptFullscreenNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const projectPath = useProjectStore((s) => s.projectPath);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const closeScriptFullscreen = useProjectStore((s) => s.closeScriptFullscreen);
  const runNodeSubgraph = useProjectStore((s) => s.runNodeSubgraph);

  const [scriptTableLayout, setScriptTableLayout] = useState<ScriptBeatsTableLayout>("basic");
  const [exportBusy, setExportBusy] = useState(false);
  const [polishBusy, setPolishBusy] = useState(false);
  const [highlightBeatId, setHighlightBeatId] = useState<string | null>(null);
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
  const storyboardDraft = node?.data.storyboardDraft ?? "";
  const storedSelection = node?.data.scriptBeatSelection;
  const themePrompt = node?.data.prompt ?? "";
  const upstreamSources = useMemo(
    () => (nodeId ? listScriptUpstreamTextSources(nodes, edges, nodeId) : []),
    [edges, nodeId, nodes],
  );
  const hasUpstreamScriptText = upstreamSources.length > 0;
  const canParse = canStartScriptParse(themePrompt, hasUpstreamScriptText);
  const nodeParams =
    node?.data.params && typeof node.data.params === "object"
      ? (node.data.params as Record<string, unknown>)
      : undefined;
  const llmParams = useMemo(() => scriptNodeLlmInvokeParams(nodeParams), [nodeParams]);
  const displayTitle =
    node?.data.label?.trim() || (themePrompt.trim() ? themePrompt.slice(0, 80) : "脚本生成器");

  const rows = useMemo(() => normalizeScriptBeats(beats.length ? beats : []), [beats]);

  const persistBeats = (next: ScriptBeat[]) => {
    if (!nodeId) return;
    const patch = patchFromScriptBeatsEdit(next, storedSelection);
    updateNodeData(nodeId, patch);
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

  const locateBeatInScript = useCallback(
    (beatId: string) => {
      setHighlightBeatId(beatId);
      const beat = rows.find((b) => b.id === beatId);
      setStatusText(
        beat
          ? `已定位到第 ${rows.findIndex((b) => b.id === beatId) + 1} 镜`
          : "已定位镜头",
      );
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-beat-id="${beatId}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    },
    [rows, setStatusText],
  );

  useEffect(() => {
    if (!nodeId || !inspectorStoryboardFocus || inspectorStoryboardFocus.scriptNodeId !== nodeId) {
      return;
    }
    const beatId = inspectorStoryboardFocus.beatId;
    setInspectorStoryboardFocus(null);
    locateBeatInScript(beatId);
  }, [inspectorStoryboardFocus, locateBeatInScript, nodeId, setInspectorStoryboardFocus]);

  if (!nodeId || !node) return null;

  const taskLocked = isBusy || exportBusy || polishBusy;
  const parseBusy = isGraphRunning || (isBusy && !isStoryboardBusy);
  const canRegen = Boolean(projectPath?.trim() && canParse && !taskLocked);
  const canStoryboard = Boolean(projectPath?.trim() && rows.length > 0 && !taskLocked);
  const canSynthesizePrompts = Boolean(rows.length > 0 && !taskLocked);
  const canPolishPrompts = Boolean(rows.length > 0 && !taskLocked);
  const canExport = Boolean(rows.length > 0 && !exportBusy);
  const canSyncDraft = Boolean(storyboardDraft.trim() && !taskLocked);

  const onSynthesizePrompts = () => {
    if (!nodeId || rows.length === 0) return;
    const next = patchBeatsWithSynthesizedPrompts(rows);
    persistBeats(next);
    setStatusText(`已为 ${next.length} 个镜头合成分镜提示词`);
  };

  const onPolishPrompts = () => {
    if (!nodeId || rows.length === 0) return;
    void (async () => {
      setPolishBusy(true);
      try {
        if (!(await preflightScriptNodeLlm(nodeParams, setStatusText))) return;
        setStatusText("正在润色分镜提示词…");
        const { beats: next, polishedCount, usedLlm } = await polishStoryboardPromptsWithLlm(
          rows,
          llmParams,
        );
        persistBeats(next);
        if (!usedLlm) {
          setStatusText(`已用规则合成 ${next.length} 条分镜提示词（非桌面端未调用 LLM）`);
        } else if (polishedCount === 0) {
          setStatusText("润色未返回有效结果，已保留规则合成稿");
        } else {
          setStatusText(`已润色 ${polishedCount}/${next.length} 条分镜提示词`);
        }
      } catch {
        setStatusText("润色分镜提示词失败，请检查模型配置");
      } finally {
        setPolishBusy(false);
      }
    })();
  };

  const onSyncFromDraft = () => {
    if (!nodeId) return;
    const result = patchFromStoryboardDraftEdit(storyboardDraft, rows, storedSelection);
    if (!result.scriptBeats) {
      setStatusText("分镜稿格式无效，请检查 --- 分镜块");
      return;
    }
    updateNodeData(nodeId, result);
    setStatusText(`已从分镜稿同步 ${result.scriptBeats.length} 条镜头`);
  };

  const onRegen = () => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程目录");
      return;
    }
    const promptText = resolveScriptParseRequirement(themePrompt, hasUpstreamScriptText);
    if (!canParse) {
      setStatusText("请连接上游剧本或填写解析要求");
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
        setStatusText(`分镜文案已生成，请在 Inspector 查看分镜缩略图`);
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
            disabled={!canSynthesizePrompts}
            onClick={onSynthesizePrompts}
            title="根据画面描述等字段合成分镜提示词"
          >
            <span className="scriptLibFloatActionIco" aria-hidden>
              ✦
            </span>
            合成提示词
          </button>
          <button
            type="button"
            className="scriptLibFloatActionBtn"
            disabled={!canPolishPrompts}
            onClick={onPolishPrompts}
            title="用 LLM 润色中文分镜提示词（先规则合成再优化）"
          >
            <span className="scriptLibFloatActionIco" aria-hidden>
              ✎
            </span>
            {polishBusy ? "润色中…" : "润色提示词"}
          </button>
          <button
            type="button"
            className="scriptLibFloatActionBtn"
            disabled={!canStoryboard}
            onClick={onGenerateStoryboard}
            title="为全部镜头生成分镜文案"
          >
            <span className="scriptLibFloatActionIco" aria-hidden>
              ⊞
            </span>
            生成分镜
          </button>
          <button
            type="button"
            className="scriptLibFloatActionBtn"
            disabled={!canSyncDraft}
            onClick={onSyncFromDraft}
            title="将分镜稿同步为镜头表"
          >
            <span className="scriptLibFloatActionIco" aria-hidden>
              ⇄
            </span>
            同步镜头表
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
              <span className="scriptLibViewBadge">脚本视图</span>
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
          <div className="scriptTableWrap scriptTableWrapFullscreenInner">
            <ScriptBeatsEditorTable
              variant="fullscreen"
              tableMode={scriptTableLayout}
              onFullscreenLayoutChange={setScriptTableLayout}
              readOnly={parseBusy}
              rows={rows}
              onPersistRows={persistBeats}
              projectPath={projectPath}
              onStatusText={setStatusText}
              highlightBeatId={highlightBeatId}
              onHighlightDone={() => setHighlightBeatId(null)}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
