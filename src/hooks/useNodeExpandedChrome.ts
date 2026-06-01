import { useNodeId } from "@xyflow/react";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

/**
 * 是否显示节点「展开」态（底栏、生成面板等）：
 * - 仅当前节点被单选且不在拖拽收起态时展开；
 * - 多选（含框选、Shift 加选）时所有被选节点一律视为「初始紧凑态」。
 */
export function useNodeExpandedChrome(selectedFromFlow: boolean) {
  const nodeId = useNodeId();
  const storeSelected = useProjectStore((s) =>
    nodeId ? s.selectedNodeIds.includes(nodeId) : false,
  );
  const selected = selectedFromFlow || storeSelected;
  const nodeDragSuppressUi = useCanvasUiStore((s) => s.nodeDragSuppressUi);
  const multiSelect = useProjectStore((s) => s.selectedNodeIds.length > 1);
  const suppressExpandedUi = nodeDragSuppressUi || (selected && multiSelect);
  const expandedChrome = selected && !suppressExpandedUi;
  return { expandedChrome, suppressExpandedUi, multiSelect };
}
