import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildTimelineLayoutFromClips,
  clipsToRenderPayload,
  buildComposeClipsFromScript,
  collectClipsFromEdges,
  composeClipToTimeline,
  createTimelineHistory,
  DEFAULT_EXPORT_PATH,
  applyExportFormatToPath,
  exportEncodeToInvokePayload,
  resolveExportFormat,
  findScriptNodeForCompose,
  normalizeExportEncode,
  formatComposeMissingHint,
  normalizeTimelineClips,
  patchComposeNodeAfterExport,
  resolveSecToClip,
  sortClipsByScriptBeats,
  splitAtPlayhead,
  TIMELINE_PX_PER_SEC,
  timelineClipsToNodePatch,
  trimSelectedInAtPlayhead,
  trimSelectedOutAtPlayhead,
  trimDragFromTrackPx,
  snapPlayheadSec,
  snapThresholdSec,
  type ComposeTimelineClip,
  type TimelineEditResult,
  type TimelineHistorySnapshot,
  type TimelineSnapOptions,
} from "@/lib/compose";
import type { TimelineExportEncodeSettings } from "@/lib/compose/timelineExportEncode";
import type { TimelineExportFormat } from "@/lib/compose/timelineExportFormat";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";

function isEditError(r: TimelineEditResult | { error: string }): r is { error: string } {
  return "error" in r;
}

export function useComposeNodeEditor(nodeId: string) {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const projectPath = useProjectStore((s) => s.projectPath);
  const selectNodesByIds = useProjectStore((s) => s.selectNodesByIds);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const nodeData = useMemo(() => nodes.find((n) => n.id === nodeId)?.data ?? {}, [nodes, nodeId]);

  const timelineClips: ComposeTimelineClip[] = useMemo(
    () => normalizeTimelineClips(nodeData),
    [nodeData],
  );

  const output: string = useMemo(
    () => nodeData.output?.trim() || DEFAULT_EXPORT_PATH,
    [nodeData.output],
  );
  const outputPath = nodeData.path?.trim();

  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const [outputReady, setOutputReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<"clip" | "output">("clip");
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [playheadSec, setPlayheadSec] = useState(0);
  const [sequencePlaying, setSequencePlaying] = useState(false);
  const [seekInClipSec, setSeekInClipSec] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineSnapEnabled, setTimelineSnapEnabled] = useState(true);
  const [historyVersion, setHistoryVersion] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const historyRef = useRef(createTimelineHistory());
  const trimDragActiveRef = useRef(false);
  const trimMetaRef = useRef<{ index: number; edge: "in" | "out" } | null>(null);

  const pxPerSec = TIMELINE_PX_PER_SEC * timelineZoom;

  const snapOptions: TimelineSnapOptions = useMemo(
    () => ({
      enabled: timelineSnapEnabled,
      thresholdSec: snapThresholdSec(pxPerSec),
      playheadSec,
    }),
    [timelineSnapEnabled, pxPerSec, playheadSec],
  );

  const { segments, totalSec, totalWidthPx } = useMemo(
    () => buildTimelineLayoutFromClips(timelineClips, durations, pxPerSec),
    [timelineClips, durations, pxPerSec],
  );

  const canUndo = useMemo(() => {
    void historyVersion;
    return historyRef.current.canUndo();
  }, [historyVersion]);

  const canRedo = useMemo(() => {
    void historyVersion;
    return historyRef.current.canRedo();
  }, [historyVersion]);

  useEffect(() => {
    historyRef.current.clear();
    setHistoryVersion((v) => v + 1);
  }, [nodeId]);

  useEffect(() => {
    if (nodeData.timelineClips?.length) return;
    if (!nodeData.inputs?.length) return;
    const migrated = normalizeTimelineClips(nodeData);
    if (migrated.length > 0) {
      updateNodeData(nodeId, timelineClipsToNodePatch(migrated));
    }
  }, [nodeId, nodeData.timelineClips, nodeData.inputs, nodeData, updateNodeData]);

  useEffect(() => {
    if (selectedIndex >= timelineClips.length) {
      setSelectedIndex(Math.max(0, timelineClips.length - 1));
    }
  }, [timelineClips.length, selectedIndex]);

  const makeSnapshot = useCallback(
    (): TimelineHistorySnapshot => ({
      clips: timelineClips.map((c) => ({ ...c })),
      selectedIndex,
      playheadSec,
    }),
    [timelineClips, selectedIndex, playheadSec],
  );

  const syncViewToTimeline = useCallback(
    (clips: ComposeTimelineClip[], index: number, globalPlayheadSec: number) => {
      const { segments: segs } = buildTimelineLayoutFromClips(clips, durations, pxPerSec);
      const seg = segs.find((s) => s.index === index) ?? segs[0];
      if (!seg) {
        setSelectedIndex(0);
        setPlayheadSec(0);
        setSeekInClipSec(0);
        return;
      }
      const offset = Math.max(0, Math.min(seg.durationSec, globalPlayheadSec - seg.startSec));
      setSelectedIndex(seg.index);
      setPreviewMode("clip");
      setSeekInClipSec(seg.inSec + offset);
      setPlayheadSec(seg.startSec + offset);
    },
    [durations, pxPerSec],
  );

  const applySnapshot = useCallback(
    (snap: TimelineHistorySnapshot) => {
      updateNodeData(nodeId, timelineClipsToNodePatch(snap.clips));
      syncViewToTimeline(snap.clips, snap.selectedIndex, snap.playheadSec);
      setOutputReady(false);
    },
    [nodeId, updateNodeData, syncViewToTimeline],
  );

  const commitEdit = useCallback(
    (result: TimelineEditResult) => {
      historyRef.current.push(makeSnapshot());
      updateNodeData(nodeId, timelineClipsToNodePatch(result.clips));
      syncViewToTimeline(result.clips, result.selectedIndex, result.playheadSec);
      setOutputReady(false);
      setHistoryVersion((v) => v + 1);
    },
    [makeSnapshot, nodeId, updateNodeData, syncViewToTimeline],
  );

  const applyClipsLive = useCallback(
    (result: TimelineEditResult) => {
      updateNodeData(nodeId, timelineClipsToNodePatch(result.clips));
      syncViewToTimeline(result.clips, result.selectedIndex, result.playheadSec);
      setOutputReady(false);
    },
    [nodeId, updateNodeData, syncViewToTimeline],
  );

  const stopSequence = useCallback(() => {
    setSequencePlaying(false);
    setPreviewPlaying(false);
    videoRef.current?.pause();
  }, []);

  const selectClip = useCallback(
    (index: number, offsetInClip = 0) => {
      if (segments.length === 0) {
        setSelectedIndex(0);
        setPlayheadSec(0);
        setSeekInClipSec(0);
        return;
      }
      const seg = segments.find((s) => s.index === index) ?? segments[0]!;
      setSelectedIndex(seg.index);
      setPreviewMode("clip");
      const seek = seg.inSec + offsetInClip;
      setSeekInClipSec(seek);
      setPlayheadSec(seg.startSec + offsetInClip);
    },
    [segments],
  );

  const seekToGlobalSec = useCallback(
    (sec: number) => {
      const { sec: snapped } = snapPlayheadSec(sec, segments, totalSec, snapOptions);
      const { index, offsetInClip } = resolveSecToClip(segments, snapped);
      selectClip(index, offsetInClip);
    },
    [segments, totalSec, snapOptions, selectClip],
  );

  const handleTrimDragStart = useCallback(
    (index: number, edge: "in" | "out") => {
      if (trimDragActiveRef.current) return;
      historyRef.current.push(makeSnapshot());
      setHistoryVersion((v) => v + 1);
      trimDragActiveRef.current = true;
      trimMetaRef.current = { index, edge };
      stopSequence();
      selectClip(index, 0);
    },
    [makeSnapshot, stopSequence, selectClip],
  );

  const handleTrimDrag = useCallback(
    (trackPx: number) => {
      if (!trimDragActiveRef.current) return;
      const meta = trimMetaRef.current;
      if (!meta) return;
      const result = trimDragFromTrackPx(
        timelineClips,
        segments,
        meta.index,
        meta.edge,
        trackPx,
        durations,
        snapOptions,
      );
      if (isEditError(result)) return;
      applyClipsLive(result);
    },
    [timelineClips, segments, durations, snapOptions, applyClipsLive],
  );

  const handleTrimDragEnd = useCallback(() => {
    if (!trimDragActiveRef.current) return;
    trimDragActiveRef.current = false;
    trimMetaRef.current = null;
    setStatus("");
  }, []);

  const commitClips = useCallback(
    (next: ComposeTimelineClip[], view?: { selectedIndex?: number; playheadSec?: number }) => {
      historyRef.current.push(makeSnapshot());
      updateNodeData(nodeId, timelineClipsToNodePatch(next));
      const idx = view?.selectedIndex ?? selectedIndex;
      const ph = view?.playheadSec ?? playheadSec;
      syncViewToTimeline(next, Math.min(idx, Math.max(0, next.length - 1)), ph);
      setOutputReady(false);
      setHistoryVersion((v) => v + 1);
    },
    [makeSnapshot, nodeId, updateNodeData, selectedIndex, playheadSec, syncViewToTimeline],
  );

  const undo = useCallback(() => {
    const restored = historyRef.current.undo(makeSnapshot());
    if (!restored) return;
    applySnapshot(restored);
    setHistoryVersion((v) => v + 1);
    setStatus("");
  }, [makeSnapshot, applySnapshot]);

  const redo = useCallback(() => {
    const restored = historyRef.current.redo(makeSnapshot());
    if (!restored) return;
    applySnapshot(restored);
    setHistoryVersion((v) => v + 1);
    setStatus("");
  }, [makeSnapshot, applySnapshot]);

  const togglePreviewPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPreviewPlaying(true);
    } else {
      v.pause();
      setPreviewPlaying(false);
    }
  }, []);

  const setPreviewPlayingState = useCallback((playing: boolean) => {
    setPreviewPlaying(playing);
  }, []);

  const handleSplitAtPlayhead = useCallback(() => {
    const result = splitAtPlayhead(timelineClips, segments, playheadSec, durations);
    if (isEditError(result)) {
      setStatus(result.error);
      return;
    }
    commitEdit(result);
    setStatus("已在播放头分割片段");
  }, [timelineClips, segments, playheadSec, durations, commitEdit]);

  const handleTrimIn = useCallback(() => {
    const result = trimSelectedInAtPlayhead(
      timelineClips,
      segments,
      selectedIndex,
      playheadSec,
      durations,
    );
    if (isEditError(result)) {
      setStatus(result.error);
      return;
    }
    commitEdit(result);
    setStatus("已修剪入点");
  }, [timelineClips, segments, selectedIndex, playheadSec, durations, commitEdit]);

  const handleTrimOut = useCallback(() => {
    const result = trimSelectedOutAtPlayhead(
      timelineClips,
      segments,
      selectedIndex,
      playheadSec,
      durations,
    );
    if (isEditError(result)) {
      setStatus(result.error);
      return;
    }
    commitEdit(result);
    setStatus("已修剪出点");
  }, [timelineClips, segments, selectedIndex, playheadSec, durations, commitEdit]);

  const canSplit = useMemo(() => {
    if (timelineClips.length === 0) return false;
    const result = splitAtPlayhead(timelineClips, segments, playheadSec, durations);
    return !isEditError(result);
  }, [timelineClips, segments, playheadSec, durations]);

  const canTrimIn = useMemo(() => {
    const result = trimSelectedInAtPlayhead(
      timelineClips,
      segments,
      selectedIndex,
      playheadSec,
      durations,
    );
    return !isEditError(result);
  }, [timelineClips, segments, selectedIndex, playheadSec, durations]);

  const canTrimOut = useMemo(() => {
    const result = trimSelectedOutAtPlayhead(
      timelineClips,
      segments,
      selectedIndex,
      playheadSec,
      durations,
    );
    return !isEditError(result);
  }, [timelineClips, segments, selectedIndex, playheadSec, durations]);

  const reorderClips = useCallback(
    (from: number, to: number) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= timelineClips.length ||
        to >= timelineClips.length
      ) {
        return;
      }
      const next = [...timelineClips];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      commitClips(next, { selectedIndex: to, playheadSec });
    },
    [timelineClips, commitClips],
  );

  const handleRefreshFromEdges = useCallback(
    async (sortByScript: boolean) => {
      if (!projectPath) {
        setStatus("请先打开工程");
        return;
      }
      setRefreshing(true);
      setStatus(sortByScript ? "正在按脚本镜号刷新…" : "正在从连线刷新…");
      try {
        let collected = await collectClipsFromEdges(nodeId, nodes, edges, projectPath);
        if (sortByScript) {
          collected = sortClipsByScriptBeats(collected, nodes);
        }
        const next = collected.map(composeClipToTimeline);
        commitClips(next, { selectedIndex: 0, playheadSec: 0 });
        setStatus(
          next.length > 0 ? `已刷新 ${next.length} 个片段` : "未检测到可合成的上游视频",
        );
      } catch (e) {
        setStatus(`刷新失败：${String(e)}`);
      } finally {
        setRefreshing(false);
      }
    },
    [projectPath, nodeId, nodes, edges, commitClips],
  );

  const scriptNodeIdForCompose = useMemo(
    () => findScriptNodeForCompose(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const handleRefreshFromScript = useCallback(async () => {
    if (!projectPath) {
      setStatus("请先打开工程");
      return;
    }
    const scriptId = scriptNodeIdForCompose;
    if (!scriptId) {
      setStatus("未找到关联脚本：请用脚本→视频→合成连线，或视频绑定镜号");
      return;
    }
    const script = nodes.find((n) => n.id === scriptId && n.type === "scriptNode");
    if (!script) return;

    setRefreshing(true);
    setStatus("正在从脚本镜头收集…");
    try {
      const built = await buildComposeClipsFromScript({
        scriptNodeId: scriptId,
        beats: script.data.scriptBeats ?? [],
        shots: script.data.storyboardShots ?? [],
        nodes,
        edges,
        projectPath,
      });
      const next = built.clips.map(composeClipToTimeline);
      commitClips(next, { selectedIndex: 0, playheadSec: 0 });
      const miss = formatComposeMissingHint(built.missing);
      setStatus(
        next.length > 0
          ? `已从脚本填入 ${next.length} 段${miss}`
          : `脚本范围内没有可合成片段${miss}`,
      );
      setOutputReady(false);
    } catch (e) {
      setStatus(`从脚本填充失败：${String(e)}`);
    } finally {
      setRefreshing(false);
    }
  }, [
    projectPath,
    scriptNodeIdForCompose,
    nodes,
    edges,
    commitClips,
  ]);

  const handleRemoveClip = useCallback(
    (index: number) => {
      const next = [...timelineClips];
      next.splice(index, 1);
      const nextIndex = Math.min(selectedIndex, Math.max(0, next.length - 1));
      commitClips(next, {
        selectedIndex: nextIndex,
        playheadSec: next.length > 0 ? playheadSec : 0,
      });
      stopSequence();
    },
    [timelineClips, selectedIndex, playheadSec, commitClips, stopSequence],
  );

  const handleMoveClip = useCallback(
    (index: number, dir: -1 | 1) => {
      reorderClips(index, index + dir);
    },
    [reorderClips],
  );

  const handleClearAll = useCallback(() => {
    historyRef.current.push(makeSnapshot());
    updateNodeData(nodeId, timelineClipsToNodePatch([]));
    setPlayheadSec(0);
    setSeekInClipSec(0);
    setSelectedIndex(0);
    stopSequence();
    setOutputReady(false);
    setStatus("");
    setHistoryVersion((v) => v + 1);
  }, [makeSnapshot, nodeId, updateNodeData, stopSequence]);

  const handleOutputChange = useCallback(
    (value: string) => {
      updateNodeData(nodeId, { output: value });
      setOutputReady(false);
    },
    [nodeId, updateNodeData],
  );

  const exportFormat = useMemo(
    () => resolveExportFormat(nodeData, output),
    [nodeData, output],
  );

  const setExportFormat = useCallback(
    (format: TimelineExportFormat) => {
      updateNodeData(nodeId, {
        output: applyExportFormatToPath(output, format),
        exportFormat: format,
      });
      setOutputReady(false);
    },
    [output, nodeId, updateNodeData],
  );

  const exportEncode = useMemo(() => normalizeExportEncode(nodeData), [nodeData]);

  const setExportEncode = useCallback(
    (next: TimelineExportEncodeSettings) => {
      updateNodeData(nodeId, { exportEncode: next });
      setOutputReady(false);
    },
    [nodeId, updateNodeData],
  );

  const handleConcat = useCallback(async () => {
    if (!projectPath || timelineClips.length === 0) return;

    setRunning(true);
    setStatus("正在导出成片…");
    setOutputReady(false);

    try {
      const payload = clipsToRenderPayload(timelineClips, durations);
      const result = await invoke<string>("render_timeline", {
        projectPath,
        clips: payload,
        outputRelPath: output,
        encodeOptions: exportEncodeToInvokePayload(exportEncode) ?? null,
        exportFormat,
      });
      setStatus(`完成：${result}`);
      setOutputReady(true);
      setPreviewMode("output");
      const patch = await patchComposeNodeAfterExport(projectPath, result);
      updateNodeData(nodeId, patch);
      setStatusText("剪辑导出完成");
    } catch (e) {
      setStatus(`失败：${String(e)}`);
    } finally {
      setRunning(false);
    }
  }, [
    projectPath,
    timelineClips,
    durations,
    output,
    exportEncode,
    exportFormat,
    nodeId,
    updateNodeData,
    setStatusText,
  ]);

  const locateSourceForIndex = useCallback(
    (index: number) => {
      const clip = timelineClips[index];
      const sourceId = clip?.sourceNodeId;
      if (!sourceId) {
        setStatusText("未找到该片段的上游节点");
        return;
      }
      selectNodesByIds([sourceId]);
      useCanvasUiStore.getState().requestCanvasFitToNode(sourceId);
      setStatusText("已定位到上游视频节点");
    },
    [timelineClips, selectNodesByIds, setStatusText],
  );

  const toggleSequencePlay = useCallback(() => {
    if (sequencePlaying) {
      stopSequence();
      return;
    }
    if (timelineClips.length === 0) return;
    setPreviewMode("clip");
    setSequencePlaying(true);
    if (previewMode === "output") {
      selectClip(0, 0);
    }
    const v = videoRef.current;
    if (v) {
      void v.play();
      setPreviewPlaying(true);
    }
  }, [sequencePlaying, stopSequence, timelineClips.length, previewMode, selectClip]);

  const handleClipEnded = useCallback(() => {
    if (!sequencePlaying) return;
    const next = selectedIndex + 1;
    if (next >= timelineClips.length) {
      stopSequence();
      return;
    }
    selectClip(next, 0);
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (v) {
        void v.play();
        setPreviewPlaying(true);
      }
    });
  }, [sequencePlaying, selectedIndex, timelineClips.length, stopSequence, selectClip]);

  const handlePlaybackTime = useCallback(
    (currentInClip: number) => {
      const seg = segments.find((s) => s.index === selectedIndex);
      if (!seg) return;
      setPlayheadSec(seg.startSec + Math.max(0, currentInClip - seg.inSec));
    },
    [segments, selectedIndex],
  );

  const setVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
  }, []);

  const registerDuration = useCallback((relPath: string, sec: number) => {
    if (!relPath || !Number.isFinite(sec) || sec <= 0) return;
    setDurations((prev) => (prev[relPath] === sec ? prev : { ...prev, [relPath]: sec }));
  }, []);

  const selectedTimelineClip = timelineClips[selectedIndex] ?? null;
  const selectedClip = selectedTimelineClip?.relPath ?? null;
  const hasInputs = timelineClips.length > 0;
  const canConcat = hasInputs && !running && !refreshing && Boolean(projectPath);
  const canPreviewOutput = Boolean(outputPath);

  return {
    timelineClips,
    inputs: timelineClips.map((c) => c.relPath),
    output,
    exportFormat,
    setExportFormat,
    exportEncode,
    setExportEncode,
    outputPath,
    status,
    running,
    outputReady,
    refreshing,
    selectedIndex,
    selectClip,
    previewMode,
    setPreviewMode,
    durations,
    registerDuration,
    segments,
    totalSec,
    totalWidthPx,
    playheadSec,
    seekToGlobalSec,
    sequencePlaying,
    toggleSequencePlay,
    stopSequence,
    seekInClipSec,
    setVideoElement,
    handleClipEnded,
    handlePlaybackTime,
    selectedClip,
    selectedTimelineClip,
    hasInputs,
    canConcat,
    canPreviewOutput,
    handleRefreshFromEdges,
    handleRefreshFromScript,
    scriptNodeIdForCompose,
    handleRemoveClip,
    handleMoveClip,
    handleClearAll,
    handleOutputChange,
    handleConcat,
    reorderClips,
    locateSourceForIndex,
    previewPlaying,
    togglePreviewPlay,
    setPreviewPlayingState,
    timelineZoom,
    setTimelineZoom,
    timelineSnapEnabled,
    setTimelineSnapEnabled,
    pxPerSec,
    undo,
    redo,
    canUndo,
    canRedo,
    handleSplitAtPlayhead,
    handleTrimIn,
    handleTrimOut,
    canSplit,
    canTrimIn,
    canTrimOut,
    handleTrimDragStart,
    handleTrimDrag,
    handleTrimDragEnd,
  };
}
