import { useProjectStore } from "@/store/projectStore";
import type { NodeRunState } from "@/lib/runNodeState";

const LABEL: Record<NodeRunState, string> = {
  running: "运行中",
  succeeded: "成功",
  failed: "失败",
  skipped: "跳过",
};

export function NodeRunBadge({ nodeId }: { nodeId: string }) {
  const state = useProjectStore((s) => s.nodeRunStateById[nodeId]);
  if (!state) return null;
  return (
    <span className={`nodeRunBadge nodeRunBadge--${state}`} title={LABEL[state]}>
      {LABEL[state]}
    </span>
  );
}
