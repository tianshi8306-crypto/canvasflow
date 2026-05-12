import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent, type WheelEvent as ReactWheelEvent } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { type Node, type NodeProps } from "@xyflow/react";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";
import { MentionInput } from "@/components/nodes/MentionInput";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { scriptNodeDispatchAgentRuntime } from "@/lib/nodeAgentRuntime/dagnodeDispatchAgents";
import { scriptStoryboardGenerateAgentRuntime } from "@/lib/nodeAgentRuntime/scriptStoryboardAgent";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { ScriptBeatsEditorTable } from "@/components/ScriptBeatsEditorTable";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";

type ProviderOption = { id: string; label: string; model: string; enabled: boolean; priority: number };
type ScriptNodeParams = {
  providerId?: string;
  model?: string;
  styleProfile?: "auto";
};

function ScriptDocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 12h8M8 16h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** 图一/二：无镜头任务；图三/四：已解析或已生成 beats；图五：由右上角展开全屏（见 ScriptNodeFullscreenOverlay） */
export function ScriptNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  const openScriptFullscreen = useProjectStore((s) => s.openScriptFullscreen);
  const projectPath = useProjectStore((s) => s.projectPath);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const runNodeSubgraph = useProjectStore((s) => s.runNodeSubgraph);
  const isGraphRunning = useProjectStore((s) => s.isGraphRunning);
  const nodeRunStateById = useProjectStore((s) => s.nodeRunStateById);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const viewportInteracting = useCanvasUiStore((s) => s.viewportInteracting);
  const nodeDragSuppressUi = useCanvasUiStore((s) => s.nodeDragSuppressUi);
  const { expandedChrome: uiSelected } = useNodeExpandedChrome(selected);

  const prompt = data.prompt ?? "";
  const params = useMemo(() => ((data.params ?? {}) as ScriptNodeParams), [data.params]);
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [providerLoading, setProviderLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const beatsList = normalizeScriptBeats(data.scriptBeats ?? []);
  const hasBeats = beatsList.length > 0;
  const selectedBeatIds = useMemo(
    () => ((data.scriptBeatSelection ?? []) as string[]).filter(Boolean),
    [data.scriptBeatSelection],
  );
  const nodeRunning = nodeRunStateById[id] === "running";
  const upstreamReferenceVideos = useMemo(
    () =>
      edges
        .filter((edge) => edge.target === id)
        .map((edge) => nodes.find((n) => n.id === edge.source))
        .filter((n): n is Node<FlowNodeData> => Boolean(n && n.type === "videoNode"))
        .map((n) => (n.data.path ?? "").trim())
        .filter(Boolean),
    [edges, id, nodes],
  );
  const allReferenceVideos = useMemo(() => Array.from(new Set(upstreamReferenceVideos)), [upstreamReferenceVideos]);
  const nodeLabels = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n.data.label ?? n.id])),
    [nodes],
  );
  const parseBusy = isParsing || nodeRunning;
  const providerUnavailable = isTauri() && !providerLoading && providerOptions.length === 0;
  const parseBlockedReason = parseBusy
    ? "脚本节点正在执行中"
    : !prompt.trim()
      ? "请先填写脚本生成要求或剧本文本"
      : providerUnavailable
        ? "请先到设置中启用模型通道"
        : null;
  const canParse = !parseBlockedReason;
  const toolbarOffsetPx =
    typeof window !== "undefined"
      ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--node-floating-top-offset")) || 10
      : 10;
  const lowerOffsetPx =
    typeof window !== "undefined"
      ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--node-floating-bottom-offset")) || 12
      : 12;
  const inlineTableDragRef = useRef<{
    active: boolean;
    startX: number;
    startScrollLeft: number;
  }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
  });
  const inlineTableWrapRef = useRef<HTMLDivElement | null>(null);

  const stop = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  const stopWheel = (e: ReactWheelEvent) => {
    e.stopPropagation();
  };
  const onInlineTablePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "input, textarea, select, button, a, label, [contenteditable='true'], [contenteditable='plaintext-only']",
      )
    ) {
      return;
    }
    inlineTableDragRef.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: e.currentTarget.scrollLeft,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  const onInlineTablePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!inlineTableDragRef.current.active) return;
    const dx = e.clientX - inlineTableDragRef.current.startX;
    e.currentTarget.scrollLeft = inlineTableDragRef.current.startScrollLeft - dx;
    e.preventDefault();
    e.stopPropagation();
  };
  const onInlineTablePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    inlineTableDragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    e.stopPropagation();
  };
  const onInlineTableWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.shiftKey) {
      stopWheel(e);
      return;
    }
    e.currentTarget.scrollLeft += e.deltaY;
    e.preventDefault();
    e.stopPropagation();
  };
  const openSettingsFromNode = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("r3-open-settings"));
    }
  };

  const exportScriptJson = () => {
    const rows = normalizeScriptBeats(data.scriptBeats ?? []);
    if (rows.length === 0) {
      setStatusText("暂无可导出的脚本镜头");
      return;
    }
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      nodeId: id,
      title: data.label?.trim() || "",
      themePrompt: prompt,
      scriptBeats: rows,
      storyboardShots: data.storyboardShots ?? [],
    };
    const safeTitle = (data.label?.trim() || "script")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    const file = `${safeTitle || "script"}-export-${new Date().toISOString().slice(0, 10)}.json`;
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatusText(`已导出：${file}`);
  };

  const persistBeats = useCallback(
    (next: ScriptBeat[]) => {
      updateNodeData(id, { scriptBeats: next });
    },
    [id, updateNodeData],
  );

  const toggleSelect = useCallback(
    (beatId: string) => {
      const base = ((useProjectStore.getState().nodes.find((n) => n.id === id)?.data.scriptBeatSelection ?? []) as string[]).filter(
        Boolean,
      );
      const next = base.includes(beatId) ? base.filter((x) => x !== beatId) : [...base, beatId];
      updateNodeData(id, { scriptBeatSelection: next });
    },
    [id, updateNodeData],
  );
  const loadProviders = useCallback(async () => {
    if (!isTauri()) return;
    setProviderLoading(true);
    try {
      const settings = await invoke<{ providers?: ProviderOption[] }>("load_settings");
      const list = (settings.providers ?? [])
        .filter((p) => p.enabled)
        .sort((a, b) => a.priority - b.priority);
      setProviderOptions(list);
    } catch {
      setProviderOptions([]);
    } finally {
      setProviderLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!uiSelected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProviders();
  }, [uiSelected, loadProviders]);

  useEffect(() => {
    if (!params.providerId || providerOptions.length === 0) return;
    const hit = providerOptions.find((p) => p.id === params.providerId);
    if (!hit?.model?.trim()) return;
    if ((params.model ?? "").trim() === hit.model.trim()) return;
    const base = (data.params && typeof data.params === "object" ? { ...data.params } : {}) as Record<string, unknown>;
    base.model = hit.model.trim();
    updateNodeData(id, { params: base });
  }, [params.providerId, params.model, providerOptions, data.params, id, updateNodeData]);

  useEffect(() => {
    if (!isGraphRunning && isParsing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsParsing(false);
    }
  }, [isGraphRunning, isParsing]);

  const composer = selected ? (
    <div className={`scriptGenComposer ${RF_NODE_INPUT_CLASS}`} onPointerDown={stop} onWheel={stopWheel}>
      <MentionInput
        nodeId={id}
        value={prompt}
        onChange={(newPrompt) => {
          updateNodeData(id, { prompt: newPrompt, params: { ...params, styleProfile: "auto" } });
        }}
        placeholder="输入脚本内容..."
        className={`scriptGenComposerInput ${RF_NODE_INPUT_CLASS}`}
        nodeLabels={nodeLabels}
      />
      <div className="scriptGenComposerBar">
        <div className="scriptGenModel">
          <span className="scriptGenModelLogo" aria-hidden />
          <select
            className={`scriptGenModelSelect ${RF_NODE_INPUT_CLASS}`}
            aria-label="模型"
            value={params.providerId ?? ""}
            disabled={providerLoading || providerUnavailable}
            onClick={() => {
              if (!providerLoading) void loadProviders();
            }}
            onChange={(e) => {
              const pid = e.currentTarget.value.trim();
              if (!pid) {
                const base = (data.params && typeof data.params === "object" ? { ...data.params } : {}) as Record<
                  string,
                  unknown
                >;
                delete base.providerId;
                delete base.model;
                updateNodeData(id, { params: base });
                return;
              }
              const picked = providerOptions.find((p) => p.id === pid);
              const base = (data.params && typeof data.params === "object" ? { ...data.params } : {}) as Record<
                string,
                unknown
              >;
              base.providerId = pid;
              if (picked?.model?.trim()) base.model = picked.model.trim();
              updateNodeData(id, { params: base });
            }}
            onPointerDown={stop}
            onWheel={stopWheel}
          >
            <option value="">
              {providerLoading
                ? "正在加载模型列表…"
                : providerUnavailable
                  ? "未启用模型通道（请到设置启用）"
                  : "默认模型（设置中优先级最高）"}
            </option>
            {providerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.model}
              </option>
            ))}
          </select>
        </div>
        <div className="scriptGenComposerActions">
          <span className="scriptGenComposerHint">{prompt.length} 字</span>
          {allReferenceVideos.length > 0 ? (
            <span className="scriptGenParsingHint">参考视频 {allReferenceVideos.length} 个</span>
          ) : null}
          {parseBusy ? <span className="scriptGenParsingHint">脚本解析中…</span> : null}
          <button
            type="button"
            className="scriptGenSend"
            title={parseBlockedReason ?? "按输入与上游素材生成分镜（支持仅参考视频或合写剧本）"}
            aria-label="生成分镜脚本"
            disabled={!canParse}
            onPointerDown={stop}
            onClick={(e) => {
              stop(e);
              const projectPath = useProjectStore.getState().projectPath;
              const promptText = prompt.trim();
              if (!projectPath) {
                setStatusText("请先打开工程目录");
                return;
              }
              if (!promptText) {
                setStatusText("请先填写脚本生成要求或剧本文本");
                return;
              }
              void (async () => {
                if (isTauri()) {
                  try {
                    const settings = await invoke<{ providers?: ProviderOption[] }>("load_settings");
                    const enabledProviders = (settings.providers ?? [])
                      .filter((p) => p.enabled)
                      .sort((a, b) => a.priority - b.priority);
                    const effectiveProvider =
                      enabledProviders.find((p) => p.id === (params.providerId ?? "").trim()) ??
                      enabledProviders[0];
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
                setIsParsing(true);
                setStatusText("脚本节点正在解析中，请稍候…");
                try {
                  await runNodeTaskAgent(
                    scriptNodeDispatchAgentRuntime,
                    { prompt: promptText, dispatch: runNodeSubgraph },
                    {
                      nodeId: id,
                      projectPath,
                      updateNodeData,
                      setStatusText,
                    },
                  );
                  const latestNode = useProjectStore.getState().nodes.find((n) => n.id === id);
                  const latestBeats = normalizeScriptBeats(latestNode?.data.scriptBeats ?? []);
                  setStatusText(
                    latestBeats.length > 0
                      ? `脚本解析完成：共 ${latestBeats.length} 条镜头`
                      : "脚本解析完成：未生成镜头，请调整要求后重试",
                  );
                } finally {
                  setIsParsing(false);
                }
              })();
            }}
          >
            {parseBusy ? "…" : "↑"}
          </button>
        </div>
      </div>
      {parseBlockedReason && !parseBusy ? (
        <div
          className={`scriptNodeBlockReason mono ${providerUnavailable ? "scriptNodeBlockReason--warn" : ""}`}
          role="status"
          aria-live="polite"
        >
          当前不可生成：{parseBlockedReason}
        </div>
      ) : null}
      {allReferenceVideos.length > 0 ? (
        <div className="scriptNodeRefVideoBar mono">
          <span>
            参考视频：已通过上游视频节点接入 {allReferenceVideos.length} 个
          </span>
        </div>
      ) : null}
      {providerUnavailable ? (
        <div className="scriptNodeInlineNotice mono">
          当前没有可用模型通道。
          <button
            type="button"
            className="scriptNodeInlineNoticeLink"
            onPointerDown={stop}
            onClick={(e) => {
              stop(e);
              openSettingsFromNode();
            }}
          >
            打开设置
          </button>
        </div>
      ) : null}
    </div>
  ) : null;
  /** 避免点击画布空白取消选中时节点从分体态塌缩，导致宽高突变 */
  const splitExpanded = hasBeats || selected;

  const scriptToolbarBody = (
    <div
      className="scriptNodeFloatActions scriptNodeFloatActions--canvasFloat"
      role="group"
      aria-label="脚本快捷操作"
      onPointerDown={stop}
    >
        <button
          type="button"
          className="scriptNodeFloatActionBtn"
          disabled={!canParse || isGraphRunning}
          title="按当前输入与上游素材重新解析脚本镜头"
          onClick={(e) => {
            stop(e);
            const path = useProjectStore.getState().projectPath;
            const promptText = (data.prompt ?? "").trim();
            if (!path?.trim()) {
              setStatusText("请先打开工程目录");
              return;
            }
            if (!promptText) {
              setStatusText("请先填写脚本生成要求或剧本文本");
              return;
            }
            void (async () => {
              if (isTauri()) {
                try {
                  const settings = await invoke<{ providers?: ProviderOption[] }>("load_settings");
                  const enabledProviders = (settings.providers ?? [])
                    .filter((p) => p.enabled)
                    .sort((a, b) => a.priority - b.priority);
                  const effectiveProvider =
                    enabledProviders.find((p) => p.id === (params.providerId ?? "").trim()) ?? enabledProviders[0];
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
              setIsParsing(true);
              setStatusText("脚本节点正在解析中，请稍候…");
              try {
                await runNodeTaskAgent(
                  scriptNodeDispatchAgentRuntime,
                  { prompt: promptText, dispatch: runNodeSubgraph },
                  { nodeId: id, projectPath: path, updateNodeData, setStatusText },
                );
                const latestNode = useProjectStore.getState().nodes.find((n) => n.id === id);
                const latestBeats = normalizeScriptBeats(latestNode?.data.scriptBeats ?? []);
                setStatusText(
                  latestBeats.length > 0
                    ? `脚本解析完成：共 ${latestBeats.length} 条镜头`
                    : "脚本解析完成：未生成镜头，请调整要求后重试",
                );
              } finally {
                setIsParsing(false);
              }
            })();
          }}
        >
          <span className="scriptNodeFloatActionIco" aria-hidden>
            ↻
          </span>
          重新生成
        </button>
        <button
          type="button"
          className="scriptNodeFloatActionBtn"
          disabled={!projectPath?.trim() || beatsList.length === 0 || isGraphRunning}
          title="为勾选镜头（无勾选则全部）生成分镜文案"
          onClick={(e) => {
            stop(e);
            const path = useProjectStore.getState().projectPath;
            if (!path?.trim()) {
              setStatusText("请先打开工程后再生成分镜");
              return;
            }
            const beats = normalizeScriptBeats(useProjectStore.getState().nodes.find((n) => n.id === id)?.data.scriptBeats ?? []);
            if (beats.length === 0) {
              setStatusText("请先生成脚本镜头后再生成分镜");
              return;
            }
            const sel = (useProjectStore.getState().nodes.find((n) => n.id === id)?.data.scriptBeatSelection ?? []) as string[];
            const picked = sel.length > 0 ? beats.filter((b) => sel.includes(b.id)) : beats;
            void (async () => {
              setIsParsing(true);
              try {
                await runNodeTaskAgent(
                  scriptStoryboardGenerateAgentRuntime,
                  {
                    targetBeats: picked,
                    themePrompt: (useProjectStore.getState().nodes.find((n) => n.id === id)?.data.prompt ?? "").trim(),
                    prevShots: useProjectStore.getState().nodes.find((n) => n.id === id)?.data.storyboardShots,
                  },
                  { nodeId: id, projectPath: path, updateNodeData, setStatusText },
                );
              } finally {
                setIsParsing(false);
              }
            })();
          }}
        >
          <span className="scriptNodeFloatActionIco" aria-hidden>
            ⊞
          </span>
          生成分镜
        </button>
        <span className="scriptNodeFloatActionSep" aria-hidden />
        <button
          type="button"
          className="scriptNodeFloatActionBtn scriptNodeFloatActionBtn--iconOnly"
          disabled={beatsList.length === 0}
          title="导出脚本与分镜为 JSON"
          aria-label="导出 JSON"
          onClick={(e) => {
            stop(e);
            exportScriptJson();
          }}
        >
          <span className="scriptNodeFloatActionIco" aria-hidden>
            ↓
          </span>
        </button>
    </div>
  );

  const expandBtn = (
    <button
      type="button"
      className="scriptNodeExpandBtn"
      title="展开全屏"
      aria-label="展开全屏"
      onPointerDown={stop}
      onClick={(e) => {
        stop(e);
        openScriptFullscreen(id);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M15 3h6v6M9 21H3v-6M21 9v6h-6M3 15V9h6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  const scriptMainBody = (
    <div className="scriptNodeBody">
      {!hasBeats ? (
        <div className={`scriptGenEmptyCard ${RF_NODE_INPUT_CLASS}`} onPointerDown={stop}>
          {!isParsing ? <p className="textNodeFigure3Hint">描述剧情或连接上游节点，开始生成分镜脚本。</p> : null}
          <div className="scriptGenEmptyGlyph" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : (
        <>
          <div
            className={`scriptTableWrap scriptNodeInlineTableWrap ${RF_NODE_INPUT_CLASS} nowheel nopan`}
            ref={inlineTableWrapRef}
            onPointerDown={onInlineTablePointerDown}
            onPointerMove={onInlineTablePointerMove}
            onPointerUp={onInlineTablePointerUp}
            onPointerCancel={onInlineTablePointerUp}
            onWheel={onInlineTableWheel}
          >
            <ScriptBeatsEditorTable
              variant="inline"
              rows={beatsList}
              selectedIds={selectedBeatIds}
              onToggleSelect={toggleSelect}
              onPersistRows={persistBeats}
              projectPath={projectPath}
              onStatusText={setStatusText}
            />
          </div>
        </>
      )}
    </div>
  );

  const simplifyDuringViewportInteraction = splitExpanded && viewportInteracting;
  const upperSkeleton = (
    <div className="scriptNodeZoomSkeleton" aria-hidden>
      <div className="scriptNodeZoomSkeletonTitle" />
      <div className="scriptNodeZoomSkeletonRow" />
      <div className="scriptNodeZoomSkeletonRow" />
      <div className="scriptNodeZoomSkeletonRow scriptNodeZoomSkeletonRow--short" />
    </div>
  );
  const lowerSkeleton = (
    <div className="scriptNodeLowerZoomStub" aria-hidden>
      <div className="scriptNodeLowerZoomStubInput" />
      <div className="scriptNodeLowerZoomStubBar">
        <span />
        <span />
      </div>
    </div>
  );
  const scriptFloatingLowerComposer =
    splitExpanded && composer ? (
      <div
        className="scriptNodeLowerFixedScale scriptNodeLowerPinnedUi nodeFloatingBottomPanel scriptNodeFloatingLowerCard"
        onPointerDown={stop}
        onWheel={stopWheel}
      >
        {simplifyDuringViewportInteraction ? lowerSkeleton : composer}
      </div>
    ) : null;

  return (
    <NodeFrame
        defaultTitle="脚本"
        label={data.label}
        nodeId={id}
        selected={selected}
        tone="script"
        icon={<ScriptDocIcon />}
        subtitle={undefined}
        actions={expandBtn}
        rootClassName={selected && !hasBeats ? "scriptGenNode scriptGenNode--emptySelected" : "scriptGenNode"}
        expandedSplit={splitExpanded}
        floatingTopOverlay={selected && !nodeDragSuppressUi ? scriptToolbarBody : undefined}
        floatingBottomOverlay={scriptFloatingLowerComposer}
        floatingTopOffsetPx={toolbarOffsetPx}
        floatingBottomOffsetPx={lowerOffsetPx}
        upperBody={
          splitExpanded ? (
            <>
              {simplifyDuringViewportInteraction ? upperSkeleton : scriptMainBody}
              <MagneticNodeAnchors nodeId={id} nodeType={type} />
            </>
          ) : undefined
        }
        lowerBody={undefined}
    >
      {!splitExpanded ? (
        <>
          {scriptMainBody}
          <MagneticNodeAnchors nodeId={id} nodeType={type} />
        </>
      ) : null}
    </NodeFrame>
  );
}
