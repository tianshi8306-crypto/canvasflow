import { invoke, isTauri } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import {
  buildAudioTtsTextFromScriptBeatBinding,
  getScriptBeatIdFromParams,
  incomingScriptUpstreamState,
  scriptSyncButtonTitle,
  scriptSyncDisabledOnlyStatus,
} from "@/lib/incomingScriptBinding";
import { ScriptBeatBindingInline } from "@/components/nodes/ScriptBeatBindingInline";
import { audioTtsAgentRuntime } from "@/lib/nodeAgentRuntime/audioTtsAgent";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { AUDIO_TTS_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { TTS_DEFAULT_PROVIDER_MODEL_OPTIONS, TTS_VOICE_OPTIONS } from "@/lib/ttsModelCatalog";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";

const MAX_CHARS = AUDIO_TTS_PROMPT_MAX_CHARS;

type AudioModelRow = {
  id: string;
  label: string;
  model: string;
  enabled: boolean;
  priority: number;
};

type ModelPick = {
  selectId: string;
  label: string;
  /** 自定义模型 id；缺省表示走默认 Provider */
  audioModelId: string | null;
  /** 与 OpenAI `/v1/audio/speech` 的 model 字段对应 */
  ttsModel: string;
};

type Props = { nodeId: string };

function buildModelPicks(custom: AudioModelRow[]): ModelPick[] {
  const defaults: ModelPick[] = TTS_DEFAULT_PROVIDER_MODEL_OPTIONS.map((o) => ({
    selectId: o.id,
    label: o.label,
    audioModelId: null,
    ttsModel: o.model,
  }));
  const customs = [...custom]
    .sort((a, b) => a.priority - b.priority)
    .filter((m) => m.enabled && m.model.trim())
    .map((m) => ({
      selectId: `custom:${m.id}`,
      label: `${m.label || m.model}（自定义）`,
      audioModelId: m.id,
      ttsModel: m.model.trim(),
    }));
  return [...defaults, ...customs];
}

/**
 * 音频节点展开：TTS 文案、模型/音色选择与合成（OpenAI 兼容 `/v1/audio/speech`）。
 */
export function AudioTtsPanel({ nodeId }: Props) {
  const queryClient = useQueryClient();
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const projectPath = useProjectStore((s) => s.projectPath);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const [customModels, setCustomModels] = useState<AudioModelRow[]>([]);
  const [modelId, setModelId] = useState(TTS_DEFAULT_PROVIDER_MODEL_OPTIONS[0]?.id ?? "__provider_tts1__");
  const [voice, setVoice] = useState("alloy");
  const [busy, setBusy] = useState(false);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const prompt = (node?.data.prompt ?? "").slice(0, MAX_CHARS);

  const modelPicks = useMemo(() => buildModelPicks(customModels), [customModels]);

  useEffect(() => {
    void (async () => {
      if (!isTauri()) return;
      try {
        const s = await invoke<{
          audioModels?: Array<{ id: string; label: string; model: string; enabled: boolean; priority: number }>;
        }>("load_settings");
        setCustomModels(s.audioModels ?? []);
      } catch {
        setCustomModels([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!modelPicks.some((p) => p.selectId === modelId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModelId(modelPicks[0]?.selectId ?? "__provider_tts1__");
    }
  }, [modelPicks, modelId]);

  const scriptBoundText = useMemo(
    () => buildAudioTtsTextFromScriptBeatBinding(nodes, edges, nodeId),
    [nodes, edges, nodeId],
  );
  const scriptUpstreamState = useMemo(
    () => incomingScriptUpstreamState(nodes, edges, nodeId),
    [nodes, edges, nodeId],
  );

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

  const onChangePrompt = (next: string) => {
    updateNodeData(nodeId, { prompt: next.slice(0, MAX_CHARS) });
  };

  const onSyncFromScript = () => {
    if (!scriptBoundText?.trim()) {
      if (scriptUpstreamState === "disabled_only") {
        setStatusText(scriptSyncDisabledOnlyStatus("从脚本同步"));
        return;
      }
      setStatusText("无法从脚本同步：请绑定 scriptBeatId 并连接上游脚本，且镜头内需有台词或音效");
      return;
    }
    updateNodeData(nodeId, { prompt: scriptBoundText.slice(0, MAX_CHARS) });
    setStatusText("已从脚本镜头同步 TTS 文案");
  };

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
    const pick = modelPicks.find((p) => p.selectId === modelId);
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
            voice,
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
        // runNodeTaskAgent 已统一写入失败状态
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className={`audioTtsPanel ${RF_NODE_INPUT_CLASS}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="audioTtsPanelHead">
        <span className="audioTtsPanelHeadHint">文字转语音</span>
        <span className="audioTtsPanelExpandHint mono" title="与画布最大化节点布局一致">
          ⛶
        </span>
      </div>
      <div className="audioTtsPanelModelRow">
        <label className="audioTtsPanelModelLabel">模型</label>
        <select
          className={`audioTtsPanelSelect ${RF_NODE_INPUT_CLASS}`}
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {modelPicks.map((p) => (
            <option key={p.selectId} value={p.selectId}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="audioTtsPanelModelLabel">音色</label>
        <select
          className={`audioTtsPanelSelect ${RF_NODE_INPUT_CLASS}`}
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {TTS_VOICE_OPTIONS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className={`audioTtsPanelTextarea ${RF_NODE_INPUT_CLASS}`}
        placeholder="输入要转为语音的文本，或点击下方从脚本同步…"
        rows={4}
        value={prompt}
        maxLength={MAX_CHARS}
        onChange={(e) => onChangePrompt(e.target.value)}
      />
      <ScriptBeatBindingInline nodeId={nodeId} dense />
      <div className="audioTtsPanelScriptRow">
        <button
          type="button"
          className="btn"
          disabled={!scriptBoundText}
          title={scriptSyncButtonTitle(scriptUpstreamState, "根据 params.scriptBeatId 与上游脚本镜头的台词/音效填入")}
          onClick={onSyncFromScript}
        >
          从脚本同步
        </button>
      </div>
      <div className="audioTtsPanelFoot">
        <span className="audioTtsPanelModeHint">OpenAI 兼容 POST …/audio/speech</span>
        <span className="audioTtsPanelMeta mono">
          {prompt.length}/{MAX_CHARS}
        </span>
        <button
          type="button"
          className="audioTtsPanelSend"
          disabled={busy || !prompt.trim() || !projectPath}
          title={!projectPath ? "请先打开工程" : busy ? "合成中…" : "生成并写入节点素材路径"}
          onClick={onGenerate}
        >
          {busy ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}
