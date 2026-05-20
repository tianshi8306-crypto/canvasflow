import { useMemo } from "react";
import { AudioTtsPanel } from "@/components/nodes/AudioTtsPanel";
import { VideoMultimodalInputPanel } from "@/components/nodes/VideoMultimodalInputPanel";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { useFocusLinkedPartnerNode } from "@/hooks/canvas/useFocusLinkedPartnerNode";
import { buildTextPromptFromScriptBinding } from "@/lib/incomingScriptBinding";
import { useProjectStore } from "@/store/projectStore";

export type TextNodeTextToVideoPanelProps = {
  /** 关联的视频节点；有值时渲染与视频节点相同的 Chrome 底栏 */
  videoNodeId?: string;
};

/**
 * 文生视频工作流底栏（Chrome C3：薄包装，复用 VideoMultimodalInputPanel）
 * @deprecated 文本节点请优先使用 `VideoGenerationPanelPortal`；保留供最大化浮层等场景
 */
export function TextNodeTextToVideoPanel({ videoNodeId }: TextNodeTextToVideoPanelProps) {
  if (!videoNodeId) {
    return (
      <div className={`textNodeWorkflowStub ${RF_NODE_INPUT_CLASS}`}>
        <p className="textNodeWorkflowStubLead">请从锚点连接视频节点</p>
        <p className="textNodeWorkflowStubHint">连接后此处显示与视频节点一致的文生视频面板。</p>
      </div>
    );
  }

  return (
    <div
      className="textNodeTtvChromeWrap"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <VideoMultimodalInputPanel videoNodeId={videoNodeId} layout="portal" />
    </div>
  );
}

/**
 * 文字生音乐：复用音频节点 TTS 面板
 * @deprecated 文本节点已改用 `TextComposerPanel` layout=textToMusic；保留供其它入口复用
 */
export function TextNodeTextToMusicPanel({ audioNodeId }: { audioNodeId?: string }) {
  if (!audioNodeId) {
    return (
      <div className={`textNodeWorkflowStub ${RF_NODE_INPUT_CLASS}`}>
        <p className="textNodeWorkflowStubLead">请从锚点连接音频节点</p>
        <p className="textNodeWorkflowStubHint">连接后使用与音频节点相同的 TTS 配置面板。</p>
      </div>
    );
  }

  return (
    <div
      className={`textNodeTtmChromeWrap ${RF_NODE_INPUT_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="textNodeTtmChromeHint">
        使用关联音频节点的 TTS 配置；正文仍保存在文本节点。
      </div>
      <AudioTtsPanel nodeId={audioNodeId} />
    </div>
  );
}

/** 脚本→文本：底部同步面板（精简 Chrome 皮肤） */
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
  const { focusPartnerNode } = useFocusLinkedPartnerNode();

  const scriptLabel = useMemo(() => {
    if (!scriptNodeId) return null;
    const n = nodes.find((x) => x.id === scriptNodeId);
    return (n?.data.label ?? "脚本节点").toString();
  }, [nodes, scriptNodeId]);

  const syncedContent = useMemo(
    () => (scriptNodeId ? buildTextPromptFromScriptBinding(nodes, edges, textNodeId) : null),
    [nodes, edges, textNodeId, scriptNodeId],
  );

  const handleSync = () => {
    if (!syncedContent?.trim()) {
      setStatusText("未能从上游脚本节点获取内容");
      return;
    }
    updateNodeData(textNodeId, { prompt: syncedContent });
    setStatusText("已从脚本同步内容到文本节点");
  };

  return (
    <div
      className={`textNodeScriptSyncPanel textGenPanel--chrome ${RF_NODE_INPUT_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="textNodeScriptSyncRow">
        <span className="textNodeScriptSyncLabel">脚本 → 正文</span>
        <div className="textNodeScriptSyncActions">
          {scriptNodeId ? (
            <button
              type="button"
              className="tgp-partner-focusBtn textNodeScriptSyncLocateBtn"
              onClick={() => {
                void focusPartnerNode(scriptNodeId, {
                  kind: "default",
                  label: scriptLabel ?? undefined,
                });
              }}
            >
              定位脚本
            </button>
          ) : null}
          <button
            type="button"
            className="btn textNodeScriptSyncBtn"
            disabled={!syncedContent?.trim()}
            onClick={handleSync}
          >
            从脚本同步
          </button>
        </div>
      </div>
      <p className="textNodeScriptSyncHint">
        {syncedContent?.trim()
          ? `可同步约 ${syncedContent.length} 字到节点正文`
          : "请连接上游脚本节点或选择分镜后再同步"}
      </p>
    </div>
  );
}
