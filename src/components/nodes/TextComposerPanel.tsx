import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { MentionInput } from "@/components/nodes/MentionInput";
import { IgpGenerateButtonIcon } from "@/components/nodes/IgpGenerateButtonIcon";
import { PanelCloseIcon, PanelExpandIcon, PanelPinIcon } from "@/components/nodes/nodePanelIcons";
import { TextProviderPicker } from "@/components/nodes/TextProviderPicker";
import { dispatchTextNodeComposerRun } from "@/lib/textNodeDispatch";
import { useNodeStatus } from "@/hooks/useNodeStatus";
import {
  getProviderSelectionPatch,
  loadEnabledProviderOptions,
  type TextNodeProviderOption,
} from "@/lib/textNodeProviders";
import { useFocusLinkedPartnerNode } from "@/hooks/canvas/useFocusLinkedPartnerNode";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { getUpstreamImageForTextNode, listTextNodeUpstreamTextSources } from "@/lib/textNodeUpstream";
import { formatUpstreamTextCharCount } from "@/lib/scriptUpstreamText";
import { useProjectStore } from "@/store/projectStore";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";

const MAX_CHARS = 200_000;

const ZONE_A_HINT_DEFAULT = "写下你想讲的故事…";
const ZONE_A_HINT_IMAGE = "图片反推提示词";
const ZONE_A_HINT_MUSIC = "文字生音乐";
const ZONE_A_HINT_EXPANDED = "模型对话";

export const IMAGE_TO_PROMPT_COMPOSER_HINT =
  "根据图片生成结构化中文提示词，包括主体描述、环境、光影、镜头语言、风格关键词。";

export const MUSIC_COMPOSER_PLACEHOLDER = "描述您想要的音乐";

export type TextComposerPanelLayout =
  | "default"
  | "expanded"
  | "imageToPrompt"
  | "textToMusic";

const MUSIC_PROMPT_MAX_CHARS = 1024;

export type TextComposerPanelProps = {
  nodeId: string;
  layout?: TextComposerPanelLayout;
  /** 图一风格：无顶栏「模型对话」标题 */
  hideChromeHead?: boolean;
  onRequestClose?: () => void;
  onRequestDock?: () => void;
  onRequestUnpin?: () => void;
  onRequestPin?: () => void;
  onPointerDown?: (e: SyntheticEvent) => void;
  onWheel?: (e: ReactWheelEvent) => void;
};

/**
 * 文本节点模型对话底栏（Chrome C2：MentionInput + Provider Picker + 生成 CTA）
 */
export function TextComposerPanel({
  nodeId,
  layout = "default",
  hideChromeHead = false,
  onRequestClose,
  onRequestDock,
  onRequestUnpin,
  onRequestPin,
  onPointerDown,
  onWheel,
}: TextComposerPanelProps) {
  const isExpandedLayout = layout === "expanded";
  const isImageToPrompt = layout === "imageToPrompt";
  const isTextToMusic = layout === "textToMusic";
  const isDefaultLayout = layout === "default";
  const promptMaxChars = isTextToMusic ? MUSIC_PROMPT_MAX_CHARS : MAX_CHARS;

  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const runNodeSubgraph = useProjectStore((s) => s.runNodeSubgraph);

  const setExpandedNodeId = useCanvasUiStore((s) => s.setTextGenPanelExpandedNodeId);
  const { focusPartnerNode } = useFocusLinkedPartnerNode();

  const { status: nodeStatus, clearStatus } = useNodeStatus(nodeId);
  const genRunRef = useRef(0);
  const [generatingLocal, setGeneratingLocal] = useState(false);
  const [providerOptions, setProviderOptions] = useState<TextNodeProviderOption[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const prompt = (node?.data.prompt ?? "").toString();
  const params =
    node?.data.params && typeof node.data.params === "object"
      ? (node.data.params as Record<string, unknown>)
      : {};
  const modelInput = (params.textModelInput ?? "").toString();
  const selectedProviderId = (params.providerId ?? "").toString();
  const linkedAudioNodeId = (params.audioNodeId ?? "").toString();

  const linkedAudioLabel = useMemo(() => {
    if (!linkedAudioNodeId) return null;
    const audio = nodes.find((n) => n.id === linkedAudioNodeId);
    return (audio?.data.label ?? "音频节点").toString();
  }, [linkedAudioNodeId, nodes]);

  const upstreamImage = useMemo(
    () => (isImageToPrompt ? getUpstreamImageForTextNode(nodeId, nodes, edges) : null),
    [edges, isImageToPrompt, nodeId, nodes],
  );

  const upstreamTextSources = useMemo(
    () => listTextNodeUpstreamTextSources(nodes, edges, nodeId),
    [edges, nodeId, nodes],
  );
  const upstreamTextChars = upstreamTextSources.reduce((sum, s) => sum + s.charCount, 0);

  const nodeLabels = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n.data.label ?? n.id])),
    [nodes],
  );

  useEffect(() => {
    let cancelled = false;
    setProvidersLoading(true);
    void (async () => {
      const list = await loadEnabledProviderOptions();
      if (!cancelled) {
        setProviderOptions(list);
        setProvidersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  const isGenerating =
    generatingLocal || nodeStatus?.status === "running" || nodeStatus?.status === "pending";

  const canGenerate = useMemo(() => {
    if (!projectPath?.trim() || isGenerating) return false;
    return Boolean(modelInput.trim() || prompt.trim());
  }, [projectPath, isGenerating, modelInput, prompt]);

  const setModelInput = useCallback(
    (next: string) => {
      const text =
        next.length <= promptMaxChars ? next : next.slice(0, promptMaxChars);
      const base =
        node?.data.params && typeof node.data.params === "object"
          ? { ...(node.data.params as Record<string, unknown>) }
          : {};
      updateNodeData(nodeId, { params: { ...base, textModelInput: text } });
      if (next.length > promptMaxChars) {
        setStatusText(`已超出输入上限，已截断到 ${promptMaxChars} 字`);
      }
    },
    [node?.data.params, nodeId, promptMaxChars, setStatusText, updateNodeData],
  );

  const seededI2pRef = useRef(false);
  useEffect(() => {
    if (!isImageToPrompt) {
      seededI2pRef.current = false;
      return;
    }
    if (modelInput.trim() || seededI2pRef.current) return;
    seededI2pRef.current = true;
    setModelInput(IMAGE_TO_PROMPT_COMPOSER_HINT);
  }, [isImageToPrompt, modelInput, setModelInput]);

  const handleProviderChange = useCallback(
    (providerId: string) => {
      const base =
        node?.data.params && typeof node.data.params === "object"
          ? { ...(node.data.params as Record<string, unknown>) }
          : {};
      if (!providerId) {
        delete base.providerId;
        delete base.model;
        updateNodeData(nodeId, { params: base });
        return;
      }
      const patch = getProviderSelectionPatch(providerId, providerOptions);
      updateNodeData(nodeId, { params: { ...base, ...patch } });
    },
    [node?.data.params, nodeId, providerOptions, updateNodeData],
  );

  const handleCancelGenerate = useCallback(() => {
    genRunRef.current += 1;
    clearStatus();
    setGeneratingLocal(false);
    setStatusText("已取消文本生成");
  }, [clearStatus, setStatusText]);

  const handleGenerate = useCallback(() => {
    if (isGenerating) {
      handleCancelGenerate();
      return;
    }
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程目录");
      return;
    }
    if (!modelInput.trim() && !prompt.trim()) {
      setStatusText("请先输入模型对话或正文");
      return;
    }

    const runId = genRunRef.current + 1;
    genRunRef.current = runId;
    setGeneratingLocal(true);

    void (async () => {
      try {
        await dispatchTextNodeComposerRun({
          nodeId,
          projectPath,
          prompt,
          modelInput,
          runNodeSubgraph,
          updateNodeData,
          setStatusText,
        });
      } catch {
        /* runNodeTaskAgent 已写入状态 */
      } finally {
        if (genRunRef.current === runId) {
          setGeneratingLocal(false);
        }
      }
    })();
  }, [
    handleCancelGenerate,
    isGenerating,
    modelInput,
    nodeId,
    projectPath,
    prompt,
    runNodeSubgraph,
    setStatusText,
    updateNodeData,
  ]);

  const handleExpandClick = useCallback(() => {
    setExpandedNodeId(nodeId);
  }, [nodeId, setExpandedNodeId]);

  const handleFocusLinkedAudio = useCallback(() => {
    if (!linkedAudioNodeId) return;
    void focusPartnerNode(linkedAudioNodeId, { kind: "audio", label: linkedAudioLabel ?? undefined });
  }, [focusPartnerNode, linkedAudioLabel, linkedAudioNodeId]);

  const handleFocusUpstreamImage = useCallback(() => {
    if (!upstreamImage?.nodeId) return;
    void focusPartnerNode(upstreamImage.nodeId, { kind: "image" });
  }, [focusPartnerNode, upstreamImage?.nodeId]);

  const handleFocusUpstreamText = useCallback(
    (sourceNodeId: string) => {
      const source = upstreamTextSources.find((s) => s.nodeId === sourceNodeId);
      void focusPartnerNode(sourceNodeId, {
        label: source?.label,
      });
    },
    [focusPartnerNode, upstreamTextSources],
  );

  const textareaClass = isExpandedLayout
    ? "mention-input-wrapper imageGenPanelTextarea imageGenPanelTextarea--expanded"
    : "mention-input-wrapper imageGenPanelTextarea imageGenPanelTextarea--minimal";

  const placeholder = isImageToPrompt
    ? IMAGE_TO_PROMPT_COMPOSER_HINT
    : isTextToMusic
      ? MUSIC_COMPOSER_PLACEHOLDER
      : "写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看星星。";

  const panelClass = [
    "scriptGenComposer",
    "textGenPanel--chrome",
    "textGenPanel--v2",
    "imageGenPanel--minimal-inner",
    isExpandedLayout ? "tgp-layout-expanded" : "tgp-layout-default",
    isImageToPrompt ? "tgp-layout-imageToPrompt" : "",
    isTextToMusic ? "tgp-layout-textToMusic" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const zoneAHint = isExpandedLayout
    ? ZONE_A_HINT_EXPANDED
    : isImageToPrompt
      ? ZONE_A_HINT_IMAGE
      : isTextToMusic
        ? ZONE_A_HINT_MUSIC
        : upstreamTextSources.length > 0
          ? `上游 ${formatUpstreamTextCharCount(upstreamTextChars)} 字`
          : ZONE_A_HINT_DEFAULT;

  const showZoneA = isExpandedLayout || !hideChromeHead || isImageToPrompt || isTextToMusic;
  const zoneAActions = isExpandedLayout ? (
    <>
      {onRequestDock ? (
        <button
          type="button"
          className="mmChromeIconBtn tgpChromeIconBtn"
          title="钉回节点下方"
          aria-label="钉回节点"
          onClick={onRequestDock}
        >
          <PanelPinIcon />
        </button>
      ) : null}
      {onRequestClose ? (
        <button
          type="button"
          className="mmChromeIconBtn tgpChromeIconBtn"
          title="关闭 (Esc)"
          aria-label="关闭"
          onClick={onRequestClose}
        >
          <PanelCloseIcon />
        </button>
      ) : null}
    </>
  ) : (
    <>
      {isDefaultLayout ? (
        <button
          type="button"
          className="mmChromeIconBtn tgpChromeIconBtn"
          title="展开面板"
          aria-label="展开面板"
          onClick={handleExpandClick}
        >
          <PanelExpandIcon />
        </button>
      ) : null}
      {onRequestPin ? (
        <button
          type="button"
          className="mmChromeIconBtn tgpChromeIconBtn"
          title="钉住面板"
          aria-label="钉住面板"
          onClick={onRequestPin}
        >
          <PanelPinIcon />
        </button>
      ) : null}
      {onRequestUnpin ? (
        <button
          type="button"
          className="mmChromeIconBtn tgpChromeIconBtn tgpChromeIconBtn--pinned"
          title="取消钉住"
          aria-label="取消钉住"
          onClick={onRequestUnpin}
        >
          <PanelPinIcon />
        </button>
      ) : null}
      {onRequestClose ? (
        <button
          type="button"
          className="mmChromeIconBtn tgpChromeIconBtn"
          title="收起面板"
          aria-label="收起面板"
          onClick={onRequestClose}
        >
          <PanelCloseIcon />
        </button>
      ) : null}
    </>
  );

  return (
    <div
      className={panelClass}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      {isTextToMusic ? (
        <div className="tgp-ttm-refRow">
          {linkedAudioNodeId ? (
            <div className="tgp-ttm-refRowInner">
              <p className="tgp-ttm-linked">
                已关联「{linkedAudioLabel}」— 音色与导出请在音频节点底栏配置
              </p>
              <button
                type="button"
                className="tgp-partner-focusBtn"
                onPointerDown={onPointerDown}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFocusLinkedAudio();
                }}
              >
                定位音频节点
              </button>
            </div>
          ) : (
            <p className="tgp-ttm-missing">请从锚点连接音频节点</p>
          )}
        </div>
      ) : null}

      <div className="tgp-v2-stack">
        {showZoneA ? (
          <div className="tgp-v2-zone-a">
            <div className="tgp-v2-zone-a-start">
              {upstreamTextSources.length > 0 && !isImageToPrompt && !isTextToMusic ? (
                <div className="tgp-upstream-text-tags" aria-label="上游文本节点">
                  {upstreamTextSources.map((source) => (
                    <button
                      key={source.nodeId}
                      type="button"
                      className="tgp-upstream-text-tag"
                      title={`定位上游「${source.label}」· ${formatUpstreamTextCharCount(source.charCount)} 字`}
                      onPointerDown={onPointerDown}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFocusUpstreamText(source.nodeId);
                      }}
                    >
                      {source.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <span className="tgp-v2-hint">{zoneAHint}</span>
            </div>
            <div className="tgp-v2-zone-a-actions">{zoneAActions}</div>
          </div>
        ) : null}

        <div className="igp-prompt-wrap tgp-prompt-wrap tgp-v2-zone-b">
          <MentionInput
            nodeId={nodeId}
            value={modelInput}
            onChange={setModelInput}
            placeholder={placeholder}
            className={textareaClass}
            nodeLabels={nodeLabels}
          />
          <span className="igp-counter vgp-prompt-counter tgp-prompt-counter" aria-live="polite">
            {modelInput.length}/{promptMaxChars}
          </span>
        </div>

        {isImageToPrompt ? (
          <div className="tgp-v2-zone-c tgp-v2-zone-c--i2p">
            {upstreamImage ? (
              <div className="tgp-i2p-refRowInner">
                <div className="tgp-i2p-thumb">
                  <NodeMediaPreview
                    relPath={upstreamImage.path}
                    assetId={upstreamImage.assetId}
                    kind="image"
                  />
                  <span className="tgp-i2p-thumbBadge" aria-hidden>
                    1
                  </span>
                </div>
                <button
                  type="button"
                  className="tgp-partner-focusBtn"
                  onPointerDown={onPointerDown}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFocusUpstreamImage();
                  }}
                >
                  定位图片节点
                </button>
              </div>
            ) : (
              <p className="tgp-i2p-missing">请从左侧 ⊕ 连接图片节点</p>
            )}
          </div>
        ) : null}

        <div className="igp-bottom-bar tgp-bottom-bar tgp-v2-zone-d">
          <TextProviderPicker
            providers={providerOptions}
            value={selectedProviderId}
            loading={providersLoading}
            onChange={handleProviderChange}
          />

          <button
            type="button"
            className={`igp-generate-btn tgp-generate-btn${isGenerating ? " generating" : ""}`}
            disabled={!isGenerating && !canGenerate}
            title={isGenerating ? "停止" : "发送并执行"}
            aria-label={isGenerating ? "停止" : "发送"}
            onPointerDown={onPointerDown}
            onClick={(e) => {
              e.stopPropagation();
              handleGenerate();
            }}
          >
            <IgpGenerateButtonIcon generating={isGenerating} />
          </button>
        </div>
      </div>
    </div>
  );
}
