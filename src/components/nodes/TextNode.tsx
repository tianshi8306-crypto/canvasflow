import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { NodeAnchors } from "@/components/nodes/anchors";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import type { FlowNodeData, TextWorkflowKind } from "@/lib/types";
import { NodeChromeShell, NodeMetaLabel, NodeMetaStatus } from "@/components/nodes/nodeChrome";
import { computeTextNodeFrameSize } from "@/lib/textNodeChrome";
import { TextComposerPanel } from "@/components/nodes/TextComposerPanel";
import { TextNodeBottomPortal } from "@/components/nodes/TextNodeBottomPortal";
import { TextPreviewToolbarPortal } from "@/components/nodes/TextPreviewToolbarPortal";
import { TextNodeResizeHandle } from "@/components/nodes/TextNodeResizeHandle";
import { TextNodeExpandEditModal } from "@/components/nodes/TextNodeExpandEditModal";
import { TextNodePasteImportModal } from "@/components/nodes/TextNodePasteImportModal";
import { orderedIncomingScriptNodeIds } from "@/lib/incomingScriptBinding";
import { isPassiveTextContainer } from "@/lib/textNodeContainerMode";
import { syncTextPromptFromUpstreamScript } from "@/lib/textScriptSync";
import {
  downloadTextAsFile,
  readClipboardText,
  writeClipboardText,
} from "@/lib/textNodeClipboard";
import { useTextNodeFrameResize } from "@/hooks/useTextNodeFrameResize";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./TextNodeChrome.css";

/** 空态壳内唯一文案；编辑态 placeholder 与之相同 */
const TEXT_EMPTY_PROMPT = "请输入内容";

type TextParams = {
  textChrome?: boolean;
  textWorkflow?: TextWorkflowKind;
  textModelInput?: string;
  providerId?: string;
  model?: string;
  videoNodeId?: string;
  audioNodeId?: string;
  scriptNodeId?: string;
  chromeWidth?: number;
  chromeHeight?: number;
};

const DEEP_THINKING_MAX_INPUT_CHARS = 200000;

function getParams(data: FlowNodeData): TextParams {
  const p = data.params;
  if (!p || typeof p !== "object") return {};
  return p as TextParams;
}

/** 文本节点：无「尝试」四入口；占位双击编辑；外置 Composer；连线推断 workflow */
export function TextNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const { expandedChrome, multiSelect } = useNodeExpandedChrome(selected);
  const uiSelected = selected;
  const previewRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const previewToolbarRef = useRef<HTMLDivElement>(null);

  const prompt = data.prompt ?? "";
  const hasBody = prompt.trim().length > 0;
  const params = getParams(data);
  const pinnedGenPanelId = useCanvasUiStore((s) => s.textGenPanelPinnedNodeId);
  const setPinnedGenPanelId = useCanvasUiStore((s) => s.setTextGenPanelPinnedNodeId);
  const expandedComposerNodeId = useCanvasUiStore((s) => s.textGenPanelExpandedNodeId);
  const isComposerExpanded = expandedComposerNodeId === id;

  const [editing, setEditing] = useState(false);
  const [expandEditOpen, setExpandEditOpen] = useState(false);
  const [expandDraft, setExpandDraft] = useState("");
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const editRef = useRef<HTMLDivElement>(null);
  const pendingFormatRef = useRef<{ command: string; value?: string } | null>(null);

  const isPassiveContainer = useMemo(
    () => isPassiveTextContainer(id, nodes, edges),
    [id, nodes, edges],
  );

  const isComposerPinned = pinnedGenPanelId === id;
  const userSizedShell =
    typeof params.chromeWidth === "number" && typeof params.chromeHeight === "number";

  const pinComposer = useCallback(() => {
    setPinnedGenPanelId(id);
    setStatusText("已钉住模型对话面板");
  }, [id, setPinnedGenPanelId, setStatusText]);

  const unpinComposer = useCallback(() => {
    if (pinnedGenPanelId === id) setPinnedGenPanelId(null);
    setStatusText("已收起模型对话面板");
  }, [id, pinnedGenPanelId, setPinnedGenPanelId, setStatusText]);

  useEffect(() => {
    if (!selected && pinnedGenPanelId === id) {
      setPinnedGenPanelId(null);
    }
  }, [id, pinnedGenPanelId, selected, setPinnedGenPanelId]);

  const stop = useCallback((e: SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const stopWheel = useCallback((e: ReactWheelEvent) => {
    e.stopPropagation();
  }, []);

  const clampByDeepThinkingLimit = useCallback((text: string) => {
    if (text.length <= DEEP_THINKING_MAX_INPUT_CHARS) {
      return { text, clipped: false };
    }
    return { text: text.slice(0, DEEP_THINKING_MAX_INPUT_CHARS), clipped: true };
  }, []);

  const savePromptWithLimit = useCallback(
    (next: string, savedTip = "已保存正文") => {
      const limited = clampByDeepThinkingLimit(next);
      updateNodeData(id, { prompt: limited.text });
      if (limited.clipped) {
        setStatusText(`已超出深度思考模型上限，已截断到 ${DEEP_THINKING_MAX_INPUT_CHARS} 字`);
      } else if (savedTip) {
        setStatusText(savedTip);
      }
      return limited.text;
    },
    [clampByDeepThinkingLimit, id, setStatusText, updateNodeData],
  );

  const clampEditableAfterPaste = useCallback(() => {
    requestAnimationFrame(() => {
      const current = editRef.current?.innerText ?? "";
      const limited = clampByDeepThinkingLimit(current);
      if (editRef.current && limited.text !== current) {
        editRef.current.textContent = limited.text;
        setStatusText(`已超出深度思考模型上限，已截断到 ${DEEP_THINKING_MAX_INPUT_CHARS} 字`);
      }
    });
  }, [clampByDeepThinkingLimit, setStatusText]);

  const saveFromEditor = useCallback(() => {
    const el = editRef.current;
    if (!el) return;
    const t = el.innerText ?? "";
    const next = savePromptWithLimit(t, "");
    el.textContent = next;
  }, [savePromptWithLimit]);

  useEffect(() => {
    if (!selected) {
      requestAnimationFrame(() => setEditing(false));
    }
  }, [selected]);

  useEffect(() => {
    if (!expandEditOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandEditOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandEditOpen]);

  useEffect(() => {
    if (multiSelect && selected) {
      requestAnimationFrame(() => setEditing(false));
    }
  }, [multiSelect, selected]);

  const prevEditing = useRef(false);
  useEffect(() => {
    if (editing && !prevEditing.current && editRef.current) {
      editRef.current.textContent = prompt;
      requestAnimationFrame(() => {
        const el = editRef.current;
        if (!el) return;
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
    }
    prevEditing.current = editing;
  }, [editing, prompt]);

  const enterEditing = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  }, []);

  const exec = useCallback((command: string, value?: string) => {
    editRef.current?.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      /* ignore */
    }
  }, []);

  const handleFormatExec = useCallback(
    (command: string, value?: string) => {
      if (!editing) {
        pendingFormatRef.current = { command, value };
        setEditing(true);
        return;
      }
      exec(command, value);
    },
    [editing, exec],
  );

  useEffect(() => {
    if (!editing || !pendingFormatRef.current) return;
    const pending = pendingFormatRef.current;
    pendingFormatRef.current = null;
    requestAnimationFrame(() => exec(pending.command, pending.value));
  }, [editing, exec]);

  const composerLayout = "default" as const;

  /** 仅孤立节点：空态用 Composer 起稿，或用户钉住模型对话；连线后仅为文字容器 */
  const showComposerPortal =
    expandedChrome &&
    uiSelected &&
    !editing &&
    !isPassiveContainer &&
    (!hasBody || isComposerPinned);

  useEffect(() => {
    if (isPassiveContainer && isComposerPinned) {
      setPinnedGenPanelId(null);
    }
  }, [isPassiveContainer, isComposerPinned, setPinnedGenPanelId]);
  const hasScriptUpstream = useMemo(
    () => orderedIncomingScriptNodeIds(nodes, edges, id).length > 0,
    [nodes, edges, id],
  );

  const handleSyncFromScript = useCallback(() => {
    const synced = syncTextPromptFromUpstreamScript(id, nodes, edges);
    if (!synced?.trim()) {
      setStatusText("未能从上游脚本节点获取内容");
      return;
    }
    savePromptWithLimit(synced, "已从脚本同步到正文");
  }, [edges, id, nodes, savePromptWithLimit, setStatusText]);

  const showPreviewTopPortal = expandedChrome && (hasBody || hasScriptUpstream);
  const showFormatInToolbar = editing;
  const showResizeHandle = expandedChrome && uiSelected && !editing;

  const openExpandEdit = useCallback(() => {
    const draft = editing ? (editRef.current?.innerText ?? prompt) : prompt;
    setExpandDraft(draft);
    setExpandEditOpen(true);
    if (editing) setEditing(false);
  }, [editing, prompt]);

  const commitExpandEdit = useCallback(() => {
    savePromptWithLimit(expandDraft, "已保存正文");
    setExpandEditOpen(false);
  }, [expandDraft, savePromptWithLimit]);

  const handleCopyBody = useCallback(() => {
    const text = editing ? (editRef.current?.innerText ?? prompt) : prompt;
    void writeClipboardText(text).then(
      () => setStatusText("已复制正文到剪贴板"),
      () => setStatusText("复制失败，请手动选择文本"),
    );
  }, [editing, prompt, setStatusText]);

  const openPasteImport = useCallback(() => {
    setPasteDraft("");
    setPasteImportOpen(true);
    if (editing) setEditing(false);
  }, [editing]);

  const readPasteClipboard = useCallback(() => {
    void readClipboardText().then(
      (text) => setPasteDraft(text),
      () => setStatusText("读取剪贴板失败"),
    );
  }, [setStatusText]);

  const commitPasteImport = useCallback(() => {
    const clip = pasteDraft.trim();
    if (!clip) {
      setStatusText("没有可导入的文本");
      return;
    }
    const base = editing ? (editRef.current?.innerText ?? prompt) : prompt;
    savePromptWithLimit(`${base}${base ? "\n" : ""}${clip}`, "已粘贴导入到正文");
    setPasteImportOpen(false);
  }, [editing, pasteDraft, prompt, savePromptWithLimit, setStatusText]);

  const handleDownloadBody = useCallback(() => {
    const text = editing ? (editRef.current?.innerText ?? prompt) : prompt;
    if (!text.trim()) {
      setStatusText("正文为空，无法下载");
      return;
    }
    const safeLabel = (data.label ?? "文本")
      .replace(/[<>:"/\\|?*]/g, "_")
      .trim()
      .slice(0, 48);
    downloadTextAsFile(text, `${safeLabel || "text"}.txt`);
    setStatusText("已下载正文");
  }, [data.label, editing, prompt, setStatusText]);

  useEffect(() => {
    if (!pasteImportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPasteImportOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pasteImportOpen]);

  const { onResizePointerDown } = useTextNodeFrameResize(id, showResizeHandle);

  useEffect(() => {
    if (!selected) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const inPanel = bottomPanelRef.current?.contains(target);
      const inToolbar = previewToolbarRef.current?.contains(target);
      const inVideoGen = document.querySelector(".videoGenPanel--chrome")?.contains(target);
      if (inVideoGen) return;
      if (!inPanel && !inToolbar) {
        document.getSelection()?.removeAllRanges();
        (document.activeElement as HTMLElement)?.blur?.();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editing) {
        saveFromEditor();
        setEditing(false);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const t = e.target;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
        if ((t as HTMLElement).isContentEditable) return;
        e.preventDefault();
        deleteSelection();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteSelection, editing, saveFromEditor, selected]);

  const bodyLineCount = useMemo(() => {
    if (!hasBody) return 1;
    return prompt.split(/\r?\n/).length;
  }, [hasBody, prompt]);

  const frameSize = useMemo(
    () =>
      computeTextNodeFrameSize({
        hasBody,
        chromeWidth: params.chromeWidth,
        chromeHeight: params.chromeHeight,
        bodyLineCount,
      }),
    [bodyLineCount, hasBody, params.chromeHeight, params.chromeWidth],
  );

  const nodeStatus = data.status;
  const isGenerating =
    nodeStatus?.status === "running" || nodeStatus?.status === "pending";
  const genProgress =
    isGenerating && typeof nodeStatus?.progress === "number" && Number.isFinite(nodeStatus.progress)
      ? Math.round(nodeStatus.progress)
      : null;
  const metaText = hasBody ? `${prompt.length} 字` : null;

  const commitLabel = useCallback(
    (next: string | undefined) => updateNodeData(id, { label: next }),
    [id, updateNodeData],
  );

  const showBottomPortal = !isComposerExpanded && showComposerPortal;

  const shellClass = [
    "minimal-text-node",
    "textNodeChrome",
    "textNodeChrome--integrated",
    hasBody ? "textNodeChrome--hasBody" : "",
    userSizedShell ? "textNodeChrome--userSized" : "",
    editing ? "textNodeChrome--editing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const renderEmptyShell = () => (
    <div
      className="textNodeEmptyShell"
      onDoubleClick={enterEditing}
      onWheel={stopWheel}
      title={TEXT_EMPTY_PROMPT}
    >
      <div className="textNodeEmptyShellIcon" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M14 2v6h6M8 13h8M8 17h5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="textNodeEmptyShellLabel">{TEXT_EMPTY_PROMPT}</p>
    </div>
  );

  const renderBody = () => {
    if (editing) {
      return (
        <div
          className={`textNodeEditable textNodeEditable--integrated ${RF_NODE_INPUT_CLASS}`}
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={TEXT_EMPTY_PROMPT}
          onPointerDown={stop}
          onWheel={stopWheel}
          onBlur={() => {
            saveFromEditor();
            setEditing(false);
          }}
          onPaste={clampEditableAfterPaste}
        />
      );
    }
    if (hasBody) {
      return (
        <div
          className={`textNodeReadOnly textNodeReadOnly--integrated mono ${RF_NODE_INPUT_CLASS}`}
          title="双击编辑正文"
          onDoubleClick={enterEditing}
          onWheel={stopWheel}
        >
          {prompt}
        </div>
      );
    }
    return renderEmptyShell();
  };

  return (
    <>
      <NodeMetaLabel
        label={data.label ?? ""}
        defaultLabel="文本"
        onCommit={commitLabel}
      />

      <NodeMetaStatus dimsText={metaText} generating={isGenerating} progress={genProgress} />

      <NodeChromeShell
        selected={selected}
        width={frameSize.width}
        height={frameSize.height}
        previewRef={previewRef}
        shellClassName={shellClass}
        previewClassName="minimal-text-preview textNodeChrome-preview"
        afterPreview={<NodeAnchors nodeId={id} nodeType={type} variant="simple" />}
      >
        <div className="textNodeChrome-inner textNodeChrome-inner--integrated">
          <div className="textNodeChrome-body textNodeChrome-body--integrated">{renderBody()}</div>
          {showResizeHandle ? (
            <TextNodeResizeHandle onResizePointerDown={onResizePointerDown} />
          ) : null}
        </div>
      </NodeChromeShell>

      <TextPreviewToolbarPortal
        anchorRef={previewRef}
        active={showPreviewTopPortal}
        toolbarRef={previewToolbarRef}
        onFormatExec={handleFormatExec}
        showFormat={showFormatInToolbar}
        onSyncFromScript={hasScriptUpstream ? handleSyncFromScript : undefined}
        onCopyBody={hasBody ? handleCopyBody : undefined}
        onExpandEdit={openExpandEdit}
        onPasteImport={openPasteImport}
        onDownloadBody={handleDownloadBody}
      />

      <TextNodeExpandEditModal
        open={expandEditOpen}
        draft={expandDraft}
        maxChars={DEEP_THINKING_MAX_INPUT_CHARS}
        onDraftChange={setExpandDraft}
        onClose={() => setExpandEditOpen(false)}
        onCommit={commitExpandEdit}
        onWheel={stopWheel}
      />

      <TextNodePasteImportModal
        open={pasteImportOpen}
        target="prompt"
        draft={pasteDraft}
        maxChars={DEEP_THINKING_MAX_INPUT_CHARS}
        onDraftChange={setPasteDraft}
        onClose={() => setPasteImportOpen(false)}
        onReadClipboard={readPasteClipboard}
        onCommit={commitPasteImport}
        onWheel={stopWheel}
      />

      <TextNodeBottomPortal
        anchorRef={previewRef}
        active={showBottomPortal}
        panelWidth={frameSize.width}
        panelRef={bottomPanelRef}
      >
        {showComposerPortal ? (
          <TextComposerPanel
            nodeId={id}
            layout={composerLayout}
            hideChromeHead={
              !hasBody && (composerLayout === "default" || composerLayout === "textToMusic")
            }
            onRequestPin={hasBody && !isComposerPinned ? pinComposer : undefined}
            onRequestUnpin={hasBody && isComposerPinned ? unpinComposer : undefined}
            onRequestClose={hasBody && isComposerPinned ? unpinComposer : undefined}
            onPointerDown={stop}
            onWheel={stopWheel}
          />
        ) : null}
      </TextNodeBottomPortal>
    </>
  );
}
