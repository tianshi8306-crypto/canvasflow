import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { patchFromStoryboardDraftEdit } from "@/lib/storyboardDraftSync";

const DEBOUNCE_MS = 400;

type Props = {
  nodeId: string;
  draft: string;
  readOnly?: boolean;
  className?: string;
  textareaClassName?: string;
};

/** 脚本节点：可编辑分镜稿；改稿后自动同步 scriptBeats（解析失败时仅保存 draft） */
export function ScriptNodeDraftPreview({
  nodeId,
  draft,
  readOnly = false,
  className = "scriptChrome-draftPreview",
  textareaClassName = "scriptChrome-draftTextarea",
}: Props) {
  const nodes = useProjectStore((s) => s.nodes);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const [localDraft, setLocalDraft] = useState(draft);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRef = useRef<string | null>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) {
      setLocalDraft(draft);
    }
  }, [draft]);

  const flushDraft = useCallback(
    (next: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      const existingBeats = normalizeScriptBeats(node?.data.scriptBeats ?? []);
      const patch = patchFromStoryboardDraftEdit(
        next,
        existingBeats,
        node?.data.scriptBeatSelection,
      );
      updateNodeData(nodeId, patch);
      pendingDraftRef.current = null;
    },
    [nodeId, nodes, updateNodeData],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingDraftRef.current != null) {
        flushDraft(pendingDraftRef.current);
      }
    };
  }, [flushDraft]);

  const schedulePersist = useCallback(
    (next: string) => {
      pendingDraftRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        flushDraft(next);
      }, DEBOUNCE_MS);
    },
    [flushDraft],
  );

  const onChange = useCallback(
    (next: string) => {
      if (readOnly) return;
      setLocalDraft(next);
      schedulePersist(next);
    },
    [readOnly, schedulePersist],
  );

  const onFocus = useCallback(() => {
    editingRef.current = true;
  }, []);

  const onBlur = useCallback(() => {
    editingRef.current = false;
    if (readOnly || pendingDraftRef.current == null) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    flushDraft(pendingDraftRef.current);
  }, [flushDraft, readOnly]);

  return (
    <div className={`scriptChrome-previewInner ${className}`.trim()}>
      <span className="scriptNodeViewTag">分镜稿</span>
      <textarea
        className={textareaClassName}
        value={localDraft}
        readOnly={readOnly}
        spellCheck={false}
        aria-label="分镜稿"
        placeholder="解析完成后在此编辑整份分镜稿；有效分镜块将自动同步到镜头表…"
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
