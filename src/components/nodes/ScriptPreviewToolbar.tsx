import { useCallback, useMemo, useState } from "react";
import { useScriptNodeTaskState } from "@/hooks/useScriptNodeTaskState";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  SCRIPT_AI_PARSE_BUSY_LABEL,
  SCRIPT_AI_REPARSE_BUTTON_LABEL,
} from "@/lib/scriptNodeActionLabels";
import { preflightScriptNodeLlm, scriptNodeLlmInvokeParams } from "@/lib/scriptNodeLlmParams";
import {
  buildScriptNodeExportPayload,
  downloadScriptNodeExportJson,
} from "@/lib/scriptNodeExport";
import { scriptNodeDispatchAgentRuntime } from "@/lib/nodeAgentRuntime/dagnodeDispatchAgents";
import { scriptStoryboardGenerateAgentRuntime } from "@/lib/nodeAgentRuntime/scriptStoryboardAgent";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import {
  resolveStoryboardBeatScope,
  storyboardScopeActionHint,
  storyboardScopeToolbarLabel,
} from "@/lib/scriptStoryboardScope";
import {
  openScriptNodeFullscreen,
} from "@/lib/scriptNodeCanvasEntries";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  nodeId: string;
};

function IconRegen() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden>
      <path
        d="M12.5 2.5v3h-3M3.5 13.5v-3h3M12.8 5.2A5 5 0 0 0 4 6.5M3.2 10.8A5 5 0 0 0 12 9.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 胶片 + 角标（对标设计稿「生成分镜」） */
function IconStoryboard() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden>
      <rect
        x="2.5"
        y="4"
        width="11"
        height="8"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M5 6.5v5M8 6.5v5M11 6.5v5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path
        d="M11.5 4.5l1.2 1.2M12.2 3.8l.6-.6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="12.8" cy="3.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconFullscreen() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        d="M4 6V4h2M10 4h2v2M12 10v2h-2M6 12H4v-2M4 4l2.5 2.5M12 4 9.5 6.5M12 12 9.5 9.5M4 12 6.5 9.5"
      />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden>
      <path
        d="M8 3v7m0 0 2-2M8 10 6 8M4 12.5h8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 有镜头时顶栏：解析/分镜 + 全屏/主题 + 下载 */
export function ScriptPreviewToolbar({ nodeId }: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const runNodeSubgraph = useProjectStore((s) => s.runNodeSubgraph);
  const { isBusy, isStoryboardBusy, isGraphRunning } = useScriptNodeTaskState(nodeId);

  const [exportBusy, setExportBusy] = useState(false);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const nodeParams =
    node?.data.params && typeof node.data.params === "object"
      ? (node.data.params as Record<string, unknown>)
      : undefined;
  const llmParams = useMemo(() => scriptNodeLlmInvokeParams(nodeParams), [nodeParams]);
  const themePrompt = node?.data.prompt ?? "";
  const rows = useMemo(
    () => normalizeScriptBeats(node?.data.scriptBeats ?? []),
    [node?.data.scriptBeats],
  );
  const hasBeats = rows.length > 0;

  const storyboardScope = useMemo(
    () => resolveStoryboardBeatScope(rows, node?.data.scriptBeatSelection),
    [node?.data.scriptBeatSelection, rows],
  );

  const onRegen = useCallback(() => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程目录");
      return;
    }
    const promptText = themePrompt.trim();
    if (!promptText) {
      setStatusText("请先填写剧情主题或脚本约束");
      return;
    }
    if (isBusy || exportBusy) {
      setStatusText("当前有任务正在执行，请稍候");
      return;
    }
    void (async () => {
      try {
        if (!(await preflightScriptNodeLlm(nodeParams, setStatusText))) return;
        await runNodeTaskAgent(
          scriptNodeDispatchAgentRuntime,
          { prompt: promptText, dispatch: runNodeSubgraph },
          { nodeId, projectPath, updateNodeData, setStatusText },
        );
      } catch {
        /* runNodeTaskAgent 已写入状态 */
      }
    })();
  }, [
    exportBusy,
    isBusy,
    nodeId,
    nodeParams,
    projectPath,
    runNodeSubgraph,
    setStatusText,
    themePrompt,
    updateNodeData,
  ]);

  const onStoryboard = useCallback(() => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程目录");
      return;
    }
    if (!hasBeats) {
      setStatusText("请先 AI 解析脚本镜头");
      return;
    }
    if (!storyboardScope.ok) {
      setStatusText(storyboardScope.message);
      return;
    }
    if (isBusy || exportBusy) {
      setStatusText("当前有任务正在执行，请稍候");
      return;
    }
    const { beats: targetBeats } = storyboardScope.scope;
    void (async () => {
      try {
        if (!(await preflightScriptNodeLlm(nodeParams, setStatusText))) return;
        const latestNode = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
        const latestShots = latestNode?.data.storyboardShots;
        await runNodeTaskAgent(
          scriptStoryboardGenerateAgentRuntime,
          {
            targetBeats,
            themePrompt,
            prevShots: latestShots,
            llmParams,
          },
          { nodeId, projectPath, updateNodeData, setStatusText },
        );
      } catch {
        /* runNodeTaskAgent 已写入状态 */
      }
    })();
  }, [
    exportBusy,
    hasBeats,
    isBusy,
    llmParams,
    nodeId,
    nodeParams,
    projectPath,
    setStatusText,
    storyboardScope,
    themePrompt,
    updateNodeData,
  ]);

  const onFullscreen = useCallback(() => {
    openScriptNodeFullscreen(nodeId);
  }, [nodeId]);

  const onDownload = useCallback(() => {
    if (!hasBeats) {
      setStatusText("暂无镜头可导出");
      return;
    }
    if (exportBusy || isBusy) return;
    void (async () => {
      setExportBusy(true);
      try {
        const payload = buildScriptNodeExportPayload({
          nodeId,
          label: node?.data.label,
          themePrompt,
          beats: rows,
          storyboardShots: node?.data.storyboardShots,
        });
        const file = downloadScriptNodeExportJson(payload);
        setStatusText(`已导出：${file}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusText(`导出失败：${msg}`);
      } finally {
        setExportBusy(false);
      }
    })();
  }, [exportBusy, hasBeats, isBusy, node, nodeId, rows, setStatusText, themePrompt]);

  const parseBusy = isGraphRunning || (isBusy && !isStoryboardBusy);
  const disabled = isBusy || exportBusy;
  const regenLabel = parseBusy ? SCRIPT_AI_PARSE_BUSY_LABEL : SCRIPT_AI_REPARSE_BUTTON_LABEL;
  const storyboardBusy = isStoryboardBusy;
  const storyboardLabel =
    storyboardScope.ok
      ? storyboardScopeToolbarLabel(storyboardScope.scope, storyboardBusy)
      : storyboardBusy
        ? "分镜中…"
        : "生成分镜";
  const storyboardTitle =
    storyboardScope.ok
      ? storyboardScopeActionHint(storyboardScope.scope)
      : "生成分镜（勾选优先，无勾选则全部）";

  return (
    <div
      className="scriptPreviewToolbar"
      role="toolbar"
      aria-label="脚本功能"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="scriptPreviewToolbar-scroll">
        <button
          type="button"
          className="scriptPreviewToolbar-labeledBtn"
          title={regenLabel}
          aria-label={regenLabel}
          disabled={disabled || !themePrompt.trim()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRegen}
        >
          <span className="scriptPreviewToolbar-btnIcon" aria-hidden>
            <IconRegen />
          </span>
          <span className="scriptPreviewToolbar-btnLabel">{regenLabel}</span>
        </button>

        <button
          type="button"
          className="scriptPreviewToolbar-labeledBtn"
          title={storyboardTitle}
          aria-label={storyboardTitle}
          disabled={disabled || !hasBeats}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onStoryboard}
        >
          <span className="scriptPreviewToolbar-btnIcon" aria-hidden>
            <IconStoryboard />
          </span>
          <span className="scriptPreviewToolbar-btnLabel">{storyboardLabel}</span>
        </button>

        <button
          type="button"
          className="scriptPreviewToolbar-iconBtn"
          title={exportBusy ? "导出中…" : "下载"}
          aria-label="下载脚本 JSON"
          disabled={disabled || !hasBeats}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDownload}
        >
          <IconDownload />
        </button>

        <button
          type="button"
          className="scriptPreviewToolbar-iconBtn"
          title="全屏展开"
          aria-label="全屏展开脚本表格"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onFullscreen}
        >
          <IconFullscreen />
        </button>
      </div>
    </div>
  );
}
