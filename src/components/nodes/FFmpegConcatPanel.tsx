/**
 * FFmpegConcatPanel - 视频合成节点的面板组件
 */

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useMemo, useState } from "react";
import { TtvVideoRefThumb } from "@/components/nodes/TtvVideoRefThumb";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { collectClipRelPaths, DEFAULT_EXPORT_PATH } from "@/lib/compose";
import { useProjectStore } from "@/store/projectStore";

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
    <div className="ffmpegClipItem">
      <div className="ffmpegClipIndex">
        <span>{index + 1}</span>
      </div>
      <div className="ffmpegClipThumb">
        <TtvVideoRefThumb relPath={path} />
      </div>
      <div className="ffmpegClipName mono" title={path}>
        {path.split("/").pop() ?? path}
      </div>
      <div className="ffmpegClipReorder">
        <button
          type="button"
          className="ffmpegClipReorderBtn"
          onClick={onMoveUp}
          disabled={index === 0}
          title="上移"
        >
          <IconChevronUp />
        </button>
        <button
          type="button"
          className="ffmpegClipReorderBtn"
          onClick={onMoveDown}
          disabled={index >= total - 1}
          title="下移"
        >
          <IconChevronDown />
        </button>
      </div>
      <button
        type="button"
        className="ffmpegClipRemove"
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

  const inputs: string[] = useMemo(() => nodeData.inputs ?? [], [nodeData.inputs]);
  const output: string = useMemo(
    () => nodeData.output?.trim() || DEFAULT_EXPORT_PATH,
    [nodeData.output],
  );

  const setInputs = useCallback(
    (next: string[]) => {
      updateNodeData(nodeId, { inputs: next });
    },
    [nodeId, updateNodeData],
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
        setInputs(paths);
        setStatus(paths.length > 0 ? `已刷新 ${paths.length} 个片段` : "未检测到可合成的上游视频");
        setOutputReady(false);
      } catch (e) {
        setStatus(`刷新失败：${String(e)}`);
      } finally {
        setRefreshing(false);
      }
    },
    [projectPath, nodeId, nodes, edges, setInputs],
  );

  const handleRemoveClip = useCallback(
    (index: number) => {
      const next = [...inputs];
      next.splice(index, 1);
      setInputs(next);
      setOutputReady(false);
    },
    [inputs, setInputs],
  );

  const handleMoveClip = useCallback(
    (index: number, dir: -1 | 1) => {
      const target = index + dir;
      if (target < 0 || target >= inputs.length) return;
      const next = [...inputs];
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      setInputs(next);
      setOutputReady(false);
    },
    [inputs, setInputs],
  );

  const handleClearAll = useCallback(() => {
    setInputs([]);
    setOutputReady(false);
    setStatus("");
  }, [setInputs]);

  const handleOutputChange = useCallback(
    (value: string) => {
      updateNodeData(nodeId, { output: value });
      setOutputReady(false);
    },
    [nodeId, updateNodeData],
  );

  const handleConcat = useCallback(async () => {
    if (!projectPath || inputs.length === 0) return;

    setRunning(true);
    setStatus("正在导出成片…");
    setOutputReady(false);

    try {
      const result = await invoke<string>("render_timeline", {
        projectPath,
        clips: inputs,
        outputRelPath: output,
      });
      setStatus(`完成：${result}`);
      setOutputReady(true);
      updateNodeData(nodeId, { output: result, path: result });
    } catch (e) {
      setStatus(`失败：${String(e)}`);
    } finally {
      setRunning(false);
    }
  }, [projectPath, inputs, output, nodeId, updateNodeData]);

  const hasInputs = inputs.length > 0;
  const canConcat = hasInputs && !running && !refreshing && Boolean(projectPath);

  return (
    <div className={`ffmpegPanel ${RF_NODE_INPUT_CLASS}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="ffmpegPanelHead">
        <div className="ffmpegPanelTitle">
          <IconVideo />
          <span>视频合成</span>
        </div>
        <div className="ffmpegPanelMeta">
          <span className="mono">{inputs.length} 个片段</span>
        </div>
      </div>

      <div className="ffmpegClipList">
        {inputs.length === 0 ? (
          <div className="ffmpegClipEmpty">
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

      <div className="ffmpegRefreshRow">
        <button
          type="button"
          className="ffmpegActionBtn ffmpegActionBtn--secondary"
          onClick={() => void handleRefreshFromEdges(false)}
          disabled={!projectPath || refreshing || running}
          title="从左侧连线收集视频路径"
        >
          <IconRefresh />
          <span>从连线刷新</span>
        </button>
        <button
          type="button"
          className="ffmpegActionBtn ffmpegActionBtn--secondary"
          onClick={() => void handleRefreshFromEdges(true)}
          disabled={!projectPath || refreshing || running}
          title="刷新并按脚本镜号排序"
        >
          <span>按脚本排序</span>
        </button>
      </div>

      <div className="ffmpegOutputSection">
        <div className="ffmpegOutputRow">
          <label className="ffmpegOutputLabel">输出路径</label>
          <input
            type="text"
            className="ffmpegOutputInput mono"
            value={output}
            onChange={(e) => handleOutputChange(e.target.value)}
            placeholder={DEFAULT_EXPORT_PATH}
          />
        </div>
      </div>

      <div className="ffmpegActions">
        <button
          type="button"
          className="ffmpegActionBtn ffmpegActionBtn--secondary"
          onClick={handleClearAll}
          disabled={!hasInputs || running}
          title="清空所有片段"
        >
          <IconTrash />
          <span>清空</span>
        </button>

        <button
          type="button"
          className={`ffmpegActionBtn ffmpegActionBtn--primary ${running ? "ffmpegActionBtn--running" : ""}`}
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
        <div className={`ffmpegStatus ${outputReady ? "ffmpegStatus--success" : ""}`}>{status}</div>
      ) : null}
    </div>
  );
}
