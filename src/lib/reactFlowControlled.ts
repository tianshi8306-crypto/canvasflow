import type { EdgeChange, Node, NodeChange } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

/** 受控 nodes/edges 下 RF 内部回声，写回 store 会触发 Maximum update depth */
export function filterReactFlowNodeEchoChanges(
  changes: NodeChange<Node<FlowNodeData>>[],
): NodeChange<Node<FlowNodeData>>[] {
  return changes.filter((c) => {
    if (c.type === "select") return false;
    if (c.type === "replace" || c.type === "add" || c.type === "remove") return false;
    return true;
  });
}

/** 仅允许用户删除连线；其余类型为受控 props 回声 */
export function filterReactFlowEdgeEchoChanges(changes: EdgeChange[]): EdgeChange[] {
  return changes.filter((c) => c.type === "remove");
}

/** RF 选区/拖拽态不应进入 store 或回传 props */
export function stripEphemeralNodeFields(nodes: Node<FlowNodeData>[]): Node<FlowNodeData>[] {
  let anyChanged = false;
  const next = nodes.map((node) => {
    if (node.selected === undefined && node.dragging === undefined) return node;
    anyChanged = true;
    const { selected: _selected, dragging: _dragging, ...rest } = node;
    return rest as Node<FlowNodeData>;
  });
  return anyChanged ? next : nodes;
}

let selectionEchoSuppressDepth = 0;
let graphSyncLockDepth = 0;

/** 程序化 setSelectedNodeIds 时忽略紧随其后的 RF onSelectionChange 回声 */
export function runIgnoringReactFlowSelectionEcho(fn: () => void): void {
  selectionEchoSuppressDepth += 1;
  try {
    fn();
  } finally {
    const release = () => {
      selectionEchoSuppressDepth = Math.max(0, selectionEchoSuppressDepth - 1);
    };
    queueMicrotask(() => {
      requestAnimationFrame(release);
    });
  }
}

export function isReactFlowSelectionEchoSuppressed(): boolean {
  return selectionEchoSuppressDepth > 0;
}

export function runWithReactFlowGraphSyncLock(fn: () => void): void {
  graphSyncLockDepth += 1;
  try {
    fn();
  } finally {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        graphSyncLockDepth = Math.max(0, graphSyncLockDepth - 1);
      });
    });
  }
}

export function isReactFlowGraphSyncLocked(): boolean {
  return graphSyncLockDepth > 0;
}
