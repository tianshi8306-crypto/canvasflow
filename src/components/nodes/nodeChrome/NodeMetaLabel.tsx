import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  /** 持久化标签（FlowNodeData.label） */
  label?: string;
  /** 无自定义名时的占位文案，如「图片」 */
  defaultLabel: string;
  onCommit: (label: string | undefined) => void;
  /** floating：节点外绝对定位；inline：嵌入元信息行 */
  variant?: "floating" | "inline";
};

/** 节点外置左上可编辑标签 */
export function NodeMetaLabel({
  label = "",
  defaultLabel,
  onCommit,
  variant = "floating",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const t = draft.trim();
    onCommit(t || undefined);
    setEditing(false);
  }, [draft, onCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        setDraft(label);
        setEditing(false);
      }
    },
    [label],
  );

  const display = label.trim() || defaultLabel;
  const rootCls =
    variant === "inline"
      ? "nodeChrome-metaLabel nodeChrome-metaLabel--inline"
      : "nodeChrome-metaLabel minimal-image-label";

  return (
    <div className={rootCls}>
      {editing ? (
        <input
          ref={inputRef}
          className="nodeChrome-metaLabel-input minimal-image-label-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="nodeChrome-metaLabel-text minimal-image-label-text"
          onClick={() => {
            setDraft(label);
            setEditing(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {display}
        </span>
      )}
    </div>
  );
}
