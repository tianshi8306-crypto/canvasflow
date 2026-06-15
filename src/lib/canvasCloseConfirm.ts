import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";
import { describeCanvasCloseRisk } from "@/lib/canvasCloseGuard";
import { useCanvasUiStore } from "@/store/canvasUiStore";

export function openCanvasCloseConfirm(opts: {
  nodes: Node<FlowNodeData>[];
  projectDirty: boolean;
  title: string;
  onClose: () => void;
  onSaveAndClose?: () => void | Promise<void>;
}): void {
  const risk = describeCanvasCloseRisk(opts.nodes, opts.projectDirty);
  if (!risk.shouldConfirm) {
    opts.onClose();
    return;
  }

  const canSave = risk.projectDirty && opts.onSaveAndClose;
  useCanvasUiStore.getState().openConfirmDialog({
    title: opts.title,
    message: `${risk.message}\n\n仍要关闭？`,
    confirmLabel: "关闭",
    saveLabel: canSave ? "保存并关闭" : undefined,
    onSave: canSave ? opts.onSaveAndClose : undefined,
    onConfirm: opts.onClose,
    onCancel: () => {},
  });
}
