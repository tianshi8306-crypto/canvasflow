/**
 * 视频节点多模态输入管理面板
 *
 * 设计规格：
 * - 模块1：顶部创作模式标签栏（文生视频/全能参考/图生视频/首尾帧/图片参考）
 * - 模块2：参考图缩略图
 * - 模块3：提示词文本区
 * - 模块4：底部生成参数栏（模型/画幅/时长/音频/生成按钮）
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  VideoPromptMentionInput,
  type VideoPromptMentionInputRef,
} from "@/components/nodes/VideoPromptMentionInput";
import { buildVideoRefAtMeta, remapVideoPromptRefOrder } from "@/lib/seedance/videoPromptAtTokens";
import { VideoGenPanelIconDropdown, VideoGenPanelIconSpeaker } from "@/components/nodes/videoGenPanelIcons";
import { VideoGenPanelSectionLabel } from "@/components/nodes/VideoGenPanelSectionLabel";
import { VideoWorkflowTab } from "@/components/nodes/VideoWorkflowTab";
import { VideoRefPreviewModal } from "@/components/nodes/VideoRefPreviewModal";
import { VideoRefThumbStrip } from "@/components/nodes/VideoRefThumbStrip";
import { swapFirstLastFrameSourcePositions } from "@/lib/videoGeneration/videoRefStripUtils";
import { useTtvDraft } from "@/hooks/useTtvDraft";
import {
  applyIncomingRefEdgeOrder,
  detectWorkflow,
  incomingRefsForDisplayStrip,
  reorderIncomingRefEdgeOrder,
  resolveIncomingRefItemsForDraft,
  splitIncomingRefsForDraft,
  swapFirstLastIncomingRefEdgeOrder,
  syncReferenceEdgeOrder,
  useVideoIncomingReferenceItems,
} from "@/hooks/useVideoIncomingReferenceItems";
import { useVideoModels } from "@/hooks/useVideoModels";
import { filterVideoModelsForWorkflow } from "@/lib/videoModelOptions";
import { VideoModelPicker } from "@/components/nodes/VideoModelPicker";
import { useVideoNodeGeneration } from "@/hooks/useVideoNodeGeneration";
import { useHermesCanvasGenFailureNotify } from "@/hooks/useHermesCanvasGenFailureNotify";
import { useSeedanceImageComplianceMap } from "@/hooks/useSeedanceImageComplianceMap";
import {
  collectSeedanceImageComplianceValidationErrors,
  mergeSeedanceComplianceIntoValidation,
} from "@/lib/seedance/seedanceImageCompliance";
import { probeSeedanceImageComplianceForRefs } from "@/lib/seedance/probeSeedanceImageRef";
import { validateMultimodalInput } from "@/lib/seedance/validation";
import { buildVideoPromptFromUpstreamText } from "@/lib/videoGeneration/videoTextPromptSync";
import { buildVideoPromptFromUpstreamVideo } from "@/lib/videoGeneration/videoVideoPromptSync";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import {
  getVideoModelCapabilities,
  isCatalogResolutionSupported,
  normalizeVideoOutputForModel,
  supportedCatalogResolutions,
} from "@/lib/videoGeneration/catalog";
import {
  type TextToVideoAspectId,
  type VideoGenerationWorkflow,
  type VideoModelId,
} from "@/lib/videoNodeTypes";
import { VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { PanelCloseIcon, PanelExpandIcon } from "@/components/nodes/nodePanelIcons";
import {
  VideoGenerationStatusRail,
  VideoGenerateButtonIconState,
} from "@/components/nodes/VideoGenerationStatusRail";
import { VideoGenerationCenterCapsule } from "@/components/nodes/VideoGenerationCenterCapsule";
import { PortalToElement } from "@/components/nodes/nodeChrome/PortalToElement";
import { getVideoGenerationDisplayLabel } from "@/lib/video/videoGenerationProgressDisplay";
import { resolveDreaminaSubmitId } from "@/lib/video/extractDreaminaSubmitId";
import { isDreaminaModel } from "@/lib/dreamina/model";
import { TtvAspectWireframe } from "@/components/nodes/TtvAspectWireframe";
import { VideoOutputSettingsContent } from "@/components/nodes/VideoOutputSettingsContent";
import { VideoOutputSettingsPopover } from "@/components/nodes/VideoOutputSettingsPopover";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { recordBeforeDiscreteMutation } from "@/store/projectHistory";
import { videoWorkflowTabsForPanel } from "@/lib/video/videoPanelLibtvSections";
import "./VideoGenerationPanel.css";

export type { TextToVideoAspectId };

export interface VideoMultimodalInputPanelProps {
  videoNodeId?: string;
  /** portal：节点底栏紧凑态；expanded：居中放大 */
  layout?: "portal" | "expanded";
  onRequestClose?: () => void;
  /** portal 布局：生成中胶囊 Portal 到预览区正中 */
  previewOverlayEl?: HTMLElement | null;
}

export function VideoMultimodalInputPanel({
  videoNodeId,
  layout,
  onRequestClose,
  previewOverlayEl = null,
}: VideoMultimodalInputPanelProps) {
  const isChromePortal = layout === "portal";
  const isExpandedLayout = layout === "expanded";
  const [outputSettingsOpen, setOutputSettingsOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [focusedRefEdgeId, setFocusedRefEdgeId] = useState<string | null>(null);
  const [hoveredRefEdgeId, setHoveredRefEdgeId] = useState<string | null>(null);
  const thumbElRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const promptMentionRef = useRef<VideoPromptMentionInputRef | null>(null);
  const outputSettingsPillRef = useRef<HTMLButtonElement | null>(null);
  const outputFootRef = useRef<HTMLDivElement | null>(null);

  const { draft, patchDraft } = useTtvDraft(videoNodeId);
  const { models: allVideoModels, loading: modelsLoading, defaultModel } = useVideoModels();
  const videoModels = useMemo(
    () => filterVideoModelsForWorkflow(allVideoModels, draft.workflow),
    [allVideoModels, draft.workflow],
  );

  // 如果当前 modelId 在 Settings 中不存在，用默认值
  const workflowDefaultModel = videoModels.find((m) => m.enabled && m.id) ?? null;
  const validModelId = videoModels.some((m) => m.id === draft.modelId)
    ? draft.modelId
    : (workflowDefaultModel?.id ?? defaultModel?.id ?? "");

  // Settings 加载或工作流切换后，若当前 modelId 不在可选列表，回退到本工作流首个可用模型
  useEffect(() => {
    if (!videoNodeId) return;
    if (modelsLoading) return;
    if (draft.modelId === validModelId) return;
    patchDraft({ modelId: validModelId });
  }, [modelsLoading, videoNodeId, draft.modelId, validModelId, patchDraft]);

  const modelCapabilities = useMemo(
    () => getVideoModelCapabilities(validModelId),
    [validModelId],
  );
  const catalogResolutions = useMemo(
    () => supportedCatalogResolutions(validModelId),
    [validModelId],
  );

  const setStatusText = useProjectStore((s) => s.setStatusText);

  useEffect(() => {
    if (!videoNodeId || modelsLoading || !validModelId) return;
    const cur = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId)?.data.video?.draft;
    if (!cur) return;
    const normalized = normalizeVideoOutputForModel(validModelId, cur.output);
    if (!normalized.adjusted) return;
    patchDraft({ output: normalized.output });
    if (normalized.message) useProjectStore.getState().setStatusText(normalized.message);
  }, [validModelId, modelsLoading, videoNodeId, patchDraft]);

  const setVideoGenPanelExpandedNodeId = useCanvasUiStore((s) => s.setVideoGenPanelExpandedNodeId);
  const { startGeneration, cancelGeneration, busy, cancelling, submitting, activeJob } =
    useVideoNodeGeneration(videoNodeId);
  const incomingRefItems = useVideoIncomingReferenceItems(videoNodeId);

  const syncedEdgeOrder = useMemo(
    () => syncReferenceEdgeOrder(draft.referenceEdgeOrder, incomingRefItems),
    [draft.referenceEdgeOrder, incomingRefItems],
  );

  const orderedIncomingRefItems = useMemo(
    () => applyIncomingRefEdgeOrder(incomingRefItems, syncedEdgeOrder),
    [incomingRefItems, syncedEdgeOrder],
  );

  useEffect(() => {
    if (!videoNodeId) return;
    const saved = draft.referenceEdgeOrder ?? [];
    if (
      saved.length === syncedEdgeOrder.length &&
      saved.every((id, i) => id === syncedEdgeOrder[i])
    ) {
      return;
    }
    patchDraft({ referenceEdgeOrder: syncedEdgeOrder });
  }, [videoNodeId, syncedEdgeOrder, draft.referenceEdgeOrder, patchDraft]);

  const imageComplianceByEdge = useSeedanceImageComplianceMap(orderedIncomingRefItems);
  const projectPath = useProjectStore((s) => s.projectPath);
  const canvasNodes = useProjectStore((s) => s.nodes);
  const canvasEdges = useProjectStore((s) => s.edges);

  // 将连线上的参考图/视频/音频同步到 draft.reference*Paths
  useEffect(() => {
    if (!videoNodeId) return;
    let cancelled = false;
    void (async () => {
      const resolved = await resolveIncomingRefItemsForDraft(projectPath, orderedIncomingRefItems);
      if (cancelled) return;
      const { referenceImagePaths, referenceVideoPaths, referenceAudioPaths } =
        splitIncomingRefsForDraft(resolved);
      const node = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId)?.data.video?.draft;
      const curI = node?.referenceImagePaths ?? [];
      const curV = node?.referenceVideoPaths ?? [];
      const curA = node?.referenceAudioPaths ?? [];
      const sameI =
        curI.length === referenceImagePaths.length && curI.every((p, i) => p === referenceImagePaths[i]);
      const sameV =
        curV.length === referenceVideoPaths.length && curV.every((p, i) => p === referenceVideoPaths[i]);
      const sameA =
        curA.length === referenceAudioPaths.length && curA.every((p, i) => p === referenceAudioPaths[i]);
      if (sameI && sameV && sameA) return;
      patchDraft({
        referenceImagePaths: referenceImagePaths.length ? referenceImagePaths : [],
        referenceVideoPaths: referenceVideoPaths.length ? referenceVideoPaths : [],
        referenceAudioPaths: referenceAudioPaths.length ? referenceAudioPaths : [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [videoNodeId, orderedIncomingRefItems, patchDraft, projectPath]);

  // 根据连线状态自动检测并更新 workflow（未锁定时）
  useEffect(() => {
    if (!videoNodeId || draft.workflowLocked) return;
    const detected = detectWorkflow(orderedIncomingRefItems, draft.prompt ?? "");
    if (detected && detected !== draft.workflow) {
      patchDraft({ workflow: detected });
    }
  }, [
    videoNodeId,
    orderedIncomingRefItems,
    draft.prompt,
    draft.workflow,
    draft.workflowLocked,
    patchDraft,
  ]);

  const upstreamTextPrompt = useMemo(() => {
    if (!videoNodeId) return null;
    return buildVideoPromptFromUpstreamText(canvasNodes, canvasEdges, videoNodeId);
  }, [videoNodeId, canvasNodes, canvasEdges]);

  const upstreamVideoPrompt = useMemo(() => {
    if (!videoNodeId) return null;
    return buildVideoPromptFromUpstreamVideo(canvasNodes, canvasEdges, videoNodeId);
  }, [videoNodeId, canvasNodes, canvasEdges]);

  const upstreamAutoInjectPrompt = upstreamVideoPrompt ?? upstreamTextPrompt;

  // Seedance：文生视频 / 参考视频 prompt 继承（音频走 referenceAudioPaths + @声音N，不注入 prompt）
  useEffect(() => {
    if (!videoNodeId || !upstreamAutoInjectPrompt) return;
    const cur = (draft.prompt ?? "").trim();
    if (cur.length > 0) return;
    if (cur === upstreamAutoInjectPrompt.trim()) return;
    patchDraft({ prompt: upstreamAutoInjectPrompt });
  }, [videoNodeId, upstreamAutoInjectPrompt, draft.prompt, patchDraft]);

  const handleWorkflowTabClick = useCallback(
    (id: VideoGenerationWorkflow, unlock?: boolean) => {
      if (unlock) {
        patchDraft({ workflowLocked: false });
        return;
      }
      patchDraft({ workflow: id, workflowLocked: true });
    },
    [patchDraft],
  );

  const hasIncomingVideoRef = useMemo(
    () => orderedIncomingRefItems.some((i) => i.kind === "video"),
    [orderedIncomingRefItems],
  );
  const workflowTabs = useMemo(
    () => videoWorkflowTabsForPanel({ hasIncomingVideoRef }),
    [hasIncomingVideoRef],
  );

  const handleWorkflowTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const idx = workflowTabs.findIndex((t) => t.id === draft.workflow);
      if (idx < 0) return;
      const next =
        e.key === "ArrowRight"
          ? workflowTabs[(idx + 1) % workflowTabs.length]
          : workflowTabs[(idx - 1 + workflowTabs.length) % workflowTabs.length];
      handleWorkflowTabClick(next.id);
    },
    [draft.workflow, handleWorkflowTabClick, workflowTabs],
  );

  const displayThumbnails = useMemo(
    () => incomingRefsForDisplayStrip(orderedIncomingRefItems),
    [orderedIncomingRefItems],
  );

  const refDisplayNamesByEdge = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of orderedIncomingRefItems) {
      if (it.nodeLabel) map.set(it.edgeId, it.nodeLabel);
    }
    return map;
  }, [orderedIncomingRefItems]);

  const refAtMeta = useMemo(
    () => buildVideoRefAtMeta(orderedIncomingRefItems, refDisplayNamesByEdge),
    [orderedIncomingRefItems, refDisplayNamesByEdge],
  );

  const handleSwapFirstLast = useCallback(() => {
    const beforeOrdered = orderedIncomingRefItems;
    const newOrder = swapFirstLastIncomingRefEdgeOrder(incomingRefItems, draft.referenceEdgeOrder);
    const afterOrdered = applyIncomingRefEdgeOrder(incomingRefItems, newOrder);
    const newPrompt = remapVideoPromptRefOrder(
      draft.prompt ?? "",
      beforeOrdered,
      afterOrdered,
      refDisplayNamesByEdge,
    );
    recordBeforeDiscreteMutation(useProjectStore.getState);
    swapFirstLastFrameSourcePositions(incomingRefItems, canvasEdges, canvasNodes);
    const patch: { referenceEdgeOrder: string[]; prompt?: string } = {
      referenceEdgeOrder: newOrder,
    };
    if (newPrompt !== draft.prompt) patch.prompt = newPrompt;
    patchDraft(patch);
  }, [
    orderedIncomingRefItems,
    incomingRefItems,
    draft.referenceEdgeOrder,
    draft.prompt,
    refDisplayNamesByEdge,
    canvasEdges,
    canvasNodes,
    patchDraft,
  ]);

  const handleRefStripReorder = useCallback(
    (fromEdgeId: string, toEdgeId: string) => {
      if (!videoNodeId || fromEdgeId === toEdgeId) return;
      const displayIds = displayThumbnails.map((t) => t.edgeId);
      const beforeOrdered = orderedIncomingRefItems;
      const newOrder = reorderIncomingRefEdgeOrder(
        incomingRefItems,
        draft.referenceEdgeOrder,
        displayIds,
        fromEdgeId,
        toEdgeId,
      );
      const afterOrdered = applyIncomingRefEdgeOrder(incomingRefItems, newOrder);
      const newPrompt = remapVideoPromptRefOrder(
        draft.prompt ?? "",
        beforeOrdered,
        afterOrdered,
        refDisplayNamesByEdge,
      );
      recordBeforeDiscreteMutation(useProjectStore.getState);
      const patch: { referenceEdgeOrder: string[]; prompt?: string } = {
        referenceEdgeOrder: newOrder,
      };
      if (newPrompt !== draft.prompt) patch.prompt = newPrompt;
      patchDraft(patch);
    },
    [
      videoNodeId,
      displayThumbnails,
      orderedIncomingRefItems,
      incomingRefItems,
      draft.referenceEdgeOrder,
      draft.prompt,
      refDisplayNamesByEdge,
      patchDraft,
    ],
  );

  useEffect(() => {
    const ids = new Set(displayThumbnails.map((t) => t.edgeId));
    if (focusedRefEdgeId && !ids.has(focusedRefEdgeId)) setFocusedRefEdgeId(null);
    if (hoveredRefEdgeId && !ids.has(hoveredRefEdgeId)) setHoveredRefEdgeId(null);
  }, [displayThumbnails, focusedRefEdgeId, hoveredRefEdgeId]);

  const activeRefEdgeId = focusedRefEdgeId ?? hoveredRefEdgeId;

  const handleRefSelect = useCallback((edgeId: string) => {
    setFocusedRefEdgeId(edgeId);
    setHoveredRefEdgeId(edgeId);
  }, []);

  const handleHoveredRefChange = useCallback((edgeId: string | null) => {
    setHoveredRefEdgeId(edgeId);
  }, []);

  const handleRefPillActivate = useCallback((edgeId: string) => {
    setFocusedRefEdgeId(edgeId);
    setHoveredRefEdgeId(edgeId);
    thumbElRefs.current.get(edgeId)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  const handleRefDelete = useCallback(
    (edgeId: string) => {
      if (!videoNodeId) return;
      useProjectStore.getState().deleteEdge(edgeId);
    },
    [videoNodeId],
  );

  const insertPromptAtToken = useCallback((token: string) => {
    promptMentionRef.current?.insertAtToken(token);
  }, []);

  // 生成参数显示
  const aspect = draft.output.aspectRatio;
  const resolution = draft.output.resolution;
  const durationSec = draft.output.durationSec;
  const watermark = draft.output.watermark ?? false;
  const generateAudio = draft.output.generateAudio ?? true;
  const noSubtitles = draft.output.noSubtitles ?? false;
  const isSmartDuration = durationSec === -1;
  const workflowLocked = draft.workflowLocked ?? false;

  // 验证多模态输入
  const validationResult = useMemo(() => {
    const assets = orderedIncomingRefItems
      .filter((item) => item.kind !== "text" && item.path?.trim())
      .map((item) => ({
        kind: item.kind,
        path: item.path,
        name: item.path?.split("/").pop(),
      }));
    const base = validateMultimodalInput(assets);

    // 按 workflow 差异化验证图片数量
    const images = assets.filter((a) => a.kind === "image");
    const videos = assets.filter((a) => a.kind === "video");
    const workflow = draft.workflow;
    if (workflow === "first_last_frame" && images.length !== 2) {
      base.errors.push({
        code: "IMAGE_COUNT_INVALID",
        message: images.length < 2
          ? "首尾帧需要 2 张图（首帧 + 尾帧）"
          : `首尾帧只需 2 张图，当前 ${images.length} 张`,
      });
      base.valid = false;
    }
    if (workflow === "image_to_video" && images.length === 0) {
      base.errors.push({
        code: "IMAGE_COUNT_INVALID",
        message: "图生视频至少需要 1 张参考图",
      });
      base.valid = false;
    }
    if (workflow === "video_reference" && videos.length === 0) {
      base.errors.push({
        code: "VIDEO_COUNT_INVALID",
        message: "参考视频模式至少需要 1 个参考视频",
      });
      base.valid = false;
    }

    const complianceRefs = orderedIncomingRefItems
      .filter((i) => i.kind === "image")
      .map((item, idx) => ({
        edgeId: item.edgeId,
        badgeLabel: refAtMeta.get(item.edgeId)?.badge ?? String(idx + 1),
      }));
    const complianceErrors = collectSeedanceImageComplianceValidationErrors(
      complianceRefs,
      imageComplianceByEdge,
    );

    return mergeSeedanceComplianceIntoValidation(base, complianceErrors);
  }, [orderedIncomingRefItems, draft.workflow, imageComplianceByEdge, refAtMeta]);

  // 当前节点是否有输出路径（生成成功）
  const nodeHasOutput = videoNodeId
    ? Boolean(useProjectStore.getState().nodes.find((n) => n.id === videoNodeId)?.data.path)
    : false;

  // 生成状态派生
  const jobStatus = activeJob?.status;
  const jobError = activeJob?.error ?? (draft as { error?: string }).error;
  const isGenerating =
    submitting ||
    jobStatus === "queued" ||
    jobStatus === "running" ||
    cancelling;
  const isCancelled = jobStatus === "cancelled";
  const isFailed = jobStatus === "failed";
  const isSucceeded = (jobStatus === "succeeded" || nodeHasOutput) && !isCancelled;
  const generationCapsuleLabel = getVideoGenerationDisplayLabel({
    status: jobStatus,
    progress: activeJob?.progress,
    cancelling,
    submitting,
  });
  const dreaminaSubmitId = resolveDreaminaSubmitId({
    jobId: activeJob?.id,
    error: jobError,
  });
  const showRecoverDreamina = Boolean(
    isDreaminaModel(validModelId) && dreaminaSubmitId && (isFailed || isGenerating),
  );

  const videoNodeLabel = useProjectStore((s) => {
    if (!videoNodeId) return undefined;
    return s.nodes.find((n) => n.id === videoNodeId)?.data.label;
  });

  useHermesCanvasGenFailureNotify({
    nodeId: videoNodeId ?? "",
    kind: "video",
    isFailed,
    isGenerating,
    error: jobError,
    nodeLabel: videoNodeLabel,
    dreaminaSubmitId: showRecoverDreamina ? dreaminaSubmitId : null,
  });

  // 合并校验错误（不含 job 失败，失败由灵体告知）
  const validationErrors = useMemo(
    () => validationResult.errors.map((e) => e.message),
    [validationResult],
  );

  const buildComplianceRefContexts = useCallback(
    () =>
      orderedIncomingRefItems
        .filter((i) => i.kind === "image")
        .map((item, idx) => ({
          edgeId: item.edgeId,
          badgeLabel: refAtMeta.get(item.edgeId)?.badge ?? String(idx + 1),
        })),
    [orderedIncomingRefItems, refAtMeta],
  );

  // 处理生成
  const handleGenerate = useCallback(async () => {
    if (busy && !cancelling) return;
    if (!validationResult.valid) {
      const msg = validationResult.errors[0]?.message ?? "输入不符合规格";
      setStatusText(msg);
      return;
    }

    const complianceRefs = buildComplianceRefContexts();
    const hasPendingCompliance = complianceRefs.some(
      (ref) => imageComplianceByEdge.get(ref.edgeId)?.status === "pending",
    );
    let complianceMap = imageComplianceByEdge;
    if (hasPendingCompliance) {
      complianceMap = await probeSeedanceImageComplianceForRefs(
        projectPath,
        orderedIncomingRefItems,
      );
    }
    const complianceErrors = collectSeedanceImageComplianceValidationErrors(
      complianceRefs,
      complianceMap,
    );
    if (complianceErrors.length > 0) {
      const msg = complianceErrors[0]?.message ?? "参考图不符合 Seedance 2.0 规格";
      setStatusText(msg);
      return;
    }

    void startGeneration();
  }, [
    busy,
    cancelling,
    validationResult,
    buildComplianceRefContexts,
    imageComplianceByEdge,
    orderedIncomingRefItems,
    projectPath,
    startGeneration,
    setStatusText,
  ]);

  const handleGenerateClick = useCallback(() => {
    if (isGenerating) {
      if (submitting || !activeJob?.id) return;
      void cancelGeneration();
      return;
    }
    handleGenerate();
  }, [cancelGeneration, handleGenerate, isGenerating, submitting, activeJob?.id]);

  const aspectLabel = aspect === "auto" ? "自动" : aspect;
  const durationLabel = isSmartDuration ? "智能" : `${durationSec}s`;

  const closeOutputMenus = () => {
    setOutputSettingsOpen(false);
  };

  const outputSettingsHandlers = {
    onAspect: (id: TextToVideoAspectId) => {
      patchDraft({ output: { aspectRatio: id } });
      closeOutputMenus();
    },
    onResolution: (r: "480P" | "720P" | "1080P") => {
      if (!isCatalogResolutionSupported(validModelId, r)) {
        setStatusText("当前模型不支持该清晰度");
        return;
      }
      patchDraft({ output: { resolution: r } });
      closeOutputMenus();
    },
    onSmartDurationToggle: () =>
      patchDraft({ output: { durationSec: isSmartDuration ? 5 : -1 } }),
    onDuration: (sec: number) => patchDraft({ output: { durationSec: sec } }),
    onWatermarkToggle: () => patchDraft({ output: { watermark: !watermark } }),
    onGenerateAudioToggle: () => patchDraft({ output: { generateAudio: !generateAudio } }),
    onNoSubtitlesToggle: () => patchDraft({ output: { noSubtitles: !noSubtitles } }),
  };

  const outputSettingsBase = {
    aspect,
    resolution,
    durationSec,
    isSmartDuration,
    watermark,
    generateAudio,
    noSubtitles,
    supportedResolutions: catalogResolutions,
    durationMinSec: modelCapabilities.durationMinSec,
    durationMaxSec: modelCapabilities.durationMaxSec,
    ...outputSettingsHandlers,
  };

  const firstLastImageItems = useMemo(
    () => displayThumbnails.filter((t) => t.kind === "image" && t.path?.trim()).slice(0, 2),
    [displayThumbnails],
  );
  const showFirstLastControls =
    draft.workflow === "first_last_frame" && firstLastImageItems.length === 2;

  const isPortalLayout = layout === "portal";
  const generationCapsule = isGenerating ? (
    <VideoGenerationCenterCapsule
      label={generationCapsuleLabel}
      onCancel={() => void cancelGeneration()}
      cancelling={cancelling}
      showCancel={!submitting && Boolean(activeJob?.id)}
    />
  ) : null;

  return (
    <>
      {isPortalLayout ? (
        <PortalToElement target={previewOverlayEl}>{generationCapsule}</PortalToElement>
      ) : null}
    <div
      className={`mmPanel mmPanel--chrome${isExpandedLayout ? " mmPanel--expanded" : ""}${isGenerating && isExpandedLayout ? " mmPanel--generating" : ""} ${RF_NODE_INPUT_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {isExpandedLayout ? generationCapsule : null}
      {/* ══ 模块 1：顶栏（展开 + 模式标签） ══ */}
      <div className="mmChromeHead mmChromeHead--compact">
        <div
          className="mmTabs mmTabs--compact"
          role="tablist"
          aria-label="视频创作模式"
          onKeyDown={handleWorkflowTabKeyDown}
        >
          {workflowTabs.map((tab) => (
            <VideoWorkflowTab
              key={tab.id}
              tab={tab}
              activeWorkflow={draft.workflow}
              locked={workflowLocked}
              onTabClick={handleWorkflowTabClick}
            />
          ))}
        </div>
        <div className="mmChromeHeadActions">
          {isChromePortal && videoNodeId ? (
              <button
                type="button"
                className="mmChromeIconBtn mmChromeExpandBtn"
                title="展开面板"
                onClick={() => setVideoGenPanelExpandedNodeId(videoNodeId)}
              >
                <PanelExpandIcon />
              </button>
            ) : null}
            {isExpandedLayout && onRequestClose ? (
              <button type="button" className="mmChromeIconBtn" title="关闭 (Esc)" onClick={onRequestClose}>
                <PanelCloseIcon />
              </button>
            ) : null}
        </div>
      </div>

      {/* ══ 模块 2：参考图（底栏缩略图条 + 悬停浮层预览，无顶部固定预览条） ══ */}
      {displayThumbnails.length > 0 ? (
      <div className="mmCollapsibleBody">
        <VideoGenPanelSectionLabel sectionKey="reference" compact />
        <div className="mmToolsAndThumbs mmToolsAndThumbs--compact mmToolsAndThumbs--hasRefs">
          <VideoRefThumbStrip
            items={displayThumbnails}
            refAtMeta={refAtMeta}
            showFirstLastControls={showFirstLastControls}
            firstLastImageItems={firstLastImageItems}
            focusedRefEdgeId={focusedRefEdgeId}
            onFocusedRefChange={handleRefSelect}
            onHoveredRefChange={handleHoveredRefChange}
            onInsertAtToken={insertPromptAtToken}
            onPreview={setPreviewIndex}
            onDelete={handleRefDelete}
            onReorder={handleRefStripReorder}
            onSwapFirstLast={handleSwapFirstLast}
            thumbElRefs={thumbElRefs}
          />
        </div>
      </div>
      ) : null}

      {/* ══ 模块 3：提示词文本区 ══ */}
      <VideoGenPanelSectionLabel sectionKey="prompt" compact />
      <div className="mmPromptArea mmPromptArea--compact">
        <div className="vgp-prompt-wrap">
          <VideoPromptMentionInput
            ref={promptMentionRef}
            className="video-prompt-mention--compact"
            value={draft.prompt ?? ""}
            maxLength={VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS}
            incomingRefs={orderedIncomingRefItems}
            displayNamesByEdge={refDisplayNamesByEdge}
            activeRefEdgeId={activeRefEdgeId}
            onRefPillActivate={handleRefPillActivate}
            complianceByEdgeId={imageComplianceByEdge}
            onChange={(next) => patchDraft({ prompt: next })}
            placeholder={
              orderedIncomingRefItems.length > 0
                ? "描述画面与动作… @ 可写 @文本1、@图片1（序号与参考条一致）或节点名"
                : "描述你想要的画面、场景、动作…"
            }
          />
        </div>
      </div>

      <VideoGenerationStatusRail
        isGenerating={isGenerating}
        isCancelled={isCancelled}
        isFailed={isFailed}
        failureError={jobError}
        errors={validationErrors}
        showValidation={!isGenerating && !isFailed && !isCancelled && !validationResult.valid}
      />

      <VideoGenPanelSectionLabel sectionKey="output" compact foot />

      <div ref={outputFootRef} className="mmFoot mmFoot--chrome">
        <VideoModelPicker
          models={videoModels}
          value={validModelId}
          loading={modelsLoading}
          workflow={draft.workflow}
          onChange={(id) => patchDraft({ modelId: id as VideoModelId })}
        />
        <button
          ref={outputSettingsPillRef}
          type="button"
          className={`mmFootPill mmFootPill--output ${outputSettingsOpen ? "mmFootPill--open" : ""}`}
          title="输出参数：比例、清晰度、时长、音频"
          onClick={(e) => {
            e.stopPropagation();
            setOutputSettingsOpen((o) => !o);
          }}
        >
          <span className="mmFootPillAspectIcon" aria-hidden>
            <TtvAspectWireframe id={aspect} />
          </span>
          <span className="mmFootPillLabel mmFootPillLabel--output">
            {aspectLabel} · {resolution} · {durationLabel}
          </span>
          <span
            className={`mmFootPillAudioIcon${generateAudio ? " mmFootPillAudioIcon--on" : ""}`}
            aria-hidden
          >
            <VideoGenPanelIconSpeaker off={!generateAudio} />
          </span>
          <VideoGenPanelIconDropdown />
        </button>
        <button
          type="button"
          className={`igp-generate-btn igp-generate-btn--circle${isGenerating ? " generating" : ""}`}
          disabled={!isGenerating && !validationResult.valid && !isFailed && !isCancelled}
          onClick={handleGenerateClick}
          title={
            isGenerating
              ? "停止"
              : isFailed
                ? "重试"
                : isCancelled
                  ? "再次生成"
                  : isSucceeded
                    ? "再生成"
                    : "生成"
          }
          aria-label={
            isGenerating
              ? "停止生成"
              : isFailed
                ? "重试"
                : isSucceeded && !isCancelled
                  ? "再生成"
                  : "生成视频"
          }
        >
          <VideoGenerateButtonIconState isGenerating={isGenerating} />
        </button>
      </div>

      <VideoOutputSettingsPopover
        anchorRef={outputSettingsPillRef}
        open={outputSettingsOpen}
        onClose={closeOutputMenus}
      >
        <VideoOutputSettingsContent
          {...outputSettingsBase}
          sections={{
            aspect: true,
            resolution: true,
            duration: true,
            durationSmart: true,
            audio: true,
            watermark: true,
            noSubtitles: true,
          }}
        />
      </VideoOutputSettingsPopover>

      {previewIndex !== null ? (
        <VideoRefPreviewModal
          items={displayThumbnails}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      ) : null}
    </div>
    </>
  );
}
