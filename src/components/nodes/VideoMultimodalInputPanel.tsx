/**
 * 视频节点多模态输入管理面板
 *
 * 设计规格：
 * - 模块1：顶部创作模式标签栏（文生视频/全能参考/图生视频/首尾帧/图片参考）
 * - 模块2：快捷工具（标记/运镜/角色库）+ 参考图缩略图
 * - 模块3：提示词文本区
 * - 模块4：底部生成参数栏（模型/画幅/时长/音频/生成按钮）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { TtvCameraMovementModal } from "@/components/nodes/TtvCameraMovementModal";
import { useTtvDraft } from "@/hooks/useTtvDraft";
import {
  detectWorkflow,
  incomingRefsForDisplayStrip,
  resolveIncomingRefItemsForDraft,
  splitIncomingRefsForDraft,
  useVideoIncomingReferenceItems,
} from "@/hooks/useVideoIncomingReferenceItems";
import { useVideoModels } from "@/hooks/useVideoModels";
import { VideoModelPicker } from "@/components/nodes/VideoModelPicker";
import { useVideoNodeGeneration } from "@/hooks/useVideoNodeGeneration";
import { MULTIMODAL_LIMITS, validateMultimodalInput } from "@/lib/seedance/validation";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { TtvAspectWireframe } from "./TtvAspectWireframe";
import {
  TEXT_TO_VIDEO_ASPECT_IDS,
  TEXT_TO_VIDEO_ASPECT_LABEL,
  type TextToVideoAspectId,
  type VideoModelId,
} from "@/lib/videoNodeTypes";
import { VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { IgpGenerateButtonIcon } from "@/components/nodes/IgpGenerateButtonIcon";
import { PanelCloseIcon, PanelExpandIcon, PanelPinIcon } from "@/components/nodes/nodePanelIcons";
import { VideoOutputSettingsContent } from "@/components/nodes/VideoOutputSettingsContent";
import { VideoOutputSettingsPopover } from "@/components/nodes/VideoOutputSettingsPopover";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

export type { TextToVideoAspectId };

// ═══════════════════════════════════════════════════════════════
// 子组件：图标
// ═══════════════════════════════════════════════════════════════

function IconMarker() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="13.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 7V5a1 1 0 011-1h6a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3L4 7v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V7l-8-4z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconDropdown() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6"/>
    </svg>
  );
}

function IconRetry() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 4v6h6M23 20v-6h-6"/>
      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// 子组件：全屏预览模态
// ═══════════════════════════════════════════════════════════════

interface RefPreviewModalProps {
  items: Array<{ path?: string; assetId?: string; kind: "image" | "video" | "audio" }>;
  initialIndex: number;
  onClose: () => void;
}

function RefPreviewModal({ items, initialIndex, onClose }: RefPreviewModalProps) {
  const [activeIdx, setActiveIdx] = useState(initialIndex);
  const item = items[activeIdx];
  if (!item) return null;

  return (
    <div
      className="mmPreviewOverlay"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mmPreviewModal" onClick={(e) => e.stopPropagation()}>
        {/* 顶部栏 */}
        <div className="mmPreviewHeader">
          <span className="mmPreviewTitle">
            参考图 {activeIdx + 1} / {items.length}
          </span>
          <button type="button" className="mmPreviewClose" onClick={onClose} aria-label="关闭预览">
            ×
          </button>
        </div>

        {/* 图片主体 */}
        <div className="mmPreviewBody">
          {item.kind === "image" && (
            <NodeMediaPreview relPath={item.path} assetId={item.assetId} kind="image" />
          )}
          {item.kind === "video" && (
            <NodeMediaPreview relPath={item.path} assetId={item.assetId} kind="video" />
          )}
          {item.kind === "audio" && (
            <div className="mmPreviewAudio">
              <span>♪</span>
              <span>音频参考</span>
            </div>
          )}
        </div>

        {/* 底部缩略图导航（多于1张时显示） */}
        {items.length > 1 && (
          <div className="mmPreviewNav">
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                className={`mmPreviewNavThumb ${i === activeIdx ? "mmPreviewNavThumb--active" : ""}`}
                onClick={() => setActiveIdx(i)}
                aria-label={`查看第 ${i + 1} 张`}
              >
                <NodeMediaPreview relPath={it.path} assetId={it.assetId} kind={it.kind === "audio" ? "image" : it.kind} />
                <span className="mmPreviewNavBadge">{i + 1}</span>
              </button>
            ))}
          </div>
        )}

        {/* 左右切换箭头 */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              className="mmPreviewArrow mmPreviewArrow--prev"
              onClick={() => setActiveIdx((i) => (i - 1 + items.length) % items.length)}
              disabled={activeIdx === 0}
              aria-label="上一张"
            >
              ‹
            </button>
            <button
              type="button"
              className="mmPreviewArrow mmPreviewArrow--next"
              onClick={() => setActiveIdx((i) => (i + 1) % items.length)}
              disabled={activeIdx === items.length - 1}
              aria-label="下一张"
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 子组件：参考图缩略图
// ═══════════════════════════════════════════════════════════════

interface ThumbnailItemProps {
  index: number;
  path?: string;
  assetId?: string;
  kind: "image" | "video" | "audio";
  edgeId: string;
  onClick?: () => void;
  onDelete?: (edgeId: string) => void;
}

function ReferenceThumbnail({ index, path, assetId, kind, edgeId, onClick, onDelete }: ThumbnailItemProps) {
  if (!path && !assetId) return null;

  return (
    <div
      className="mmThumb mmThumb--clickable"
      title={`点击预览参考图 ${index}，悬停可删除连线`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
    >
      <span className="mmThumbBadge">{index}</span>
      {/* 悬停显示删除 */}
      <button
        className="mmThumbDelete"
        title="删除此连线"
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onClick={(e) => { e.stopPropagation(); onDelete?.(edgeId); }}
        aria-label={`删除参考图 ${index} 的连线`}
      >
        ×
      </button>
      {kind === "image" && (
        <NodeMediaPreview relPath={path} assetId={assetId} kind="image" />
      )}
      {kind === "video" && (
        <NodeMediaPreview relPath={path} assetId={assetId} kind="video" />
      )}
      {kind === "audio" && (
        <div className="mmThumbAudio">
          <span>♪</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 子组件：快捷工具按钮
// ═══════════════════════════════════════════════════════════════

interface QuickToolButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}

function QuickToolButton({ icon, label, onClick, active }: QuickToolButtonProps) {
  return (
    <button
      type="button"
      className={`mmQuickTool ${active ? "mmQuickTool--active" : ""}`}
      onClick={onClick}
      title={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════

export interface VideoMultimodalInputPanelProps {
  videoNodeId?: string;
  /** portal：节点底栏紧凑态；expanded：居中放大 */
  layout?: "portal" | "expanded";
  onRequestClose?: () => void;
  onRequestDock?: () => void;
}

const WORKFLOW_TABS = [
  { id: "text_to_video", label: "文生视频" },
  { id: "multimodal_reference", label: "全能参考" },
  { id: "image_to_video", label: "图生视频" },
  { id: "first_last_frame", label: "首尾帧" },
  { id: "image_reference", label: "图片参考" },
  { id: "video_reference", label: "参考视频" },
] as const;

export function VideoMultimodalInputPanel({
  videoNodeId,
  layout,
  onRequestClose,
  onRequestDock,
}: VideoMultimodalInputPanelProps) {
  const isChromePortal = layout === "portal";
  const isExpandedLayout = layout === "expanded";
  const useCompactChrome = isChromePortal || isExpandedLayout;
  const [ratioOpen, setRatioOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [outputMenuOpen, setOutputMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [paramCollapsed, setParamCollapsed] = useState(false);

  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const outputComboRef = useRef<HTMLButtonElement | null>(null);
  const outputFootRef = useRef<HTMLDivElement | null>(null);
  const pendingCameraInsertRef = useRef<number | null>(null);

  const closeCamera = useCallback(() => setCameraOpen(false), []);

  const { draft, patchDraft } = useTtvDraft(videoNodeId);
  const { models: videoModels, loading: modelsLoading, defaultModel } = useVideoModels();

  // 如果当前 modelId 在 Settings 中不存在，用默认值
  const validModelId = videoModels.some((m) => m.id === draft.modelId)
    ? draft.modelId
    : (defaultModel?.id ?? "");

  // Settings 加载完成后，若当前 modelId 已匹配但 draft 里不是有效值，自动写回正确的 modelId
  useEffect(() => {
    if (!videoNodeId) return;
    if (modelsLoading) return;
    if (!defaultModel) return;
    if (draft.modelId === validModelId) return; // 已经匹配
    patchDraft({ modelId: validModelId });
  }, [modelsLoading, videoNodeId, draft.modelId, validModelId, defaultModel, patchDraft]);

  const getInsertIndexForCamera = useCallback(() => {
    const ta = promptTextareaRef.current;
    const len = (draft.prompt ?? "").length;
    if (!ta) return len;
    const raw = pendingCameraInsertRef.current ?? ta.selectionStart ?? len;
    return Math.max(0, Math.min(raw, len));
  }, [draft.prompt]);

  const setMaximizedNodeId = useCanvasUiStore((s) => s.setMaximizedNodeId);
  const setVideoGenPanelExpandedNodeId = useCanvasUiStore((s) => s.setVideoGenPanelExpandedNodeId);
  const markedNodeId = useCanvasUiStore((s) => s.markedNodeId);
  const setMarkedNodeId = useCanvasUiStore((s) => s.setMarkedNodeId);
  const { startGeneration, busy, activeJob } = useVideoNodeGeneration(videoNodeId);
  const incomingRefItems = useVideoIncomingReferenceItems(videoNodeId);
  const projectPath = useProjectStore((s) => s.projectPath);

  // 将连线上的参考图/视频/音频同步到 draft.reference*Paths
  useEffect(() => {
    if (!videoNodeId) return;
    let cancelled = false;
    void (async () => {
      const resolved = await resolveIncomingRefItemsForDraft(projectPath, incomingRefItems);
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
  }, [videoNodeId, incomingRefItems, patchDraft, projectPath]);

  // 根据连线状态自动检测并更新 workflow
  useEffect(() => {
    if (!videoNodeId) return;
    const detected = detectWorkflow(incomingRefItems, draft.prompt ?? "");
    if (detected && detected !== draft.workflow) {
      patchDraft({ workflow: detected });
    }
  }, [videoNodeId, incomingRefItems, draft.prompt, draft.workflow, patchDraft]);

  // 过滤出图片类型的参考项用于缩略图展示
  const displayThumbnails = useMemo(() => {
    return incomingRefsForDisplayStrip(incomingRefItems);
  }, [incomingRefItems]);

  // 生成参数显示
  const aspect = draft.output.aspectRatio;
  const resolution = draft.output.resolution;
  const durationSec = draft.output.durationSec;
  const watermark = draft.output.watermark ?? false;
  const isSmartDuration = durationSec === -1;

  // 验证多模态输入
  const validationResult = useMemo(() => {
    const assets = incomingRefItems.map((item) => ({
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

    return base;
  }, [incomingRefItems, draft.workflow]);

  // 当前节点是否有输出路径（生成成功）
  const nodeHasOutput = videoNodeId
    ? Boolean(useProjectStore.getState().nodes.find((n) => n.id === videoNodeId)?.data.path)
    : false;

  // 生成状态派生
  const jobStatus = activeJob?.status;
  const jobProgress = activeJob?.progress;
  const jobError = activeJob?.error ?? (draft as { error?: string }).error;
  const isGenerating = jobStatus === "queued" || jobStatus === "running";
  const isFailed = jobStatus === "failed" || jobStatus === "cancelled";
  const isSucceeded = jobStatus === "succeeded" || nodeHasOutput;

  // 合并所有错误
  const allErrors = useMemo(() => {
    const errs: string[] = [];
    if (!validationResult.valid) {
      errs.push(...validationResult.errors.map((e) => e.message));
    }
    if (jobError) errs.push(jobError);
    return errs;
  }, [validationResult, jobError]);

  const hasErrors = allErrors.length > 0;

  // 处理生成
  const handleGenerate = useCallback(() => {
    if (busy) return;
    // 验证未通过时阻止生成
    if (!validationResult.valid) {
      const msg = validationResult.errors[0]?.message ?? "输入不符合规格";
      useProjectStore.getState().setStatusText(msg);
      return;
    }
    void startGeneration();
  }, [busy, validationResult, startGeneration]);

  // 快捷工具状态
  const hasMarker = markedNodeId === videoNodeId;
  const hasCamera = Boolean(draft.cameraMovement?.presetId || draft.cameraMovement?.selectedCustomMoveId);

  const aspectLabel = aspect === "auto" ? "自动" : aspect;
  const durationLabel = isSmartDuration ? "智能" : `${durationSec}s`;
  const outputComboLabel = `${aspectLabel} · ${resolution} · ${durationLabel}`;

  const closeOutputMenus = () => {
    setOutputMenuOpen(false);
    setRatioOpen(false);
    setResolutionOpen(false);
    setDurationOpen(false);
  };

  const showOutputSettings = outputMenuOpen || ratioOpen || resolutionOpen || durationOpen;

  const outputSettingsContent = (
    <VideoOutputSettingsContent
      aspect={aspect}
      resolution={resolution}
      durationSec={durationSec}
      isSmartDuration={isSmartDuration}
      watermark={watermark}
      onAspect={(id) => {
        patchDraft({ output: { aspectRatio: id } });
        closeOutputMenus();
      }}
      onResolution={(r) => {
        patchDraft({ output: { resolution: r } });
      }}
      onSmartDurationToggle={() =>
        patchDraft({ output: { durationSec: isSmartDuration ? 5 : -1 } })
      }
      onDuration={(sec) => patchDraft({ output: { durationSec: sec } })}
      onWatermarkToggle={() => patchDraft({ output: { watermark: !watermark } })}
    />
  );

  return (
    <div
      className={`mmPanel${useCompactChrome ? " mmPanel--chrome" : ""}${isExpandedLayout ? " mmPanel--expanded" : ""} ${RF_NODE_INPUT_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ══ 模块 1：顶栏（展开 + 模式标签） ══ */}
      <div className={`mmChromeHead${useCompactChrome ? " mmChromeHead--compact" : ""}`}>
        <div className={`mmTabs${useCompactChrome ? " mmTabs--compact" : ""}`}>
        {WORKFLOW_TABS.map((tab) => {
          const isActive = draft.workflow === tab.id;
          return (
            <span
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className={`mmTab ${isActive ? "mmTab--active" : "mmTab--inactive"}`}
              title={isActive ? undefined : "创作模式由参考素材连线自动识别"}
            >
              {tab.label}
            </span>
          );
        })}
        </div>
        {useCompactChrome ? (
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
            {isExpandedLayout ? (
              <>
                {onRequestDock ? (
                  <button type="button" className="mmChromeIconBtn" title="钉在节点下方" onClick={onRequestDock}>
                    <PanelPinIcon />
                  </button>
                ) : null}
                {onRequestClose ? (
                  <button type="button" className="mmChromeIconBtn" title="关闭 (Esc)" onClick={onRequestClose}>
                    <PanelCloseIcon />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="mmExpandBtn"
              title={paramCollapsed ? "展开参数" : "收起参数"}
              onClick={() => setParamCollapsed((c) => !c)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                {paramCollapsed ? <path d="M6 9l6 6 6-6" /> : <path d="M18 15l-6-6-6 6" />}
              </svg>
            </button>
          </>
        )}
      </div>

      {/* ══ 模块 2：快捷工具 + 参考图 ══ */}
      <div
        className={`mmCollapsibleBody${!useCompactChrome && paramCollapsed ? " mmCollapsibleBody--collapsed" : ""}`}
      >
        <div className={`mmToolsAndThumbs${useCompactChrome ? " mmToolsAndThumbs--compact" : ""}`}>
          <div className="mmQuickTools">
            <QuickToolButton
              icon={<IconMarker />}
              label="标记"
              active={hasMarker}
              onClick={() => {
                if (!videoNodeId) return;
                setMarkedNodeId(hasMarker ? null : videoNodeId);
              }}
            />
            <QuickToolButton
              icon={<IconCamera />}
              label="运镜"
              active={hasCamera}
              onClick={() => {
                pendingCameraInsertRef.current =
                  promptTextareaRef.current?.selectionStart ?? (draft.prompt?.length ?? 0);
                setCameraOpen((o) => !o);
              }}
            />
            <TtvCameraMovementModal
              open={cameraOpen}
              onClose={closeCamera}
              cameraMovement={draft.cameraMovement}
              patchDraft={patchDraft}
              getInsertIndex={getInsertIndexForCamera}
            />
            <QuickToolButton
              icon={<IconShield />}
              label="角色库"
              onClick={() => useProjectStore.getState().setStatusText("角色库功能开发中，敬请期待")}
            />
          </div>
          {/* 右侧参考素材缩略图（有连线素材时才显示） */}
          {displayThumbnails.length > 0 ? (
            <div className="mmThumbsWrapper">
              <span className="mmThumbsCount">{displayThumbnails.length}</span>
              <div className="mmThumbs">
                {displayThumbnails.map((item, idx) => (
                  <ReferenceThumbnail
                    key={`${item.kind}-${item.assetId ?? item.path}`}
                    index={idx + 1}
                    path={item.path}
                    assetId={item.assetId}
                    kind={item.kind}
                    edgeId={item.edgeId}
                    onClick={() => setPreviewIndex(idx)}
                    onDelete={(edgeId) => {
                      if (!videoNodeId) return;
                      useProjectStore.getState().deleteEdge(edgeId);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ══ 模块 3：提示词文本区 ══ */}
      <div className={`mmPromptArea${useCompactChrome ? " mmPromptArea--compact" : ""}`}>
        <div className={useCompactChrome ? "vgp-prompt-wrap" : undefined}>
          <textarea
            ref={promptTextareaRef}
            className={`mmPromptInput ${RF_NODE_INPUT_CLASS}`}
            placeholder="描述你想要的画面、场景、动作…"
            value={draft.prompt ?? ""}
            maxLength={VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS}
            onChange={(e) => patchDraft({ prompt: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
          />
          {useCompactChrome ? (
            <span className="vgp-prompt-counter mono" aria-live="polite">
              {(draft.prompt ?? "").length}/{VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS}
            </span>
          ) : null}
        </div>
        {!useCompactChrome ? (
          <div className="mmPromptFooter">
            <span className="mmPromptLen mono">
              {(draft.prompt ?? "").length}/{VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS}
            </span>
          </div>
        ) : null}
      </div>

      {/* ══ 模块 4：底部生成参数栏 ══ */}
      <div ref={outputFootRef} className={`mmFoot${useCompactChrome ? " mmFoot--chrome" : ""}`}>
        {useCompactChrome ? (
          <VideoModelPicker
            models={videoModels}
            value={validModelId}
            loading={modelsLoading}
            onChange={(id) => patchDraft({ modelId: id as VideoModelId })}
          />
        ) : (
          <select
            className="mmModelSelect"
            value={validModelId}
            onChange={(e) => patchDraft({ modelId: e.target.value as VideoModelId })}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={modelsLoading}
          >
            {modelsLoading ? (
              <option value="">加载中…</option>
            ) : videoModels.filter((m) => m.enabled).length > 0 ? (
              videoModels
                .filter((m) => m.enabled)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))
            ) : (
              <option value="">请在设置中配置视频模型</option>
            )}
          </select>
        )}

        {useCompactChrome ? (
          <>
            <button
              ref={outputComboRef}
              type="button"
              className={`mmOutputCombo ${outputMenuOpen ? "mmOutputCombo--open" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOutputMenuOpen((o) => !o);
                setRatioOpen(false);
                setResolutionOpen(false);
                setDurationOpen(false);
              }}
            >
              <span className="mmOutputComboLabel">{outputComboLabel}</span>
              <IconDropdown />
            </button>
            <button
              type="button"
              className={`igp-generate-btn${isGenerating ? " generating" : ""}`}
              disabled={isGenerating || (!validationResult.valid && !isFailed)}
              onClick={isFailed ? () => void startGeneration() : handleGenerate}
              title={isGenerating ? "生成中…" : isFailed ? "重试" : isSucceeded ? "已完成" : "生成"}
            >
              {isGenerating ? (
                <IgpGenerateButtonIcon generating />
              ) : isFailed ? (
                <IconRetry />
              ) : isSucceeded ? (
                <IconCheck />
              ) : (
                <IgpGenerateButtonIcon />
              )}
            </button>
          </>
        ) : (
          <>
        <button
          type="button"
          className={`mmParam mmParam--clickable ${ratioOpen ? "mmParam--open" : ""}`}
          onClick={() => { setRatioOpen((o) => !o); setResolutionOpen(false); setDurationOpen(false); }}
        >
          <span className="mmParamIcon">▭</span>
          <span className="mmParamText">{aspect === "auto" ? "自动" : aspect}</span>
          <IconDropdown />
        </button>

        <button
          type="button"
          className={`mmParam mmParam--clickable ${resolutionOpen ? "mmParam--open" : ""}`}
          onClick={() => { setResolutionOpen((o) => !o); setRatioOpen(false); setDurationOpen(false); }}
        >
          <span className="mmParamText">{resolution}</span>
          <IconDropdown />
        </button>

        <button
          type="button"
          className={`mmParam mmParam--clickable ${durationOpen ? "mmParam--open" : ""}`}
          onClick={() => { setDurationOpen((o) => !o); setRatioOpen(false); setResolutionOpen(false); }}
        >
          <span className="mmParamText">{isSmartDuration ? "智能" : `${durationSec}s`}</span>
          <IconDropdown />
        </button>

        <button
          type="button"
          className={`mmGenerateBtn ${isGenerating ? "mmGenerateBtn--busy" : ""} ${isSucceeded ? "mmGenerateBtn--success" : ""} ${isFailed ? "mmGenerateBtn--failed" : ""}`}
          disabled={isGenerating || (!validationResult.valid && !isFailed)}
          onClick={isFailed ? () => void startGeneration() : handleGenerate}
          title={isGenerating ? "生成中…" : isFailed ? "重试" : isSucceeded ? "已完成" : "生成"}
        >
          {isGenerating ? <span className="mmSpinner" /> : isFailed ? <IconRetry /> : isSucceeded ? <IconCheck /> : <IgpGenerateButtonIcon />}
        </button>

        {ratioOpen && (
          <div className="mmGenSettings" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mmGenSettingsSection">
              <div className="mmGenSettingsLabel">比例</div>
              <div className="mmGenSettingsRatioGrid">
                {TEXT_TO_VIDEO_ASPECT_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`mmGenSettingsRatioBtn ${aspect === id ? "mmGenSettingsRatioBtn--active" : ""}`}
                    onClick={() => { patchDraft({ output: { aspectRatio: id } }); setRatioOpen(false); }}
                  >
                    <TtvAspectWireframe id={id} />
                    <span>{TEXT_TO_VIDEO_ASPECT_LABEL[id]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 清晰度二级面板 */}
        {resolutionOpen && (
          <div className="mmGenSettings" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mmGenSettingsSection">
              <div className="mmGenSettingsLabel">清晰度</div>
              <div className="mmGenSettingsSeg">
                {(["480P", "720P", "1080P"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`mmGenSettingsSegBtn ${resolution === r ? "mmGenSettingsSegBtn--active" : ""}`}
                    onClick={() => { patchDraft({ output: { resolution: r } }); setResolutionOpen(false); }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 视频时长二级面板 */}
        {durationOpen && (
          <div className="mmGenSettings" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mmGenSettingsSection">
              {/* 智能时长开关 */}
              <div className="mmGenSettingsRow">
                <span className="mmGenSettingsLabel">智能时长</span>
                <button
                  type="button"
                  className={`mmGenSettingsToggle ${isSmartDuration ? "mmGenSettingsToggle--on" : ""}`}
                  onClick={() => patchDraft({ output: { durationSec: isSmartDuration ? 5 : -1 } })}
                  aria-pressed={isSmartDuration}
                >
                  <span className="mmGenSettingsToggleThumb" />
                </button>
              </div>

              {/* 手动时长滑块 */}
              <div className="mmGenSettingsLabelRow">
                <span className="mmGenSettingsLabel">视频时长</span>
                <span className="mmGenSettingsDurationVal">
                  {isSmartDuration ? "智能" : `${durationSec}s`}
                </span>
              </div>
              <input
                type="range"
                className="mmGenSettingsSlider"
                min={MULTIMODAL_LIMITS.OUTPUT_DURATION_MIN}
                max={MULTIMODAL_LIMITS.OUTPUT_DURATION_MAX}
                step={1}
                value={isSmartDuration ? 5 : durationSec}
                disabled={isSmartDuration}
                onChange={(e) => patchDraft({ output: { durationSec: Number(e.target.value) } })}
              />

              {/* 水印开关 */}
              <div className="mmGenSettingsRow">
                <span className="mmGenSettingsLabel">水印</span>
                <button
                  type="button"
                  className={`mmGenSettingsToggle ${watermark ? "mmGenSettingsToggle--on" : ""}`}
                  onClick={() => patchDraft({ output: { watermark: !watermark } })}
                  aria-pressed={watermark}
                >
                  <span className="mmGenSettingsToggleThumb" />
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {useCompactChrome ? (
        <VideoOutputSettingsPopover
          anchorRef={outputFootRef}
          open={showOutputSettings}
          onClose={closeOutputMenus}
        >
          {outputSettingsContent}
        </VideoOutputSettingsPopover>
      ) : null}

      {/* 生成进度条 */}
      {isGenerating && typeof jobProgress === "number" && (
        <div className="mmProgress">
          <div className="mmProgressBar" style={{ width: `${jobProgress}%` }} />
          <span className="mmProgressText">生成中 {jobProgress}%</span>
        </div>
      )}

      {/* 生成结果提示 */}
      {isSucceeded && !isGenerating && (
        <div className="mmResultBanner mmResultBanner--success">
          <IconCheck />
          <span>生成完成，视频已写入节点</span>
          <button
            type="button"
            className="mmResultAction"
            onClick={() => videoNodeId && setMaximizedNodeId(videoNodeId)}
          >
            查看
          </button>
        </div>
      )}

      {/* 失败态固定区域 */}
      {isFailed && !isGenerating && (
        <div className="mmFailurePanel">
          <div className="mmFailureHeader">
            <span className="mmFailureTitle">生成失败</span>
            <button
              type="button"
              className="mmFailureRetry"
              onClick={() => void startGeneration()}
            >
              <IconRetry />
              重试
            </button>
          </div>
          {allErrors.length > 0 && (
            <div className="mmFailureErrors">
              {allErrors.map((err, i) => (
                <div key={i} className="mmFailureErrorItem">
                  {err}
                </div>
              ))}
            </div>
          )}
          <div className="mmFailureHint">参数错误可修正后重试，网络问题会自动重试</div>
        </div>
      )}

      {/* 参数验证错误（非生成状态时显示） */}
      {!isGenerating && !isFailed && !isSucceeded && hasErrors && (
        <div className="mmValidationErrors">
          {allErrors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}

      {/* 全屏参考图预览模态 */}
      {previewIndex !== null && (
        <RefPreviewModal
          items={displayThumbnails}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}
