import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MentionInput, type MentionInputRef } from "@/components/nodes/MentionInput";
import { SlashPresetPanel } from "@/components/nodes/SlashPresetPanel";
import { IgpGenerateButtonIcon } from "@/components/nodes/IgpGenerateButtonIcon";
import { PanelCloseIcon, PanelExpandIcon, PanelPinIcon } from "@/components/nodes/nodePanelIcons";
import { ScriptModelPicker } from "@/components/nodes/ScriptModelPicker";
import { ScriptDocumentImportButton } from "@/components/script/ScriptDocumentImportButton";
import { useFocusScriptNodeViewport } from "@/hooks/canvas/useFocusScriptNodeViewport";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import {
  getProviderSelectionPatch,
  loadEnabledProviderOptions,
  type TextNodeProviderOption,
} from "@/lib/textNodeProviders";
import { scriptNodeDispatchAgentRuntime } from "@/lib/nodeAgentRuntime/dagnodeDispatchAgents";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { IMAGE_GENERATION_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { SCRIPT_AI_PARSE_BUTTON_LABEL } from "@/lib/scriptNodeActionLabels";
import { preflightScriptNodeLlm } from "@/lib/scriptNodeLlmParams";
import { scriptParseCompleteStatus } from "@/lib/scriptNodeFeedback";
import { useScriptNodeTaskState } from "@/hooks/useScriptNodeTaskState";
import {
  listScriptUpstreamTextSources,
  formatUpstreamTextCharCount,
  totalUpstreamTextChars,
} from "@/lib/scriptUpstreamText";
import {
  buildReferenceVideoPromptBlock,
  listScriptReferenceVideoSources,
} from "@/lib/scriptReferenceVideo";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import "./TextNodeChrome.css";

const THEME_PLACEHOLDER =
  "描述剧情、角色与风格约束，用 @ 引用节点，按 / 呼出指令";

function IconMarker() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <path
        d="M12 4.25c-2.55 0-4.6 2.05-4.6 4.55 0 3.35 4.6 9.95 4.6 9.95s4.6-6.6 4.6-9.95c0-2.5-2.05-4.55-4.6-4.55Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="8.75" r="1.35" fill="currentColor" />
    </svg>
  );
}

export type ScriptComposerPanelLayout = "default" | "expanded";

export type ScriptComposerPanelProps = {
  nodeId: string;
  layout?: ScriptComposerPanelLayout;
  /** 空态底栏：隐藏 Zone A（对标 TextComposerPanel） */
  hideChromeHead?: boolean;
  onRequestClose?: () => void;
  onRequestDock?: () => void;
};

/**
 * 脚本节点底栏：主题 prompt + Provider + 生成镜头（尺寸/结构对标 TextComposerPanel v2）
 */
export function ScriptComposerPanel({
  nodeId,
  layout = "default",
  hideChromeHead = false,
  onRequestClose,
  onRequestDock,
}: ScriptComposerPanelProps) {
  const isExpandedLayout = layout === "expanded";
  const isDefaultLayout = layout === "default";

  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const runNodeSubgraph = useProjectStore((s) => s.runNodeSubgraph);

  const setExpandedNodeId = useCanvasUiStore((s) => s.setScriptGenPanelExpandedNodeId);
  const setPinnedNodeId = useCanvasUiStore((s) => s.setScriptGenPanelPinnedNodeId);
  const pinnedGenPanelId = useCanvasUiStore((s) => s.scriptGenPanelPinnedNodeId);
  const markedNodeId = useCanvasUiStore((s) => s.markedNodeId);
  const setMarkedNodeId = useCanvasUiStore((s) => s.setMarkedNodeId);
  const { focusScriptNodeAt200 } = useFocusScriptNodeViewport();

  const mentionRef = useRef<MentionInputRef>(null);
  const [slashCursorRect, setSlashCursorRect] = useState<DOMRect | null>(null);
  const [providerOptions, setProviderOptions] = useState<TextNodeProviderOption[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const genRunRef = useRef(0);

  const { clearStatus } = useNodeStatus(nodeId);
  const { isBusy, panelFeedback, clearZeroBeatsHint } = useScriptNodeTaskState(nodeId);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const prompt = (node?.data.prompt ?? "").slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS);
  const params = useMemo(
    () =>
      node?.data.params && typeof node.data.params === "object"
        ? (node.data.params as Record<string, unknown>)
        : {},
    [node?.data.params],
  );
  const selectedProviderId = (params.providerId ?? "").toString();
  const beatCount = node?.data.scriptBeats?.length ?? 0;

  const nodeLabels = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n.data.label ?? n.id])),
    [nodes],
  );

  const isPinned = pinnedGenPanelId === nodeId;
  const hasMarker = markedNodeId === nodeId;

  const isGenerating = isBusy;

  const canGenerate = useMemo(() => {
    if (!projectPath?.trim() || isBusy) return false;
    return Boolean(prompt.trim());
  }, [projectPath, isBusy, prompt]);

  useEffect(() => {
    let cancelled = false;
    setProvidersLoading(true);
    void (async () => {
      const list = await loadEnabledProviderOptions();
      if (!cancelled) {
        setProviderOptions(list);
        setProvidersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  const setPrompt = useCallback(
    (next: string) => {
      updateNodeData(nodeId, {
        prompt: next.slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS),
      });
    },
    [nodeId, updateNodeData],
  );

  const handleProviderChange = useCallback(
    (providerId: string) => {
      const base = { ...params };
      if (!providerId) {
        delete base.providerId;
        delete base.model;
        updateNodeData(nodeId, { params: base });
        return;
      }
      const patch = getProviderSelectionPatch(providerId, providerOptions);
      updateNodeData(nodeId, { params: { ...base, ...patch } });
    },
    [nodeId, params, providerOptions, updateNodeData],
  );

  const handleSlashTrigger = useCallback((rect: DOMRect) => {
    setSlashCursorRect(rect);
  }, []);

  const handlePresetSelect = useCallback((template: string) => {
    mentionRef.current?.insertPresetTemplate(template);
    setSlashCursorRect(null);
  }, []);

  const handleCancelGenerate = useCallback(() => {
    genRunRef.current += 1;
    clearStatus();
    clearZeroBeatsHint();
    setStatusText("已取消脚本解析");
  }, [clearStatus, clearZeroBeatsHint, setStatusText]);

  const handleGenerate = useCallback(() => {
    if (isGenerating) {
      handleCancelGenerate();
      return;
    }
    const promptText = prompt.trim();
    if (!projectPath?.trim()) {
      setStatusText("请先新建或打开工程目录");
      return;
    }
    if (!promptText) {
      setStatusText("请先输入剧情主题或脚本约束");
      return;
    }

    void (async () => {
      if (!(await preflightScriptNodeLlm(params, setStatusText))) return;

      const runId = genRunRef.current + 1;
      genRunRef.current = runId;
      clearZeroBeatsHint();
      try {
        await runNodeTaskAgent(
          scriptNodeDispatchAgentRuntime,
          { prompt: promptText, dispatch: runNodeSubgraph },
          { nodeId, projectPath, updateNodeData, setStatusText },
        );
        if (genRunRef.current !== runId) return;
        const latest = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
        const count = normalizeScriptBeats(latest?.data.scriptBeats ?? []).length;
        setStatusText(scriptParseCompleteStatus(count));
      } catch {
        /* runNodeTaskAgent 已写入状态 */
      }
    })();
  }, [
    handleCancelGenerate,
    isGenerating,
    nodeId,
    params,
    projectPath,
    prompt,
    runNodeSubgraph,
    setStatusText,
    updateNodeData,
    clearZeroBeatsHint,
  ]);

  const handleExpandClick = useCallback(() => {
    setExpandedNodeId(nodeId);
  }, [nodeId, setExpandedNodeId]);

  const handleMarkerClick = useCallback(() => {
    if (hasMarker) {
      setMarkedNodeId(null);
      return;
    }
    setMarkedNodeId(nodeId);
    void focusScriptNodeAt200(nodeId);
  }, [hasMarker, nodeId, setMarkedNodeId, focusScriptNodeAt200]);

  const handlePinClick = useCallback(() => {
    setPinnedNodeId(isPinned ? null : nodeId);
  }, [isPinned, nodeId, setPinnedNodeId]);

  const handleCloseDocked = useCallback(() => {
    setPinnedNodeId(null);
    onRequestClose?.();
  }, [onRequestClose, setPinnedNodeId]);

  const textareaClass = isExpandedLayout
    ? "mention-input-wrapper imageGenPanelTextarea imageGenPanelTextarea--expanded"
    : "mention-input-wrapper imageGenPanelTextarea imageGenPanelTextarea--minimal";

  const panelClass = [
    "scriptGenComposer",
    "textGenPanel--chrome",
    "textGenPanel--v2",
    "imageGenPanel--minimal-inner",
    isExpandedLayout ? "tgp-layout-expanded" : "tgp-layout-default",
  ]
    .filter(Boolean)
    .join(" ");

  const upstreamSources = useMemo(
    () => listScriptUpstreamTextSources(nodes, edges, nodeId),
    [edges, nodeId, nodes],
  );
  const upstreamChars = totalUpstreamTextChars(upstreamSources);
  const refVideoSources = useMemo(
    () => listScriptReferenceVideoSources(nodes, edges, nodeId),
    [edges, nodeId, nodes],
  );

  const handleInsertRefVideoBlock = useCallback(() => {
    if (refVideoSources.length === 0) return;
    const block = buildReferenceVideoPromptBlock(refVideoSources);
    mentionRef.current?.insertPresetTemplate(block);
    setStatusText(`已插入参考视频说明（${refVideoSources.length} 个路径）`);
  }, [refVideoSources, setStatusText]);

  const zoneAHint = isExpandedLayout
    ? upstreamSources.length > 0
      ? `解析要求 · 上游剧本 ${formatUpstreamTextCharCount(upstreamChars)}字${refVideoSources.length > 0 ? ` · 参考视频 ${refVideoSources.length}` : ""}`
      : refVideoSources.length > 0
        ? `解析要求 · 参考视频 ${refVideoSources.length}`
        : "专注编辑解析要求（非剧本文本）"
    : beatCount > 0
      ? upstreamSources.length > 0
        ? `${beatCount} 镜头 · 上游 ${formatUpstreamTextCharCount(upstreamChars)}字${refVideoSources.length > 0 ? ` · 参考 ${refVideoSources.length}` : ""}`
        : refVideoSources.length > 0
          ? `${beatCount} 镜头 · 参考视频 ${refVideoSources.length}`
          : `${beatCount} 条镜头`
      : upstreamSources.length > 0
        ? `上游剧本 ${formatUpstreamTextCharCount(upstreamChars)}字${refVideoSources.length > 0 ? ` · 参考 ${refVideoSources.length}` : ""}`
        : refVideoSources.length > 0
          ? `参考视频 ${refVideoSources.length}`
          : "AI 解析";

  const showZoneA = isExpandedLayout || !hideChromeHead;

  const zoneAActions = isExpandedLayout ? (
    <>
      {onRequestDock ? (
        <button
          type="button"
          className="mmChromeIconBtn tgpChromeIconBtn"
          title="钉回节点下方"
          aria-label="钉回节点"
          onClick={onRequestDock}
        >
          <PanelPinIcon />
        </button>
      ) : null}
      {onRequestClose ? (
        <button
          type="button"
          className="mmChromeIconBtn tgpChromeIconBtn"
          title="关闭 (Esc)"
          aria-label="关闭"
          onClick={onRequestClose}
        >
          <PanelCloseIcon />
        </button>
      ) : null}
    </>
  ) : (
    <>
      {isDefaultLayout ? (
        <button
          type="button"
          className="mmChromeIconBtn tgpChromeIconBtn"
          title="展开面板"
          aria-label="展开面板"
          onClick={handleExpandClick}
        >
          <PanelExpandIcon />
        </button>
      ) : null}
      <button
        type="button"
        className={`mmChromeIconBtn tgpChromeIconBtn${isPinned ? " tgpChromeIconBtn--pinned" : ""}`}
        title={isPinned ? "取消钉住" : "钉在节点下方"}
        aria-label={isPinned ? "取消钉住" : "钉住面板"}
        onClick={handlePinClick}
      >
        <PanelPinIcon />
      </button>
      <button
        type="button"
        className="mmChromeIconBtn tgpChromeIconBtn"
        title="收起面板"
        aria-label="收起面板"
        onClick={handleCloseDocked}
      >
        <PanelCloseIcon />
      </button>
    </>
  );

  return (
    <div className={panelClass} onPointerDown={(e) => e.stopPropagation()}>
      <div className="tgp-v2-stack">
        {showZoneA ? (
          <div className="tgp-v2-zone-a">
            <div className="tgp-v2-zone-a-start">
              <button
                type="button"
                className={`mmChromeIconBtn tgpChromeIconBtn tgp-marker-btn${hasMarker ? " tgp-marker-btn--active" : ""}`}
                title={hasMarker ? "取消画布标记" : "标记并定位到此节点"}
                aria-label={hasMarker ? "取消标记" : "标记节点"}
                onClick={handleMarkerClick}
              >
                <IconMarker />
              </button>
              <span className="tgp-v2-hint">{zoneAHint}</span>
            </div>
            <div className="tgp-v2-zone-a-actions">{zoneAActions}</div>
          </div>
        ) : null}

        <div className="igp-prompt-wrap tgp-prompt-wrap tgp-v2-zone-b">
          <MentionInput
            ref={mentionRef}
            nodeId={nodeId}
            value={prompt}
            onChange={setPrompt}
            placeholder={THEME_PLACEHOLDER}
            className={textareaClass}
            nodeLabels={nodeLabels}
            onSlashTrigger={handleSlashTrigger}
          />
          <span className="igp-counter vgp-prompt-counter tgp-prompt-counter" aria-live="polite">
            {prompt.length}/{IMAGE_GENERATION_PROMPT_MAX_CHARS}
          </span>
        </div>
        {slashCursorRect ? (
          <SlashPresetPanel
            cursorRect={slashCursorRect}
            onSelect={handlePresetSelect}
            onClose={() => setSlashCursorRect(null)}
          />
        ) : null}

        {panelFeedback ? (
          <div
            className={`igp-feedback tgp-feedback igp-feedback--${panelFeedback.tone === "error" ? "block" : panelFeedback.tone === "warn" ? "warn" : "info"}`}
            role={panelFeedback.tone === "error" ? "alert" : "status"}
          >
            {panelFeedback.message}
          </div>
        ) : null}

        <div className="igp-bottom-bar tgp-bottom-bar tgp-v2-zone-d">
          <ScriptModelPicker
            providers={providerOptions}
            value={selectedProviderId}
            loading={providersLoading}
            onChange={handleProviderChange}
          />
          {refVideoSources.length > 0 ? (
            <button
              type="button"
              className="btn tgp-ref-video-insert"
              title="在解析要求中插入【参考视频】说明块（路径与执行器一致）"
              onClick={handleInsertRefVideoBlock}
            >
              参考视频说明
            </button>
          ) : null}
          <ScriptDocumentImportButton
            scriptNodeId={nodeId}
            disabled={isGenerating}
            className="btn btn--ghost btn--sm tgp-script-upload"
          />
          <button
            type="button"
            className={`igp-generate-btn tgp-generate-btn${isGenerating ? " generating" : ""}`}
            disabled={!isGenerating && !canGenerate}
            title={
              isGenerating
                ? "停止解析"
                : `${SCRIPT_AI_PARSE_BUTTON_LABEL}（使用底栏所选模型）`
            }
            aria-label={isGenerating ? "停止解析" : SCRIPT_AI_PARSE_BUTTON_LABEL}
            onClick={handleGenerate}
          >
            <IgpGenerateButtonIcon generating={isGenerating} />
          </button>
        </div>
      </div>
    </div>
  );
}
