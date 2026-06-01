import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import "./TtvShared.css";
import { MentionInput } from "@/components/nodes/MentionInput";
import { useProjectStore } from "@/store/projectStore";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { indexFromPoint } from "@/lib/textareaCaretCoords";
import {
  getCaretRangeFromPoint,
  getPromptIndexFromCaretRange,
  getPromptIndexFromSelection,
} from "@/lib/inlineFlowPromptIndex";
import { getCameraInsertIndex, getCameraPromptPart } from "@/lib/ttvCameraUi";
import type { VideoGenerationDraft, VideoGenerationDraftPatch } from "@/lib/videoNodeTypes";

export type TtvInlineCameraPromptHandle = {
  getSelectionStart: () => number;
};

type Props = {
  nodeId: string;
  draft: VideoGenerationDraft;
  patchDraft: (patch: VideoGenerationDraftPatch) => void;
  cameraLabel: string | null;
  hasCamera: boolean;
};

const PLAIN_PLACEHOLDER = "描述画面、镜头与风格；生成结果将出现在视频节点中。";
const FLOW_PLACEHOLDER = "描述画面、镜头与风格；运镜标签与正文同一行，可拖动或 Alt+点击调整位置。";

export const TtvInlineCameraPrompt = forwardRef<TtvInlineCameraPromptHandle, Props>(
  function TtvInlineCameraPrompt({ nodeId, draft, patchDraft, cameraLabel, hasCamera }, ref) {
    const taRef = useRef<HTMLTextAreaElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const leftSegRef = useRef<HTMLSpanElement>(null);
    const rightSegRef = useRef<HTMLSpanElement>(null);
    const chipRef = useRef<HTMLSpanElement>(null);
    const mirrorTaRef = useRef<HTMLTextAreaElement>(null);
    const chipDragActive = useRef(false);
    const draggingChipRef = useRef(false);

    const prompt = draft.prompt ?? "";
    const insertIndex = getCameraInsertIndex(draft.cameraMovement, prompt.length);
    const nodes = useProjectStore((s) => s.nodes);
    const nodeLabels = useMemo(
      () => Object.fromEntries(nodes.map((n) => [n.id, n.data.label ?? n.id])),
      [nodes]
    );

    useLayoutEffect(() => {
      if (!hasCamera) return;
      const left = prompt.slice(0, insertIndex);
      const right = prompt.slice(insertIndex);
      if (leftSegRef.current && leftSegRef.current.textContent !== left) {
        leftSegRef.current.textContent = left;
      }
      if (rightSegRef.current && rightSegRef.current.textContent !== right) {
        rightSegRef.current.textContent = right;
      }
    }, [hasCamera, insertIndex, prompt]);

    useImperativeHandle(
      ref,
      () => ({
        getSelectionStart: () => {
          const len = (draft.prompt ?? "").length;
          if (!hasCamera || !editorRef.current || !leftSegRef.current || !rightSegRef.current || !chipRef.current) {
            return taRef.current?.selectionStart ?? len;
          }
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) {
            return getCameraInsertIndex(draft.cameraMovement, len);
          }
          return getPromptIndexFromSelection(
            editorRef.current,
            leftSegRef.current,
            chipRef.current,
            rightSegRef.current,
          );
        },
      }),
      [hasCamera, draft.prompt, draft.cameraMovement],
    );

    useEffect(() => {
      const len = prompt.length;
      const raw = draft.cameraMovement?.insertIndex;
      if (typeof raw === "number" && Number.isFinite(raw) && raw > len) {
        patchDraft({ cameraMovement: { insertIndex: len } });
      }
    }, [draft.cameraMovement?.insertIndex, patchDraft, prompt.length]);

    const mergedTooltip = hasCamera ? getCameraPromptPart(draft) : null;

    const readSegments = () => ({
      left: leftSegRef.current?.textContent ?? "",
      right: rightSegRef.current?.textContent ?? "",
    });

    const onLeftInput = () => {
      const { left, right } = readSegments();
      patchDraft({ prompt: left + right });
      patchDraft({ cameraMovement: { insertIndex: left.length } });
    };

    const onRightInput = () => {
      const { left, right } = readSegments();
      patchDraft({ prompt: left + right });
    };

    const onPastePlainText = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      if (typeof document.execCommand === "function") {
        document.execCommand("insertText", false, text);
      }
    };

    const onChipPointerDown = (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest(".textNodeTtvCameraChipX")) return;
      e.preventDefault();
      e.stopPropagation();
      chipDragActive.current = true;
      draggingChipRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onChipPointerMove = (e: React.PointerEvent) => {
      if (!draggingChipRef.current || !editorRef.current || !leftSegRef.current || !rightSegRef.current || !chipRef.current)
        return;
      const r = getCaretRangeFromPoint(e.clientX, e.clientY);
      let idx: number | null = null;
      if (r && editorRef.current.contains(r.startContainer)) {
        idx = getPromptIndexFromCaretRange(r, leftSegRef.current, chipRef.current, rightSegRef.current);
      } else if (mirrorTaRef.current) {
        idx = indexFromPoint(mirrorTaRef.current, e.clientX, e.clientY);
      }
      if (idx !== null) {
        patchDraft({ cameraMovement: { insertIndex: idx } });
      }
    };

    const endChipDrag = (e: React.PointerEvent) => {
      if (!draggingChipRef.current) return;
      draggingChipRef.current = false;
      chipDragActive.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (editorRef.current && leftSegRef.current && rightSegRef.current && chipRef.current) {
        const r = getCaretRangeFromPoint(e.clientX, e.clientY);
        let idx: number | null = null;
        if (r && editorRef.current.contains(r.startContainer)) {
          idx = getPromptIndexFromCaretRange(r, leftSegRef.current, chipRef.current, rightSegRef.current);
        } else if (mirrorTaRef.current) {
          idx = indexFromPoint(mirrorTaRef.current, e.clientX, e.clientY);
        }
        if (idx !== null) {
          patchDraft({ cameraMovement: { insertIndex: idx } });
        }
      }
    };

    const onFlowPointerUp = (e: React.PointerEvent) => {
      if (e.button !== 0 || !e.altKey || !hasCamera) return;
      if (chipDragActive.current) return;
      if (chipRef.current?.contains(e.target as Node)) return;
      const r = getCaretRangeFromPoint(e.clientX, e.clientY);
      if (
        !r ||
        !editorRef.current?.contains(r.startContainer) ||
        !leftSegRef.current ||
        !rightSegRef.current ||
        !chipRef.current
      )
        return;
      const idx = getPromptIndexFromCaretRange(r, leftSegRef.current, chipRef.current, rightSegRef.current);
      patchDraft({ cameraMovement: { insertIndex: idx } });
    };

    const chipDisplay = cameraLabel ?? "运镜";

    return (
      <div className="textNodeTtvPromptComposer textNodeTtvPromptComposer--inline">
        <div className="textNodeTtvInlineWrap textNodeTtvInlineWrap--flow">
          {!hasCamera ? (
            <MentionInput
              nodeId={nodeId}
              value={prompt}
              onChange={(value) => patchDraft({ prompt: value })}
              placeholder={PLAIN_PLACEHOLDER}
              className={`textNodeTtvPrompt textNodeTtvPromptInput textNodeTtvPromptInput--composer mono ${RF_NODE_INPUT_CLASS}`}
              nodeLabels={nodeLabels}
            />
          ) : (
            <>
              <textarea
                ref={mirrorTaRef}
                className="textNodeTtvInlineMirrorTa mono"
                readOnly
                tabIndex={-1}
                aria-hidden
                value={prompt}
                rows={4}
              />
              <div
                ref={editorRef}
                className={`textNodeTtvInlineFlow mono ${RF_NODE_INPUT_CLASS} ${!prompt.length ? "textNodeTtvInlineFlow--empty" : ""}`}
                role="textbox"
                aria-multiline="true"
                aria-label="文生视频提示词"
                data-placeholder={FLOW_PLACEHOLDER}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={onFlowPointerUp}
              >
                <span
                  ref={leftSegRef}
                  className="textNodeTtvInlineSeg"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onInput={onLeftInput}
                  onPaste={onPastePlainText}
                />
                <span
                  ref={chipRef}
                  className="textNodeTtvCameraChip textNodeTtvCameraChip--flow"
                  contentEditable={false}
                  title={
                    mergedTooltip ? `生成时在此位置插入：${mergedTooltip}` : "拖动或 Alt+点击正文调整位置"
                  }
                  onPointerDown={onChipPointerDown}
                  onPointerMove={onChipPointerMove}
                  onPointerUp={endChipDrag}
                  onPointerCancel={endChipDrag}
                >
                  <span className="textNodeTtvCameraChipGrip" aria-hidden title="拖动">
                    ⋮⋮
                  </span>
                  <span className="textNodeTtvCameraChipIcon" aria-hidden>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <rect x="4" y="7" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
                      <circle cx="12" cy="12.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                      <path
                        d="M9 7V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </span>
                  <span className="textNodeTtvCameraChipText">{chipDisplay}</span>
                  <button
                    type="button"
                    className="textNodeTtvCameraChipX"
                    aria-label="移除运镜"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      patchDraft({
                        cameraMovement: {
                          presetId: undefined,
                          selectedCustomMoveId: undefined,
                          insertIndex: undefined,
                        },
                      });
                    }}
                  >
                    ×
                  </button>
                </span>
                <span
                  ref={rightSegRef}
                  className="textNodeTtvInlineSeg"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onInput={onRightInput}
                  onPaste={onPastePlainText}
                />
              </div>
            </>
          )}
        </div>
        {hasCamera ? (
          <p className="textNodeTtvCamFusionHint">
            运镜标签与正文同一行内排版（与示意图一致）；拖动标签或 Alt+点击可改插入点。
          </p>
        ) : null}
      </div>
    );
  },
);
