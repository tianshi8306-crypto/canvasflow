import type { FlowNodeData, StoryboardShot } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";

export function patchStoryboardShot(
  scriptNodeId: string,
  beatId: string,
  patch: Partial<StoryboardShot>,
  updateNodeData: (id: string, dataPatch: Partial<FlowNodeData>) => void,
): void {
  const scriptNode = useProjectStore.getState().nodes.find((n) => n.id === scriptNodeId);
  const list = [...(scriptNode?.data.storyboardShots ?? [])];
  const idx = list.findIndex((s) => s.scriptBeatId === beatId);
  if (idx === -1) return;
  list[idx] = { ...list[idx]!, ...patch };
  updateNodeData(scriptNodeId, { storyboardShots: list });
}
