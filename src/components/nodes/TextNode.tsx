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
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import type { FlowNodeData, TextWorkflowKind } from "@/lib/types";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { textNodeSubtitle } from "@/lib/nodeUiStrings";
import { TextNodeComposerBar } from "@/components/nodes/TextNodeComposerBar";
import { TextNodeComposerInput } from "@/components/nodes/TextNodeComposerInput";
import { TextNodeExpandEditModal } from "@/components/nodes/TextNodeExpandEditModal";
import { TextNodeFormatToolbar } from "@/components/nodes/TextNodeFormatToolbar";
import { TextNodePasteImportModal } from "@/components/nodes/TextNodePasteImportModal";
import {
  TextNodeTextToMusicPanel,
  TextNodeTextToVideoPanel,
} from "@/components/nodes/TextNodeWorkflowPanels";
import { useProjectStore } from "@/store/projectStore";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import {
  getProviderSelectionPatch,
  loadEnabledProviderOptions,
  type TextNodeProviderOption,
} from "@/lib/textNodeProviders";
import { dispatchTextNodeComposerRun } from "@/lib/textNodeDispatch";
import { downloadTextAsFile, readClipboardText, writeClipboardText } from "@/lib/textNodeClipboard";

function TextDocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 12h8M8 16h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

type TextParams = {
  textChrome?: boolean;
  textWorkflow?: TextWorkflowKind;
  /** 下方模型对话输入（与上方正文 prompt 解耦） */
  textModelInput?: string;
  /** DAG 执行时指定 Provider（对齐设置页 providers.id） */
  providerId?: string;
  /** DAG 执行时指定模型（默认沿用 Provider 的 model） */
  model?: string;
};
const DEEP_THINKING_MAX_INPUT_CHARS = 200000;

function getParams(data: FlowNodeData): TextParams {
  const p = data.params;
  if (!p || typeof p !== "object") return {};
  return p as TextParams;
}

/** 图一 初始空态 · 图二 选中出底栏 · 图三 有正文 · 文本工具/缩放见节点右键菜单 · 图五 双击编辑与浮动格式条 */
export function TextNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const runNodeSubgraph = useProjectStore((s) => s.runNodeSubgraph);
  const { multiSelect } = useNodeExpandedChrome(selected);
  const uiSelected = selected;

  const prompt = data.prompt ?? "";
  const hasBody = prompt.trim().length > 0;
  const params = getParams(data);
  const textChrome = Boolean(params.textChrome);
  const textWorkflow = params.textWorkflow;
  const modelInput = (params.textModelInput ?? "").toString();

  const [editing, setEditing] = useState(false);
  const [expandEditOpen, setExpandEditOpen] = useState(false);
  const [expandDraft, setExpandDraft] = useState("");
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [pasteImportDraft, setPasteImportDraft] = useState("");
  const [pasteImportTarget, setPasteImportTarget] = useState<"prompt" | "model">("prompt");
  const [providerOptions, setProviderOptions] = useState<TextNodeProviderOption[]>([]);
  const editRef = useRef<HTMLDivElement>(null);

  const stop = useCallback((e: SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const stopWheel = useCallback((e: ReactWheelEvent) => {
    e.stopPropagation();
  }, []);

  const mergeParams = useCallback(
    (patch: Partial<TextParams>) => {
      const base =
        data.params && typeof data.params === "object" ? { ...data.params } : {};
      updateNodeData(id, { params: { ...base, ...patch } });
    },
    [data.params, id, updateNodeData],
  );

  useEffect(() => {
    if (!selected) return;
    void (async () => {
      const list = await loadEnabledProviderOptions();
      setProviderOptions(list);
    })();
  }, [selected]);

  const selectedProviderId = useMemo(() => (params.providerId ?? "").toString(), [params.providerId]);

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
      } else {
        setStatusText(savedTip);
      }
      return limited.text;
    },
    [clampByDeepThinkingLimit, id, setStatusText, updateNodeData],
  );

  const openPasteImportForPrompt = useCallback(() => {
    setPasteImportDraft("");
    setPasteImportTarget("prompt");
    setPasteImportOpen(true);
  }, []);

  const openPasteImportForModel = useCallback(() => {
    setPasteImportDraft("");
    setPasteImportTarget("model");
    setPasteImportOpen(true);
  }, []);

  const readClipboardToImportDraft = useCallback(async () => {
    try {
      const raw = await readClipboardText();
      const limited = clampByDeepThinkingLimit(raw);
      setPasteImportDraft(limited.text);
      if (!raw) {
        setStatusText("剪贴板为空");
      } else if (limited.clipped) {
        setStatusText(`剪贴板内容超长，已截断到 ${DEEP_THINKING_MAX_INPUT_CHARS} 字`);
      }
    } catch {
      setStatusText("读取剪贴板失败，请手动粘贴到输入框");
    }
  }, [clampByDeepThinkingLimit, setStatusText]);

  const saveModelInputWithLimit = useCallback(
    (next: string) => {
      const limited = clampByDeepThinkingLimit(next);
      mergeParams({ textModelInput: limited.text });
      if (limited.clipped) {
        setStatusText(`已超出深度思考模型上限，已截断到 ${DEEP_THINKING_MAX_INPUT_CHARS} 字`);
      }
      return limited.text;
    },
    [clampByDeepThinkingLimit, mergeParams, setStatusText],
  );

  const commitPasteImport = useCallback(() => {
    if (pasteImportTarget === "model") {
      const merged = `${modelInput}${modelInput ? "\n" : ""}${pasteImportDraft}`;
      saveModelInputWithLimit(merged);
      setStatusText("已导入到模型对话输入");
      setPasteImportOpen(false);
      return;
    }
    const merged = `${prompt}${prompt ? "\n" : ""}${pasteImportDraft}`;
    const next = savePromptWithLimit(merged, "已导入粘贴文本");
    if (editRef.current) editRef.current.textContent = next;
    setPasteImportOpen(false);
  }, [modelInput, pasteImportDraft, pasteImportTarget, prompt, saveModelInputWithLimit, savePromptWithLimit, setStatusText]);

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
    const next = savePromptWithLimit(t, "已保存正文");
    el.textContent = next;
  }, [savePromptWithLimit]);

  const saveWriteSelfFromEditor = useCallback(() => {
    const el = editRef.current;
    if (!el) return;
    const t = el.innerText ?? "";
    if (!t.trim()) return;
    const base =
      data.params && typeof data.params === "object" ? { ...data.params } : {};
    delete (base as TextParams).textWorkflow;
    const limited = clampByDeepThinkingLimit(t);
    updateNodeData(id, { prompt: limited.text, params: base });
    if (limited.clipped) {
      setStatusText(`已超出深度思考模型上限，已截断到 ${DEEP_THINKING_MAX_INPUT_CHARS} 字`);
    }
  }, [clampByDeepThinkingLimit, data.params, id, setStatusText, updateNodeData]);

  useEffect(() => {
    if (!hasBody && textWorkflow === "writeSelf") {
      requestAnimationFrame(() => editRef.current?.focus());
    }
  }, [hasBody, textWorkflow]);

  useEffect(() => {
    if (!selected) {
      requestAnimationFrame(() => setEditing(false));
    }
  }, [selected]);

  useEffect(() => {
    if (multiSelect && selected) {
      requestAnimationFrame(() => setEditing(false));
      requestAnimationFrame(() => setExpandEditOpen(false));
    }
  }, [multiSelect, selected]);

  const prevEditing = useRef(false);
  useEffect(() => {
    if (editing && !prevEditing.current && editRef.current && hasBody) {
      editRef.current.textContent = prompt;
      requestAnimationFrame(() => {
        const el = editRef.current;
        if (!el) return;
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
    }
    prevEditing.current = editing;
  }, [editing, hasBody, prompt]);

  const onBodyDoubleClick = (e: ReactMouseEvent) => {
    if (!hasBody) return;
    e.stopPropagation();
    setEditing(true);
  };

  const exec = (command: string, value?: string) => {
    editRef.current?.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      /* ignore */
    }
  };

  const copyContent = useCallback(async () => {
    const text = editRef.current?.innerText ?? prompt;
    try {
      await writeClipboardText(text);
      setStatusText("已复制到剪贴板");
    } catch {
      setStatusText("复制失败，请手动选择文本复制");
    }
  }, [prompt, setStatusText]);

  const openExpandEdit = useCallback(() => {
    const t = editRef.current?.innerText ?? prompt;
    setExpandDraft(t);
    setExpandEditOpen(true);
  }, [prompt]);

  const commitExpandEdit = useCallback(() => {
    const next = savePromptWithLimit(expandDraft);
    if (editRef.current) editRef.current.textContent = next;
    setExpandEditOpen(false);
  }, [expandDraft, savePromptWithLimit]);

  const cancelExpandEdit = useCallback(() => {
    setExpandEditOpen(false);
  }, []);

  useEffect(() => {
    if (!expandEditOpen && !pasteImportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setExpandEditOpen(false);
        setPasteImportOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandEditOpen, pasteImportOpen]);

  const downloadTxt = () => {
    downloadTextAsFile(prompt, `${(data.label ?? "文本").trim() || "文本"}.txt`);
    setStatusText("已下载文本文件");
  };

  const handleProviderChange = useCallback(
    (providerId: string) => {
      if (!providerId) {
        const base = {
          ...(data.params && typeof data.params === "object" ? data.params : {}),
        } as Record<string, unknown>;
        delete base.providerId;
        delete base.model;
        updateNodeData(id, { params: base });
        return;
      }
      const patch = getProviderSelectionPatch(providerId, providerOptions);
      mergeParams(patch);
    },
    [data.params, id, mergeParams, providerOptions, updateNodeData],
  );

  const handleComposerSend = useCallback(
    (e: SyntheticEvent) => {
      stop(e);
      const projectPath = useProjectStore.getState().projectPath;
      void dispatchTextNodeComposerRun({
        nodeId: id,
        projectPath,
        prompt,
        modelInput,
        runNodeSubgraph,
        updateNodeData,
        setStatusText,
      });
    },
    [id, modelInput, prompt, runNodeSubgraph, setStatusText, stop, updateNodeData],
  );

  const showScriptComposer =
    uiSelected &&
    !editing &&
    (hasBody || textWorkflow === "writeSelf") &&
    textWorkflow !== "textToVideo" &&
    textWorkflow !== "textToMusic";

  const composer = showScriptComposer ? (
    <div className={`scriptGenComposer ${RF_NODE_INPUT_CLASS}`} onPointerDown={stop} onWheel={stopWheel}>
      <TextNodeComposerInput
        hasBody={hasBody}
        value={modelInput}
        maxChars={DEEP_THINKING_MAX_INPUT_CHARS}
        onChange={saveModelInputWithLimit}
        onPointerDown={stop}
        onWheel={stopWheel}
      />
      <TextNodeComposerBar
        selectedProviderId={selectedProviderId}
        providerOptions={providerOptions}
        modelInputLength={modelInput.length}
        maxChars={DEEP_THINKING_MAX_INPUT_CHARS}
        onProviderChange={handleProviderChange}
        onOpenPasteImport={openPasteImportForModel}
        onSend={handleComposerSend}
        onPointerDown={stop}
      />
    </div>
  ) : null;

  const workflowBottomPanel =
    selected && !editing && textWorkflow === "textToVideo" ? (
      <TextNodeTextToVideoPanel />
    ) : selected && !editing && textWorkflow === "textToMusic" ? (
      <TextNodeTextToMusicPanel />
    ) : null;

  const rootClass = [
    "textNodeCard",
    hasBody ? "textNodeCard--hasBody" : "",
    selected && !hasBody ? "textNodeCard--emptySelected" : "",
    textChrome && hasBody ? "textNodeCard--chrome" : "",
    editing ? "textNodeCard--editing" : "",
    textWorkflow === "textToVideo" ? "textNodeCard--ttv" : "",
    textWorkflow === "textToMusic" ? "textNodeCard--ttm" : "",
    textWorkflow === "writeSelf" && !hasBody ? "textNodeCard--writeSelf" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const splitExpanded =
    selected && !editing && Boolean(composer || workflowBottomPanel);

  const textUpperSplit = (
    <>
      {!hasBody && textWorkflow === undefined ? (
        <button
          type="button"
          className={`scriptGenEmptyCard textNodeFigure3Empty ${RF_NODE_INPUT_CLASS}`}
          onPointerDown={stop}
          onClick={(e) => {
            stop(e);
            mergeParams({ textWorkflow: "writeSelf" });
            setStatusText("在此输入正文");
          }}
        >
          <p className="textNodeFigure3Hint">请编写内容，开始你的创作。</p>
          <div className="scriptGenEmptyGlyph" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>
        </button>
      ) : null}
      {uiSelected && !hasBody && textWorkflow === "writeSelf" ? (
        <div className={`textNodeEditChrome textNodeWriteSelfHost ${RF_NODE_INPUT_CLASS}`} onPointerDown={stop}>
          <TextNodeFormatToolbar
            onExec={exec}
            onCopy={() => void copyContent()}
            onPasteImport={openPasteImportForPrompt}
            onExpand={openExpandEdit}
          />
          <div
            ref={editRef}
            className={`textNodeEditable textNodeWriteSelfEditable ${RF_NODE_INPUT_CLASS}`}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="输入内容..."
            onPointerDown={stop}
            onWheel={stopWheel}
            onBlur={() => saveWriteSelfFromEditor()}
            onPaste={clampEditableAfterPaste}
          />
        </div>
      ) : null}
      {uiSelected && !hasBody && textWorkflow === "imageToPrompt" ? (
        <div className={`scriptGenEmptyCard ${RF_NODE_INPUT_CLASS}`}>
          <div className="scriptGenEmptyGlyph" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : null}
      {hasBody ? (
        <div className="textNodeBodyWrap">
          {textChrome ? (
            <button
              type="button"
              className={`textNodeDownloadFloat ${RF_NODE_INPUT_CLASS}`}
              title="下载为 .txt"
              onPointerDown={stop}
              onClick={(e) => {
                stop(e);
                downloadTxt();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
          {editing ? (
            <div className={`textNodeEditChrome ${RF_NODE_INPUT_CLASS}`} onPointerDown={stop}>
              <TextNodeFormatToolbar
                onExec={exec}
                onCopy={() => void copyContent()}
                onPasteImport={openPasteImportForPrompt}
                onExpand={openExpandEdit}
              />
              <div
                ref={editRef}
                className={`textNodeEditable ${RF_NODE_INPUT_CLASS}`}
                contentEditable
                suppressContentEditableWarning
                onPointerDown={stop}
                onWheel={stopWheel}
                onBlur={() => {
                  saveFromEditor();
                  setEditing(false);
                }}
                onPaste={clampEditableAfterPaste}
              />
            </div>
          ) : (
            <div
              className={`textNodeReadOnly mono ${RF_NODE_INPUT_CLASS} ${textChrome ? "textNodeReadOnly--chrome" : ""}`}
              title="双击可编辑正文"
              onDoubleClick={onBodyDoubleClick}
              onPointerDown={stop}
              onWheel={stopWheel}
            >
              {prompt}
            </div>
          )}
        </div>
      ) : null}
      <MagneticNodeAnchors nodeId={id} nodeType={type} />
    </>
  );

  const textLowerSplit = (
    <>
      {!hasBody && (textWorkflow === "textToVideo" || textWorkflow === "textToMusic") ? (
        <div className="textNodeWorkflowHint mono">
          {textWorkflow === "textToVideo"
            ? "已连接下游视频节点，可在下方配置文生视频参数。"
            : "已连接下游音频节点，可在下方配置音乐生成。"}
        </div>
      ) : null}
      {composer}
      {workflowBottomPanel}
    </>
  );

  return (
    <>
      <NodeFrame
        defaultTitle="文本"
        label={data.label}
        nodeId={id}
        selected={selected}
        tone="text"
        icon={<TextDocIcon />}
        subtitle={textNodeSubtitle(hasBody, prompt)}
        rootClassName={rootClass}
        expandedSplit={splitExpanded}
        upperBody={splitExpanded ? textUpperSplit : undefined}
        floatingBottomOverlay={splitExpanded ? <div className="nodeFloatingBottomPanel">{textLowerSplit}</div> : undefined}
        lowerBody={undefined}
      >
        {!splitExpanded ? (
          <>
            {!hasBody && textWorkflow === undefined ? (
              <button
                type="button"
                className={`scriptGenEmptyCard textNodeFigure3Empty ${RF_NODE_INPUT_CLASS}`}
                onPointerDown={stop}
                onClick={(e) => {
                  stop(e);
                  mergeParams({ textWorkflow: "writeSelf" });
                  setStatusText("在此输入正文");
                }}
              >
                <p className="textNodeFigure3Hint">请编写内容，开始你的创作。</p>
                <div className="scriptGenEmptyGlyph" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </button>
            ) : null}
            {uiSelected && !hasBody && textWorkflow === "writeSelf" ? (
              <div className={`textNodeEditChrome textNodeWriteSelfHost ${RF_NODE_INPUT_CLASS}`} onPointerDown={stop}>
                <TextNodeFormatToolbar
                  onExec={exec}
                  onCopy={() => void copyContent()}
                  onPasteImport={openPasteImportForPrompt}
                  onExpand={openExpandEdit}
                />
                <div
                  ref={editRef}
                  className={`textNodeEditable textNodeWriteSelfEditable ${RF_NODE_INPUT_CLASS}`}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="输入内容..."
                  onPointerDown={stop}
                  onWheel={stopWheel}
                  onBlur={() => saveWriteSelfFromEditor()}
                  onPaste={clampEditableAfterPaste}
                />
              </div>
            ) : null}
            {uiSelected && !hasBody && textWorkflow === "imageToPrompt" ? (
              <div className={`scriptGenEmptyCard ${RF_NODE_INPUT_CLASS}`}>
                <div className="scriptGenEmptyGlyph" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
            {uiSelected && !hasBody && (textWorkflow === "textToVideo" || textWorkflow === "textToMusic") ? (
              <>
                <div className="textNodeWorkflowHint mono">
                  {textWorkflow === "textToVideo"
                    ? "已连接下游视频节点，可在下方配置文生视频参数。"
                    : "已连接下游音频节点，可在下方配置音乐生成。"}
                </div>
                {workflowBottomPanel}
              </>
            ) : null}
            {hasBody ? (
              <div className="textNodeBodyWrap">
                {textChrome ? (
                  <button
                    type="button"
                    className={`textNodeDownloadFloat ${RF_NODE_INPUT_CLASS}`}
                    title="下载为 .txt"
                    onPointerDown={stop}
                    onClick={(e) => {
                      stop(e);
                      downloadTxt();
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                ) : null}
                {editing ? (
                  <div className={`textNodeEditChrome ${RF_NODE_INPUT_CLASS}`} onPointerDown={stop}>
                    <TextNodeFormatToolbar
                      onExec={exec}
                      onCopy={() => void copyContent()}
                      onPasteImport={openPasteImportForPrompt}
                      onExpand={openExpandEdit}
                    />
                    <div
                      ref={editRef}
                      className={`textNodeEditable ${RF_NODE_INPUT_CLASS}`}
                      contentEditable
                      suppressContentEditableWarning
                      onPointerDown={stop}
                      onWheel={stopWheel}
                      onBlur={() => {
                        saveFromEditor();
                        setEditing(false);
                      }}
                      onPaste={clampEditableAfterPaste}
                    />
                  </div>
                ) : (
                  <div
                    className={`textNodeReadOnly mono ${RF_NODE_INPUT_CLASS} ${textChrome ? "textNodeReadOnly--chrome" : ""}`}
                    title="双击可编辑正文"
                    onDoubleClick={onBodyDoubleClick}
                    onPointerDown={stop}
                    onWheel={stopWheel}
                  >
                    {prompt}
                  </div>
                )}
                {composer}
                {workflowBottomPanel}
              </div>
            ) : null}

            <MagneticNodeAnchors nodeId={id} nodeType={type} />
          </>
        ) : null}
      </NodeFrame>

      <TextNodeExpandEditModal
        open={expandEditOpen}
        draft={expandDraft}
        maxChars={DEEP_THINKING_MAX_INPUT_CHARS}
        onDraftChange={setExpandDraft}
        onClose={cancelExpandEdit}
        onCommit={commitExpandEdit}
        onWheel={stopWheel}
      />
      <TextNodePasteImportModal
        open={pasteImportOpen}
        target={pasteImportTarget}
        draft={pasteImportDraft}
        maxChars={DEEP_THINKING_MAX_INPUT_CHARS}
        onDraftChange={setPasteImportDraft}
        onClose={() => setPasteImportOpen(false)}
        onReadClipboard={() => void readClipboardToImportDraft()}
        onCommit={commitPasteImport}
        onWheel={stopWheel}
      />
    </>
  );
}
