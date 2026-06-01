import type { Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { useCallback, type ReactNode, type SyntheticEvent } from "react";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { spawnNodeInView } from "@/lib/canvasSpawnNode";
import type { FlowNodeData } from "@/lib/types";
import { IconMenuImage, IconMenuText, IconMenuVideo } from "@/components/canvas/canvasMenuNodeIcons";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

function IconDblClick() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="canvasEmptyGuideDblIcon">
      <path
        d="M5 19l5-14 4 8 3-5 2 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

const IconText = () => <IconMenuText size={20} />;
const IconImage = () => <IconMenuImage size={20} />;
const IconVideo = () => <IconMenuVideo size={20} />;

function makeNode(type: string, data: FlowNodeData): Node<FlowNodeData> {
  return {
    id: crypto.randomUUID(),
    position: { x: 0, y: 0 },
    type,
    data,
  };
}

type QuickAction = {
  id: string;
  label: string;
  icon: ReactNode;
  nodeType: string;
  factory: () => FlowNodeData;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "text", label: "生文本", icon: <IconText />, nodeType: "textNode", factory: newNodeDataByType.textNode },
  { id: "image", label: "生图像", icon: <IconImage />, nodeType: "imageNode", factory: newNodeDataByType.imageNode },
  { id: "video", label: "生视频", icon: <IconVideo />, nodeType: "videoNode", factory: newNodeDataByType.videoNode },
];

export function CanvasEmptyGuide() {
  const addNode = useProjectStore((s) => s.addNode);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const { screenToFlowPosition } = useReactFlow();

  const dismissEmptyGuide = useCanvasUiStore((s) => s.dismissEmptyGuide);

  const addAtCenter = useCallback(
    (nodeType: string, factory: () => FlowNodeData) => {
      dismissEmptyGuide();
      spawnNodeInView(() => makeNode(nodeType, factory()), {
        screenToFlowPosition,
        addNode,
        getExistingNodes: () => useProjectStore.getState().nodes,
        yRatio: 0.5,
      });
      setStatusText("已添加节点");
    },
    [addNode, dismissEmptyGuide, screenToFlowPosition, setStatusText],
  );

  const stopPane = (e: SyntheticEvent) => e.stopPropagation();

  return (
    <div className="canvasEmptyGuide" role="region" aria-label="画布空态引导">
      <div className="canvasEmptyGuideHero">
        <span className="canvasEmptyGuideDblPill" aria-hidden>
          <IconDblClick />
          双击
        </span>
        <p className="canvasEmptyGuideLead">画布自由创建，或双击空白打开添加面板</p>
      </div>
      <div className="canvasEmptyGuideActions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            className="canvasEmptyGuideAction"
            onClick={(e) => {
              stopPane(e);
              addAtCenter(action.nodeType, action.factory);
            }}
            onDoubleClick={stopPane}
          >
            <span className="canvasEmptyGuideActionIcon">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
      <p className="canvasEmptyGuideFoot">拖入媒体 · 左侧 + 添加 · Space 拖拽平移</p>
    </div>
  );
}
