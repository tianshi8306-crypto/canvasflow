import {
  memo,
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
import type { FlowNodeData, TextWorkflowKind } from "@/lib/types";
import {
  NodeChromeProvider,
  NodeChromeShell,
  NodeMetaLabel,
  NodeMetaStatus,
  NodePanelPlaceholder,
} from "@/components/nodes/nodeChrome";
import { computeTextNodeFrameSize } from "@/lib/textNodeChrome";
import { TextComposerPanel } from "@/components/nodes/TextComposerPanel";
import { TextNodeBottomPortal } from "@/components/nodes/TextNodeBottomPortal";
import { GEN_PANEL_CHROME_WIDTH } from "@/hooks/useNodeGenerationChrome";
import { TextPreviewToolbarPortal } from "@/components/nodes/TextPreviewToolbarPortal";
import { TextNodeResizeHandle } from "@/components/nodes/TextNodeResizeHandle";
import { TextPromptDocSurface, type TextPromptDocSurfaceHandle } from "@/components/nodes/TextPromptDocSurface";
import { orderedIncomingScriptNodeIds } from "@/lib/incomingScriptBinding";
import { isPassiveTextContainer } from "@/lib/textNodeContainerMode";
import { hasUpstreamForTextProcessing } from "@/lib/textNodeUpstreamProcess";
import {
  writeClipboardText,
} from "@/lib/textNodeClipboard";
import { isTextInputTarget } from "@/lib/canvasInteraction";
import { applyFormatExec } from "@/lib/textPromptFormatExec";
import { htmlToMarkdown } from "@/lib/textPromptHtml";
import { normalizeTextPromptMarkdown } from "@/lib/textPromptMarkdown";
import { useTextNodeFrameResize } from "@/hooks/useTextNodeFrameResize";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./TextNodeChrome.css";
import "./TextPromptDocument.css";

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
function TextNodeInner({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
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
  const [editDraft, setEditDraft] = useState("");
  const editSurfaceRef = useRef<TextPromptDocSurfaceHandle>(null);
  const pendingFormatRef = useRef<{ command: string; value?: string } | null>(null);
  const setTextPreviewExpandedNodeId = useCanvasUiStore((s) => s.setTextPreviewExpandedNodeId);

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
      const normalized = normalizeTextPromptMarkdown(next);
      const limited = clampByDeepThinkingLimit(normalized);
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


  const saveEditDraft = useCallback(
    (draft: string, savedTip = "") => {
      const next = savePromptWithLimit(draft, savedTip);
      setEditDraft(next);
      return next;
    },
    [savePromptWithLimit],
  );

  const saveFromEditor = useCallback(() => {
    saveEditDraft(editDraft, "");
  }, [editDraft, saveEditDraft]);

  const prevSelectedRef = useRef(selected);
  useEffect(() => {
    const wasSelected = prevSelectedRef.current;
    prevSelectedRef.current = selected;
    if (wasSelected && !selected) {
      if (editing) {
        saveFromEditor();
      }
      setEditing(false);
    }
  }, [editing, saveFromEditor, selected]);

  useEffect(() => {
    if (multiSelect && selected) {
      requestAnimationFrame(() => setEditing(false));
    }
  }, [multiSelect, selected]);

  const prevEditing = useRef(false);
  useEffect(() => {
    if (editing && !prevEditing.current) {
      setEditDraft(prompt);
    }
    prevEditing.current = editing;
  }, [editing, prompt]);

  const requestEdit = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      if (editing) return;
      if (e.type === "click" && !uiSelected) return;
      setEditDraft(prompt);
      setEditing(true);
    },
    [editing, prompt, uiSelected],
  );

  const execFormat = useCallback(
    (command: string, value?: string) => {
      const root = editSurfaceRef.current?.getRoot();
      if (!root) return;
      root.focus();
      applyFormatExec(command, value);
      const next = htmlToMarkdown(root.innerHTML);
      const limited = clampByDeepThinkingLimit(next);
      setEditDraft(limited.text);
      if (limited.clipped) {
        setStatusText(`已超出深度思考模型上限，已截断到 ${DEEP_THINKING_MAX_INPUT_CHARS} 字`);
      }
    },
    [clampByDeepThinkingLimit, setStatusText],
  );

  const handleFormatExec = useCallback(
    (command: string, value?: string) => {
      if (!editing) {
        pendingFormatRef.current = { command, value };
        setEditDraft(prompt);
        setEditing(true);
        return;
      }
      execFormat(command, value);
    },
    [editing, execFormat, prompt],
  );

  useEffect(() => {
    if (!editing || !pendingFormatRef.current) return;
    const pending = pendingFormatRef.current;
    pendingFormatRef.current = null;
    requestAnimationFrame(() => execFormat(pending.command, pending.value));
  }, [editing, execFormat]);

  const composerLayout = "default" as const;

  const hasScriptUpstream = useMemo(
    () => orderedIncomingScriptNodeIds(nodes, edges, id).length > 0,
    [nodes, edges, id],
  );
  const hasTextUpstream = useMemo(
    () => hasUpstreamForTextProcessing(nodes, edges, id),
    [nodes, edges, id],
  );

  /** 孤立节点或接入上游文本：空态起稿 / 钉住对话 / 上游处理模式持续对话 */
  const showComposerPortal =
    expandedChrome &&
    uiSelected &&
    !editing &&
    !isPassiveContainer &&
    (!hasBody || isComposerPinned || hasTextUpstream);

  useEffect(() => {
    if (isPassiveContainer && isComposerPinned) {
      setPinnedGenPanelId(null);
    }
  }, [isPassiveContainer, isComposerPinned, setPinnedGenPanelId]);

  const showPreviewTopPortal =
    editing || (expandedChrome && (hasBody || hasScriptUpstream));
  const showFormatInToolbar = editing || (expandedChrome && hasBody);
  const showResizeHandle = expandedChrome && uiSelected && !editing;

  const openExpandEdit = useCallback(() => {
    const startInEdit = editing;
    if (editing) {
      saveFromEditor();
      setEditing(false);
    }
    setTextPreviewExpandedNodeId(id, startInEdit);
  }, [editing, id, saveFromEditor, setTextPreviewExpandedNodeId]);

  const handleCopyBody = useCallback(() => {
    const text = editing ? editDraft : prompt;
    void writeClipboardText(text).then(
      () => setStatusText("已复制正文到剪贴板"),
      () => setStatusText("复制失败，请手动选择文本"),
    );
  }, [editing, editDraft, prompt, setStatusText]);

  const { onResizePointerDown } = useTextNodeFrameResize(id, showResizeHandle);

  useEffect(() => {
    if (!selected) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const inPanel = bottomPanelRef.current?.contains(target);
      const inToolbar = previewToolbarRef.current?.contains(target);
      const inPreview = previewRef.current?.contains(target);
      const inExpandedPreview = Boolean(target.closest(".textPreviewExpanded-overlay"));
      const inVideoGen = document.querySelector(".videoGenPanel--chrome")?.contains(target);
      if (inVideoGen || inPreview || inPanel || inToolbar || inExpandedPreview) {
        return;
      }
      document.getSelection()?.removeAllRanges();
      (document.activeElement as HTMLElement)?.blur?.();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editing) {
        saveFromEditor();
        setEditing(false);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editing) return;
        const t = e.target;
        if (isTextInputTarget(t)) return;
        if (t instanceof Element && t.closest(".textPreviewExpanded-overlay")) return;
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
  const dimsText = hasBody && !isGenerating ? `${prompt.length} 字` : null;

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
      onPointerDown={(e) => e.stopPropagation()}
      onClick={requestEdit}
      onDoubleClick={requestEdit}
      onWheel={stopWheel}
      title="单击或双击编辑正文"
    >
      <NodePanelPlaceholder kind="textNode" />
    </div>
  );

  const renderBody = () => {
    if (!hasBody && !editing) return renderEmptyShell();
    return (
      <TextPromptDocSurface
        ref={editSurfaceRef}
        className="textNodeReadOnly--integrated"
        markdown={editing ? editDraft : prompt}
        editing={editing}
        clamp={!userSizedShell && !editing}
        placeholder="在此编辑正文…"
        onMarkdownChange={(next) => {
          const limited = clampByDeepThinkingLimit(next);
          setEditDraft(limited.text);
          if (limited.clipped) {
            setStatusText(`已超出深度思考模型上限，已截断到 ${DEEP_THINKING_MAX_INPUT_CHARS} 字`);
          }
        }}
        onWheel={stopWheel}
        onBlur={() => {
          saveFromEditor();
          setEditing(false);
        }}
        onRequestEdit={requestEdit}
      />
    );
  };

  return (
    <NodeChromeProvider>
      <NodeMetaLabel
        label={data.label ?? ""}
        defaultLabel="文本"
        onCommit={commitLabel}
      />
      <NodeMetaStatus dimsText={dimsText} generating={isGenerating} progress={genProgress} />

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
        onCopyBody={hasBody ? handleCopyBody : undefined}
        onExpandEdit={openExpandEdit}
      />

      <TextNodeBottomPortal
        anchorRef={previewRef}
        active={showBottomPortal}
        panelWidth={GEN_PANEL_CHROME_WIDTH}
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
    </NodeChromeProvider>
  );
}

export const TextNode = memo(TextNodeInner);
