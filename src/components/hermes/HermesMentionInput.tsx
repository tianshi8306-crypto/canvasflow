import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "@/components/nodes/MentionInput.css";
import "@/components/nodes/VideoPromptAtPicker.css";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { getTextareaAtTriggerViewportRect } from "@/lib/textareaCaretCoords";
import {
  buildHermesMentionCatalog,
  filterHermesMentionCatalog,
  parseHermesMentionInlineSegments,
  promptContainsHermesMention,
  type HermesMentionItem,
} from "@/lib/hermes/hermesMentionCatalog";
import type { HermesRefAsset } from "@/lib/hermes/hermesRefAssets";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";
import { useMentionTextMirror } from "@/hooks/useMentionTextMirror";
import { getAtomicHermesMentionDeletion } from "@/lib/hermes/hermesMentionEditing";
import { applyAtomicTokenDeletion } from "@/lib/mentionInputEditing";

export type HermesMentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  nodes: Node<FlowNodeData>[];
  pinnedRefs?: HermesRefAsset[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  rows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  /** 从 @ 浮层选中或插入带路径素材时回调（用于钉选参考条） */
  onPinMention?: (item: HermesMentionItem) => void;
};

export type HermesMentionInputRef = {
  focus: () => void;
  insertAtToken: (token: string) => void;
  getTextarea: () => HTMLTextAreaElement | null;
};

const PICKER_GAP_PX = 4;
const PICKER_WIDTH_ESTIMATE = 300;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampPickerPosition(
  anchor: { left: number; bottom: number },
  menuHeightEstimate: number,
): { left: number; top: number } {
  const margin = 8;
  let left = finiteOr(anchor.left, margin);
  let top = finiteOr(anchor.bottom, margin) + PICKER_GAP_PX;
  const maxLeft = window.innerWidth - PICKER_WIDTH_ESTIMATE - margin;
  if (left > maxLeft) left = Math.max(margin, maxLeft);
  if (left < margin) left = margin;
  if (top + menuHeightEstimate > window.innerHeight - margin) {
    top = Math.max(margin, anchor.bottom - menuHeightEstimate - PICKER_GAP_PX);
  }
  return { left, top };
}

function pickerThumbKind(
  item: HermesMentionItem,
): "image" | "video" | "audio" | null {
  if (item.kind === "image" || item.kind === "pinned") {
    const mt = item.mediaType?.toLowerCase() ?? "";
    if (mt.includes("audio") || mt.includes("video")) return null;
    if (item.relPath && /\.(mp3|wav|mp4|mov|webm)$/i.test(item.relPath)) return null;
    return "image";
  }
  if (item.kind === "video") return "video";
  if (item.kind === "audio") return "audio";
  return null;
}

export const HermesMentionInput = forwardRef<HermesMentionInputRef, HermesMentionInputProps>(
  (
    {
      value,
      onChange,
      nodes,
      pinnedRefs = [],
      placeholder,
      className = "",
      disabled,
      rows = 2,
      onKeyDown,
      onPaste,
      onPinMention,
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const pickerListRef = useRef<HTMLDivElement>(null);
    const pendingValueRef = useRef(value);
    const pendingCursorRef = useRef(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [dropdownQuery, setDropdownQuery] = useState("");
    const [dropdownIndex, setDropdownIndex] = useState(0);
    const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null);

    useEffect(() => {
      pendingValueRef.current = value;
    }, [value]);

    const catalog = useMemo(
      () => buildHermesMentionCatalog(nodes, pinnedRefs),
      [nodes, pinnedRefs],
    );

    const filteredItems = useMemo(
      () => filterHermesMentionCatalog(catalog, dropdownQuery),
      [catalog, dropdownQuery],
    );

    const overlaySegments = useMemo(
      () => parseHermesMentionInlineSegments(value, catalog),
      [value, catalog],
    );

    useMentionTextMirror(textareaRef, overlayRef, [value]);

    const resolvePickerPosition = useCallback(
      (rowCount: number): { left: number; top: number } | null => {
        const ta = textareaRef.current;
        if (!ta) return null;
        const cursor = ta.selectionStart ?? pendingCursorRef.current;
        const menuHeight = Math.max(1, Math.min(rowCount, 8)) * 46 + 12;
        const anchor = getTextareaAtTriggerViewportRect(ta, cursor);
        if (anchor && Number.isFinite(anchor.left) && Number.isFinite(anchor.bottom)) {
          return clampPickerPosition(anchor, menuHeight);
        }
        const rect = ta.getBoundingClientRect();
        return clampPickerPosition({ left: rect.left, bottom: rect.bottom }, menuHeight);
      },
      [],
    );

    const updatePickerAnchor = useCallback(() => {
      setPickerPos(resolvePickerPosition(filteredItems.length));
    }, [filteredItems.length, resolvePickerPosition]);

    const notifyPinForToken = useCallback(
      (token: string) => {
        if (!onPinMention) return;
        const name = token.startsWith("@") ? token.slice(1) : token;
        const item = catalog.find(
          (it) =>
            it.insertToken === token ||
            it.insertToken.slice(1) === name ||
            it.aliases.some((a) => a === name),
        );
        if (item) onPinMention(item);
      },
      [catalog, onPinMention],
    );

    const insertTokenAtCursor = useCallback(
      (token: string, replaceAtQuery = false) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const currentValue = pendingValueRef.current;
        const cursor =
          document.activeElement === textarea
            ? (textarea.selectionStart ?? pendingCursorRef.current)
            : currentValue.length;
        const textBefore = currentValue.slice(0, cursor);
        const textAfter = currentValue.slice(cursor);

        let newValue: string;
        let newPos: number;

        if (replaceAtQuery) {
          const atMatch = textBefore.match(/@([^@\n]*)$/);
          if (!atMatch) return;
          newValue =
            textBefore.slice(0, textBefore.length - atMatch[0].length) + token + textAfter;
          newPos = textBefore.length - atMatch[0].length + token.length;
        } else {
          const spacerBefore = textBefore.length > 0 && !/\s$/.test(textBefore) ? " " : "";
          const spacerAfter = textAfter.length > 0 && !/^\s/.test(textAfter) ? " " : "";
          newValue = textBefore + spacerBefore + token + spacerAfter + textAfter;
          newPos = textBefore.length + spacerBefore.length + token.length;
        }

        pendingValueRef.current = newValue;
        onChange(newValue);
        setShowDropdown(false);
        setPickerPos(null);
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(newPos, newPos);
          pendingCursorRef.current = newPos;
        });
        notifyPinForToken(token);
      },
      [notifyPinForToken, onChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        insertAtToken: (token: string) => insertTokenAtCursor(token, false),
        focus: () => textareaRef.current?.focus(),
        getTextarea: () => textareaRef.current,
      }),
      [insertTokenAtCursor],
    );

    const openDropdown = useCallback(
      (query: string) => {
        if (catalog.length === 0) return;
        setDropdownQuery(query);
        setDropdownIndex(0);
        setPickerPos(resolvePickerPosition(catalog.length));
        setShowDropdown(true);
        requestAnimationFrame(updatePickerAnchor);
      },
      [catalog.length, resolvePickerPosition, updatePickerAnchor],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const cursor = e.target.selectionStart ?? 0;
        pendingValueRef.current = newValue;
        pendingCursorRef.current = cursor;
        onChange(newValue);

        const textBefore = newValue.slice(0, cursor);
        const atMatch = textBefore.match(/@([^@\n]*)$/);
        if (atMatch && catalog.length > 0) {
          openDropdown(atMatch[1]);
        } else {
          setShowDropdown(false);
          setPickerPos(null);
        }
      },
      [catalog.length, onChange, openDropdown],
    );

    const pickItem = useCallback(
      (item: HermesMentionItem) => {
        insertTokenAtCursor(item.insertToken, true);
      },
      [insertTokenAtCursor],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        const cursor = textarea.selectionStart ?? pendingCursorRef.current;
        const selEnd = textarea.selectionEnd ?? cursor;

        if (e.key === "Backspace" || e.key === "Delete") {
          const deletion = getAtomicHermesMentionDeletion(
            pendingValueRef.current,
            cursor,
            selEnd,
            e.key,
            catalog,
          );
          if (deletion) {
            e.preventDefault();
            const { value: newValue, cursor: newCursor } = applyAtomicTokenDeletion(
              pendingValueRef.current,
              deletion,
            );
            pendingValueRef.current = newValue;
            pendingCursorRef.current = newCursor;
            onChange(newValue);
            setShowDropdown(false);
            setPickerPos(null);
            requestAnimationFrame(() => {
              textarea.focus();
              textarea.setSelectionRange(newCursor, newCursor);
            });
            return;
          }
        }

        if (showDropdown && filteredItems.length > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setDropdownIndex((i) => Math.min(i + 1, filteredItems.length - 1));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setDropdownIndex((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            const item = filteredItems[dropdownIndex];
            if (item) pickItem(item);
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setShowDropdown(false);
            setPickerPos(null);
            return;
          }
        }
        onKeyDown?.(e);
      },
      [showDropdown, filteredItems, dropdownIndex, pickItem, onKeyDown, catalog, onChange],
    );

    useEffect(() => {
      if (!showDropdown) return;
      updatePickerAnchor();
      const ta = textareaRef.current;
      const onReposition = () => updatePickerAnchor();
      window.addEventListener("resize", onReposition);
      window.addEventListener("scroll", onReposition, true);
      ta?.addEventListener("scroll", onReposition);
      return () => {
        window.removeEventListener("resize", onReposition);
        window.removeEventListener("scroll", onReposition, true);
        ta?.removeEventListener("scroll", onReposition);
      };
    }, [showDropdown, value, dropdownQuery, updatePickerAnchor]);

    useEffect(() => {
      if (!showDropdown) return;
      const list = pickerListRef.current;
      const active = list?.querySelector(".video-at-picker__row--active");
      if (typeof active?.scrollIntoView === "function") {
        active.scrollIntoView({ block: "nearest" });
      }
    }, [dropdownIndex, showDropdown, filteredItems.length]);

    const pickerPortal =
      showDropdown && pickerPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={pickerListRef}
              className="video-at-picker hermes-mention-picker nodrag nopan nowheel"
              style={{ left: pickerPos.left, top: pickerPos.top }}
              role="listbox"
              aria-label="引用画布素材"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {filteredItems.length === 0 ? (
                <div className="video-at-picker__empty">无匹配素材</div>
              ) : (
                filteredItems.map((item, i) => {
                  const cited = promptContainsHermesMention(value, item);
                  const thumbKind = pickerThumbKind(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={i === dropdownIndex}
                      className={`video-at-picker__row${i === dropdownIndex ? " video-at-picker__row--active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickItem(item);
                      }}
                      onMouseEnter={() => setDropdownIndex(i)}
                    >
                      <div
                        className={`video-at-picker__thumb${
                          item.kind === "audio" ? " video-at-picker__thumb--audio" : ""
                        }${item.kind === "text" || item.kind === "script" ? " video-at-picker__thumb--text" : ""}`}
                      >
                        {thumbKind && item.relPath ? (
                          <NodeMediaPreview
                            relPath={item.relPath}
                            assetId={item.assetId}
                            kind={thumbKind}
                          />
                        ) : item.kind === "audio" ? (
                          <span aria-hidden>♪</span>
                        ) : item.kind === "text" || item.kind === "script" ? (
                          <span aria-hidden>T</span>
                        ) : (
                          <span aria-hidden>◇</span>
                        )}
                      </div>
                      <span className="video-at-picker__title">{item.menuTitle}</span>
                      <span className="video-at-picker__meta">
                        {cited ? (
                          <span className="video-at-picker__check" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                        <span className="video-at-picker__shortcut">{item.menuShortcut}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null;

    return (
      <div className={`hermes-mention-input mention-input-wrapper ${className}`}>
        <div className="mention-overlay hermes-mention-overlay" ref={overlayRef} aria-hidden>
          {overlaySegments.map((seg, idx) => {
            if (seg.kind === "text") {
              return <React.Fragment key={`t-${idx}`}>{seg.text}</React.Fragment>;
            }
            return (
              <span key={`m-${idx}-${seg.token}`} className="mention-token-slot">
                <span className="mention-token-measure" aria-hidden>
                  {seg.token}
                </span>
                <span className="mention-pill mention-pill--hermes-ref">{seg.label}</span>
              </span>
            );
          })}
        </div>
        <textarea
          ref={textareaRef}
          className="mention-textarea hermesFloatInput"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          onSelect={(e) => {
            pendingCursorRef.current = e.currentTarget.selectionStart ?? 0;
            if (showDropdown) requestAnimationFrame(updatePickerAnchor);
          }}
          onClick={(e) => {
            pendingCursorRef.current = e.currentTarget.selectionStart ?? 0;
            if (showDropdown) requestAnimationFrame(updatePickerAnchor);
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
        />
        {pickerPortal}
      </div>
    );
  },
);

HermesMentionInput.displayName = "HermesMentionInput";
