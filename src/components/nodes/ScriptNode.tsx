/**
 * 脚本节点 - 主流节点编辑器风格
 * 参考 docs/node-ui-spec/README.md 规范实现
 *
 * 按钮功能说明：
 * - 生成: 调用 scriptNodeDispatchAgentRuntime 解析脚本为镜头
 * - 解析: 调用 scriptStoryboardGenerateAgentRuntime 生成分镜文案
 * - 展开: 调用 openScriptFullscreen 打开全屏编辑工作台
 */
import { useState, useRef, useCallback, useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { MentionInput } from "./MentionInput";
import { SlashPresetPanel } from "./SlashPresetPanel";
import type { MentionInputRef } from "./MentionInput";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { scriptNodeDispatchAgentRuntime } from "@/lib/nodeAgentRuntime/dagnodeDispatchAgents";
import { scriptStoryboardGenerateAgentRuntime } from "@/lib/nodeAgentRuntime/scriptStoryboardAgent";
import { useProjectStore } from "@/store/projectStore";

interface ScriptNodeProps {
  id: string;
  data: FlowNodeData;
}

export function ScriptNode({ id, data }: ScriptNodeProps) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const openScriptFullscreen = useProjectStore((s) => s.openScriptFullscreen);
  const runNodeSubgraph = useProjectStore((s) => s.runNodeSubgraph);
  const projectPath = useProjectStore((s) => s.projectPath);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const isGraphRunning = useProjectStore((s) => s.isGraphRunning);

  const [prompt, setPrompt] = useState(data.prompt ?? "");
  const [hasContent] = useState(Boolean(data.scriptBeats?.length));
  const [slashCursorRect, setSlashCursorRect] = useState<DOMRect | null>(null);
  const [busy, setBusy] = useState<null | "generate" | "storyboard">(null);
  const mentionRef = useRef<MentionInputRef>(null);

  const nodeLabels = useMemo(
    () => ({ [id]: data.label ?? id }),
    [id, data.label],
  );

  const handleSlashTrigger = useCallback((rect: DOMRect) => {
    setSlashCursorRect(rect);
  }, []);

  const handlePresetSelect = useCallback((template: string) => {
    mentionRef.current?.insertPresetTemplate(template);
    setSlashCursorRect(null);
  }, []);

  // 生成: 解析脚本为镜头
  const handleGenerate = useCallback(() => {
    const promptText = prompt.trim();
    if (!promptText) {
      setStatusText("请先输入剧情主题或脚本约束");
      return;
    }
    if (!projectPath) {
      setStatusText("请先新建或打开工程目录");
      return;
    }
    if (isGraphRunning) {
      setStatusText("当前有任务正在执行，请稍候");
      return;
    }
    void (async () => {
      setBusy("generate");
      try {
        // 先将 prompt 回写到节点数据
        updateNodeData(id, { prompt: promptText });
        await runNodeTaskAgent(
          scriptNodeDispatchAgentRuntime,
          { prompt: promptText, dispatch: runNodeSubgraph },
          { nodeId: id, projectPath, updateNodeData, setStatusText },
        );
      } finally {
        setBusy(null);
      }
    })();
  }, [prompt, projectPath, isGraphRunning, id, updateNodeData, runNodeSubgraph, setStatusText]);

  // 展开: 打开全屏编辑工作台
  const handleExpand = useCallback(() => {
    openScriptFullscreen(id);
  }, [id, openScriptFullscreen]);

  // 解析: 生成分镜文案
  const handleStoryboard = useCallback(() => {
    const beats = data.scriptBeats ?? [];
    if (beats.length === 0) {
      setStatusText("请先生成脚本镜头后再生成分镜");
      return;
    }
    if (!projectPath) {
      setStatusText("请先新建或打开工程目录");
      return;
    }
    if (isGraphRunning) {
      setStatusText("当前有任务正在执行，请稍候");
      return;
    }
    void (async () => {
      setBusy("storyboard");
      try {
        await runNodeTaskAgent(
          scriptStoryboardGenerateAgentRuntime,
          { targetBeats: beats, themePrompt: data.prompt ?? "", prevShots: data.storyboardShots },
          { nodeId: id, projectPath, updateNodeData, setStatusText },
        );
      } finally {
        setBusy(null);
      }
    })();
  }, [data.scriptBeats, data.prompt, data.storyboardShots, projectPath, isGraphRunning, id, updateNodeData, setStatusText]);

  return (
    <div className="script-node-container">
      {/* 左侧输入锚点 */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="script-handle-left"
      />

      {/* 脚本内容区 */}
      <div className="script-node-content">
        {/* 头部标签 */}
        <div className="script-node-header">
          <span className="script-node-title">脚本</span>
          {hasContent && <span className="script-node-badge">已生成</span>}
        </div>

        {/* 脚本预览/输入区 */}
        <div className="script-node-body">
          {hasContent ? (
            <div className="script-node-preview">
              <span className="script-node-preview-text">
                {data.prompt?.slice(0, 100) || "脚本内容..."}
              </span>
              <span className="script-node-beats-count">
                {data.scriptBeats?.length || 0} 个镜头
              </span>
            </div>
          ) : (
            <div className="script-node-mention-wrapper">
              <MentionInput
                ref={mentionRef}
                nodeId={id}
                value={prompt}
                onChange={setPrompt}
                onSlashTrigger={handleSlashTrigger}
                placeholder="输入脚本内容或生成要求..."
                nodeLabels={nodeLabels}
              />
              {slashCursorRect && (
                <SlashPresetPanel
                  cursorRect={slashCursorRect}
                  onSelect={handlePresetSelect}
                  onClose={() => setSlashCursorRect(null)}
                />
              )}
            </div>
          )}
        </div>

        {/* 工具栏 */}
        <div className="script-node-toolbar">
          <button
            className="script-node-btn"
            onClick={handleGenerate}
            disabled={busy !== null}
            title="解析输入为镜头"
          >
            {busy === "generate" ? "生成中…" : "生成"}
          </button>
          <button
            className="script-node-btn"
            onClick={handleStoryboard}
            disabled={busy !== null}
            title="生成分镜文案"
          >
            {busy === "storyboard" ? "解析中…" : "解析"}
          </button>
          <button
            className="script-node-btn"
            onClick={handleExpand}
            disabled={busy !== null}
            title="展开为全屏编辑工作台"
          >
            展开
          </button>
        </div>
      </div>

      {/* 右侧输出锚点 */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="script-handle-right"
      />
    </div>
  );
}
