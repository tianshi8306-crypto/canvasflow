import React, { useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import "./MentionInput.css";
import { useUpstreamNodeCandidates } from "../../hooks/useUpstreamNodeCandidates";
import { parsePromptInlineSegments } from "@/lib/imageGeneration/imageStyleTokens";
import { USER_INPUT_PLACEHOLDER } from "@/lib/slashPresets";

export interface MentionInputProps {
  nodeId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  nodeLabels?: Record<string, string>;
  onSlashTrigger?: (cursorRect: DOMRect) => void;
}

export interface MentionInputRef {
  insertPresetTemplate: (template: string) => void;
}

export const MentionInput = forwardRef<MentionInputRef, MentionInputProps>(
  ({ nodeId, value, onChange, placeholder, className = "", style, nodeLabels = {}, onSlashTrigger }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [dropdownQuery, setDropdownQuery] = useState("");
    const [dropdownIndex, setDropdownIndex] = useState(0);
    const pendingValueRef = useRef(value);
    const pendingCursorRef = useRef(0);
    const upstreamNodes = useUpstreamNodeCandidates(nodeId);

    useImperativeHandle(ref, () => ({
      insertPresetTemplate: (template: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const cursor = textarea.selectionStart ?? 0;
        const textBefore = pendingValueRef.current.slice(0, cursor);
        const textAfter = pendingValueRef.current.slice(cursor);
        const slashMatch = textBefore.match(/\/([^/\n]*)$/);
        if (!slashMatch) return;
        const newValue =
          textBefore.slice(0, textBefore.length - slashMatch[0].length) +
          template +
          textAfter;
        pendingValueRef.current = newValue;
        onChange(newValue);
        requestAnimationFrame(() => {
          textarea.focus();
          const anchorPos = textBefore.length - slashMatch[0].length;
          const placeholderPos = template.indexOf(USER_INPUT_PLACEHOLDER);
          if (placeholderPos !== -1) {
            textarea.setSelectionRange(
              anchorPos + placeholderPos,
              anchorPos + placeholderPos
            );
          } else {
            textarea.setSelectionRange(anchorPos + template.length, anchorPos + template.length);
          }
        });
      },
    }));

  const filteredNodes = useMemo(() => {
    if (!dropdownQuery) return upstreamNodes;
    const q = dropdownQuery.toLowerCase();
    return upstreamNodes.filter(
      (n) =>
        (nodeLabels[n.id] ?? n.label ?? n.id).toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
    );
  }, [upstreamNodes, dropdownQuery, nodeLabels]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursor = e.target.selectionStart ?? 0;
      pendingValueRef.current = newValue;
      pendingCursorRef.current = cursor;
      onChange(newValue);

      // / 触发优先级高于 @
      const textBefore = newValue.slice(0, cursor);
      const slashMatch = textBefore.match(/\/([^/\n]*)$/);
      if (slashMatch) {
        setShowDropdown(false);
        onSlashTrigger?.(textareaRef.current!.getBoundingClientRect());
        return;
      }

      // @ 触发节点引用下拉
      const atMatch = textBefore.match(/@([^@\n]*)$/);
      if (atMatch) {
        setDropdownQuery(atMatch[1]);
        setShowDropdown(true);
        setDropdownIndex(0);
      } else {
        setShowDropdown(false);
      }
    },
    [onChange, onSlashTrigger]
  );

  const insertMention = useCallback(
    (targetNodeId: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const currentValue = pendingValueRef.current;
      const cursor = pendingCursorRef.current;
      const textBefore = currentValue.slice(0, cursor);
      const textAfter = currentValue.slice(cursor);
      const atMatch = textBefore.match(/@([^@\n]*)$/);
      if (!atMatch) return;
      const insertText = `@[${targetNodeId}]`;
      const newValue =
        textBefore.slice(0, textBefore.length - atMatch[0].length) +
        insertText +
        textAfter;
      onChange(newValue);
      setShowDropdown(false);
      pendingValueRef.current = newValue;
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = textBefore.length - atMatch[0].length + insertText.length;
        textarea.setSelectionRange(newPos, newPos);
      });
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showDropdown) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDropdownIndex((i) => Math.min(i + 1, filteredNodes.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setDropdownIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredNodes[dropdownIndex]) {
          insertMention(filteredNodes[dropdownIndex].id);
        }
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [showDropdown, filteredNodes, dropdownIndex, insertMention]
  );

  const overlaySegments = useMemo(
    () => parsePromptInlineSegments(value, nodeLabels),
    [value, nodeLabels],
  );

  return (
    <div className={`mention-input-wrapper ${className}`} style={style}>
      <div className="mention-overlay" ref={overlayRef}>
        {overlaySegments.map((seg, idx) => {
          if (seg.kind === "text") {
            return <React.Fragment key={`t-${idx}`}>{seg.text}</React.Fragment>;
          }
          if (seg.kind === "mention") {
            return (
              <span key={`m-${idx}-${seg.nodeId}`} className="mention-token-slot">
                <span className="mention-token-measure" aria-hidden>
                  {seg.token}
                </span>
                <span className="mention-pill">@{seg.label}</span>
              </span>
            );
          }
          return (
            <span key={`s-${idx}-${seg.styleId}`} className="mention-token-slot">
              <span className="mention-token-measure" aria-hidden>
                {seg.token}
              </span>
              <span className="mention-pill mention-pill--style">#{seg.label}</span>
            </span>
          );
        })}
      </div>
      <textarea
        ref={textareaRef}
        className="mention-textarea nodrag nopan nowheel"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
      />
      {showDropdown && filteredNodes.length > 0 && (
        <div className="mention-dropdown">
          {filteredNodes.map((node, i) => (
            <div
              key={node.id}
              className={`mention-dropdown-item ${i === dropdownIndex ? "selected" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(node.id);
              }}
              onMouseEnter={() => setDropdownIndex(i)}
            >
              <span className="mention-dropdown-type">{node.type}</span>
              <span className="mention-dropdown-label">
                {nodeLabels[node.id] ?? node.label ?? node.id}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

MentionInput.displayName = "MentionInput";