/**
 * 脚本节点 - 主流节点编辑器风格
 * 参考 docs/node-ui-spec/README.md 规范实现
 */
import { useState, useRef, useCallback, useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { MentionInput } from "./MentionInput";
import { SlashPresetPanel } from "./SlashPresetPanel";
import type { MentionInputRef } from "./MentionInput";

interface ScriptNodeProps {
  id: string;
  data: FlowNodeData;
}

export function ScriptNode({ id, data }: ScriptNodeProps) {
  const [prompt, setPrompt] = useState(data.prompt ?? "");
  const [hasContent] = useState(Boolean(data.scriptBeats?.length));
  const [slashCursorRect, setSlashCursorRect] = useState<DOMRect | null>(null);
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
          <button className="script-node-btn">生成</button>
          <button className="script-node-btn">解析</button>
          <button className="script-node-btn">展开</button>
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
