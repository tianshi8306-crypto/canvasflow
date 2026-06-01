import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "./MentionInput.css";
import "./VideoPromptAtPicker.css";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { VideoPromptRefChip, readMentionMirrorFont } from "@/components/nodes/VideoPromptRefChip";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import {
  enrichImagePromptSegmentsWithMedia,
  findSourceNodeIdAtCursor,
  imageRefPickerItems,
  normalizeImagePromptRefTokens,
  parseImagePromptInlineSegments,
  promptContainsImageRefToken,
  resolveCanonicalImageRefInsertToken,
  type ImagePromptInlineSegmentWithMedia,
  type ImageRefPickerItem,
} from "@/lib/imageGeneration/imagePromptAtTokens";
import {
  getAtomicImagePromptTokenDeletion,
  mapImagePromptCursorAfterSegmentReplace,
} from "@/lib/imageGeneration/imagePromptMentionEditing";
import type { ResolvedIncomingImageRef } from "@/lib/imageGeneration/types";
import { applyAtomicTokenDeletion } from "@/lib/mentionInputEditing";
import { USER_INPUT_PLACEHOLDER } from "@/lib/slashPresets";
import { useMentionTextMirror } from "@/hooks/useMentionTextMirror";
import { getTextareaAtTriggerViewportRect } from "@/lib/textareaCaretCoords";
import {
  fitHoverPreviewBox,
  readMediaNaturalSize,
  REF_HOVER_PREVIEW_DELAY_MS,
} from "@/lib/video/refPreviewUtils";

export interface ImagePromptMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  incomingRefs: ResolvedIncomingImageRef[];
  nodeLabels?: Record<string, string>;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  activeRefSourceNodeId?: string | null;
  onRefPillActivate?: (sourceNodeId: string) => void;
  onSlashTrigger?: (cursorRect: DOMRect) => void;
}

export interface ImagePromptMentionInputRef {
  insertAtToken: (token: string) => void;
  insertPresetTemplate: (template: string) => void;
  getSelectionStart: () => number;
  focus: () => void;
}

const PICKER_GAP_PX = 4;
const PICKER_WIDTH_ESTIMATE = 268;
const PICKER_HOVER_PREVIEW_MAX = 280;

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

function PickerHoverPreview({
  item,
  anchorRect,
}: {
  item: ImageRefPickerItem;
  anchorRect: DOMRect;
}) {
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const box = naturalSize
    ? fitHoverPreviewBox(naturalSize.w, naturalSize.h, PICKER_HOVER_PREVIEW_MAX)
    : { width: 200, height: 150 };

  const gap = 12;
  let left = anchorRect.left - box.width - gap;
  let top = anchorRect.top + anchorRect.height / 2 - box.height / 2;
  const margin = 8;
  if (left < margin) left = anchorRect.right + gap;
  if (top < margin) top = margin;
  if (top + box.height > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - margin - box.height);
  }

  return createPortal(
    <div
      className="video-at-picker-hover-preview nodrag nopan nowheel"
      style={{ left, top, width: box.width, height: box.height }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <NodeMediaPreview
        relPath={item.path}
        assetId={item.assetId}
        kind="image"
        imageClassName="video-at-picker-hover-preview__media"
        onImageLoad={(e) => {
          const size = readMediaNaturalSize(e.currentTarget);
          if (size) setNaturalSize(size);
        }}
      />
    </div>,
    document.body,
  );
}

function ImageRefMediaPill({
  seg,
  active,
  mirrorFont,
  onActivate,
}: {
  seg: ImagePromptInlineSegmentWithMedia;
  active: boolean;
  mirrorFont: string;
  onActivate?: () => void;
}) {
  if (seg.kind === "text" || seg.kind === "style") return null;
  const hasMedia = Boolean(seg.path || seg.assetId);
  const pillVariant = seg.kind === "atNamed" || seg.kind === "nodeMention" ? "video-named" : "video-ref";

  if (!hasMedia) {
    return (
      <span className="mention-token-slot">
        <span className="mention-token-measure" aria-hidden>
          {seg.token}
        </span>
        <span className="mention-pill">@{seg.label}</span>
      </span>
    );
  }

  return (
    <VideoPromptRefChip
      overlay
      token={seg.token}
      label={seg.label}
      path={seg.path}
      assetId={seg.assetId}
      mediaKind="image"
      pillVariant={pillVariant}
      active={active}
      mirrorFont={mirrorFont}
      onActivate={onActivate}
    />
  );
}

export const ImagePromptMentionInput = forwardRef<
  ImagePromptMentionInputRef,
  ImagePromptMentionInputProps
>(
  (
    {
      value,
      onChange,
      incomingRefs,
      nodeLabels = {},
      placeholder,
      className = "",
      maxLength,
      activeRefSourceNodeId,
      onRefPillActivate,
      onSlashTrigger,
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const pickerListRef = useRef<HTMLDivElement>(null);
    const pickerRowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
    const pickerHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingValueRef = useRef(value);
    const pendingCursorRef = useRef(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [dropdownQuery, setDropdownQuery] = useState("");
    const [dropdownIndex, setDropdownIndex] = useState(0);
    const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null);
    const [pickerHoverIndex, setPickerHoverIndex] = useState<number | null>(null);
    const [pickerHoverRect, setPickerHoverRect] = useState<DOMRect | null>(null);
    const [mirrorFont, setMirrorFont] = useState("400 13px sans-serif");

    useLayoutEffect(() => {
      setMirrorFont(readMentionMirrorFont(overlayRef.current));
    }, [value, className]);

    useEffect(() => {
      pendingValueRef.current = value;
    }, [value]);

    const clearPickerHoverTimer = useCallback(() => {
      if (pickerHoverTimerRef.current) {
        clearTimeout(pickerHoverTimerRef.current);
        pickerHoverTimerRef.current = null;
      }
    }, []);

    useEffect(() => () => clearPickerHoverTimer(), [clearPickerHoverTimer]);

    const pickerItems = useMemo(
      () => imageRefPickerItems(incomingRefs, nodeLabels),
      [incomingRefs, nodeLabels],
    );

    const filteredItems = useMemo(() => {
      if (!dropdownQuery) return pickerItems;
      const q = dropdownQuery.toLowerCase();
      return pickerItems.filter(
        (it) =>
          it.menuTitle.toLowerCase().includes(q) ||
          it.menuShortcut.toLowerCase().includes(q) ||
          it.insertToken.toLowerCase().includes(q) ||
          it.fileName.toLowerCase().includes(q) ||
          (it.stemName?.toLowerCase().includes(q) ?? false) ||
          (it.displayName?.toLowerCase().includes(q) ?? false),
      );
    }, [pickerItems, dropdownQuery]);

    const overlaySegments = useMemo(
      () =>
        enrichImagePromptSegmentsWithMedia(
          parseImagePromptInlineSegments(value, incomingRefs, nodeLabels),
          incomingRefs,
          nodeLabels,
        ),
      [value, incomingRefs, nodeLabels],
    );

    useMentionTextMirror(textareaRef, overlayRef, [value]);

    const resolvePickerPosition = useCallback(
      (rowCount: number): { left: number; top: number } | null => {
        const ta = textareaRef.current;
        if (!ta) return null;
        const cursor = ta.selectionStart ?? pendingCursorRef.current;
        const menuHeight = Math.max(1, Math.min(rowCount, 6)) * 46 + 12;
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

    const schedulePickerHoverPreview = useCallback(
      (index: number) => {
        clearPickerHoverTimer();
        pickerHoverTimerRef.current = setTimeout(() => {
          const row = pickerRowRefs.current.get(index);
          const rect = row?.getBoundingClientRect();
          if (rect) {
            setPickerHoverIndex(index);
            setPickerHoverRect(rect);
          }
        }, REF_HOVER_PREVIEW_DELAY_MS);
      },
      [clearPickerHoverTimer],
    );

    const clearPickerHoverPreview = useCallback(() => {
      clearPickerHoverTimer();
      setPickerHoverIndex(null);
      setPickerHoverRect(null);
    }, [clearPickerHoverTimer]);

    const insertTokenAtCursor = useCallback(
      (token: string, replaceAtQuery = false) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const resolved = resolveCanonicalImageRefInsertToken(token, incomingRefs, nodeLabels);
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
            textBefore.slice(0, textBefore.length - atMatch[0].length) + resolved + textAfter;
          newPos = textBefore.length - atMatch[0].length + resolved.length;
        } else {
          const spacerBefore = textBefore.length > 0 && !/\s$/.test(textBefore) ? " " : "";
          const spacerAfter = textAfter.length > 0 && !/^\s/.test(textAfter) ? " " : "";
          newValue = textBefore + spacerBefore + resolved + spacerAfter + textAfter;
          newPos = textBefore.length + spacerBefore.length + resolved.length;
        }

        if (maxLength != null && newValue.length > maxLength) {
          newValue = newValue.slice(0, maxLength);
          newPos = Math.min(newPos, maxLength);
        }

        pendingValueRef.current = newValue;
        onChange(newValue);
        setShowDropdown(false);
        setPickerPos(null);
        clearPickerHoverPreview();
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(newPos, newPos);
          pendingCursorRef.current = newPos;
        });
      },
      [maxLength, onChange, clearPickerHoverPreview, incomingRefs, nodeLabels],
    );

    const insertPresetTemplate = useCallback(
      (template: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const cursor = textarea.selectionStart ?? pendingCursorRef.current;
        const textBefore = pendingValueRef.current.slice(0, cursor);
        const textAfter = pendingValueRef.current.slice(cursor);
        const slashMatch = textBefore.match(/\/([^/\n]*)$/);
        if (!slashMatch) return;
        const newValue =
          textBefore.slice(0, textBefore.length - slashMatch[0].length) + template + textAfter;
        pendingValueRef.current = newValue;
        onChange(newValue);
        requestAnimationFrame(() => {
          textarea.focus();
          const anchorPos = textBefore.length - slashMatch[0].length;
          const placeholderPos = template.indexOf(USER_INPUT_PLACEHOLDER);
          if (placeholderPos !== -1) {
            textarea.setSelectionRange(
              anchorPos + placeholderPos,
              anchorPos + placeholderPos,
            );
          } else {
            textarea.setSelectionRange(anchorPos + template.length, anchorPos + template.length);
          }
        });
      },
      [onChange],
    );

    const handleBlur = useCallback(() => {
      if (incomingRefs.length === 0) return;
      const textarea = textareaRef.current;
      const current = pendingValueRef.current;
      const normalized = normalizeImagePromptRefTokens(current, incomingRefs, nodeLabels);
      if (normalized === current) return;
      const selStart = textarea?.selectionStart ?? pendingCursorRef.current;
      const selEnd = textarea?.selectionEnd ?? selStart;
      const newStart = mapImagePromptCursorAfterSegmentReplace(
        current,
        normalized,
        selStart,
        incomingRefs,
        nodeLabels,
      );
      const newEnd = mapImagePromptCursorAfterSegmentReplace(
        current,
        normalized,
        selEnd,
        incomingRefs,
        nodeLabels,
      );
      pendingValueRef.current = normalized;
      pendingCursorRef.current = newStart;
      onChange(normalized);
      requestAnimationFrame(() => {
        textarea?.setSelectionRange(newStart, newEnd);
      });
    }, [incomingRefs, nodeLabels, onChange]);

    useImperativeHandle(
      ref,
      () => ({
        insertAtToken: (token: string) => insertTokenAtCursor(token, false),
        insertPresetTemplate,
        getSelectionStart: () =>
          textareaRef.current?.selectionStart ?? pendingCursorRef.current,
        focus: () => textareaRef.current?.focus(),
      }),
      [insertTokenAtCursor, insertPresetTemplate],
    );

    const openDropdown = useCallback(
      (query: string) => {
        if (pickerItems.length === 0) return;
        setDropdownQuery(query);
        setDropdownIndex(0);
        setPickerPos(resolvePickerPosition(pickerItems.length));
        setShowDropdown(true);
        requestAnimationFrame(updatePickerAnchor);
      },
      [pickerItems.length, resolvePickerPosition, updatePickerAnchor],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const cursor = e.target.selectionStart ?? 0;
        pendingValueRef.current = newValue;
        pendingCursorRef.current = cursor;
        onChange(newValue);

        const textBefore = newValue.slice(0, cursor);
        const slashMatch = textBefore.match(/\/([^/\n]*)$/);
        if (slashMatch) {
          setShowDropdown(false);
          setPickerPos(null);
          clearPickerHoverPreview();
          onSlashTrigger?.(textareaRef.current!.getBoundingClientRect());
          return;
        }

        const atMatch = textBefore.match(/@([^@\n]*)$/);
        if (atMatch && pickerItems.length > 0) {
          openDropdown(atMatch[1]);
        } else {
          setShowDropdown(false);
          setPickerPos(null);
          clearPickerHoverPreview();
        }
      },
      [onChange, openDropdown, pickerItems.length, clearPickerHoverPreview, onSlashTrigger],
    );

    const pickItem = useCallback(
      (item: ImageRefPickerItem) => {
        insertTokenAtCursor(item.insertToken, true);
      },
      [insertTokenAtCursor],
    );

    const handleTextareaClick = useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => {
        pendingCursorRef.current = e.currentTarget.selectionStart ?? 0;
        if (showDropdown) requestAnimationFrame(updatePickerAnchor);
        const sourceNodeId = findSourceNodeIdAtCursor(
          overlaySegments,
          pendingCursorRef.current,
        );
        if (sourceNodeId) onRefPillActivate?.(sourceNodeId);
      },
      [showDropdown, updatePickerAnchor, overlaySegments, onRefPillActivate],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        const cursor = textarea.selectionStart ?? pendingCursorRef.current;
        const selEnd = textarea.selectionEnd ?? cursor;

        if (e.key === "Backspace" || e.key === "Delete") {
          const deletion = getAtomicImagePromptTokenDeletion(
            pendingValueRef.current,
            cursor,
            selEnd,
            e.key,
            incomingRefs,
            nodeLabels,
          );
          if (deletion) {
            e.preventDefault();
            const { value: newValue, cursor: newCursor } = applyAtomicTokenDeletion(
              pendingValueRef.current,
              deletion,
            );
            let trimmed = newValue;
            if (maxLength != null && trimmed.length > maxLength) {
              trimmed = trimmed.slice(0, maxLength);
            }
            const pos = maxLength != null ? Math.min(newCursor, maxLength) : newCursor;
            pendingValueRef.current = trimmed;
            pendingCursorRef.current = pos;
            onChange(trimmed);
            setShowDropdown(false);
            setPickerPos(null);
            clearPickerHoverPreview();
            requestAnimationFrame(() => {
              textarea.focus();
              textarea.setSelectionRange(pos, pos);
            });
            return;
          }
        }

        if (!showDropdown || filteredItems.length === 0) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setDropdownIndex((i) => Math.min(i + 1, filteredItems.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setDropdownIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const item = filteredItems[dropdownIndex];
          if (item) pickItem(item);
        } else if (e.key === "Escape") {
          setShowDropdown(false);
          setPickerPos(null);
          clearPickerHoverPreview();
        }
      },
      [
        showDropdown,
        filteredItems,
        dropdownIndex,
        pickItem,
        clearPickerHoverPreview,
        incomingRefs,
        nodeLabels,
        maxLength,
        onChange,
      ],
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

    useEffect(() => {
      if (pickerHoverIndex == null) return;
      const row = pickerRowRefs.current.get(pickerHoverIndex);
      if (row) setPickerHoverRect(row.getBoundingClientRect());
    }, [dropdownIndex, pickerHoverIndex]);

    const pickerHoverItem =
      pickerHoverIndex != null ? filteredItems[pickerHoverIndex] : undefined;

    const pickerPortal =
      showDropdown && pickerPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={pickerListRef}
              className="video-at-picker nodrag nopan nowheel"
              style={{ left: pickerPos.left, top: pickerPos.top }}
              role="listbox"
              aria-label="引用参考图"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseLeave={clearPickerHoverPreview}
            >
              {filteredItems.length === 0 ? (
                <div className="video-at-picker__empty">无匹配参考图</div>
              ) : (
                filteredItems.map((item, i) => {
                  const cited = promptContainsImageRefToken(value, item);
                  return (
                    <button
                      key={item.sourceNodeId}
                      ref={(el) => {
                        if (el) pickerRowRefs.current.set(i, el);
                        else pickerRowRefs.current.delete(i);
                      }}
                      type="button"
                      role="option"
                      aria-selected={i === dropdownIndex}
                      className={`video-at-picker__row${i === dropdownIndex ? " video-at-picker__row--active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickItem(item);
                      }}
                      onMouseEnter={() => {
                        setDropdownIndex(i);
                        schedulePickerHoverPreview(i);
                      }}
                    >
                      <div className="video-at-picker__thumb">
                        <NodeMediaPreview
                          relPath={item.path}
                          assetId={item.assetId}
                          kind="image"
                        />
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

    const pickerHoverPortal =
      pickerHoverItem && pickerHoverRect ? (
        <PickerHoverPreview item={pickerHoverItem} anchorRect={pickerHoverRect} />
      ) : null;

    return (
      <div className={`mention-input-wrapper image-prompt-mention ${className}`}>
        <div className="mention-overlay" ref={overlayRef}>
          {overlaySegments.map((seg, idx) => {
            if (seg.kind === "text") {
              return <React.Fragment key={`t-${idx}`}>{seg.text}</React.Fragment>;
            }
            if (seg.kind === "style") {
              return (
                <span key={`s-${idx}-${seg.styleId}`} className="mention-token-slot">
                  <span className="mention-token-measure" aria-hidden>
                    {seg.token}
                  </span>
                  <span className="mention-pill mention-pill--style">#{seg.label}</span>
                </span>
              );
            }
            return (
              <ImageRefMediaPill
                key={`${seg.kind}-${idx}-${seg.token}`}
                seg={seg}
                mirrorFont={mirrorFont}
                active={Boolean(seg.sourceNodeId && seg.sourceNodeId === activeRefSourceNodeId)}
                onActivate={
                  seg.sourceNodeId && onRefPillActivate
                    ? () => onRefPillActivate(seg.sourceNodeId!)
                    : undefined
                }
              />
            );
          })}
        </div>
        <textarea
          ref={textareaRef}
          className={`mention-textarea ${RF_NODE_INPUT_CLASS}`}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onSelect={(e) => {
            pendingCursorRef.current = e.currentTarget.selectionStart ?? 0;
            if (showDropdown) requestAnimationFrame(updatePickerAnchor);
          }}
          onClick={handleTextareaClick}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          onPointerDown={(e) => e.stopPropagation()}
        />
        {pickerPortal}
        {pickerHoverPortal}
      </div>
    );
  },
);

ImagePromptMentionInput.displayName = "ImagePromptMentionInput";
