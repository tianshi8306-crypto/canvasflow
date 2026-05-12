import React, { useRef, useState, useCallback, useMemo } from "react";
import "./MentionInput.css";
import { useUpstreamNodeCandidates } from "../../hooks/useUpstreamNodeCandidates";

export interface MentionInputProps {
  nodeId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  nodeLabels?: Record<string, string>;
}

export function MentionInput({
  nodeId,
  value,
  onChange,
  placeholder,
  className = "",
  style,
  nodeLabels = {},
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState("");
  const [dropdownIndex, setDropdownIndex] = useState(0);
  // Use refs for immediate value/cursor tracking (not batched like state)
  const pendingValueRef = useRef(value);
  const pendingCursorRef = useRef(0);
  const upstreamNodes = useUpstreamNodeCandidates(nodeId);

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
      // Use refs for immediate tracking (not batched)
      pendingValueRef.current = newValue;
      pendingCursorRef.current = cursor;
      onChange(newValue);

      // Detect @ trigger
      const textBefore = newValue.slice(0, cursor);
      const atMatch = textBefore.match(/@([^@\n]*)$/);
      if (atMatch) {
        setDropdownQuery(atMatch[1]);
        setShowDropdown(true);
        setDropdownIndex(0);
      } else {
        setShowDropdown(false);
      }
    },
    [onChange]
  );

  const insertMention = useCallback(
    (targetNodeId: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      // Use refs for current value and cursor (immediately available, not batched)
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
      // Update ref with new value
      pendingValueRef.current = newValue;
      // Restore cursor after inserted text
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

  const pills = useMemo(() => {
    const result: { nodeId: string; label: string; start: number; end: number }[] = [];
    const regex = /@\[([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
      const id = match[1];
      result.push({
        nodeId: id,
        label: nodeLabels[id] ?? id,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    return result;
  }, [value, nodeLabels]);

  return (
    <div className={`mention-input-wrapper ${className}`} style={style}>
      <div className="mention-overlay" ref={overlayRef}>
        {(() => {
          const parts: React.ReactNode[] = [];
          let lastIndex = 0;
          for (const pill of pills) {
            if (pill.start > lastIndex) {
              parts.push(value.slice(lastIndex, pill.start));
            }
            parts.push(
              <span key={`${pill.start}-${pill.nodeId}`} className="mention-pill">
                @{pill.label}
              </span>
            );
            lastIndex = pill.end;
          }
          if (lastIndex < value.length) {
            parts.push(value.slice(lastIndex));
          }
          return parts;
        })()}
      </div>
      <textarea
        ref={textareaRef}
        className="mention-textarea nodrag nopan nowheel"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={4}
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
}
