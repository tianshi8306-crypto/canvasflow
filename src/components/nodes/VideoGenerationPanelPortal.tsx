import { createPortal } from "react-dom";
import { useCallback, useMemo, type MutableRefObject, type RefObject } from "react";
import { NODE_CHROME_VIDEO_PANEL_CLASS } from "@/components/nodes/nodeChrome";
import {
  GEN_PANEL_CHROME_Z,
  useNodeGenerationChrome,
} from "@/hooks/useNodeGenerationChrome";
import { useFocusLinkedPartnerNode } from "@/hooks/canvas/useFocusLinkedPartnerNode";
import { VideoMultimodalInputPanel } from "@/components/nodes/VideoMultimodalInputPanel";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  nodeId: string;
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  panelRef?: RefObject<HTMLDivElement | null>;
  /** 文本节点托管 VGP 时显示「定位视频节点」 */
  showLocateVideoNode?: boolean;
};

/** 单选展开态：预览区下缘 Portal 渲染视频多模态生成面板 */
export function VideoGenerationPanelPortal({
  nodeId,
  anchorRef,
  active,
  panelRef: externalPanelRef,
  showLocateVideoNode = false,
}: Props) {
  const nodes = useProjectStore((s) => s.nodes);
  const { focusPartnerNode } = useFocusLinkedPartnerNode();
  const { pos, panelRef: innerPanelRef } = useNodeGenerationChrome(anchorRef, { active });

  const videoLabel = useMemo(() => {
    const n = nodes.find((x) => x.id === nodeId);
    return (n?.data.label ?? "视频节点").toString();
  }, [nodeId, nodes]);

  const setPanelRef = useCallback(
    (el: HTMLDivElement | null) => {
      (innerPanelRef as MutableRefObject<HTMLDivElement | null>).current = el;
      if (externalPanelRef) {
        (externalPanelRef as MutableRefObject<HTMLDivElement | null>).current = el;
      }
    },
    [innerPanelRef, externalPanelRef],
  );

  if (!active || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={setPanelRef}
      className={NODE_CHROME_VIDEO_PANEL_CLASS}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: "translateX(-50%)",
        zIndex: GEN_PANEL_CHROME_Z + 1,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {showLocateVideoNode ? (
        <div className="tgp-partner-linkRow tgp-partner-linkRow--video">
          <span className="tgp-partner-linkHint">文生视频 · 面板锚定在文本节点</span>
          <button
            type="button"
            className="tgp-partner-focusBtn"
            onClick={(e) => {
              e.stopPropagation();
              void focusPartnerNode(nodeId, { kind: "video", label: videoLabel });
            }}
          >
            定位视频节点
          </button>
        </div>
      ) : null}
      <VideoMultimodalInputPanel videoNodeId={nodeId} layout="portal" />
    </div>,
    document.body,
  );
}
