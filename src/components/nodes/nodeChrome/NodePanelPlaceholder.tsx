import { memo, type ReactNode } from "react";
import {
  IconMenuAudio,
  IconMenuFfmpeg,
  IconMenuImage,
  IconMenuLlm,
  IconMenuScript,
  IconMenuText,
  IconMenuVideo,
} from "@/components/canvas/canvasMenuNodeIcons";

export type NodePanelPlaceholderKind =
  | "textNode"
  | "imageNode"
  | "videoNode"
  | "audioNode"
  | "scriptNode"
  | "ffmpegConcat"
  | "llm";

const ICON_BY_KIND: Record<NodePanelPlaceholderKind, (props: { size?: number }) => ReactNode> = {
  textNode: IconMenuText,
  imageNode: IconMenuImage,
  videoNode: IconMenuVideo,
  audioNode: IconMenuAudio,
  scriptNode: IconMenuScript,
  ffmpegConcat: IconMenuFfmpeg,
  llm: IconMenuLlm,
};

/** 节点主面板空态占位图（与添加节点菜单图标一致） */
function NodePanelPlaceholder({ kind }: { kind: NodePanelPlaceholderKind }) {
  const Icon = ICON_BY_KIND[kind];
  return (
    <div className="nodePanelPlaceholderIcon" aria-hidden>
      <Icon size={24} />
    </div>
  );
}

export { NodePanelPlaceholder };
export const NodePanelPlaceholderMemo = memo(NodePanelPlaceholder);
