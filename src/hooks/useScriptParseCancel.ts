import { useCallback } from "react";
import { cancelScriptParseRun } from "@/lib/scriptParseRunControl";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import { useScriptNodeTaskState } from "@/hooks/useScriptNodeTaskState";
import { useProjectStore } from "@/store/projectStore";

/** 预览胶囊 / 底栏共用：取消脚本解析（无法中止 Rust DAG，仅清 UI 并忽略 Agent 回调） */
export function useScriptParseCancel(nodeId: string) {
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const { clearStatus } = useNodeStatus(nodeId);
  const { clearZeroBeatsHint } = useScriptNodeTaskState(nodeId);

  return useCallback(() => {
    cancelScriptParseRun(nodeId);
    clearStatus();
    clearZeroBeatsHint();
    setStatusText("已取消脚本解析");
  }, [clearStatus, clearZeroBeatsHint, nodeId, setStatusText]);
}
