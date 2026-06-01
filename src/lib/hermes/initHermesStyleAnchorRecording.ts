import { agentKindFromName } from "@/lib/hermes/hermesTaskTrack";
import {
  recordStyleAnchorFromImageNode,
  recordStyleAnchorFromVideoNode,
} from "@/lib/hermes/agent/hermesCanvasEventCache";

let attached = false;

/**
 * 关键帧/视频 Agent 成功后更新风格参考锚点（供「按上面风格」跨镜套用）。
 */
export function initHermesStyleAnchorRecording(): void {
  if (attached || typeof window === "undefined") return;
  attached = true;

  window.addEventListener("node-agent-event", (ev) => {
    const detail = (ev as CustomEvent<{
      phase?: string;
      error?: string;
      agentName?: string;
      nodeId?: string;
    }>).detail;
    if (!detail?.nodeId || detail.phase !== "end" || detail.error) return;
    const kind = agentKindFromName(detail.agentName ?? "");
    if (kind === "image") {
      recordStyleAnchorFromImageNode(detail.nodeId);
    } else if (kind === "video") {
      recordStyleAnchorFromVideoNode(detail.nodeId);
    }
  });
}
