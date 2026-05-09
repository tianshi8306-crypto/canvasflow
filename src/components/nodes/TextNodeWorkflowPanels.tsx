import {
  buildVideoDraftPromptFromScriptBeatBinding,
  buildTextPromptFromScriptBinding,
  getScriptBeatIdFromParams,
  incomingScriptUpstreamState,
  scriptSyncButtonTitle,
  scriptSyncDisabledOnlyStatus,
} from "@/lib/incomingScriptBinding";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScriptBeatBindingInline } from "@/components/nodes/ScriptBeatBindingInline";
import { useTtvDraft } from "@/hooks/useTtvDraft";
import {
  incomingRefsForDisplayStrip,
  resolveIncomingRefItemsForDraft,
  splitIncomingRefsForDraft,
  useVideoIncomingReferenceItems,
  type VideoIncomingRefItem,
} from "@/hooks/useVideoIncomingReferenceItems";
import { useVideoNodeGeneration } from "@/hooks/useVideoNodeGeneration";
import { useVideoModels } from "@/hooks/useVideoModels";
import { VIDEO_WORKFLOW_TAB_LABELS } from "@/lib/videoGeneration";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { TtvVideoRefThumb } from "@/components/nodes/TtvVideoRefThumb";
import { TtvAudioRefThumb } from "@/components/nodes/TtvAudioRefThumb";
import { TtvCameraMovementModal } from "@/components/nodes/TtvCameraMovementModal";
import { TtvInlineCameraPrompt, type TtvInlineCameraPromptHandle } from "@/components/nodes/TtvInlineCameraPrompt";
import { getCameraChipDisplayLabel } from "@/lib/ttvCameraUi";
import {
  videoInputConstraintsSummary,
  VIDEO_GENERATION_DURATION_SEC,
} from "@/lib/videoInputConstraints";
import {
  TEXT_TO_VIDEO_ASPECT_IDS,
  TEXT_TO_VIDEO_ASPECT_LABEL,
  type TextToVideoAspectId,
  type VideoModelId,
} from "@/lib/videoNodeTypes";
import { VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

export type { TextToVideoAspectId };

function TtvIncomingReferenceStrip({ items }: { items: VideoIncomingRefItem[] }) {
  const display = incomingRefsForDisplayStrip(items);
  if (display.length === 0) return null;
  return (
    <div
      className="textNodeTtvRefStrip"
      title={`${videoInputConstraintsSummary()}。画布上输入节点在视频节点左侧，成片从右侧连接输出。`}
      role="list"
      aria-label="已连接的参考图、参考视频与参考音频"
    >
      {display.map((it, i) => {
        const stripMod =
          it.kind === "video"
            ? "textNodeTtvRefStripItem--video"
            : it.kind === "audio"
              ? "textNodeTtvRefStripItem--audio"
              : "";
        const badgeMod =
          it.kind === "video"
            ? "textNodeTtvRefBadge--video"
            : it.kind === "audio"
              ? "textNodeTtvRefBadge--audio"
              : "";
        return (
          <div
            key={`${it.kind}-${it.assetId ?? it.path}-${i}`}
            className={`textNodeTtvRefStripItem ${stripMod}`}
            role="listitem"
          >
            <span className={`textNodeTtvRefBadge ${badgeMod}`}>{i + 1}</span>
            <div className="textNodeTtvRefThumbInner">
              {it.kind === "image" ? (
                <NodeMediaPreview relPath={it.path} assetId={it.assetId} kind="image" />
              ) : it.kind === "video" ? (
                <TtvVideoRefThumb relPath={it.path} assetId={it.assetId} />
              ) : (
                <TtvAudioRefThumb relPath={it.path} assetId={it.assetId} />
              )}
            </div>
            {it.kind === "video" ? (
              <span className="textNodeTtvRefVideoMark" aria-hidden title="参考视频">
                ▶
              </span>
            ) : it.kind === "audio" ? (
              <span className="textNodeTtvRefAudioMark" aria-hidden title="参考音频">
                ♪
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

import { TtvAspectWireframe } from "./TtvAspectWireframe";

function TtvSpeakerIcon({ muted }: { muted?: boolean }) {
  return (
    <svg className="textNodeTtvSpeakerSvg" viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path
        fill="currentColor"
        d="M8 3.5 12 6.5v3L8 12.5H5v-9h3zm-2.5 1H3.5v7H5.5v-7zM12.5 5c.8.6 1.3 1.5 1.3 2.5s-.5 1.9-1.3 2.5v-1.2c.3-.4.5-.8.5-1.3s-.2-1-.5-1.3V5z"
      />
      {!muted && (
        <path fill="currentColor" d="M13.2 3.8c1.2 1 1.8 2.4 1.8 3.9s-.6 2.9-1.8 3.9l-.9-1c.8-.7 1.3-1.7 1.3-2.9s-.5-2.2-1.3-2.9l.9-1z" />
      )}
    </svg>
  );
}

export type TextNodeTextToVideoPanelProps = {
  /** 传入时草稿与生成任务与视频节点 `data.video` 绑定 */
  videoNodeId?: string;
};

/** 文生视频：底部配置面板（参数写入 videoNode；文本节点为本地预览） */
function TtvCameraFeatIcon() {
  return (
    <svg className="textNodeTtvFeatCamIcon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="7" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12.5" r="2.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 7V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function TextNodeTextToVideoPanel({ videoNodeId }: TextNodeTextToVideoPanelProps) {
  const [genMenuOpen, setGenMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const setMaximizedNodeId = useCanvasUiStore((s) => s.setMaximizedNodeId);
  const { draft, patchDraft } = useTtvDraft(videoNodeId);
  const { startGeneration, busy, activeJob } = useVideoNodeGeneration(videoNodeId);
  const setupFirstLastFrameForVideoNode = useProjectStore((s) => s.setupFirstLastFrameForVideoNode);
  const addInputNodeLeftOfVideo = useProjectStore((s) => s.addInputNodeLeftOfVideo);
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const incomingRefItems = useVideoIncomingReferenceItems(videoNodeId);
  const scriptBoundVideoPrompt = useMemo(
    () => (videoNodeId ? buildVideoDraftPromptFromScriptBeatBinding(nodes, edges, videoNodeId) : null),
    [nodes, edges, videoNodeId],
  );
  const scriptUpstreamState = useMemo(
    () => (videoNodeId ? incomingScriptUpstreamState(nodes, edges, videoNodeId) : "none"),
    [nodes, edges, videoNodeId],
  );
  const scriptBeatKey = useMemo(() => {
    if (!videoNodeId) return "";
    const n = nodes.find((x) => x.id === videoNodeId);
    return getScriptBeatIdFromParams(n?.data ?? {}) ?? "";
  }, [nodes, videoNodeId]);
  const autoFilledScriptPromptRef = useRef(false);

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

  useEffect(() => {
    autoFilledScriptPromptRef.current = false;
  }, [scriptBeatKey, videoNodeId]);

  useEffect(() => {
    if (!videoNodeId) return;
    const st = useProjectStore.getState();
    const bound = buildVideoDraftPromptFromScriptBeatBinding(st.nodes, st.edges, videoNodeId);
    if (!bound?.trim()) return;
    const cur = st.nodes.find((n) => n.id === videoNodeId)?.data.video?.draft?.prompt?.trim() ?? "";
    if (cur !== "") return;
    if (autoFilledScriptPromptRef.current) return;
    patchDraft({ prompt: bound });
    autoFilledScriptPromptRef.current = true;
  }, [videoNodeId, nodes, edges, patchDraft]);

  // ... 下方 UI 继续渲染 ...

  useEffect(() => {
    if (!videoNodeId) return;
    const d = draft.output.durationSec;
    if (d < VIDEO_GENERATION_DURATION_SEC.min || d > VIDEO_GENERATION_DURATION_SEC.max) {
      patchDraft({
        output: {
          durationSec: Math.min(
            VIDEO_GENERATION_DURATION_SEC.max,
            Math.max(VIDEO_GENERATION_DURATION_SEC.min, d),
          ),
        },
      });
    }
  }, [videoNodeId, draft.output.durationSec, patchDraft]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const camWrapRef = useRef<HTMLDivElement>(null);
  const inlinePromptRef = useRef<TtvInlineCameraPromptHandle>(null);
  const pendingCameraInsertRef = useRef<number | null>(null);

  const closeMenu = useCallback(() => setGenMenuOpen(false), []);
  const closeCamera = useCallback(() => setCameraOpen(false), []);

  const camFeatActive = Boolean(
    cameraOpen ||
      draft.cameraMovement?.presetId ||
      draft.cameraMovement?.selectedCustomMoveId,
  );

  useEffect(() => {
    if (!genMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [genMenuOpen, closeMenu]);

  useEffect(() => {
    if (!cameraOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = camWrapRef.current;
      if (el && !el.contains(e.target as Node)) closeCamera();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCamera();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [cameraOpen, closeCamera]);

  const aspect = draft.output.aspectRatio;
  const resolution = draft.output.resolution;
  const durationSec = draft.output.durationSec;
  const generateAudio = draft.output.generateAudio;

  const aspectSummary = aspect === "auto" ? "自动" : aspect;
  const durationLabel = `${durationSec}s`;
  const promptLen = (draft.prompt ?? "").length;
  const workflowLabel = useMemo(
    () => VIDEO_WORKFLOW_TAB_LABELS.find((w) => w.workflow === draft.workflow)?.label ?? draft.workflow,
    [draft.workflow],
  );
  const refSummary = useMemo(() => {
    const stats = { image: 0, video: 0, audio: 0 };
    for (const item of incomingRefItems) {
      if (item.kind === "image") stats.image += 1;
      else if (item.kind === "video") stats.video += 1;
      else if (item.kind === "audio") stats.audio += 1;
    }
    const total = stats.image + stats.video + stats.audio;
    return { ...stats, total };
  }, [incomingRefItems]);
  const jobSummary = useMemo(() => {
    if (!activeJob) return "任务：空闲";
    if (activeJob.status === "running" || activeJob.status === "queued") {
      if (typeof activeJob.progress === "number" && Number.isFinite(activeJob.progress)) {
        const raw = activeJob.progress;
        const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
        return `任务：进行中 ${pct}%`;
      }
      return "任务：进行中";
    }
    if (activeJob.status === "failed") return "任务：失败";
    if (activeJob.status === "cancelled") return "任务：已取消";
    return `任务：${activeJob.status}`;
  }, [activeJob]);

  const { models: videoModels, loading: modelsLoading, defaultModel } = useVideoModels();

  useEffect(() => {
    if (modelsLoading) return;
    if (!videoModels.some((m) => m.id === draft.modelId) && defaultModel) {
      patchDraft({ modelId: defaultModel.id });
    }
  }, [draft.modelId, modelsLoading, videoModels, defaultModel, patchDraft]);

  const onSend = () => {
    void startGeneration();
  };

  const cameraChipLabel = useMemo(
    () => getCameraChipDisplayLabel(draft.cameraMovement),
    [draft.cameraMovement],
  );

  const getInsertIndexForCamera = useCallback(() => {
    const len = draft.prompt?.length ?? 0;
    const raw =
      pendingCameraInsertRef.current ?? inlinePromptRef.current?.getSelectionStart() ?? len;
    return Math.max(0, Math.min(raw, len));
  }, [draft.prompt]);

  const hasCamera = Boolean(draft.cameraMovement?.presetId || draft.cameraMovement?.selectedCustomMoveId);

  return (
    <div className={`textNodeTtvPanel ${RF_NODE_INPUT_CLASS}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="textNodeTtvTabs">
        {VIDEO_WORKFLOW_TAB_LABELS.map(({ workflow, label }) => {
          const active = draft.workflow === workflow;
          const enabled =
            workflow === "text_to_video" ||
            workflow === "first_last_frame" ||
            workflow === "multimodal_reference" ||
            workflow === "image_to_video";
          return (
            <button
              key={`${workflow}-${label}`}
              type="button"
              className={`textNodeTtvTab ${active ? "textNodeTtvTab--active" : ""}`}
              disabled={!enabled}
              title={!enabled ? "敬请期待" : undefined}
              onClick={() => {
                if (workflow === "first_last_frame" && videoNodeId) {
                  setupFirstLastFrameForVideoNode(videoNodeId);
                  return;
                }
                patchDraft({ workflow });
              }}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          className="textNodeTtvExpand"
          title={videoNodeId ? "最大化当前视频节点编辑区" : "仅视频节点支持最大化"}
          aria-label="全屏"
          disabled={!videoNodeId}
          onClick={() => {
            if (videoNodeId) setMaximizedNodeId(videoNodeId);
          }}
        >
          ⛶
        </button>
      </div>
      <div className="textNodeTtvFeatures">
        <div className="textNodeTtvFeatWrap" ref={camWrapRef}>
          <button
            type="button"
            className={`textNodeTtvFeat textNodeTtvFeat--cam ${camFeatActive ? "textNodeTtvFeat--active" : ""}`}
            title="运镜"
            onClick={() => {
              setGenMenuOpen(false);
              pendingCameraInsertRef.current =
                inlinePromptRef.current?.getSelectionStart() ?? (draft.prompt?.length ?? 0);
              setCameraOpen((o) => !o);
            }}
          >
            <TtvCameraFeatIcon />
            <span>运镜</span>
          </button>
          <TtvCameraMovementModal
            open={cameraOpen}
            onClose={closeCamera}
            cameraMovement={draft.cameraMovement}
            patchDraft={patchDraft}
            getInsertIndex={getInsertIndexForCamera}
          />
        </div>
        <button
          type="button"
          className="textNodeTtvFeat"
          title="清空当前视频提示词"
          onClick={() => patchDraft({ prompt: "" })}
        >
          清空提示词
        </button>
        {videoNodeId ? (
          <div className="textNodeTtvRefAddGroup" title="在画布左侧添加输入节点并联线；成片从本节点右侧输出连接">
            <button
              type="button"
              className="textNodeTtvFeat textNodeTtvFeat--refAdd"
              onClick={() => addInputNodeLeftOfVideo(videoNodeId, "image")}
            >
              +参考图
            </button>
            <button
              type="button"
              className="textNodeTtvFeat textNodeTtvFeat--refAdd"
              onClick={() => addInputNodeLeftOfVideo(videoNodeId, "referenceVideo")}
            >
              +参考视频
            </button>
            <button
              type="button"
              className="textNodeTtvFeat textNodeTtvFeat--refAdd"
              onClick={() => addInputNodeLeftOfVideo(videoNodeId, "audio")}
            >
              +参考音频
            </button>
          </div>
        ) : null}
        <TtvIncomingReferenceStrip items={incomingRefItems} />
        {videoNodeId ? (
          <button
            type="button"
            className="textNodeTtvFeat textNodeTtvFeat--scriptSync"
            disabled={!scriptBoundVideoPrompt}
            title={scriptSyncButtonTitle(
              scriptUpstreamState,
              "根据 params.scriptBeatId 与上游脚本节点，覆盖当前视频提示词（与 M5 试点拼接规则一致）",
            )}
            onClick={() => {
              if (scriptBoundVideoPrompt) patchDraft({ prompt: scriptBoundVideoPrompt });
              else if (scriptUpstreamState === "disabled_only") {
                useProjectStore
                  .getState()
                  .setStatusText(scriptSyncDisabledOnlyStatus("从脚本同步提示"));
              }
            }}
          >
            从脚本同步提示
          </button>
        ) : null}
      </div>
      {videoNodeId ? <ScriptBeatBindingInline nodeId={videoNodeId} dense /> : null}
      <TtvInlineCameraPrompt
        ref={inlinePromptRef}
        draft={draft}
        patchDraft={patchDraft}
        cameraLabel={cameraChipLabel}
        hasCamera={hasCamera}
      />
      {activeJob?.error ? (
        <div className="textNodeTtvJobErr mono" role="status">
          {activeJob.error}
        </div>
      ) : null}
      <div className="textNodeTtvFoot">
        <div className="textNodeTtvModel">
          <span className="textNodeTtvModelLogo" aria-hidden />
          <select
            className={`textNodeTtvModelSelect ${RF_NODE_INPUT_CLASS}`}
            aria-label="视频模型"
            value={draft.modelId}
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
          <span className="textNodeTtvCaret">▾</span>
        </div>
        <div className="textNodeTtvGenSettingsWrap" ref={wrapRef}>
          <button
            type="button"
            className={`textNodeTtvGenTrigger ${genMenuOpen ? "textNodeTtvGenTrigger--open" : ""}`}
            aria-expanded={genMenuOpen}
            aria-haspopup="dialog"
            onClick={() => {
              setCameraOpen(false);
              setGenMenuOpen((o) => !o);
            }}
          >
            <span className="textNodeTtvGenTriggerMain">
              <span className="textNodeTtvGenTriggerTxt">{aspectSummary}</span>
              <span className="textNodeTtvGenTriggerSep">·</span>
              <span className="textNodeTtvGenTriggerTxt">{resolution}</span>
              <span className="textNodeTtvGenTriggerSep">·</span>
              <span className="textNodeTtvGenTriggerTxt">{durationLabel}</span>
              <span className="textNodeTtvGenTriggerSep">·</span>
              <TtvSpeakerIcon muted={!generateAudio} />
            </span>
            <span className="textNodeTtvGenTriggerCaret" aria-hidden>
              {genMenuOpen ? "⌃" : "▾"}
            </span>
          </button>
          {genMenuOpen ? (
            <div
              className="textNodeTtvGenMenu"
              role="dialog"
              aria-label="视频生成参数"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="textNodeTtvGenMenuSection">
                <div className="textNodeTtvGenMenuLabel">比例</div>
                <div className="textNodeTtvGenMenuRatioGrid">
                  {TEXT_TO_VIDEO_ASPECT_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`textNodeTtvGenMenuRatioBtn ${aspect === id ? "textNodeTtvGenMenuRatioBtn--active" : ""}`}
                      onClick={() => patchDraft({ output: { aspectRatio: id } })}
                    >
                      <TtvAspectWireframe id={id} />
                      <span>{TEXT_TO_VIDEO_ASPECT_LABEL[id]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="textNodeTtvGenMenuSection">
                <div className="textNodeTtvGenMenuLabel">清晰度</div>
                <div className="textNodeTtvGenMenuSeg">
                  {(["480P", "720P", "1080P"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`textNodeTtvGenMenuSegBtn ${resolution === r ? "textNodeTtvGenMenuSegBtn--active" : ""}`}
                      onClick={() => patchDraft({ output: { resolution: r } })}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="textNodeTtvGenMenuSection">
                <div className="textNodeTtvGenMenuLabelRow">
                  <span className="textNodeTtvGenMenuLabel">视频时长</span>
                  <span className="textNodeTtvGenMenuDurationVal">{durationLabel}</span>
                </div>
                <div className="textNodeTtvGenMenuSliderRow">
                  <input
                    type="range"
                    className="textNodeTtvGenMenuSlider"
                    min={VIDEO_GENERATION_DURATION_SEC.min}
                    max={VIDEO_GENERATION_DURATION_SEC.max}
                    step={1}
                    value={durationSec}
                    onChange={(e) => patchDraft({ output: { durationSec: Number(e.target.value) } })}
                  />
                </div>
              </div>
              <div className="textNodeTtvGenMenuSection textNodeTtvGenMenuSection--last">
                <div className="textNodeTtvGenMenuLabelRow">
                  <span className="textNodeTtvGenMenuLabel">生成音频</span>
                  <button
                    type="button"
                    className="textNodeTtvGenMenuInfo"
                    title="是否由模型生成配套音频，具体以所选模型能力为准。"
                    aria-label="生成音频说明"
                  >
                    ⓘ
                  </button>
                </div>
                <div className="textNodeTtvGenMenuAudioRow">
                  <button
                    type="button"
                    className={`textNodeTtvGenMenuAudioBtn ${generateAudio ? "textNodeTtvGenMenuAudioBtn--active" : ""}`}
                    onClick={() => patchDraft({ output: { generateAudio: true } })}
                  >
                    开启
                  </button>
                  <button
                    type="button"
                    className={`textNodeTtvGenMenuAudioBtn ${!generateAudio ? "textNodeTtvGenMenuAudioBtn--active" : ""}`}
                    onClick={() => patchDraft({ output: { generateAudio: false } })}
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="textNodeTtvMeta">
          <span className="mono textNodeTtvMetaItem">
            文案 {promptLen}/{VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS}
          </span>
          <span className="textNodeTtvMetaItem">工作流：{workflowLabel}</span>
          <span className="textNodeTtvMetaItem">
            参考：{refSummary.total}（图{refSummary.image}/视{refSummary.video}/音{refSummary.audio}）
          </span>
          <span className="textNodeTtvMetaItem">音频：{generateAudio ? "开" : "关"}</span>
          <span className="textNodeTtvMetaItem">{jobSummary}</span>
        </div>
        <button
          type="button"
          className={`textNodeTtvSend ${busy ? "textNodeTtvSend--busy" : ""}`}
          title={videoNodeId ? (busy ? "生成中…" : "提交生成任务") : "在视频节点中提交"}
          aria-label="生成"
          disabled={busy}
          onClick={onSend}
        >
          {busy ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}

/** 文字生音乐：底部占位面板 */
export function TextNodeTextToMusicPanel({ audioNodeId: _audioNodeId }: { audioNodeId?: string }) {
  return (
    <div className={`textNodeTtmPanel ${RF_NODE_INPUT_CLASS}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="textNodeTtmRow">
        <span className="textNodeTtmLabel">音乐生成</span>
        <span className="textNodeTtmHint">将使用左侧文本节点的正文作为提示词</span>
      </div>
      <div className="textNodeTtmFoot">
        <span className="mono textNodeTtmModel">Suno（占位）</span>
        <button type="button" className="btn textNodeTtmBtn">
          生成
        </button>
      </div>
    </div>
  );
}

/** 脚本→文本：底部同步面板 */
export function TextNodeScriptSyncPanel({
  textNodeId,
  scriptNodeId,
}: {
  textNodeId: string;
  scriptNodeId?: string;
}) {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const syncedContent = useMemo(
    () => (scriptNodeId ? buildTextPromptFromScriptBinding(nodes, edges, textNodeId) : null),
    [nodes, edges, textNodeId, scriptNodeId],
  );

  const handleSync = () => {
    if (!syncedContent) {
      setStatusText("未能从上游脚本节点获取内容");
      return;
    }
    updateNodeData(textNodeId, { prompt: syncedContent });
    setStatusText("已从脚本同步内容到文本节点");
  };

  return (
    <div
      className={`textNodeScriptSyncPanel ${RF_NODE_INPUT_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="textNodeScriptSyncRow">
        <span className="textNodeScriptSyncLabel">脚本内容</span>
        <button
          type="button"
          className="btn textNodeScriptSyncBtn"
          disabled={!syncedContent}
          onClick={handleSync}
        >
          从脚本同步
        </button>
      </div>
    </div>
  );
}
