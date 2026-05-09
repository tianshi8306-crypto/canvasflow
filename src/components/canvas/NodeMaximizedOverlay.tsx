import { useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { ImageGenerationPanel } from "@/components/nodes/ImageGenerationPanel";
import { AudioTtsPanel } from "@/components/nodes/AudioTtsPanel";
import { TextNodeTextToVideoPanel } from "@/components/nodes/TextNodeWorkflowPanels";
import { ScriptNodeWorkbench } from "@/components/ScriptNodeWorkbench";
import { ScriptStoryboardSection } from "@/components/ScriptStoryboardSection";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { getIncomingImageRefForNode } from "@/lib/incomingImageReference";

/**
 * 右键双击节点：在当前画布内最大化展示节点对应 Agent 工作区，并与节点数据双向同步。
 */
export function NodeMaximizedOverlay() {
  const maximizedNodeId = useCanvasUiStore((s) => s.maximizedNodeId);
  const setMaximizedNodeId = useCanvasUiStore((s) => s.setMaximizedNodeId);
  const subjectListVersion = useCanvasUiStore((s) => s.subjectListVersion);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);

  const node = maximizedNodeId ? nodes.find((n) => n.id === maximizedNodeId) : undefined;
  const incomingImageRef =
    node?.type === "imageNode" && maximizedNodeId
      ? getIncomingImageRefForNode(nodes, edges, maximizedNodeId)
      : undefined;

  useEffect(() => {
    if (!maximizedNodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMaximizedNodeId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximizedNodeId, setMaximizedNodeId]);

  if (!maximizedNodeId || !node) return null;

  return (
    <div
      className="nodeMaxOverlay"
      role="dialog"
      aria-modal
      aria-label="节点最大化编辑"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setMaximizedNodeId(null);
      }}
    >
      <div className={`nodeMaxOverlayCard ${RF_NODE_INPUT_CLASS}`} onPointerDown={(e) => e.stopPropagation()}>
        <div className="nodeMaxOverlayHead">
          <span className="nodeMaxOverlayTitle mono">
            {node.type === "imageNode" && "图片节点"}
            {node.type === "videoNode" && "视频节点"}
            {node.type === "audioNode" && "音频节点"}
            {node.type === "textNode" && "文本节点"}
            {node.type === "scriptNode" && "脚本节点"}
            {![
              "imageNode",
              "videoNode",
              "audioNode",
              "textNode",
              "scriptNode",
            ].includes(node.type ?? "") && "节点"}
          </span>
          <button
            type="button"
            className="nodeMaxOverlayClose"
            onClick={() => setMaximizedNodeId(null)}
            title="关闭 (Esc)"
          >
            ✕
          </button>
        </div>
        <div className="nodeMaxOverlayBody">
          {node.type === "imageNode" ? (
            <ImageGenerationPanel
              nodeId={node.id}
              referenceImagePath={incomingImageRef?.path}
              referenceImageAssetId={incomingImageRef?.assetId}
              subjectListVersion={subjectListVersion}
            />
          ) : node.type === "audioNode" ? (
            <AudioTtsPanel nodeId={node.id} />
          ) : node.type === "videoNode" ? (
            <TextNodeTextToVideoPanel videoNodeId={node.id} />
          ) : node.type === "textNode" ? (
            <div className="nodeMaxOverlayStack">
              <div className="nodeMaxOverlayHint">
                上方节点主体承载记忆与资产；此处是文本 Agent 的执行输入区（实时回写节点）。
              </div>
              <textarea
                className="nodeMaxOverlayTextarea"
                placeholder="输入文本 Agent 的上下文与任务意图…"
                value={node.data.prompt ?? ""}
                onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
              />
            </div>
          ) : node.type === "scriptNode" ? (
            <div className="nodeMaxOverlayStack">
              <div className="field">
                <label>剧情主题 / 一句话梗概（脚本 Agent 记忆体）</label>
                <textarea
                  className="nodeMaxOverlayTextarea"
                  rows={4}
                  value={node.data.prompt ?? ""}
                  onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
                  placeholder="输入剧情主题、角色关系与风格约束，供脚本生成与分镜决策使用…"
                />
              </div>
              <ScriptNodeWorkbench
                nodeId={node.id}
                beats={node.data.scriptBeats ?? []}
                storedSelection={node.data.scriptBeatSelection}
                themePrompt={node.data.prompt ?? ""}
              />
              <ScriptStoryboardSection
                nodeId={node.id}
                beats={node.data.scriptBeats ?? []}
                scriptBeatSelection={node.data.scriptBeatSelection}
                shots={node.data.storyboardShots}
                themePrompt={node.data.prompt ?? ""}
              />
            </div>
          ) : (
            <div className="nodeMaxOverlayPlaceholder">该类型节点暂不支持最大化预览</div>
          )}
        </div>
      </div>
    </div>
  );
}
