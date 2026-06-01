import { useMemo } from "react";
import { SaveWorkflowDialog } from "@/components/canvas/SaveWorkflowDialog";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

export function CanvasSaveWorkflowHost() {
  const open = useCanvasUiStore((s) => s.saveWorkflowDialogOpen);
  const closeSaveWorkflowDialog = useCanvasUiStore((s) => s.closeSaveWorkflowDialog);
  const saveWorkflowFromSelection = useProjectStore((s) => s.saveWorkflowFromSelection);
  const projectPath = useProjectStore((s) => s.projectPath);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const nodes = useProjectStore((s) => s.nodes);

  const defaultName = useMemo(() => {
    if (selectedNodeIds.length === 0) return "工作流";
    if (selectedNodeIds.length === 1) {
      const n = nodes.find((x) => x.id === selectedNodeIds[0]);
      const label = n?.data.label?.trim();
      if (label) return label;
      return "工作流";
    }
    return `工作流（${selectedNodeIds.length} 个节点）`;
  }, [nodes, selectedNodeIds]);

  return (
    <SaveWorkflowDialog
      open={open}
      defaultName={defaultName}
      projectOpen={Boolean(projectPath)}
      onCancel={closeSaveWorkflowDialog}
      onConfirm={(name, targets) => {
        void saveWorkflowFromSelection(name, targets).finally(() => {
          closeSaveWorkflowDialog();
        });
      }}
    />
  );
}
