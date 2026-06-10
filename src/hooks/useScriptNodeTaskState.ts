import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  isScriptNodeTaskBusy,
  isScriptStoryboardAgentBusy,
  resolveScriptNodePanelFeedback,
} from "@/lib/scriptNodeFeedback";
import { useProjectStore } from "@/store/projectStore";

/** 脚本节点：图执行 / Agent status / 解析 0 条 的统一任务态（顶栏、底栏、全屏共用） */
export function useScriptNodeTaskState(nodeId: string) {
  const node = useProjectStore((s) => s.nodes.find((n) => n.id === nodeId));
  const isGraphRunning = useProjectStore((s) => s.isGraphRunning);
  const status = node?.data.status;
  const themePrompt = node?.data.prompt ?? "";
  const beatCount = normalizeScriptBeats(node?.data.scriptBeats ?? []).length;

  const [zeroBeatsAfterParse, setZeroBeatsAfterParse] = useState(false);
  const wasGraphRunningRef = useRef(false);

  useEffect(() => {
    if (wasGraphRunningRef.current && !isGraphRunning) {
      // 延迟到下一个微任务，确保 DAG 调度回写的 scriptBeats 已 flush 到 store
      queueMicrotask(() => {
        const latest = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
        const count = normalizeScriptBeats(latest?.data.scriptBeats ?? []).length;
        const hasTheme = Boolean((latest?.data.prompt ?? "").trim());
        setZeroBeatsAfterParse(hasTheme && count === 0);
      });
    }
    wasGraphRunningRef.current = isGraphRunning;
  }, [isGraphRunning, nodeId]);

  const clearZeroBeatsHint = () => setZeroBeatsAfterParse(false);

  const isBusy = isScriptNodeTaskBusy({ isGraphRunning, status });
  const isStoryboardBusy = isScriptStoryboardAgentBusy(status);

  const panelFeedback = useMemo(
    () =>
      resolveScriptNodePanelFeedback({
        status,
        isGraphRunning,
        beatCount,
        themeFilled: Boolean(themePrompt.trim()),
        zeroBeatsAfterParse,
      }),
    [beatCount, isGraphRunning, status, themePrompt, zeroBeatsAfterParse],
  );

  return {
    status,
    isBusy,
    isStoryboardBusy,
    isGraphRunning,
    panelFeedback,
    zeroBeatsAfterParse,
    clearZeroBeatsHint,
  };
}
