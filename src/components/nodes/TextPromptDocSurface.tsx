import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { htmlToMarkdown, markdownToHtml } from "@/lib/textPromptHtml";
import { normalizeTextPromptMarkdown } from "@/lib/textPromptMarkdown";
import "./TextPromptDocument.css";

export type TextPromptDocSurfaceHandle = {
  focus: () => void;
  getRoot: () => HTMLDivElement | null;
  readMarkdown: () => string;
};

type Props = {
  markdown: string;
  editing: boolean;
  className?: string;
  clamp?: boolean;
  placeholder?: string;
  onMarkdownChange?: (markdown: string) => void;
  onBlur?: () => void;
  onRequestEdit?: (e: ReactMouseEvent) => void;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onWheel?: (e: ReactWheelEvent) => void;
};

/** 预览与编辑共用同一 HTML 排版，仅切换 contentEditable */
export const TextPromptDocSurface = forwardRef<TextPromptDocSurfaceHandle, Props>(
  function TextPromptDocSurface(
    {
      markdown,
      editing,
      className = "",
      clamp = false,
      placeholder,
      onMarkdownChange,
      onBlur,
      onRequestEdit,
      onPointerDown,
      onWheel,
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const lastEmittedRef = useRef(markdown);

    const prepared = useMemo(() => normalizeTextPromptMarkdown(markdown), [markdown]);
    const html = useMemo(() => markdownToHtml(prepared), [prepared]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => rootRef.current?.focus(),
        getRoot: () => rootRef.current,
        readMarkdown: () => {
          const el = rootRef.current;
          if (!el) return markdown;
          return htmlToMarkdown(el.innerHTML);
        },
      }),
      [markdown],
    );

    useLayoutEffect(() => {
      const el = rootRef.current;
      if (!el) return;
      const externalChange = markdown !== lastEmittedRef.current;
      const typing = editing && document.activeElement === el;
      if (typing && !externalChange) return;
      if (el.innerHTML !== html) {
        el.innerHTML = html;
      }
      lastEmittedRef.current = markdown;
    }, [editing, html, markdown]);

    useLayoutEffect(() => {
      if (!editing) return;
      rootRef.current?.focus();
    }, [editing]);

    const handleInput = useCallback(() => {
      const el = rootRef.current;
      if (!el || !onMarkdownChange) return;
      const next = htmlToMarkdown(el.innerHTML);
      lastEmittedRef.current = next;
      onMarkdownChange(next);
    }, [onMarkdownChange]);

    const rootClass = [
      "textPromptDoc",
      editing ? "textPromptDoc--editable" : "",
      clamp ? "textPromptDoc--clamp" : "",
      RF_NODE_INPUT_CLASS,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    if (!html && !editing && !placeholder) return null;

    return (
      <div
        ref={rootRef}
        className={rootClass}
        contentEditable={editing}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-readonly={!editing}
        data-placeholder={placeholder}
        tabIndex={editing ? 0 : -1}
        onInput={editing ? handleInput : undefined}
        onBlur={editing ? onBlur : undefined}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          if (!editing) e.stopPropagation();
        }}
        onClick={(e) => {
          if (!editing) {
            e.stopPropagation();
            onRequestEdit?.(e);
          }
        }}
        onDoubleClick={(e) => {
          if (!editing) {
            e.stopPropagation();
            onRequestEdit?.(e);
          }
        }}
        onWheel={onWheel}
      />
    );
  },
);
