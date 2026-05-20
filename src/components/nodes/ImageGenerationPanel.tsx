import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MentionInput, type MentionInputRef } from "@/components/nodes/MentionInput";
import { SlashPresetPanel } from "@/components/nodes/SlashPresetPanel";
import { ImageModelPicker } from "@/components/nodes/ImageModelPicker";
import { ImageAspectResolutionPicker } from "@/components/nodes/ImageAspectResolutionPicker";
import { ImageStylePickerPopover } from "@/components/nodes/ImageStylePickerPopover";
import { IgpGenerateButtonIcon } from "@/components/nodes/IgpGenerateButtonIcon";
import { PanelCloseIcon, PanelExpandIcon, PanelPinIcon } from "@/components/nodes/nodePanelIcons";
import { useImageGenerationContext } from "@/hooks/useImageGenerationContext";
import { useImageModels } from "@/hooks/useImageModels";
import { useFocusImageNodeViewport } from "@/hooks/canvas/useFocusImageNodeViewport";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import {
  IMAGE_COUNT_OPTIONS,
  type ImageAspectId,
  type ImageResolutionTierId,
  type ImageStyleId,
  type ImageTaskMode,
} from "@/lib/imageGeneration/catalog";
import {
  imageTaskMetaChipLabel,
  imageTaskStatusLabel,
} from "@/lib/imageGeneration/detectImageTask";
import { resolveImageApiSize } from "@/lib/imageGeneration/imageAspectSize";
import {
  readImageOutputParams,
  patchImageOutputParams,
} from "@/lib/imageGeneration/imageOutputParams";
import {
  parseImageStyleIdsFromPrompt,
  stripImageStyleTokensFromPrompt,
  toggleImageStyleInPrompt,
} from "@/lib/imageGeneration/imageStyleTokens";
import { imageGenerationAgentRuntime } from "@/lib/nodeAgentRuntime/imageGenerationAgent";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { IMAGE_GENERATION_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import "./MinimalImageNode.css";

const PARAM_IMAGE_MODEL = "imageModelId";
const PARAM_IMAGE_COUNT = "imageCount";

export type ImageGenerationPanelProps = {
  nodeId: string;
  layout?: "empty" | "default" | "expanded";
  onRequestClose?: () => void;
  onRequestDock?: () => void;
};

/** 顶栏快捷钮图标容器：主图标 + 右下角「+」 */
function IgpQuickIconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="igp-quick-icon-wrap" aria-hidden>
      {children}
      <svg className="igp-quick-icon-plus" viewBox="0 0 10 10">
        <path
          d="M5 2.25v5.5M2.25 5h5.5"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** 风格：等轴测线框立方体 + 角标 + */
function IconStyle() {
  return (
    <IgpQuickIconBadge>
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M12 4.75 17.25 8 12 11.25 6.75 8 12 4.75Z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path
          d="M6.75 8v6.5L12 17.75 12 11.25"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M17.25 8v6.5L12 17.75 12 11.25"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </IgpQuickIconBadge>
  );
}

/** 标记：线框定位针 + 中心点 + 角标 + */
function IconMarker() {
  return (
    <IgpQuickIconBadge>
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M12 4.25c-2.55 0-4.6 2.05-4.6 4.55 0 3.35 4.6 9.95 4.6 9.95s4.6-6.6 4.6-9.95c0-2.5-2.05-4.55-4.6-4.55Z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="8.75" r="1.35" fill="currentColor" />
      </svg>
    </IgpQuickIconBadge>
  );
}

/** 任务模式：文生图 / 参考（只读，无角标 +） */
function IconTaskMeta({ hasReference }: { hasReference: boolean }) {
  if (hasReference) {
    return (
      <svg className="igp-meta-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="4.5"
          y="6.5"
          width="9"
          height="9"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.35"
        />
        <rect
          x="10.5"
          y="8.5"
          width="9"
          height="9"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.35"
        />
      </svg>
    );
  }
  return (
    <svg className="igp-meta-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 14.2 9.3 20.5 9.8 15.8 13.9 17.2 20.1 12 16.8 6.8 20.1 8.2 13.9 3.5 9.8 9.8 9.3 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IgpTaskMetaTile({
  task,
  refCount,
}: {
  task?: ImageTaskMode;
  refCount: number;
}) {
  const title = task
    ? imageTaskStatusLabel(task, refCount)
    : refCount > 0
      ? `${refCount} 张参考已连接`
      : "";
  const label = imageTaskMetaChipLabel(task, refCount);

  return (
    <div
      className="igp-icon-btn igp-meta-tile"
      title={title}
      aria-label={title}
    >
      <IconTaskMeta hasReference={refCount > 0} />
      <span>{label}</span>
    </div>
  );
}

/**
 * 图片节点底栏 / 展开态生成参数面板（与 `ImageGenerationPanelPortal`、`ImageGenerationPanelExpandedModal` 共用）。
 */
export function ImageGenerationPanel({
  nodeId,
  layout = "empty",
  onRequestClose,
  onRequestDock,
}: ImageGenerationPanelProps) {
  const isExpandedLayout = layout === "expanded";
  const isDefaultLayout = layout === "default";

  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const setImageGenPanelExpandedNodeId = useCanvasUiStore((s) => s.setImageGenPanelExpandedNodeId);
  const setImageGenPanelPinnedNodeId = useCanvasUiStore((s) => s.setImageGenPanelPinnedNodeId);
  const pinnedGenPanelId = useCanvasUiStore((s) => s.imageGenPanelPinnedNodeId);
  const markedNodeId = useCanvasUiStore((s) => s.markedNodeId);
  const setMarkedNodeId = useCanvasUiStore((s) => s.setMarkedNodeId);

  const { models, loading: modelsLoading, defaultModel } = useImageModels();
  const { focusImageNodeAt200 } = useFocusImageNodeViewport();
  const { status: nodeStatus, clearStatus } = useNodeStatus(nodeId);

  const mentionRef = useRef<MentionInputRef>(null);
  const styleBtnRef = useRef<HTMLButtonElement>(null);
  const cancelTokenRef = useRef({ cancelled: false });
  const genRunRef = useRef(0);

  const [slashCursorRect, setSlashCursorRect] = useState<DOMRect | null>(null);
  const [stylePopoverOpen, setStylePopoverOpen] = useState(false);
  const [generatingLocal, setGeneratingLocal] = useState(false);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const prompt = (node?.data.prompt ?? "").slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS);
  const params = node?.data.params;

  const outputParams = useMemo(() => readImageOutputParams(params), [params]);
  const modelId = typeof params?.[PARAM_IMAGE_MODEL] === "string" ? params[PARAM_IMAGE_MODEL] : "";
  const imageCountRaw = params?.[PARAM_IMAGE_COUNT];
  const imageCount =
    typeof imageCountRaw === "number" && imageCountRaw >= 1 && imageCountRaw <= 4
      ? imageCountRaw
      : 1;
  const ctx = useImageGenerationContext(nodeId, prompt);

  const nodeLabels = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n.data.label ?? n.id])),
    [nodes],
  );

  const selectedStyleIds = useMemo(() => parseImageStyleIdsFromPrompt(prompt), [prompt]);

  const validModelId = useMemo(() => {
    if (modelId && models.some((m) => m.id === modelId && m.enabled)) return modelId;
    return defaultModel?.id ?? models.find((m) => m.enabled)?.id ?? "";
  }, [modelId, models, defaultModel]);

  const customModels = useMemo(
    () =>
      models
        .filter((m) => m.settingsId)
        .map((m) => ({
          id: m.settingsId!,
          label: m.label,
          model: m.model,
          priority: m.priority,
          enabled: m.enabled,
        })),
    [models],
  );

  const effectivePromptText = useMemo(() => {
    const stripped = stripImageStyleTokensFromPrompt(prompt).trim();
    const aggregated = ctx.aggregatedPrompt.trim();
    return aggregated || stripped;
  }, [ctx.aggregatedPrompt, prompt]);

  const isGenerating =
    generatingLocal || nodeStatus?.status === "running" || nodeStatus?.status === "pending";

  const hasMarker = markedNodeId === nodeId;
  const isPinned = pinnedGenPanelId === nodeId;

  const apiSize = useMemo(
    () =>
      resolveImageApiSize(
        outputParams.aspect,
        outputParams.resolution,
        node?.data.imageWidth,
        node?.data.imageHeight,
      ),
    [outputParams.aspect, outputParams.resolution, node?.data.imageWidth, node?.data.imageHeight],
  );

  const canGenerate = useMemo(() => {
    if (!projectPath || isGenerating) return false;
    if (ctx.blockReason) return false;
    if (!effectivePromptText) return false;
    if (!ctx.task) return false;
    return true;
  }, [projectPath, isGenerating, ctx.blockReason, effectivePromptText, ctx.task]);

  useEffect(() => {
    if (modelsLoading || !defaultModel) return;
    if (validModelId === modelId || !validModelId) return;
    updateNodeData(nodeId, {
      params: {
        ...(params && typeof params === "object" ? params : {}),
        [PARAM_IMAGE_MODEL]: validModelId,
      },
    });
  }, [modelsLoading, defaultModel, validModelId, modelId, nodeId, updateNodeData, params]);

  const setPrompt = useCallback(
    (next: string) => {
      updateNodeData(nodeId, {
        prompt: next.slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS),
      });
    },
    [nodeId, updateNodeData],
  );

  const patchNodeParams = useCallback(
    (patch: Record<string, unknown>) => {
      updateNodeData(nodeId, {
        params: {
          ...(params && typeof params === "object" ? params : {}),
          ...patch,
        },
      });
    },
    [nodeId, params, updateNodeData],
  );

  const handleSlashTrigger = useCallback((rect: DOMRect) => {
    setSlashCursorRect(rect);
  }, []);

  const handlePresetSelect = useCallback((template: string) => {
    mentionRef.current?.insertPresetTemplate(template);
    setSlashCursorRect(null);
  }, []);

  const handleStyleToggle = useCallback(
    (styleId: ImageStyleId) => {
      const enable = !selectedStyleIds.includes(styleId);
      setPrompt(toggleImageStyleInPrompt(prompt, styleId, enable));
    },
    [prompt, selectedStyleIds, setPrompt],
  );

  const handleAspectChange = useCallback(
    (aspect: ImageAspectId) => {
      updateNodeData(nodeId, {
        params: patchImageOutputParams(params, { aspect }),
      });
    },
    [nodeId, params, updateNodeData],
  );

  const handleResolutionChange = useCallback(
    (resolution: ImageResolutionTierId) => {
      updateNodeData(nodeId, {
        params: patchImageOutputParams(params, { resolution }),
      });
    },
    [nodeId, params, updateNodeData],
  );

  const handleCancelGenerate = useCallback(() => {
    cancelTokenRef.current.cancelled = true;
    genRunRef.current += 1;
    clearStatus();
    setGeneratingLocal(false);
    setStatusText("已取消图片生成");
  }, [clearStatus, setStatusText]);

  const handleGenerate = useCallback(() => {
    if (isGenerating) {
      handleCancelGenerate();
      return;
    }
    if (!projectPath) {
      setStatusText("请先新建或打开工程目录后再生成图片。");
      return;
    }
    if (ctx.blockReason) {
      setStatusText(ctx.blockReason);
      return;
    }
    if (!effectivePromptText) {
      setStatusText("请输入图片提示词。");
      return;
    }
    if (!ctx.task) {
      setStatusText("无法推断图片生成任务，请检查参考图连线。");
      return;
    }

    const runId = genRunRef.current + 1;
    genRunRef.current = runId;
    cancelTokenRef.current = { cancelled: false };
    setGeneratingLocal(true);

    const promptForAgent = stripImageStyleTokensFromPrompt(prompt).trim() || effectivePromptText;
    const styleIds = parseImageStyleIdsFromPrompt(prompt);

    void (async () => {
      try {
        await runNodeTaskAgent(
          imageGenerationAgentRuntime,
          {
            prompt: promptForAgent,
            modelId: validModelId,
            customModels,
            task: ctx.task!,
            referenceImagePaths: ctx.referenceImagePaths,
            count: imageCount,
            aspect: outputParams.aspect,
            resolution: apiSize,
            styleIds,
          },
          {
            nodeId,
            projectPath,
            updateNodeData,
            setStatusText,
            cancelToken: cancelTokenRef.current,
          },
        );
      } catch {
        // runNodeTaskAgent 已统一写入失败状态
      } finally {
        if (genRunRef.current === runId) {
          setGeneratingLocal(false);
        }
      }
    })();
  }, [
    isGenerating,
    handleCancelGenerate,
    projectPath,
    ctx.blockReason,
    ctx.task,
    ctx.referenceImagePaths,
    effectivePromptText,
    prompt,
    validModelId,
    customModels,
    imageCount,
    outputParams.aspect,
    apiSize,
    nodeId,
    updateNodeData,
    setStatusText,
  ]);

  const handleMarkerClick = useCallback(() => {
    if (hasMarker) {
      setMarkedNodeId(null);
      return;
    }
    setMarkedNodeId(nodeId);
    void focusImageNodeAt200(nodeId);
  }, [hasMarker, nodeId, setMarkedNodeId, focusImageNodeAt200]);

  const handlePinClick = useCallback(() => {
    setImageGenPanelPinnedNodeId(isPinned ? null : nodeId);
  }, [isPinned, nodeId, setImageGenPanelPinnedNodeId]);

  const handleExpandClick = useCallback(() => {
    setImageGenPanelExpandedNodeId(nodeId);
  }, [nodeId, setImageGenPanelExpandedNodeId]);

  const handleCloseDocked = useCallback(() => {
    setImageGenPanelPinnedNodeId(null);
    onRequestClose?.();
  }, [onRequestClose, setImageGenPanelPinnedNodeId]);

  const refCount = ctx.referenceImagePaths.length;
  const textareaClass = isExpandedLayout
    ? "imageGenPanelTextarea imageGenPanelTextarea--expanded"
    : "imageGenPanelTextarea imageGenPanelTextarea--minimal";

  return (
    <div
      className="imageGenPanel--minimal-inner"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ── 顶栏 ── */}
      <div
        className={`igp-header-row${layout === "empty" ? " igp-header-row--empty" : ""}${
          isExpandedLayout ? " igp-header-row--expanded" : ""
        }`}
      >
        <div className="igp-header-quick">
            <button
              ref={styleBtnRef}
              type="button"
              className={`igp-icon-btn${
                stylePopoverOpen || selectedStyleIds.length > 0 ? " active" : ""
              }`}
              title="画风"
              onClick={() => setStylePopoverOpen((o) => !o)}
            >
              <IconStyle />
              <span>风格</span>
            </button>
            <button
              type="button"
              className={`igp-icon-btn${hasMarker ? " active" : ""}`}
              title={hasMarker ? "取消画布标记" : "标记并定位到此节点"}
              onClick={handleMarkerClick}
            >
              <IconMarker />
              <span>{hasMarker ? "已标记" : "标记"}</span>
            </button>
            {(ctx.task || refCount > 0) ? (
              <IgpTaskMetaTile task={ctx.task} refCount={refCount} />
            ) : null}
          </div>

        {layout === "empty" ? (
          <div className="igp-header-actions">
            <button
              type="button"
              className="igp-header-icon-btn igp-expand-trigger"
              title="展开面板，专注编辑提示词"
              aria-label="展开面板"
              onClick={handleExpandClick}
            >
              <PanelExpandIcon />
            </button>
          </div>
        ) : null}

        {isDefaultLayout ? (
          <div className="igp-header-actions">
            <button
              type="button"
              className={`igp-header-icon-btn${isPinned ? " active" : ""}`}
              title={isPinned ? "取消钉住" : "钉在节点下方"}
              aria-label={isPinned ? "取消钉住" : "钉住面板"}
              onClick={handlePinClick}
            >
              <PanelPinIcon />
            </button>
            <button
              type="button"
              className="igp-header-icon-btn igp-expand-trigger"
              title="展开面板"
              aria-label="展开面板"
              onClick={handleExpandClick}
            >
              <PanelExpandIcon />
            </button>
            <button
              type="button"
              className="igp-header-icon-btn"
              title="收起面板"
              aria-label="收起面板"
              onClick={handleCloseDocked}
            >
              <PanelCloseIcon />
            </button>
          </div>
        ) : null}

        {isExpandedLayout ? (
          <div className="igp-header-actions">
            {onRequestDock ? (
              <button
                type="button"
                className="igp-header-icon-btn"
                title="钉回节点"
                aria-label="钉回节点"
                onClick={onRequestDock}
              >
                <PanelPinIcon />
              </button>
            ) : null}
            {onRequestClose ? (
              <button
                type="button"
                className="igp-header-icon-btn"
                title="关闭 (Esc)"
                aria-label="关闭"
                onClick={onRequestClose}
              >
                <PanelCloseIcon />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ImageStylePickerPopover
        anchorRef={styleBtnRef}
        open={stylePopoverOpen}
        onClose={() => setStylePopoverOpen(false)}
        selectedIds={selectedStyleIds}
        onToggle={handleStyleToggle}
      />

      {/* ── 提示词 ── */}
      <div className="igp-prompt-wrap">
        <MentionInput
          ref={mentionRef}
          nodeId={nodeId}
          value={prompt}
          onChange={setPrompt}
          placeholder="描述你想要生成的内容，使用 @可快速引用上传的文件，按 / 呼出指令"
          className={textareaClass}
          nodeLabels={nodeLabels}
          onSlashTrigger={handleSlashTrigger}
        />
        <span className="igp-counter" aria-live="polite">
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


      {ctx.blockReason ? (
        <div className="igp-feedback igp-feedback--block" role="alert">
          {ctx.blockReason}
        </div>
      ) : null}
      {!ctx.blockReason && ctx.warnMessage ? (
        <div className="igp-feedback igp-feedback--warn">{ctx.warnMessage}</div>
      ) : null}


      {/* ── 底栏：模型 → 比例/分辨率 → 张数 → 生成 ── */}
      <div className="igp-bottom-bar">
        <ImageModelPicker
          models={models}
          value={validModelId}
          loading={modelsLoading}
          onChange={(id) => patchNodeParams({ [PARAM_IMAGE_MODEL]: id })}
        />

        <ImageAspectResolutionPicker
          aspect={outputParams.aspect}
          resolution={outputParams.resolution}
          onAspectChange={handleAspectChange}
          onResolutionChange={handleResolutionChange}
        />

        <select
          className={`igp-count-select ${RF_NODE_INPUT_CLASS}`}
          value={imageCount}
          title="生成张数"
          aria-label="生成张数"
          onChange={(e) =>
            patchNodeParams({ [PARAM_IMAGE_COUNT]: Number(e.target.value) })
          }
          onPointerDown={(e) => e.stopPropagation()}
        >
          {IMAGE_COUNT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`igp-generate-btn${isGenerating ? " generating" : ""}`}
          disabled={!isGenerating && !canGenerate}
          title={isGenerating ? "停止生成" : "生成图片"}
          aria-label={isGenerating ? "停止生成" : "生成图片"}
          onClick={handleGenerate}
        >
          <IgpGenerateButtonIcon generating={isGenerating} />
        </button>
      </div>
    </div>
  );
}
