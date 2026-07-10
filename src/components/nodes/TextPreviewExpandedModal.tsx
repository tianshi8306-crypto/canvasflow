import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TextPromptDocSurface,
  type TextPromptDocSurfaceHandle,
} from "@/components/nodes/TextPromptDocSurface";
import { TextPreviewToolbar } from "@/components/nodes/TextPreviewToolbar";
import { writeClipboardText } from "@/lib/textNodeClipboard";
import { applyFormatExec } from "@/lib/textPromptFormatExec";
import { htmlToMarkdown } from "@/lib/textPromptHtml";
import { normalizeTextPromptMarkdown } from "@/lib/textPromptMarkdown";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./TextPreviewExpandedModal.css";

const PREVIEW_EXPANDED_Z = 55;
const MAX_CHARS = 200_000;

/** 文本节点预览正文全屏展开（WYSIWYG 阅读/编辑，排版一致） */
export function TextPreviewExpandedModal() {
  const expandedNodeId = useCanvasUiStore((s) => s.textPreviewExpandedNodeId);
  const setExpandedNodeId = useCanvasUiStore((s) => s.setTextPreviewExpandedNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const node = expandedNodeId ? nodes.find((n) => n.id === expandedNodeId) : undefined;
  const prompt = node?.data.prompt ?? "";
  const label = node?.data.label?.trim() || "文本";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const surfaceRef = useRef<TextPromptDocSurfaceHandle>(null);
  const pendingFormatRef = useRef<{ command: string; value?: string } | null>(null);
  const openedNodeRef = useRef<string | null>(null);

  const normalizeDraft = useCallback((source: string) => {
    return normalizeTextPromptMarkdown(
      source.length > MAX_CHARS ? source.slice(0, MAX_CHARS) : source,
    );
  }, []);

  const saveDraft = useCallback(
    (savedTip = "") => {
      if (!expandedNodeId) return draft;
      const next = normalizeDraft(surfaceRef.current?.readMarkdown() ?? draft);
      updateNodeData(expandedNodeId, { prompt: next });
      setDraft(next);
      if (savedTip) setStatusText(savedTip);
      return next;
    },
    [draft, expandedNodeId, normalizeDraft, setStatusText, updateNodeData],
  );

  useEffect(() => {
    if (!expandedNodeId) {
      openedNodeRef.current = null;
      setEditing(false);
      return;
    }
    if (openedNodeRef.current === expandedNodeId) return;
    openedNodeRef.current = expandedNodeId;
    setDraft(prompt);
    const shouldEdit = useCanvasUiStore.getState().textPreviewExpandedEditOnOpen;
    if (shouldEdit) {
      useCanvasUiStore.setState({ textPreviewExpandedEditOnOpen: false });
      setEditing(true);
    } else {
      setEditing(false);
    }
  }, [expandedNodeId, prompt]);

  useEffect(() => {
    if (!expandedNodeId || editing) return;
    setDraft(prompt);
  }, [expandedNodeId, editing, prompt]);

  const closeModal = useCallback(() => {
    setExpandedNodeId(null);
  }, [setExpandedNodeId]);

  const saveAndClose = useCallback(() => {
    if (editing && expandedNodeId) {
      saveDraft("已保存正文");
    }
    closeModal();
  }, [closeModal, editing, expandedNodeId, saveDraft]);

  useEffect(() => {
    if (!expandedNodeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (editing) {
        saveDraft("已保存正文");
        setEditing(false);
        return;
      }
      closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal, editing, expandedNodeId, saveDraft]);

  const execFormat = useCallback(
    (command: string, value?: string) => {
      const root = surfaceRef.current?.getRoot();
      if (!root) return;
      root.focus();
      applyFormatExec(command, value);
      const next = normalizeDraft(htmlToMarkdown(root.innerHTML));
      setDraft(next);
      if (expandedNodeId) updateNodeData(expandedNodeId, { prompt: next });
    },
    [expandedNodeId, normalizeDraft, updateNodeData],
  );

  useEffect(() => {
    if (!editing || !pendingFormatRef.current) return;
    const pending = pendingFormatRef.current;
    pendingFormatRef.current = null;
    requestAnimationFrame(() => execFormat(pending.command, pending.value));
  }, [editing, execFormat]);

  const handleFormatExec = useCallback(
    (command: string, value?: string) => {
      if (!editing) {
        pendingFormatRef.current = { command, value };
        setDraft(prompt);
        setEditing(true);
        return;
      }
      execFormat(command, value);
    },
    [editing, execFormat, prompt],
  );

  const handleCopy = useCallback(() => {
    const text = editing ? surfaceRef.current?.readMarkdown() ?? draft : prompt;
    void writeClipboardText(text).then(
      () => setStatusText("已复制正文到剪贴板"),
      () => setStatusText("复制失败"),
    );
  }, [draft, editing, prompt, setStatusText]);

  const requestEdit = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (editing) return;
      setDraft(prompt);
      setEditing(true);
    },
    [editing, prompt],
  );

  const exitEditing = useCallback(() => {
    saveDraft("");
    setEditing(false);
  }, [saveDraft]);

  if (!expandedNodeId || node?.type !== "textNode" || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="textPreviewExpanded-overlay"
      role="dialog"
      aria-modal
      aria-label={`${label} 正文`}
      style={{ zIndex: PREVIEW_EXPANDED_Z }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="textPreviewExpanded-header">
        <h2 className="textPreviewExpanded-title">{label}</h2>
        <button
          type="button"
          className="textPreviewExpanded-close"
          aria-label="关闭"
          title="关闭 (Esc)"
          onClick={saveAndClose}
        >
          ×
        </button>
      </header>

      <div className="textPreviewExpanded-toolbarRow">
        <TextPreviewToolbar
          onFormatExec={handleFormatExec}
          showFormat
          onCopyBody={handleCopy}
        />
      </div>

      <div className="textPreviewExpanded-body">
        <div className="textPreviewExpanded-bodyInner">
          <TextPromptDocSurface
            ref={surfaceRef}
            className="textPreviewExpanded-surface"
            markdown={editing ? draft : prompt}
            editing={editing}
            placeholder="单击或双击开始编辑正文"
            onMarkdownChange={setDraft}
            onBlur={exitEditing}
            onRequestEdit={requestEdit}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
