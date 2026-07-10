import { ScriptNodeDraftPreview } from "@/components/nodes/ScriptNodeDraftPreview";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  nodeId: string;
};

/** Inspector：分镜稿全文编辑（自全屏 Tab 迁出） */
export function ScriptNodeDraftInspector({ nodeId }: Props) {
  const storyboardDraft = useProjectStore(
    (s) => s.nodes.find((n) => n.id === nodeId)?.data.storyboardDraft ?? "",
  );

  return (
    <details className="scriptInspectorDraft" open>
      <summary className="scriptInspectorDraft-summary">分镜稿</summary>
      <p className="scriptInspectorDraft-hint">
        编辑整份分镜稿；有效分镜块会自动同步到脚本表。
      </p>
      <ScriptNodeDraftPreview
        nodeId={nodeId}
        draft={storyboardDraft}
        className="scriptInspectorDraftPreview"
        textareaClassName="scriptInspectorDraftTextarea"
      />
    </details>
  );
}
