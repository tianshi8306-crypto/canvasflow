import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { ScriptBeat, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { formatUserError } from "@/lib/errors";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { scriptStoryboardGenerateAgentRuntime } from "@/lib/nodeAgentRuntime/scriptStoryboardAgent";
import { handleScriptNodeCompleted } from "@/lib/hermes/autoChain";
import {
  hermesAutoChainSettingsHint,
  loadHermesAutoChainSettings,
  resolveHermesBatchSplitSettings,
} from "@/lib/hermes/hermesAutoChainPolicy";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { useProjectStore } from "@/store/projectStore";
import { importStoryboardImageForBeat } from "@/lib/scriptStoryboardImageImport";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import {
  batchGenerateImagesForStoryboard,
  findImageNodesForScript,
} from "@/lib/storyboard/batchGenerateImages";
import { createBeatReferenceResolver } from "@/lib/projectBible/resolveBeatRefsForBatch";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import { batchGenerateVideosForStoryboard } from "@/lib/storyboard/batchGenerateVideos";
import { getAgentMaxConcurrentMedia } from "@/lib/hermes/agent/hermesAgentSettings";
import {
  assessBatchImageReadiness,
  assessBatchVideoReadiness,
  assessComposeExportScope,
  formatBatchImageReadinessHint,
  formatBatchVideoReadinessHint,
  formatComposeExportReadinessHint,
  listFailedKeyframeBeatIds,
  listFailedVideoBeatIds,
} from "@/lib/storyboard/scriptProductionExport";
import {
  resolveStoryboardBeatScope,
  storyboardChainScopeHint,
} from "@/lib/scriptStoryboardScope";
import {
  buildScriptBeatChain,
  formatChainBuildStatus,
  type ChainMediaKind,
} from "@/lib/scriptBeatChainBuild";
import {
  getGroupMemberIdSet,
  resolveUniqueStoryboardGroupForScript,
  storyboardBeatIdsForGroup,
} from "@/lib/canvasGroupStoryboard";
import { fitGroupAfterMemberChange } from "@/store/projectGroupProduction";
import { preflightScriptNodeLlm, scriptNodeLlmInvokeParams } from "@/lib/scriptNodeLlmParams";

type Props = {
  nodeId: string;
  beats: ScriptBeat[];
  /** 与脚本工作台勾选一致；用于「为勾选生成分镜」 */
  scriptBeatSelection: string[] | undefined;
  shots: StoryboardShot[] | undefined;
  themePrompt: string;
};

export function ScriptStoryboardSection({
  nodeId,
  beats,
  scriptBeatSelection,
  shots,
  themePrompt,
}: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const addNodesWithEdges = useProjectStore((s) => s.addNodesWithEdges);
  const setSelectedNodeIds = useProjectStore((s) => s.setSelectedNodeIds);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const exportScriptCompose = useProjectStore((s) => s.exportScriptCompose);
  const [sbView, setSbView] = useState<"grid" | "list">("grid");
  const [generating, setGenerating] = useState(false);
  const [batchVideoRunning, setBatchVideoRunning] = useState(false);
  const [batchImageRunning, setBatchImageRunning] = useState(false);
  const [composeExportRunning, setComposeExportRunning] = useState(false);
  const [detail, setDetail] = useState<StoryboardShot | null>(null);
  const storyboardImageInputRef = useRef<HTMLInputElement | null>(null);
  const inspectorStoryboardFocus = useCanvasUiStore((s) => s.inspectorStoryboardFocus);
  const setInspectorStoryboardFocus = useCanvasUiStore((s) => s.setInspectorStoryboardFocus);

  const scriptNode = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const nodeParams =
    scriptNode?.data.params && typeof scriptNode.data.params === "object"
      ? (scriptNode.data.params as Record<string, unknown>)
      : undefined;
  const llmParams = useMemo(() => scriptNodeLlmInvokeParams(nodeParams), [nodeParams]);

  const shotByBeat = useMemo(() => {
    const m = new Map<string, StoryboardShot>();
    for (const s of shots ?? []) m.set(s.scriptBeatId, s);
    return m;
  }, [shots]);

  const beatsNorm = useMemo(() => normalizeScriptBeats(beats), [beats]);

  const orderedRows = useMemo(() => {
    return beatsNorm.map((b) => ({
      beat: b,
      shot: shotByBeat.get(b.id),
    }));
  }, [beatsNorm, shotByBeat]);

  useEffect(() => {
    if (!inspectorStoryboardFocus || inspectorStoryboardFocus.scriptNodeId !== nodeId) return;
    const beatId = inspectorStoryboardFocus.beatId;
    const beat = beatsNorm.find((b) => b.id === beatId);
    if (!beat) {
      setInspectorStoryboardFocus(null);
      return;
    }
    const shot = shotByBeat.get(beatId);
    setDetail(
      shot ?? {
        scriptBeatId: beatId,
        visualPrompt: "",
        status: "idle",
      },
    );
    setSbView("grid");
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-storyboard-focus-beat="${beatId}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    setInspectorStoryboardFocus(null);
  }, [
    beatsNorm,
    inspectorStoryboardFocus,
    nodeId,
    setInspectorStoryboardFocus,
    shotByBeat,
  ]);

  const storyboardHealth = useMemo(() => {
    const beatIds = new Set(beatsNorm.map((b) => b.id));
    const list = shots ?? [];
    const dupMap = new Map<string, number>();
    for (const s of list) dupMap.set(s.scriptBeatId, (dupMap.get(s.scriptBeatId) ?? 0) + 1);
    const duplicateShotIds = [...dupMap.entries()].filter(([, c]) => c > 1).map(([id]) => id);
    const orphanShots = list.filter((s) => !beatIds.has(s.scriptBeatId));
    const missingShotBeats = beatsNorm.filter((b) => !shotByBeat.get(b.id));
    const emptyPromptBeats = beatsNorm.filter((b) => {
      const s = shotByBeat.get(b.id);
      return Boolean(s && !s.visualPrompt?.trim());
    });
    // 增强：按生成状态分类
    const generatedShots = list.filter((s) => s.status === "generated" && s.visualPrompt?.trim());
    const failedShots = list.filter((s) => s.status === "failed");
    const idleShots = list.filter((s) => !s.status || s.status === "idle");
    const generatingShots = list.filter((s) => s.status === "generating");
    return {
      totalBeats: beatsNorm.length,
      totalShots: list.length,
      orphanShots,
      duplicateShotIds,
      missingShotBeats,
      emptyPromptBeats,
      // 新增状态统计
      generatedShots,
      failedShots,
      idleShots,
      generatingShots,
      generatedCount: generatedShots.length,
      failedCount: failedShots.length,
      idleCount: idleShots.length,
      generatingCount: generatingShots.length,
    };
  }, [beatsNorm, shotByBeat, shots]);

  const chainScopeResult = useMemo(
    () => resolveStoryboardBeatScope(beatsNorm, scriptBeatSelection),
    [beatsNorm, scriptBeatSelection],
  );

  const batchVideoReadiness = useMemo(
    () =>
      assessBatchVideoReadiness({
        scriptNodeId: nodeId,
        beats: beatsNorm,
        shots,
        nodes,
        edges,
        scriptBeatSelection,
      }),
    [beatsNorm, shots, nodes, edges, nodeId, scriptBeatSelection],
  );
  const batchImageReadiness = useMemo(
    () =>
      assessBatchImageReadiness({
        scriptNodeId: nodeId,
        beats: beatsNorm,
        shots,
        nodes,
        edges,
        scriptBeatSelection,
      }),
    [beatsNorm, shots, nodes, edges, nodeId, scriptBeatSelection],
  );
  const batchVideoOk = "canStart" in batchVideoReadiness;
  const batchVideoHint = batchVideoOk
    ? formatBatchVideoReadinessHint(batchVideoReadiness)
    : batchVideoReadiness.message;
  const batchImageHasScope = "canStart" in batchImageReadiness;
  const batchImageCanRun = batchImageHasScope && batchImageReadiness.canStart;
  const batchImageHint = batchImageHasScope
    ? formatBatchImageReadinessHint(batchImageReadiness)
    : batchImageReadiness.message;

  const composeExportReadiness = useMemo(
    () =>
      assessComposeExportScope({
        scriptNodeId: nodeId,
        beats: beatsNorm,
        shots,
        nodes,
        edges,
        scriptBeatSelection,
      }),
    [beatsNorm, shots, nodes, edges, nodeId, scriptBeatSelection],
  );
  const composeExportOk = "canExport" in composeExportReadiness;
  const composeExportHint = composeExportOk
    ? formatComposeExportReadinessHint(composeExportReadiness)
    : composeExportReadiness.message;

  const failedVideoBeatIdsInScope = useMemo(() => {
    if (!chainScopeResult.ok) return [];
    const scopeIds = new Set(chainScopeResult.scope.beats.map((b) => b.id));
    return listFailedVideoBeatIds(shots).filter((id) => scopeIds.has(id));
  }, [shots, chainScopeResult]);
  const failedKeyframeBeatIdsInScope = useMemo(() => {
    if (!chainScopeResult.ok) return [];
    const scopeIds = new Set(chainScopeResult.scope.beats.map((b) => b.id));
    return listFailedKeyframeBeatIds(shots).filter((id) => scopeIds.has(id));
  }, [shots, chainScopeResult]);
  const storyboardGroupId = useMemo(
    () => resolveUniqueStoryboardGroupForScript(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );
  const restrictToStoryboardGroup = useMemo(
    () =>
      storyboardGroupId
        ? getGroupMemberIdSet(nodes, storyboardGroupId)
        : undefined,
    [nodes, storyboardGroupId],
  );
  const hermesPolicyHint = useMemo(
    () => hermesAutoChainSettingsHint(loadHermesAutoChainSettings()),
    [],
  );

  const runGenerate = async (targetBeats: ScriptBeat[]) => {
    setGenerating(true);
    try {
      if (!projectPath) {
        setStatusText("请先打开工程后再生成分镜");
        return;
      }
      if (!(await preflightScriptNodeLlm(nodeParams, setStatusText))) return;
      await runNodeTaskAgent(
        scriptStoryboardGenerateAgentRuntime,
        {
          targetBeats,
          themePrompt,
          prevShots: shots,
          llmParams,
        },
        {
          nodeId,
          projectPath,
          updateNodeData,
          setStatusText,
        },
      );
    } catch {
      // runNodeTaskAgent 已统一写入失败状态
    } finally {
      setGenerating(false);
    }
  };

  const cleanupStoryboardCache = () => {
    const beatIds = new Set(beatsNorm.map((b) => b.id));
    const list = shots ?? [];
    const seen = new Set<string>();
    const cleaned: StoryboardShot[] = [];
    // 保留同 id 最后一次出现（更贴合“后来覆盖”）
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]!;
      if (!beatIds.has(s.scriptBeatId)) continue;
      if (seen.has(s.scriptBeatId)) continue;
      seen.add(s.scriptBeatId);
      cleaned.push(s);
    }
    cleaned.reverse();
    updateNodeData(nodeId, { storyboardShots: cleaned });
    const removedOrphans = (shots ?? []).filter((s) => !beatIds.has(s.scriptBeatId)).length;
    const removedDups = (shots ?? []).length - removedOrphans - cleaned.length;
    const parts = [
      removedOrphans ? `清理无效 ${removedOrphans} 条` : "",
      removedDups ? `去重 ${removedDups} 条` : "",
    ].filter(Boolean);
    setStatusText(parts.length ? `已清理分镜缓存：${parts.join("，")}` : "分镜缓存无需清理");
  };

  const generateMissingOnly = () => {
    const picked = storyboardHealth.missingShotBeats;
    if (picked.length === 0) {
      setStatusText("当前没有缺失的分镜条目");
      return;
    }
    void runGenerate(picked);
  };

  const generateEmptyPromptsOnly = () => {
    const picked = storyboardHealth.emptyPromptBeats;
    if (picked.length === 0) {
      setStatusText("当前没有空的分镜文案条目");
      return;
    }
    void runGenerate(picked);
  };

  /** 批量重试所有失败的镜头 */
  const retryFailedShots = () => {
    if (storyboardHealth.failedCount === 0) {
      setStatusText("当前没有失败的分镜条目");
      return;
    }
    // 找到失败条目对应的 beat
    const failedBeatIds = storyboardHealth.failedShots.map((s) => s.scriptBeatId);
    const picked = beatsNorm.filter((b) => failedBeatIds.includes(b.id));
    if (picked.length === 0) {
      setStatusText("无法找到失败条目对应的脚本镜头");
      return;
    }
    void runGenerate(picked);
  };

  const batchGenerateVideos = async () => {
    if (!projectPath) {
      setStatusText("请先打开工程");
      return;
    }
    if (!batchVideoOk) {
      setStatusText(
        "canStart" in batchVideoReadiness
          ? batchVideoReadiness.message
          : batchVideoReadiness.message,
      );
      return;
    }
    const beatIds = batchVideoReadiness.scope.beats.map((b) => b.id);
    setBatchVideoRunning(true);
    try {
      await batchGenerateVideosForStoryboard({
        scriptNodeId: nodeId,
        beats: beatsNorm,
        shots: shots ?? [],
        nodes,
        edges,
        projectPath,
        updateNodeData,
        setStatusText,
        beatIds,
        maxConcurrent: getAgentMaxConcurrentMedia(),
        onProgress: (current, total, shotNumber) => {
          setStatusText(`批量视频：${current}/${total} 镜 ${shotNumber}…`);
        },
      });
    } finally {
      setBatchVideoRunning(false);
    }
  };

  /** E5：批量出关键帧（缺节点则先建链再提交云端出图） */
  const batchGenerateKeyframeImages = async () => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程");
      return;
    }
    if (!("canStart" in batchImageReadiness)) {
      setStatusText(batchImageReadiness.message);
      return;
    }
    const readiness = batchImageReadiness;
    if (!readiness.canStart) {
      setStatusText(readiness.blockMessage);
      return;
    }
    if (readiness.needsChainBuild > 0) {
      runChainBuild(["image"], { submitImageGeneration: true });
      return;
    }
    setBatchImageRunning(true);
    try {
      const beatIds = readiness.eligible.map((e) => e.beatId);
      const bible = useProjectBibleStore.getState().bible;
      const scriptNode = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
      const nodeParams =
        scriptNode?.data.params && typeof scriptNode.data.params === "object"
          ? (scriptNode.data.params as Record<string, unknown>)
          : undefined;
      const split = resolveHermesBatchSplitSettings(loadHermesAutoChainSettings(), nodeParams);
      await batchGenerateImagesForStoryboard({
        scriptNodeId: nodeId,
        nodes: useProjectStore.getState().nodes,
        edges: useProjectStore.getState().edges,
        projectPath: projectPath.trim(),
        updateNodeData,
        setStatusText,
        beatIds,
        restrictToNodeIds: restrictToStoryboardGroup,
        resolveBeatReferencePaths: createBeatReferenceResolver(beatsNorm, bible),
        maxConcurrent: getAgentMaxConcurrentMedia(),
        hermesBatch: {
          strategy: split.batchSplitStrategy,
          packImageCount: split.packImageCount,
          beats: beatsNorm,
          shots,
        },
        onProgress: (current, total, detail) => {
          setStatusText(`批量出图：${current}/${total}${detail ? ` · ${detail}` : ""}`);
        },
      });
    } finally {
      setBatchImageRunning(false);
    }
  };

  /** E5：仅重试范围内 storyboard status=failed 的关键帧出图 */
  const retryFailedKeyframes = async () => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程");
      return;
    }
    if (failedKeyframeBeatIdsInScope.length === 0) {
      setStatusText("范围内没有失败的关键帧镜头");
      return;
    }
    const imageByBeat = findImageNodesForScript(nodeId, nodes, edges, {
      restrictToNodeIds: restrictToStoryboardGroup,
    });
    const beatIds = failedKeyframeBeatIdsInScope.filter((id) => imageByBeat.has(id));
    const missingNodeCount = failedKeyframeBeatIdsInScope.length - beatIds.length;
    if (beatIds.length === 0) {
      setStatusText(
        missingNodeCount > 0
          ? "失败镜头尚无图片节点，请先点「批量出关键帧」建链"
          : "范围内没有可重试的关键帧",
      );
      return;
    }
    const bible = useProjectBibleStore.getState().bible;
    const scriptNode = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
    const retryNodeParams =
      scriptNode?.data.params && typeof scriptNode.data.params === "object"
        ? (scriptNode.data.params as Record<string, unknown>)
        : undefined;
    const split = resolveHermesBatchSplitSettings(loadHermesAutoChainSettings(), retryNodeParams);
    setBatchImageRunning(true);
    try {
      await batchGenerateImagesForStoryboard({
        scriptNodeId: nodeId,
        nodes: useProjectStore.getState().nodes,
        edges: useProjectStore.getState().edges,
        projectPath: projectPath.trim(),
        updateNodeData,
        setStatusText,
        beatIds,
        restrictToNodeIds: restrictToStoryboardGroup,
        resolveBeatReferencePaths: createBeatReferenceResolver(beatsNorm, bible),
        maxConcurrent: getAgentMaxConcurrentMedia(),
        hermesBatch: {
          strategy: split.batchSplitStrategy,
          packImageCount: split.packImageCount,
          beats: beatsNorm,
          shots,
        },
        onProgress: (current, total, detail) => {
          setStatusText(`重试关键帧：${current}/${total}${detail ? ` · ${detail}` : ""}`);
        },
      });
      if (missingNodeCount > 0) {
        const tail = useProjectStore.getState().statusText;
        setStatusText(
          `${tail}；另有 ${missingNodeCount} 镜无图片节点，请先「批量出关键帧」建链`,
        );
      }
    } finally {
      setBatchImageRunning(false);
    }
  };

  const retryFailedVideos = async () => {
    if (!projectPath) {
      setStatusText("请先打开工程");
      return;
    }
    if (failedVideoBeatIdsInScope.length === 0) {
      setStatusText("范围内没有失败的视频镜头");
      return;
    }
    setBatchVideoRunning(true);
    try {
      await batchGenerateVideosForStoryboard({
        scriptNodeId: nodeId,
        beats: beatsNorm,
        shots: shots ?? [],
        nodes,
        edges,
        projectPath,
        updateNodeData,
        setStatusText,
        beatIds: failedVideoBeatIdsInScope,
        maxConcurrent: getAgentMaxConcurrentMedia(),
        onProgress: (current, total, shotNumber) => {
          setStatusText(`重试视频：${current}/${total} 镜 ${shotNumber}…`);
        },
      });
    } finally {
      setBatchVideoRunning(false);
    }
  };

  const handleExportScriptCompose = async () => {
    if (!projectPath) {
      setStatusText("请先打开工程");
      return;
    }
    if (!composeExportOk) {
      setStatusText(
        "canExport" in composeExportReadiness
          ? composeExportReadiness.message
          : composeExportReadiness.message,
      );
      return;
    }
    const beatIds = composeExportReadiness.scope.beats.map((b) => b.id);
    setComposeExportRunning(true);
    try {
      await exportScriptCompose(nodeId, { autoRender: true, beatIds });
    } finally {
      setComposeExportRunning(false);
    }
  };

  const triggerHermesAutoChain = () => {
    const generatedShots = shots?.filter((s) => s.status === "generated" && s.visualPrompt?.trim()) ?? [];
    if (generatedShots.length === 0) {
      setStatusText("当前没有已生成分镜的镜头，请先生成分镜");
      return;
    }
    const beatIds =
      chainScopeResult.ok && chainScopeResult.scope.mode === "selected"
        ? chainScopeResult.scope.beats.map((b) => b.id)
        : undefined;
    const result = handleScriptNodeCompleted(nodeId, {
      beatIds,
      submitImageGeneration: Boolean(projectPath?.trim()),
    });
    if (result.total === 0) {
      setStatusText("Hermes 串联：未找到可创建的下游节点（可能已建链）");
    } else {
      const scriptNode = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
      const nodeParams =
        scriptNode?.data.params && typeof scriptNode.data.params === "object"
          ? (scriptNode.data.params as Record<string, unknown>)
          : undefined;
      const split = resolveHermesBatchSplitSettings(loadHermesAutoChainSettings(), nodeParams);
      const tail =
        projectPath?.trim() && result.succeeded > 0
          ? split.batchSplitStrategy === "pack_forward"
            ? `；图片已按打包拆镜 ${split.packImageCount} 张排队`
            : "；图片已按镜头逐张排队"
          : "";
      setStatusText(
        `Hermes 串联完成：${result.succeeded} 个节点组已创建` +
          (result.failed > 0 ? `，${result.failed} 个失败` : "") +
          tail,
      );
    }
  };

  const runChainBuild = (
    kinds: ChainMediaKind[],
    opts?: { submitImageGeneration?: boolean },
  ) => {
    const storyboardGroupId = resolveUniqueStoryboardGroupForScript(nodeId, nodes, edges);
    const storyboardGroup = storyboardGroupId
      ? nodes.find((n) => n.id === storyboardGroupId)
      : undefined;
    const groupBeatIds = storyboardBeatIdsForGroup(storyboardGroup);
    const chainSelection =
      groupBeatIds && groupBeatIds.length > 0 ? groupBeatIds : scriptBeatSelection;
    const anchor =
      storyboardGroup ?? nodes.find((n) => n.id === nodeId);
    if (!anchor) {
      setStatusText("找不到脚本节点，无法创建链路");
      return;
    }
    const result = buildScriptBeatChain({
      scriptNodeId: nodeId,
      anchor,
      beats: beatsNorm,
      scriptBeatSelection: chainSelection,
      shots,
      nodes,
      edges,
      kinds,
      skipExisting: true,
      storyboardGroupId: storyboardGroupId ?? undefined,
    });
    if ("message" in result) {
      setStatusText(result.message);
      return;
    }
    if (result.newNodes.length > 0) {
      addNodesWithEdges(result.newNodes, result.newEdges);
      if (storyboardGroupId) {
        useProjectStore.setState((s) => ({
          nodes: fitGroupAfterMemberChange(s.nodes, storyboardGroupId),
        }));
      }
      setSelectedNodeIds(
        storyboardGroupId ? [storyboardGroupId] : result.newNodes.map((n) => n.id),
      );
    }
    setStatusText(formatChainBuildStatus(result));
    if (
      opts?.submitImageGeneration &&
      result.created.image > 0
    ) {
      const freshProjectPath = useProjectStore.getState().projectPath?.trim();
      if (!freshProjectPath) {
        setStatusText("工程已关闭，无法提交图片生成");
        return;
      }
      const scriptNode = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
      const nodeParams =
        scriptNode?.data.params && typeof scriptNode.data.params === "object"
          ? (scriptNode.data.params as Record<string, unknown>)
          : undefined;
      const split = resolveHermesBatchSplitSettings(loadHermesAutoChainSettings(), nodeParams);
      const restrict = storyboardGroupId
        ? getGroupMemberIdSet(useProjectStore.getState().nodes, storyboardGroupId)
        : undefined;
      const bible = useProjectBibleStore.getState().bible;
      void batchGenerateImagesForStoryboard({
        scriptNodeId: nodeId,
        nodes: useProjectStore.getState().nodes,
        edges: useProjectStore.getState().edges,
        projectPath: freshProjectPath,
        updateNodeData,
        setStatusText,
        beatIds: result.scope.beats.map((b) => b.id),
        restrictToNodeIds: restrict,
        resolveBeatReferencePaths: createBeatReferenceResolver(beatsNorm, bible),
        maxConcurrent: getAgentMaxConcurrentMedia(),
        hermesBatch: {
          strategy: split.batchSplitStrategy,
          packImageCount: split.packImageCount,
          beats: beatsNorm,
          shots,
        },
      }).catch((e) => setStatusText(`图片批量生成失败：${formatUserError(e)}`));
    }
  };

  const generateSelected = () => {
    const scopeResult = resolveStoryboardBeatScope(beatsNorm, scriptBeatSelection);
    if (!scopeResult.ok) {
      setStatusText(scopeResult.message);
      return;
    }
    void runGenerate(scopeResult.scope.beats);
  };

  const generateAll = () => {
    void runGenerate(beatsNorm);
  };

  const persistShotPatch = (id: string, patch: Partial<StoryboardShot>) => {
    const list = [...(shots ?? [])];
    const idx = list.findIndex((s) => s.scriptBeatId === id);
    const prev =
      idx >= 0 ? list[idx] : ({ scriptBeatId: id, visualPrompt: "" } satisfies StoryboardShot);
    const next: StoryboardShot = { ...prev, ...patch, scriptBeatId: id };
    if (idx >= 0) list[idx] = next;
    else list.push(next);
    updateNodeData(nodeId, { storyboardShots: list });
  };

  const runStoryboardImportFromPaths = (paths: string[]) => {
    if (paths.length === 0 || !detail || !projectPath) return;
    const beatId = detail.scriptBeatId;
    void (async () => {
      try {
        const latestNode = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
        const latestShots = latestNode?.data.storyboardShots;
        const result = await importStoryboardImageForBeat(
          projectPath,
          paths,
          latestShots,
          beatId,
        );
        if (!result) return;
        updateNodeData(nodeId, { storyboardShots: result.shots });
        setDetail((d) => (d ? { ...d, imagePath: result.relPath } : null));
        setStatusText(`已关联分镜图：${result.relPath}`);
      } catch (e) {
        setStatusText(`导入分镜图失败：${formatUserError(e)}`);
      }
    })();
  };

  const pickStoryboardImage = () => {
    if (!projectPath) {
      setStatusText("请先打开工程后再关联分镜图");
      return;
    }
    if (!detail) return;
    void (async () => {
      if (isTauri()) {
        const paths = await pickImagePathsForImport(false);
        if (paths?.length) runStoryboardImportFromPaths(paths);
      } else {
        storyboardImageInputRef.current?.click();
      }
    })();
  };

  const onStoryboardImageFiles = (ev: ChangeEvent<HTMLInputElement>) => {
    const input = ev.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0 || !detail || !projectPath) return;
    const paths = files
      .map((f) => (f as File & { path?: string }).path)
      .filter((p): p is string => Boolean(p && typeof p === "string"));
    if (paths.length === 0) {
      setStatusText("未拿到本地文件路径：请在 Tauri 桌面端选择文件（浏览器预览不支持 path）");
      return;
    }
    runStoryboardImportFromPaths(paths);
  };

  const createImageVideoChain = () => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程后再建链并提交图片生成");
      return;
    }
    runChainBuild(["image", "video"], { submitImageGeneration: true });
  };

  const createImageNodesFromSelection = () => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程后再批量生成图片");
      return;
    }
    runChainBuild(["image"], { submitImageGeneration: true });
  };

  const createVideoNodesFromSelection = () => {
    runChainBuild(["video"]);
  };

  const createAudioNodesFromSelection = () => {
    runChainBuild(["audio"]);
  };

  return (
    <div id={`script-storyboard-anchor-${nodeId}`} className="storyboardSection">
      {chainScopeResult.ok ? (
        <p className="storyboardChainScopeHint" role="status">
          {storyboardChainScopeHint(chainScopeResult.scope)}
          <span className="storyboardChainScopeHint-sep"> · </span>
          {hermesPolicyHint}
        </p>
      ) : null}
      <div className="storyboardToolbar">
        <span className="storyboardTitle">分镜（文案 + 本地图）</span>
        <button type="button" className="btn" disabled={sbView === "grid"} onClick={() => setSbView("grid")}>
          网格
        </button>
        <button type="button" className="btn" disabled={sbView === "list"} onClick={() => setSbView("list")}>
          列表
        </button>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={generating || beatsNorm.length === 0}
          title="使用当前 Provider 与 API Key"
          onClick={() => void generateSelected()}
        >
          {generating ? "分镜生成中…" : "为勾选脚本生成分镜"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={generating || beatsNorm.length === 0}
          onClick={() => void generateAll()}
        >
          {generating ? "分镜生成中…" : "为全部脚本生成分镜"}
        </button>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={beatsNorm.length === 0}
          title="按勾选范围创建图片+视频节点（脚本→图→视频），写入 params.scriptBeatId；已存在则跳过"
          onClick={createImageVideoChain}
        >
          一键建链（图+视频）
        </button>
        <button
          type="button"
          className="btn"
          disabled={beatsNorm.length === 0}
          title="仅创建图片节点并提交生成"
          onClick={createImageNodesFromSelection}
        >
          仅图片
        </button>
        <button
          type="button"
          className="btn"
          disabled={beatsNorm.length === 0}
          title="仅创建视频节点"
          onClick={createVideoNodesFromSelection}
        >
          仅视频
        </button>
        <button
          type="button"
          className="btn"
          disabled={beatsNorm.length === 0}
          title="仅创建音频节点"
          onClick={createAudioNodesFromSelection}
        >
          仅音频
        </button>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={generating || storyboardHealth.generatedCount === 0}
          title="手动触发 Hermes：为已生成分镜的镜头创建图+视频节点（受节点 Hermes 策略与勾选范围约束）"
          onClick={triggerHermesAutoChain}
        >
          {generating ? "串联中…" : `Hermes 手动串联（${storyboardHealth.generatedCount}）`}
        </button>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={batchImageRunning || !projectPath || !batchImageCanRun}
          title={
            "canStart" in batchImageReadiness
              ? batchImageReadiness.canStart
                ? batchImageHint
                : batchImageReadiness.blockMessage
              : batchImageReadiness.message
          }
          onClick={() => void batchGenerateKeyframeImages()}
        >
          {batchImageRunning ? "批量出图中…" : "批量出关键帧"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={
            batchImageRunning || !projectPath || failedKeyframeBeatIdsInScope.length === 0
          }
          title="仅重试范围内分镜 status=failed 的镜头（需已有图片节点）"
          onClick={() => void retryFailedKeyframes()}
        >
          重试失败关键帧（{failedKeyframeBeatIdsInScope.length}）
        </button>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={batchVideoRunning || !projectPath || !batchVideoOk}
          title={
            batchVideoOk
              ? batchVideoHint
              : "canStart" in batchVideoReadiness
                ? batchVideoReadiness.message
                : batchVideoReadiness.message
          }
          onClick={() => void batchGenerateVideos()}
        >
          {batchVideoRunning ? "批量视频中…" : "批量生成视频"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={
            batchVideoRunning || !projectPath || failedVideoBeatIdsInScope.length === 0
          }
          title="仅重试范围内 videoStatus=failed 的镜头"
          onClick={() => void retryFailedVideos()}
        >
          重试失败视频（{failedVideoBeatIdsInScope.length}）
        </button>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={composeExportRunning || !projectPath || !composeExportOk}
          title={
            composeExportOk
              ? composeExportHint
              : "canExport" in composeExportReadiness
                ? composeExportReadiness.message
                : composeExportReadiness.message
          }
          onClick={() => void handleExportScriptCompose()}
        >
          {composeExportRunning
            ? "导出成片中…"
            : composeExportOk
              ? `导出成片（${composeExportReadiness.readyCount}/${composeExportReadiness.totalInScope}）`
              : "导出成片"}
        </button>
      </div>
      {(batchImageHasScope || batchVideoOk || composeExportOk) && (
        <p className="storyboardProductionHint mono" role="status">
          {batchImageHasScope ? batchImageHint : null}
          {batchImageHasScope && batchVideoOk ? " · " : null}
          {batchVideoOk ? batchVideoHint : null}
          {(batchImageHasScope || batchVideoOk) && composeExportOk ? " · " : null}
          {composeExportOk ? composeExportHint : null}
        </p>
      )}
      <p className="storyboardHint">
        LLM 生成分镜文案；可在详情中从本机选择一张图导入工程并关联为「分镜图」（不出云端图生）。须已打开工程，桌面端选择文件。
        {composeExportOk && composeExportReadiness.missingCount > 0 ? (
          <span className="storyboardComposeHint">
            {" "}
            导出时将跳过 {composeExportReadiness.missingCount} 个未出片或未关联视频节点的镜头。
          </span>
        ) : null}
      </p>
      {beatsNorm.length > 0 ? (
        <div className="storyboardHealthBar" role="status" aria-label="分镜一致性自检">
          <div className="storyboardHealthMain">
            <span className="mono">
              镜头 {storyboardHealth.totalBeats} · 分镜缓存 {storyboardHealth.totalShots}
            </span>
            {storyboardHealth.missingShotBeats.length > 0 ? (
              <span className="storyboardHealthWarn mono">缺失 {storyboardHealth.missingShotBeats.length}</span>
            ) : (
              <span className="storyboardHealthOk mono">齐全</span>
            )}
            {storyboardHealth.emptyPromptBeats.length > 0 ? (
              <span className="storyboardHealthWarn mono">空文案 {storyboardHealth.emptyPromptBeats.length}</span>
            ) : null}
            {storyboardHealth.orphanShots.length > 0 ? (
              <span className="storyboardHealthWarn mono">无效缓存 {storyboardHealth.orphanShots.length}</span>
            ) : null}
            {storyboardHealth.duplicateShotIds.length > 0 ? (
              <span className="storyboardHealthWarn mono">重复 {storyboardHealth.duplicateShotIds.length}</span>
            ) : null}
            {generating ? (
              <span className="storyboardHealthWarn mono">生成中 {storyboardHealth.generatingCount > 0 ? `（${storyboardHealth.generatingCount} 条）` : ""}</span>
            ) : (
              <>
                {storyboardHealth.generatedCount > 0 && (
                  <span className="storyboardHealthOk mono">已生成 {storyboardHealth.generatedCount}</span>
                )}
                {storyboardHealth.failedCount > 0 && (
                  <span className="storyboardHealthWarn mono">失败 {storyboardHealth.failedCount}</span>
                )}
              </>
            )}
          </div>
          <div className="storyboardHealthActions">
            <button
              type="button"
              className="btn"
              disabled={generating || storyboardHealth.missingShotBeats.length === 0}
              onClick={generateMissingOnly}
              title="只为缺失分镜的镜头补全（不会覆盖已有文案）"
            >
              补生成（缺失）
            </button>
            <button
              type="button"
              className="btn"
              disabled={generating || storyboardHealth.emptyPromptBeats.length === 0}
              onClick={generateEmptyPromptsOnly}
              title="只为分镜文案为空的镜头补全（会覆盖空文案）"
            >
              补生成（空文案）
            </button>
            <button
              type="button"
              className="btn"
              disabled={generating || storyboardHealth.failedCount === 0}
              onClick={retryFailedShots}
              title="重试所有失败的分镜生成"
            >
              重试失败（{storyboardHealth.failedCount}）
            </button>
            <button
              type="button"
              className="btn"
              disabled={generating || (storyboardHealth.orphanShots.length === 0 && storyboardHealth.duplicateShotIds.length === 0)}
              onClick={cleanupStoryboardCache}
              title="清理已不在脚本镜头列表中的分镜缓存，并对重复 scriptBeatId 去重"
            >
              清理缓存
            </button>
          </div>
        </div>
      ) : null}
      <input
        ref={storyboardImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
        style={{ display: "none" }}
        onChange={onStoryboardImageFiles}
      />

      {beatsNorm.length === 0 ? (
        <div className="storyboardEmpty">请先在脚本工作台添加或生成脚本条目。</div>
      ) : sbView === "grid" ? (
        <div className="storyboardGrid">
          {orderedRows.map(({ beat, shot }) => {
            const status = shot?.status ?? "idle";
            const videoStatus = shot?.videoStatus;
            const isGenerating = status === "generating";
            const isFailed = status === "failed";
            const isGenerated = status === "generated" && shot?.visualPrompt?.trim();
            const isVideoGenerating = videoStatus === "generating";
            const isVideoFailed = videoStatus === "failed";
            const isVideoGenerated = videoStatus === "generated";
            return (
              <button
                key={beat.id}
                type="button"
                data-storyboard-focus-beat={beat.id}
                className={`storyboardCard${isGenerating ? " storyboardCard--generating" : ""}${isFailed ? " storyboardCard--failed" : ""}${isGenerated ? " storyboardCard--generated" : ""}${detail?.scriptBeatId === beat.id ? " storyboardCard--focused" : ""}`}
                onClick={() =>
                  setDetail(
                    shot ?? {
                      scriptBeatId: beat.id,
                      visualPrompt: "",
                      status: "idle",
                    },
                  )
                }
              >
                {shot?.imagePath && resolveProjectAssetSrc(projectPath, shot.imagePath) ? (
                  <div className="storyboardCardThumb">
                    <img
                      alt=""
                      src={resolveProjectAssetSrc(projectPath, shot.imagePath) ?? undefined}
                    />
                  </div>
                ) : null}
                <div className="storyboardCardMeta mono">
                  {(beat.shotNumber ?? "").trim() || "未标镜号"}
                  {isGenerating ? <span className="storyboardStatusBadge storyboardStatusBadge--generating">生成中</span> : null}
                  {isFailed ? (
                    <span className="storyboardStatusBadge storyboardStatusBadge--failed" title={shot?.error}>
                      失败{shot?.retryCount ? ` · 重试 ${shot.retryCount}` : ""}
                    </span>
                  ) : isGenerated ? (
                    <span className="storyboardStatusBadge storyboardStatusBadge--generated">✓</span>
                  ) : null}
                  {isVideoGenerating ? (
                    <span className="storyboardStatusBadge storyboardStatusBadge--video">视频生成中</span>
                  ) : isVideoFailed ? (
                    <span className="storyboardStatusBadge storyboardStatusBadge--video storyboardStatusBadge--failed" title={shot?.videoError}>
                      视频失败
                    </span>
                  ) : isVideoGenerated ? (
                    <span className="storyboardStatusBadge storyboardStatusBadge--video storyboardStatusBadge--generated">✓ 视频</span>
                  ) : null}
                </div>
                <div className="storyboardCardPreview">
                  {shot?.visualPrompt?.trim()
                    ? `${shot.visualPrompt.slice(0, 120)}${shot.visualPrompt.length > 120 ? "…" : ""}`
                    : status === "generating"
                      ? "正在生成镜头描述…"
                      : status === "failed"
                        ? `生成失败：${shot?.error ?? "未知错误"}`
                        : "待生成 · 点击填写或生成后查看全文"}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="storyboardListWrap">
          <table className="storyboardTable">
            <thead>
              <tr>
                <th style={{ width: 52 }}>图</th>
                <th>场次</th>
                <th>画面描述摘要</th>
                <th style={{ width: 80 }}>视频</th>
                <th style={{ width: 72 }}>回看</th>
              </tr>
            </thead>
            <tbody>
              {orderedRows.map(({ beat, shot }) => {
                const videoStatus = shot?.videoStatus;
                const isVideoGenerating = videoStatus === "generating";
                const isVideoFailed = videoStatus === "failed";
                const isVideoGenerated = videoStatus === "generated";
                return (
                  <tr key={beat.id}>
                    <td>
                      {shot?.imagePath && resolveProjectAssetSrc(projectPath, shot.imagePath) ? (
                        <img
                          className="storyboardListThumb"
                          alt=""
                          src={resolveProjectAssetSrc(projectPath, shot.imagePath) ?? undefined}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="mono">{beat.shotNumber}</td>
                    <td>
                      {shot?.visualPrompt?.trim()
                        ? `${shot.visualPrompt.slice(0, 80)}${shot.visualPrompt.length > 80 ? "…" : ""}`
                        : "—"}
                    </td>
                    <td>
                      {isVideoGenerating ? (
                        <span className="storyboardStatusBadge storyboardStatusBadge--video">视频生成中</span>
                      ) : isVideoFailed ? (
                        <span className="storyboardStatusBadge storyboardStatusBadge--video storyboardStatusBadge--failed" title={shot?.videoError}>
                          视频失败
                        </span>
                      ) : isVideoGenerated ? (
                        <span className="storyboardStatusBadge storyboardStatusBadge--video storyboardStatusBadge--generated">✓ 视频</span>
                      ) : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: "4px 8px" }}
                        onClick={() =>
                          setDetail(
                            shot ?? {
                              scriptBeatId: beat.id,
                              visualPrompt: "",
                            },
                          )
                        }
                      >
                        全文
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail ? (
        <div
          className="storyboardModalBackdrop"
          role="presentation"
          onClick={() => setDetail(null)}
        >
          <div
            className="storyboardModal"
            role="dialog"
            aria-modal="true"
            aria-label="分镜全文"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="storyboardModalHead">
              <span className="mono">镜头 {detail.scriptBeatId.slice(0, 8)}…</span>
              <button type="button" className="btn" onClick={() => setDetail(null)}>
                关闭
              </button>
            </div>
            {detail.imagePath && resolveProjectAssetSrc(projectPath, detail.imagePath) ? (
              <div className="field storyboardModalPreview">
                <img alt="分镜图" src={resolveProjectAssetSrc(projectPath, detail.imagePath) ?? undefined} />
              </div>
            ) : null}
            <div className="field" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button type="button" className="btn btnPrimary" onClick={pickStoryboardImage}>
                从本机选择分镜图…
              </button>
              {detail.imagePath ? (
                <button
                  type="button"
                  className="btn btnDanger"
                  onClick={() => {
                    persistShotPatch(detail.scriptBeatId, { imagePath: undefined });
                    setDetail({ ...detail, imagePath: undefined });
                    setStatusText("已移除分镜图关联");
                  }}
                >
                  移除图片
                </button>
              ) : null}
              <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                {detail.imagePath ?? "未关联"}
              </span>
              {detail.status === "failed" ? (
                <button
                  type="button"
                  className="btn btnDanger"
                  onClick={() => {
                    const beat = beatsNorm.find((b) => b.id === detail.scriptBeatId);
                    if (!beat || !projectPath) return;
                    void (async () => {
                      setGenerating(true);
                      try {
                        if (!(await preflightScriptNodeLlm(nodeParams, setStatusText))) return;
                        await runNodeTaskAgent(
                          scriptStoryboardGenerateAgentRuntime,
                          {
                            targetBeats: [beat],
                            themePrompt,
                            prevShots: shots,
                            llmParams,
                          },
                          { nodeId, projectPath, updateNodeData, setStatusText },
                        );
                      } finally {
                        setGenerating(false);
                      }
                    })();
                  }}
                  disabled={generating}
                >
                  重试生成
                </button>
              ) : detail.status === "generating" ? (
                <span className="storyboardStatusBadge storyboardStatusBadge--generating mono">生成中…</span>
              ) : null}
              {detail.status === "failed" && detail.error ? (
                <span className="mono" style={{ fontSize: 12, color: "var(--danger)" }} title={detail.error}>
                  错误：{detail.error}
                </span>
              ) : null}
            </div>
            <div className="field">
              <label>画面描述（visualPrompt）</label>
              <textarea
                rows={10}
                value={detail.visualPrompt}
                onChange={(e) => setDetail({ ...detail, visualPrompt: e.target.value })}
                onBlur={(e) => persistShotPatch(detail.scriptBeatId, { visualPrompt: e.currentTarget.value })}
              />
            </div>
            <div className="field">
              <label>构图补充（可选）</label>
              <textarea
                rows={3}
                value={detail.compositionNote ?? ""}
                onChange={(e) => setDetail({ ...detail, compositionNote: e.target.value })}
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim();
                  persistShotPatch(detail.scriptBeatId, {
                    compositionNote: v ? v : undefined,
                  });
                }}
              />
            </div>
            <div className="field">
              <label>负面提示（可选）</label>
              <textarea
                rows={2}
                value={detail.negativePrompt ?? ""}
                onChange={(e) => setDetail({ ...detail, negativePrompt: e.target.value })}
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim();
                  persistShotPatch(detail.scriptBeatId, {
                    negativePrompt: v ? v : undefined,
                  });
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
