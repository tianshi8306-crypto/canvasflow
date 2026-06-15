import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";
import { persistActiveTabSnapshot } from "@/lib/canvasTabSync";
import { listVideoNodesWithActiveJobs } from "@/lib/videoGeneration/videoNodeJobPoll";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

export function countActiveVideoJobs(nodes: Node<FlowNodeData>[]): number {
  return listVideoNodesWithActiveJobs(nodes).length;
}

export type CanvasCloseRisk = {
  shouldConfirm: boolean;
  projectDirty: boolean;
  activeVideoJobCount: number;
  message: string;
};

/** 关闭画布 / 工程前的风险说明（未保存 + 进行中视频任务） */
export function describeCanvasCloseRisk(
  nodes: Node<FlowNodeData>[],
  projectDirty: boolean,
): CanvasCloseRisk {
  const activeVideoJobCount = countActiveVideoJobs(nodes);
  const lines: string[] = [];
  if (projectDirty) {
    lines.push("当前有尚未写入磁盘的编辑。");
  }
  if (activeVideoJobCount > 0) {
    lines.push(
      `有 ${activeVideoJobCount} 个视频任务正在生成；关闭后云端仍会继续，重开同一工程可恢复进度并自动拉回成片。`,
    );
  }
  if (lines.length === 0) {
    return {
      shouldConfirm: false,
      projectDirty,
      activeVideoJobCount,
      message: "",
    };
  }
  return {
    shouldConfirm: true,
    projectDirty,
    activeVideoJobCount,
    message: lines.join("\n"),
  };
}

/** 汇总所有 Tab + 当前活动画布，用于关闭应用前的风险提示 */
export function describeWorkspaceCloseRisk(): CanvasCloseRisk {
  persistActiveTabSnapshot();

  const { tabs, activeTabId } = useCanvasUiStore.getState();
  const store = useProjectStore.getState();

  if (tabs.length === 0) {
    return describeCanvasCloseRisk(store.nodes, store.projectDirty);
  }

  let dirtyTabCount = 0;
  let activeVideoJobCount = 0;

  for (const tab of tabs) {
    const isActive = tab.id === activeTabId;
    const nodes = isActive ? store.nodes : tab.nodes;
    const dirty = isActive ? store.projectDirty : tab.unsaved;
    if (dirty) dirtyTabCount += 1;
    activeVideoJobCount += countActiveVideoJobs(nodes);
  }

  const lines: string[] = [];
  if (dirtyTabCount > 0) {
    lines.push(
      dirtyTabCount === 1
        ? "当前有尚未写入磁盘的编辑。"
        : `有 ${dirtyTabCount} 个标签页存在尚未写入磁盘的编辑。`,
    );
  }
  if (activeVideoJobCount > 0) {
    lines.push(
      `有 ${activeVideoJobCount} 个视频任务正在生成；关闭后云端仍会继续，重开同一工程可恢复进度并自动拉回成片。`,
    );
  }

  if (lines.length === 0) {
    return {
      shouldConfirm: false,
      projectDirty: dirtyTabCount > 0,
      activeVideoJobCount,
      message: "",
    };
  }

  return {
    shouldConfirm: true,
    projectDirty: dirtyTabCount > 0,
    activeVideoJobCount,
    message: lines.join("\n"),
  };
}
