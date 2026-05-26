import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { AudioModelPicker } from "@/components/nodes/AudioModelPicker";
import { useAudioModels } from "@/hooks/useAudioModels";
import {
  buildAudioTtsTextFromScriptBeatBinding,
  getScriptBeatIdFromParams,
} from "@/lib/incomingScriptBinding";
import { IgpGenerateButtonIcon } from "@/components/nodes/IgpGenerateButtonIcon";
import { PanelCloseIcon, PanelExpandIcon, PanelPinIcon } from "@/components/nodes/nodePanelIcons";
import { audioTtsAgentRuntime } from "@/lib/nodeAgentRuntime/audioTtsAgent";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { AUDIO_TTS_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";

const MAX_CHARS = AUDIO_TTS_PROMPT_MAX_CHARS;
const TTS_DEFAULT_VOICE = "alloy";

type Props = {
  nodeId: string;
  onRequestExpand?: () => void;
  onRequestClose?: () => void;
  onRequestDock?: () => void;
};

/**
 * 音频节点 TTS 底栏：输入区 + 模型/生成；Portal 右上角仅展开。
 */
export function AudioTtsPanel({
  nodeId,
  onRequestExpand,
  onRequestClose,
  onRequestDock,
}: Props) {
  const queryClient = useQueryClient();
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const projectPath = useProjectStore((s) => s.projectPath);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { models: audioModels, loading: modelsLoading, defaultModel } = useAudioModels();
  const [modelId, setModelId] = useState("");
  const [busy, setBusy] = useState(false);

  const isExpandedLayout = !onRequestExpand;

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el || el.classList.contains("atp-v2-textarea--expanded")) {
      if (el) el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const prompt = (node?.data.prompt ?? "").slice(0, MAX_CHARS);

  const selectedPick = useMemo(
    () => audioModels.find((m) => m.id === modelId) ?? audioModels.find((m) => m.enabled) ?? null,
    [audioModels, modelId],
  );

  useEffect(() => {
    if (modelsLoading) return;
    if (modelId && audioModels.some((m) => m.id === modelId && m.enabled)) return;
    const next = defaultModel?.id ?? audioModels.find((m) => m.enabled)?.id ?? "";
    if (next) setModelId(next);
  }, [audioModels, defaultModel, modelId, modelsLoading]);

  const scriptBeatKey = useMemo(() => {
    if (!node) return "";
    return getScriptBeatIdFromParams(node.data) ?? "";
  }, [node]);

  const autoFilledRef = useRef(false);

  useEffect(() => {
    autoFilledRef.current = false;
  }, [scriptBeatKey, nodeId]);

  useEffect(() => {
    const st = useProjectStore.getState();
    const n = st.nodes.find((x) => x.id === nodeId);
    if (!n || n.type !== "audioNode") return;
    const bound = buildAudioTtsTextFromScriptBeatBinding(st.nodes, st.edges, nodeId);
    if (!bound?.trim()) return;
    const cur = (n.data.prompt ?? "").trim();
    if (cur !== "") return;
    if (autoFilledRef.current) return;
    updateNodeData(nodeId, { prompt: bound.slice(0, MAX_CHARS) });
    autoFilledRef.current = true;
  }, [nodeId, nodes, edges, updateNodeData]);

  const onChangePrompt = useCallback(
    (next: string) => {
      updateNodeData(nodeId, { prompt: next.slice(0, MAX_CHARS) });
    },
    [nodeId, updateNodeData],
  );

  useEffect(() => {
    syncTextareaHeight();
  }, [prompt, syncTextareaHeight]);

  const onGenerate = () => {
    if (!isTauri()) {
      setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const path = projectPath?.trim();
    if (!path) {
      setStatusText("请先打开工程目录");
      return;
    }
    const text = prompt.trim();
    if (!text) {
      setStatusText("请输入要合成的文本");
      return;
    }
    const pick = selectedPick;
    if (!pick) {
      setStatusText("请选择语音模型");
      return;
    }
    void (async () => {
      setBusy(true);
      try {
        const committed = await runNodeTaskAgent(
          audioTtsAgentRuntime,
          {
            text,
            audioModelId: pick.audioModelId,
            model: pick.ttsModel,
            voice: TTS_DEFAULT_VOICE,
          },
          {
            nodeId,
            projectPath: path,
            updateNodeData,
            setStatusText,
          },
        );
        await queryClient.invalidateQueries({ queryKey: queryKeys.assets.list(path) });
        setStatusText(`TTS 已生成：${committed.rel}`);
      } catch {
        /* runNodeTaskAgent 已统一写入失败状态 */
      } finally {
        setBusy(false);
      }
    })();
  };

  const cornerActions = onRequestDock ? (
    <>
      <button
        type="button"
        className="atp-chrome-icon-btn"
        title="钉回节点下方"
        aria-label="钉回节点"
        onClick={onRequestDock}
      >
        <PanelPinIcon />
      </button>
      {onRequestClose ? (
        <button
          type="button"
          className="atp-chrome-icon-btn"
          title="关闭 (Esc)"
          aria-label="关闭"
          onClick={onRequestClose}
        >
          <PanelCloseIcon />
        </button>
      ) : null}
    </>
  ) : onRequestExpand ? (
    <button
      type="button"
      className="atp-chrome-icon-btn"
      title="展开面板"
      aria-label="展开面板"
      onClick={onRequestExpand}
    >
      <PanelExpandIcon />
    </button>
  ) : null;

  const canGenerate = Boolean(prompt.trim() && projectPath?.trim());

  return (
    <div
      className={`audioTtsPanel audioTtsPanel--v2 ${RF_NODE_INPUT_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className={`atp-v2-stack${isExpandedLayout ? " atp-v2-stack--expanded" : ""}`}>
        {cornerActions ? (
          <div className="atp-v2-corner-actions" aria-label="面板操作">
            {cornerActions}
          </div>
        ) : null}

        <div className="atp-v2-prompt-wrap">
          <textarea
            ref={textareaRef}
            className={`audioTtsPanelTextarea atp-v2-textarea${onRequestExpand ? "" : " atp-v2-textarea--expanded"} ${RF_NODE_INPUT_CLASS}`}
            placeholder="输入要合成的文本"
            rows={1}
            value={prompt}
            maxLength={MAX_CHARS}
            onChange={(e) => {
              onChangePrompt(e.target.value);
              syncTextareaHeight();
            }}
          />
          <span className="atp-v2-prompt-counter mono" aria-live="polite">
            {prompt.length}/{MAX_CHARS}
          </span>
        </div>

        <div className="atp-v2-bottom-bar audioTtsPanelFoot">
          <AudioModelPicker
            models={audioModels}
            value={modelId}
            loading={modelsLoading}
            onChange={setModelId}
          />

          <button
            type="button"
            className={`atp-v2-generate igp-generate-btn audioTtsPanelSend${busy ? " generating" : ""}`}
            disabled={!busy && !canGenerate}
            title={!projectPath ? "请先打开工程" : busy ? "合成中…" : "生成并写入节点素材"}
            aria-label={busy ? "合成中" : "生成"}
            onClick={onGenerate}
          >
            <IgpGenerateButtonIcon generating={busy} />
          </button>
        </div>
      </div>
    </div>
  );
}
