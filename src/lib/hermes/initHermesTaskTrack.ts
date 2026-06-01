import type { NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";
import { labelForAgentNode } from "@/lib/hermes/hermesTaskTrack";
import { useHermesTaskStore } from "@/store/hermesTaskStore";
import { useProjectStore } from "@/store/projectStore";

let listenerAttached = false;

/**
 * 全局订阅 node-agent-event，写入 Hermes 任务轨（侧栏 + 灵体角标共用）。
 */
export function initHermesTaskTrack(): void {
  if (listenerAttached || typeof window === "undefined") return;
  listenerAttached = true;

  window.addEventListener("node-agent-event", (ev) => {
    const detail = (ev as CustomEvent<NodeAgentRuntimeEvent>).detail;
    if (!detail?.nodeId) return;

    const projectPath = useProjectStore.getState().projectPath?.trim();
    if (!projectPath || detail.projectPath !== projectPath) return;

    const state = useProjectStore.getState();
    const node = state.nodes.find((n) => n.id === detail.nodeId);
    const scriptNode = state.nodes.find((n) => n.type === "scriptNode");
    const beats = scriptNode?.data.scriptBeats;
    const label = labelForAgentNode(node, beats, detail.agentName);

    useHermesTaskStore.getState().upsertAgentEvent(detail, label);
  });
}
