/**
 * FFmpegConcatPanel - 视频合成节点的面板组件
 */

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useMemo, useState } from "react";
import { TtvVideoRefThumb } from "@/components/nodes/TtvVideoRefThumb";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import {
  clipsToRenderPayload,
  collectClipRelPaths,
  composeClipToTimeline,
  applyExportFormatToPath,
  DEFAULT_EXPORT_PATH,
  resolveExportFormat,
  normalizeTimelineClips,
  TIMELINE_EXPORT_FORMATS,
  patchComposeNodeAfterExport,
  timelineClipsToNodePatch,
} from "@/lib/compose";
import { ComposeEditorExportSettings } from "@/components/compose/ComposeEditorExportSettings";
import {
  exportEncodeToInvokePayload,
  normalizeExportEncode,
  type TimelineExportEncodeSettings,
} from "@/lib/compose/timelineExportEncode";
import type { TimelineExportFormat } from "@/lib/compose/timelineExportFormat";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./FFmpegConcatPanel.css";

export interface FFmpegConcatPanelProps {
  nodeId: string;
}

function IconVideo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 9.5L15 12l-5 2.5V9.5Z" fill="currentColor"/>
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12a8 8 0 018-8c3.2 0 6 1.9 7.3 4.6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M20 12a8 8 0 01-8 8c-3.2 0-6-1.9-7.3-4.6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M15 3h6v6M9 21H3v-6" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

interface ClipItemProps {
  index: number;
  path: string;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ClipItem({ index, path, total, onRemove, onMoveUp, onMoveDown }: ClipItemProps) {
  return (
    <div className="fcp-clip-item">
      <div className="fcp-clip-index">
        <span>{index + 1}</span>
      </div>
      <div className="fcp-clip-thumb">
        <TtvVideoRefThumb relPath={path} />
      </div>
      <div className="fcp-clip-name mono" title={path}>
        {path.split("/").pop() ?? path}
      </div>
      <div className="fcp-clip-reorder">
        <button
          type="button"
          className="fcp-clip-reorder-btn"
          onClick={onMoveUp}
          disabled={index === 0}
          title="上移"
        >
          <IconChevronUp />
        </button>
        <button
          type="button"
          className="fcp-clip-reorder-btn"
          onClick={onMoveDown}
          disabled={index >= total - 1}
          title="下移"
        >
          <IconChevronDown />
        </button>
      </div>
      <button
        type="button"
        className="fcp-clip-remove"
        onClick={onRemove}
        title="移除此片段"
      >
        <IconTrash />
      </button>
    </div>
  );
}

export function FFmpegConcatPanel({ nodeId }: FFmpegConcatPanelProps) {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const projectPath = useProjectStore((s) => s.projectPath);

  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const [outputReady, setOutputReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const nodeData = useMemo(() => nodes.find((n) => n.id === nodeId)?.data ?? {}, [nodes, nodeId]);

  const timelineClips = useMemo(() => normalizeTimelineClips(nodeData), [nodeData]);
  const inputs: string[] = useMemo(
    () => timelineClips.map((c) => c.relPath),
    [timelineClips],
  );
  const output: string = useMemo(
    () => nodeData.output?.trim() || DEFAULT_EXPORT_PATH,
    [nodeData.output],
  );
  const exportFormat = useMemo(
    () => resolveExportFormat(nodeData, output),
    [nodeData, output],
  );
  const exportEncode = useMemo(() => normalizeExportEncode(nodeData), [nodeData]);

  const setClipsFromPaths = useCallback(
    (paths: string[]) => {
      const prevByPath = new Map(timelineClips.map((c) => [c.relPath, c]));
      const next = paths.map((relPath) => {
        const existing = prevByPath.get(relPath);
        return existing ?? composeClipToTimeline({ sourceNodeId: "", relPath });
      });
      updateNodeData(nodeId, timelineClipsToNodePatch(next));
    },
    [nodeId, timelineClips, updateNodeData],
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
        const paths = await collectClipRelPaths(nodeId, nodes, edges, projectPath, {
          sortByScript,
        });
        setClipsFromPaths(paths);
        setStatus(paths.length > 0 ? `已刷新 ${paths.length} 个片段` : "未检测到可合成的上游视频");
        setOutputReady(false);
      } catch (e) {
        setStatus(`刷新失败：${String(e)}`);
      } finally {
        setRefreshing(false);
      }
    },
    [projectPath, nodeId, nodes, edges, setClipsFromPaths],
  );

  const handleRemoveClip = useCallback(
    (index: number) => {
      const next = [...timelineClips];
      next.splice(index, 1);
      updateNodeData(nodeId, timelineClipsToNodePatch(next));
      setOutputReady(false);
    },
    [timelineClips, nodeId, updateNodeData],
  );

  const handleMoveClip = useCallback(
    (index: number, dir: -1 | 1) => {
      const target = index + dir;
      if (target < 0 || target >= timelineClips.length) return;
      const next = [...timelineClips];
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      updateNodeData(nodeId, timelineClipsToNodePatch(next));
      setOutputReady(false);
    },
    [timelineClips, nodeId, updateNodeData],
  );

  const handleClearAll = useCallback(() => {
    updateNodeData(nodeId, timelineClipsToNodePatch([]));
    setOutputReady(false);
    setStatus("");
  }, [nodeId, updateNodeData]);

  const handleOutputChange = useCallback(
    (value: string) => {
      updateNodeData(nodeId, {
        output: value,
        exportFormat: resolveExportFormat({ ...nodeData, output: value }, value),
      });
      setOutputReady(false);
    },
    [nodeId, nodeData, updateNodeData],
  );

  const handleFormatChange = useCallback(
    (format: TimelineExportFormat) => {
      updateNodeData(nodeId, {
        output: applyExportFormatToPath(output, format),
        exportFormat: format,
      });
      setOutputReady(false);
    },
    [nodeId, output, updateNodeData],
  );

  const handleExportEncodeChange = useCallback(
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
      const result = await invoke<string>("render_timeline", {
        projectPath,
        clips: clipsToRenderPayload(timelineClips, {}),
        outputRelPath: output,
        encodeOptions: exportEncodeToInvokePayload(exportEncode) ?? null,
        exportFormat,
      });
      setStatus(`完成：${result}`);
      setOutputReady(true);
      const patch = await patchComposeNodeAfterExport(projectPath, result);
      updateNodeData(nodeId, patch);
    } catch (e) {
      setStatus(`失败：${String(e)}`);
    } finally {
      setRunning(false);
    }
  }, [projectPath, timelineClips, output, exportEncode, exportFormat, nodeId, updateNodeData]);

  const hasInputs = inputs.length > 0;
  const canConcat = hasInputs && !running && !refreshing && Boolean(projectPath);

  return (
    <div
      className={`ffmpegConcatPanel--minimal-inner ${RF_NODE_INPUT_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="fcp-header-row">
        <div className="fcp-header-title">
          <IconVideo />
          <span>视频合成</span>
        </div>
        <div className="fcp-header-meta">
          <span className="mono">{inputs.length} 个片段</span>
        </div>
      </div>

      <div className="fcp-clip-list">
        {inputs.length === 0 ? (
          <div className="fcp-clip-empty">
            <span>连接已出片的视频节点后，点击「从连线刷新」</span>
          </div>
        ) : (
          inputs.map((path, idx) => (
            <ClipItem
              key={`${path}-${idx}`}
              index={idx}
              path={path}
              total={inputs.length}
              onRemove={() => handleRemoveClip(idx)}
              onMoveUp={() => handleMoveClip(idx, -1)}
              onMoveDown={() => handleMoveClip(idx, 1)}
            />
          ))
        )}
      </div>

      <div className="fcp-tool-row">
        <button
          type="button"
          className="fcp-btn"
          onClick={() => useCanvasUiStore.getState().setComposeEditorNodeId(nodeId)}
          title="打开全屏时间线剪辑"
        >
          <span>时间线编辑</span>
        </button>
        <button
          type="button"
          className="fcp-btn"
          onClick={() => void handleRefreshFromEdges(false)}
          disabled={!projectPath || refreshing || running}
          title="从左侧连线收集视频路径"
        >
          <IconRefresh />
          <span>从连线刷新</span>
        </button>
        <button
          type="button"
          className="fcp-btn"
          onClick={() => void handleRefreshFromEdges(true)}
          disabled={!projectPath || refreshing || running}
          title="刷新并按脚本镜号排序"
        >
          <span>按脚本排序</span>
        </button>
      </div>

      <div className="fcp-output-row">
        <label className="fcp-output-label" htmlFor={`fcp-output-${nodeId}`}>
          输出路径
        </label>
        <input
          id={`fcp-output-${nodeId}`}
          type="text"
          className="fcp-output-input mono"
          value={output}
          onChange={(e) => handleOutputChange(e.target.value)}
          placeholder={DEFAULT_EXPORT_PATH}
        />
        <select
          className="fcp-output-format"
          value={exportFormat}
          onChange={(e) => handleFormatChange(e.target.value as TimelineExportFormat)}
          disabled={running}
          aria-label="导出格式"
        >
          {TIMELINE_EXPORT_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.ext.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <ComposeEditorExportSettings
        format={exportFormat}
        encode={exportEncode}
        onChange={handleExportEncodeChange}
        disabled={running}
      />

      <div className="fcp-bottom-bar">
        <button
          type="button"
          className="fcp-btn"
          onClick={handleClearAll}
          disabled={!hasInputs || running}
          title="清空所有片段"
        >
          <IconTrash />
          <span>清空</span>
        </button>

        <button
          type="button"
          className={`fcp-btn fcp-btn--primary ${running ? "fcp-btn--running" : ""}`}
          onClick={() => void handleConcat()}
          disabled={!canConcat}
          title={canConcat ? "导出成片（FFmpeg 拼接）" : "请先添加视频片段"}
        >
          {running ? (
            <>
              <IconRefresh />
              <span>导出中…</span>
            </>
          ) : (
            <>
              <IconCheck />
              <span>导出成片</span>
            </>
          )}
        </button>
      </div>

      {status ? (
        <div className={`fcp-status ${outputReady ? "fcp-status--success" : ""}`}>{status}</div>
      ) : null}
    </div>
  );
}
