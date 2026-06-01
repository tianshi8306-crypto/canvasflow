import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import "./MentionInput.css";
import "./VideoPromptAtPicker.css";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { getTextareaAtTriggerViewportRect } from "@/lib/textareaCaretCoords";
import {
  parseVideoPromptInlineSegments,
  buildVideoNamedAssetsFromIncoming,
  enrichVideoPromptSegmentsWithMedia,
  normalizeVideoPromptRefTokens,
  resolveCanonicalVideoRefInsertToken,
  videoRefPickerItems,
  type VideoRefPickerItem,
  type VideoPromptInlineSegmentWithMedia,
} from "@/lib/seedance/videoPromptAtTokens";
import type { VideoIncomingRefItem } from "@/hooks/useVideoIncomingReferenceItems";
import type { SeedanceImageComplianceResult } from "@/lib/seedance/seedanceImageCompliance";
import { useMentionTextMirror } from "@/hooks/useMentionTextMirror";
import {
  fitHoverPreviewBox,
  readMediaNaturalSize,
  REF_HOVER_PREVIEW_DELAY_MS,
} from "@/lib/video/refPreviewUtils";
import { VideoPromptRefChip, readMentionMirrorFont } from "@/components/nodes/VideoPromptRefChip";
import {
  getAtomicRefTokenDeletion,
  mapPromptCursorAfterSegmentReplace,
} from "@/lib/seedance/videoPromptMentionEditing";
import { applyAtomicTokenDeletion } from "@/lib/mentionInputEditing";

export interface VideoPromptMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  incomingRefs: VideoIncomingRefItem[];
  displayNamesByEdge?: Map<string, string>;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  /** 参考条 / pill 联动：当前聚焦的连线 */
  activeRefEdgeId?: string | null;
  /** 点击 prompt 内 @ pill 时聚焦对应参考 */
  onRefPillActivate?: (edgeId: string) => void;
  /** 上游图片 Seedance 2.0 合规（edgeId → 结果） */
  complianceByEdgeId?: ReadonlyMap<string, SeedanceImageComplianceResult>;
}

export interface VideoPromptMentionInputRef {
  insertAtToken: (token: string) => void;
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

function promptContainsRefToken(prompt: string, item: VideoRefPickerItem): boolean {
  if (prompt.includes(item.insertToken)) return true;
  if (item.namedToken && prompt.includes(item.namedToken)) return true;
  if (item.stemToken && prompt.includes(item.stemToken)) return true;
  if (item.displayToken && prompt.includes(item.displayToken)) return true;
  return false;
}

function segmentCharLength(seg: VideoPromptInlineSegmentWithMedia): number {
  return seg.kind === "text" ? seg.text.length : seg.token.length;
}

function findSegmentEdgeAtCursor(
  segments: VideoPromptInlineSegmentWithMedia[],
  cursor: number,
): string | undefined {
  let offset = 0;
  for (const seg of segments) {
    const len = segmentCharLength(seg);
    if (seg.kind !== "text" && seg.edgeId && cursor >= offset && cursor <= offset + len) {
      return seg.edgeId;
    }
    offset += len;
  }
  return undefined;
}

function readMirrorFont(el: HTMLElement | null): string {
  return readMentionMirrorFont(el);
}

function VideoPromptMediaPill({
  seg,
  active,
  onActivate,
  compliance,
  mirrorFont,
}: {
  seg: Exclude<VideoPromptInlineSegmentWithMedia, { kind: "text" }>;
  active: boolean;
  onActivate?: () => void;
  compliance?: SeedanceImageComplianceResult;
  mirrorFont: string;
}) {
  const pillVariant = seg.kind === "atNamed" ? "video-named" : "video-ref";
  const rawKind = seg.mediaKind ?? (seg.kind === "atRef" ? seg.refKind : "image");
  const kind = rawKind === "text" ? "image" : rawKind;

  return (
    <VideoPromptRefChip
      overlay
      token={seg.token}
      label={seg.label}
      path={seg.path}
      assetId={seg.assetId}
      mediaKind={kind}
      pillVariant={pillVariant}
      active={active}
      compliance={compliance}
      mirrorFont={mirrorFont}
      onActivate={onActivate}
    />
  );
}

function PickerHoverPreview({
  item,
  anchorRect,
}: {
  item: VideoRefPickerItem;
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

  if (item.kind === "audio") return null;

  return createPortal(
    <div
      className="video-at-picker-hover-preview nodrag nopan nowheel"
      style={{ left, top, width: box.width, height: box.height }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <NodeMediaPreview
        relPath={item.path}
        assetId={item.assetId}
        kind={item.kind === "video" ? "video" : "image"}
        imageClassName="video-at-picker-hover-preview__media"
        videoClassName="video-at-picker-hover-preview__media"
        videoControls={false}
        onImageLoad={(e) => {
          const size = readMediaNaturalSize(e.currentTarget);
          if (size) setNaturalSize(size);
        }}
        onVideoLoadedMetadata={(e) => {
          const size = readMediaNaturalSize(e.currentTarget);
          if (size) setNaturalSize(size);
        }}
      />
    </div>,
    document.body,
  );
}

export const VideoPromptMentionInput = forwardRef<
  VideoPromptMentionInputRef,
  VideoPromptMentionInputProps
>(
  (
    {
      value,
      onChange,
      incomingRefs,
      displayNamesByEdge,
      placeholder,
      className = "",
      maxLength,
      activeRefEdgeId,
      onRefPillActivate,
      complianceByEdgeId,
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
    setMirrorFont(readMirrorFont(overlayRef.current));
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

  const namedAssets = useMemo(
    () => buildVideoNamedAssetsFromIncoming(incomingRefs, displayNamesByEdge),
    [incomingRefs, displayNamesByEdge],
  );

  const pickerItems = useMemo(
    () => videoRefPickerItems(incomingRefs, displayNamesByEdge),
    [incomingRefs, displayNamesByEdge],
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
      enrichVideoPromptSegmentsWithMedia(
        parseVideoPromptInlineSegments(value, namedAssets),
        incomingRefs,
        displayNamesByEdge,
      ),
    [value, namedAssets, incomingRefs, displayNamesByEdge],
  );

  useMentionTextMirror(textareaRef, overlayRef, [value]);

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

  const resolvePickerPosition = useCallback(
    (rowCount: number): { left: number; top: number } | null => {
      const ta = textareaRef.current;
      if (!ta) return null;
      const cursor = ta.selectionStart ?? pendingCursorRef.current;
      const menuHeight = Math.max(1, Math.min(rowCount, 6)) * 46 + 12;
      const anchor = getTextareaAtTriggerViewportRect(ta, cursor);
      if (
        anchor &&
        Number.isFinite(anchor.left) &&
        Number.isFinite(anchor.bottom)
      ) {
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

  const insertTokenAtCursor = useCallback(
    (token: string, replaceAtQuery = false) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const resolved = resolveCanonicalVideoRefInsertToken(
        token,
        incomingRefs,
        displayNamesByEdge,
      );
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
    [maxLength, onChange, clearPickerHoverPreview, incomingRefs, displayNamesByEdge],
  );

  const handleBlur = useCallback(() => {
    const textarea = textareaRef.current;
    const current = pendingValueRef.current;
    const normalized = normalizeVideoPromptRefTokens(
      current,
      incomingRefs,
      displayNamesByEdge,
    );
    if (normalized === current) return;
    const selStart = textarea?.selectionStart ?? pendingCursorRef.current;
    const selEnd = textarea?.selectionEnd ?? selStart;
    const newStart = mapPromptCursorAfterSegmentReplace(
      current,
      normalized,
      selStart,
      namedAssets,
    );
    const newEnd = mapPromptCursorAfterSegmentReplace(
      current,
      normalized,
      selEnd,
      namedAssets,
    );
    pendingValueRef.current = normalized;
    pendingCursorRef.current = newStart;
    onChange(normalized);
    requestAnimationFrame(() => {
      textarea?.setSelectionRange(newStart, newEnd);
    });
  }, [incomingRefs, displayNamesByEdge, onChange, namedAssets]);

  useImperativeHandle(
    ref,
    () => ({
      insertAtToken: (token: string) => insertTokenAtCursor(token, false),
      getSelectionStart: () =>
        textareaRef.current?.selectionStart ?? pendingCursorRef.current,
      focus: () => textareaRef.current?.focus(),
    }),
    [insertTokenAtCursor],
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
      const atMatch = textBefore.match(/@([^@\n]*)$/);
      if (atMatch && pickerItems.length > 0) {
        openDropdown(atMatch[1]);
      } else {
        setShowDropdown(false);
        setPickerPos(null);
        clearPickerHoverPreview();
      }
    },
    [onChange, openDropdown, pickerItems.length, clearPickerHoverPreview],
  );

  const pickItem = useCallback(
    (item: VideoRefPickerItem) => {
      insertTokenAtCursor(item.insertToken, true);
    },
    [insertTokenAtCursor],
  );

  const handleTextareaClick = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      pendingCursorRef.current = e.currentTarget.selectionStart ?? 0;
      if (showDropdown) requestAnimationFrame(updatePickerAnchor);
      const edgeId = findSegmentEdgeAtCursor(overlaySegments, pendingCursorRef.current);
      if (edgeId) onRefPillActivate?.(edgeId);
    },
    [showDropdown, updatePickerAnchor, overlaySegments, onRefPillActivate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const cursor = textarea.selectionStart ?? pendingCursorRef.current;
      const selEnd = textarea.selectionEnd ?? cursor;

      if (e.key === "Backspace" || e.key === "Delete") {
        const deletion = getAtomicRefTokenDeletion(
          pendingValueRef.current,
          cursor,
          selEnd,
          e.key,
          namedAssets,
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
      namedAssets,
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
            aria-label="引用参考素材"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseLeave={clearPickerHoverPreview}
          >
            {filteredItems.length === 0 ? (
              <div className="video-at-picker__empty">无匹配素材</div>
            ) : (
              filteredItems.map((item, i) => {
                const cited = promptContainsRefToken(value, item);
                return (
                  <button
                    key={item.edgeId}
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
                    <div className={`video-at-picker__thumb${item.kind === "audio" ? " video-at-picker__thumb--audio" : ""}`}>
                      {item.kind === "audio" ? (
                        <span aria-hidden>♪</span>
                      ) : (
                        <NodeMediaPreview
                          relPath={item.path}
                          assetId={item.assetId}
                          kind={item.kind === "video" ? "video" : "image"}
                        />
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

  const pickerHoverPortal =
    pickerHoverItem && pickerHoverRect ? (
      <PickerHoverPreview item={pickerHoverItem} anchorRect={pickerHoverRect} />
    ) : null;

  return (
    <div className={`mention-input-wrapper video-prompt-mention ${className}`}>
      <div className="mention-overlay" ref={overlayRef}>
        {overlaySegments.map((seg, idx) => {
          if (seg.kind === "text") {
            return <React.Fragment key={`t-${idx}`}>{seg.text}</React.Fragment>;
          }
          return (
            <VideoPromptMediaPill
              key={`${seg.kind}-${idx}-${seg.token}`}
              seg={seg}
              mirrorFont={mirrorFont}
              active={Boolean(seg.edgeId && seg.edgeId === activeRefEdgeId)}
              compliance={seg.edgeId ? complianceByEdgeId?.get(seg.edgeId) : undefined}
              onActivate={
                seg.edgeId && onRefPillActivate
                  ? () => onRefPillActivate(seg.edgeId!)
                  : undefined
              }
            />
          );
        })}
      </div>
      <textarea
        ref={textareaRef}
        className={`mention-textarea mmPromptInput ${RF_NODE_INPUT_CLASS}`}
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

VideoPromptMentionInput.displayName = "VideoPromptMentionInput";
