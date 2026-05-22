import { invoke, isTauri } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import {
  buildAudioTtsTextFromScriptBeatBinding,
  getScriptBeatIdFromParams,
  incomingScriptUpstreamState,
  orderedIncomingScriptNodeIds,
  scriptSyncButtonTitle,
  scriptSyncDisabledOnlyStatus,
} from "@/lib/incomingScriptBinding";
import { IgpGenerateButtonIcon } from "@/components/nodes/IgpGenerateButtonIcon";
import { PanelCloseIcon, PanelExpandIcon, PanelPinIcon } from "@/components/nodes/nodePanelIcons";
import { findIncomingTextNodeId } from "@/lib/audioNodeContainerMode";
import { audioTtsAgentRuntime } from "@/lib/nodeAgentRuntime/audioTtsAgent";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { AUDIO_TTS_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { TTS_DEFAULT_PROVIDER_MODEL_OPTIONS, TTS_VOICE_OPTIONS } from "@/lib/ttsModelCatalog";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";

const MAX_CHARS = AUDIO_TTS_PROMPT_MAX_CHARS;

const ZONE_A_HINT = "输入要合成的文本";

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
  audioModelId: string | null;
  ttsModel: string;
};

type Props = {
  nodeId: string;
  showChromeHead?: boolean;
  onRequestExpand?: () => void;
  onRequestPin?: () => void;
  onRequestUnpin?: () => void;
  onRequestClose?: () => void;
  onRequestDock?: () => void;
};

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

function safeParamsRecord(p: unknown): Record<string, unknown> {
  return p && typeof p === "object" && !Array.isArray(p) ? { ...(p as Record<string, unknown>) } : {};
}

/**
 * 音频节点 TTS 底栏（对齐成熟参考：A 提示+图标 / B 输入 / C Chip / D 模型+字数+生成）
 */
export function AudioTtsPanel({
  nodeId,
  showChromeHead = false,
  onRequestExpand,
  onRequestPin,
  onRequestUnpin,
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

  const beatChoices = useMemo(() => {
    const scriptIds = orderedIncomingScriptNodeIds(nodes, edges, nodeId);
    const out: { beatId: string; label: string; shotNumber: string }[] = [];
    for (const scriptId of scriptIds) {
      const sn = nodes.find((n) => n.id === scriptId);
      const rawBeats = sn?.data.scriptBeats;
      if (!rawBeats?.length) continue;
      const scriptLabel = (sn?.data.label ?? "").trim().slice(0, 10) || scriptId.slice(0, 6);
      const beats = normalizeScriptBeats(rawBeats);
      for (let i = 0; i < beats.length; i++) {
        const b = beats[i];
        const num = (b.shotNumber ?? "").trim() || String(i + 1);
        const desc = (b.description ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
        const label =
          scriptIds.length > 1
            ? `[${scriptLabel}] 镜${num}${desc ? ` · ${desc}` : ""}`
            : `镜${num}${desc ? ` · ${desc}` : ""}`;
        out.push({ beatId: b.id, label: label.trim() || `镜${num}`, shotNumber: num });
      }
    }
    return out;
  }, [edges, nodeId, nodes]);

  const curBeatId = useMemo(() => {
    const cur = String((node?.data.params as Record<string, unknown> | undefined)?.scriptBeatId ?? "").trim();
    return cur;
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

  const insertAtCursor = useCallback(
    (snippet: string) => {
      const el = textareaRef.current;
      if (!el) {
        onChangePrompt(prompt + snippet);
        return;
      }
      const start = el.selectionStart ?? prompt.length;
      const end = el.selectionEnd ?? prompt.length;
      const next = prompt.slice(0, start) + snippet + prompt.slice(end);
      onChangePrompt(next);
      requestAnimationFrame(() => {
        const pos = start + snippet.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [onChangePrompt, prompt],
  );

  const textNodeId = useMemo(
    () => findIncomingTextNodeId(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );
  const textBoundPrompt = useMemo(() => {
    if (!textNodeId) return "";
    const t = nodes.find((n) => n.id === textNodeId);
    return (t?.data.prompt ?? "").trim();
  }, [nodes, textNodeId]);

  const onSyncFromText = () => {
    if (!textBoundPrompt) {
      setStatusText("无法从文本同步：请连接上游文本节点并填写正文");
      return;
    }
    updateNodeData(nodeId, { prompt: textBoundPrompt.slice(0, MAX_CHARS) });
    setStatusText("已从文本节点同步 TTS 文案");
  };

  const onSyncFromScript = () => {
    if (!scriptBoundText?.trim()) {
      if (scriptUpstreamState === "disabled_only") {
        setStatusText(scriptSyncDisabledOnlyStatus("从脚本同步"));
        return;
      }
      setStatusText("无法从脚本同步：请绑定镜头并连接上游脚本");
      return;
    }
    updateNodeData(nodeId, { prompt: scriptBoundText.slice(0, MAX_CHARS) });
    setStatusText("已从脚本镜头同步 TTS 文案");
  };

  const onBeatChange = (beatId: string) => {
    if (!node) return;
    const hit = beatChoices.find((c) => c.beatId === beatId);
    const base = safeParamsRecord(node.data.params);
    if (!beatId) {
      delete base.scriptBeatId;
      delete base.shotNumber;
    } else {
      base.scriptBeatId = beatId;
      if (hit?.shotNumber) base.shotNumber = hit.shotNumber;
    }
    updateNodeData(nodeId, { params: base });
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
        /* runNodeTaskAgent 已统一写入失败状态 */
      } finally {
        setBusy(false);
      }
    })();
  };

  const showZoneA =
    showChromeHead ||
    Boolean(onRequestExpand || onRequestPin || onRequestClose || onRequestDock);

  const canSyncScript =
    Boolean(scriptBoundText?.trim()) || scriptUpstreamState !== "none";
  const showChipRow =
    beatChoices.length > 0 || textNodeId || canSyncScript;

  const zoneAActions = onRequestDock ? (
    <>
      <button
        type="button"
        className="mmChromeIconBtn atpChromeIconBtn"
        title="钉回节点下方"
        aria-label="钉回节点"
        onClick={onRequestDock}
      >
        <PanelPinIcon />
      </button>
      {onRequestClose ? (
        <button
          type="button"
          className="mmChromeIconBtn atpChromeIconBtn"
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
      {onRequestExpand ? (
        <button
          type="button"
          className="mmChromeIconBtn atpChromeIconBtn"
          title="展开面板"
          aria-label="展开面板"
          onClick={onRequestExpand}
        >
          <PanelExpandIcon />
        </button>
      ) : null}
      {onRequestPin ? (
        <button
          type="button"
          className="mmChromeIconBtn atpChromeIconBtn"
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
          className="mmChromeIconBtn atpChromeIconBtn atpChromeIconBtn--pinned"
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
          className="mmChromeIconBtn atpChromeIconBtn"
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
      className={`audioTtsPanel audioTtsPanel--v2 ${RF_NODE_INPUT_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="atp-v2-stack">
        {showZoneA ? (
          <div className="atp-v2-zone-a">
            <span className="atp-v2-hint">{ZONE_A_HINT}</span>
            <div className="atp-v2-zone-a-actions">{zoneAActions}</div>
          </div>
        ) : (
          <div className="atp-v2-zone-a atp-v2-zone-a--hintOnly">
            <span className="atp-v2-hint">{ZONE_A_HINT}</span>
          </div>
        )}

        <div className="atp-v2-zone-b">
          <textarea
            ref={textareaRef}
            className={`audioTtsPanelTextarea atp-v2-textarea ${RF_NODE_INPUT_CLASS}`}
            placeholder="输入要合成的文本"
            rows={3}
            value={prompt}
            maxLength={MAX_CHARS}
            onChange={(e) => onChangePrompt(e.target.value)}
          />
        </div>

        {showChipRow ? (
          <div className="atp-v2-zone-c" role="group" aria-label="快捷操作">
            <button
              type="button"
              className="atp-v2-chip"
              title="插入停顿标记"
              onClick={() => insertAtCursor("<#>")}
            >
              &lt;#&gt; 停顿
            </button>
            <button
              type="button"
              className="atp-v2-chip"
              title="插入语气词占位"
              onClick={() => insertAtCursor("()")}
            >
              () 语气词
            </button>
            {beatChoices.length > 0 ? (
              <label className="atp-v2-chip atp-v2-chip--select">
                <span className="atp-v2-chipLabel">镜头</span>
                <select
                  className={`atp-v2-chipSelect ${RF_NODE_INPUT_CLASS}`}
                  value={curBeatId}
                  onChange={(e) => onBeatChange(e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <option value="">未绑定</option>
                  {beatChoices.map((c) => (
                    <option key={c.beatId} value={c.beatId}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {textNodeId ? (
              <button
                type="button"
                className="atp-v2-chip"
                disabled={!textBoundPrompt}
                title="将上游文本节点正文填入"
                onClick={onSyncFromText}
              >
                从文本同步
              </button>
            ) : null}
            <button
              type="button"
              className="atp-v2-chip"
              disabled={!scriptBoundText?.trim() && scriptUpstreamState === "none"}
              title={scriptSyncButtonTitle(
                scriptUpstreamState,
                "根据绑定镜头与上游脚本填入",
              )}
              onClick={onSyncFromScript}
            >
              从脚本同步
            </button>
          </div>
        ) : null}

        <div className="atp-v2-zone-d audioTtsPanelFoot">
          <label className="atp-v2-pill atp-v2-pill--model">
            <span className="atp-v2-pillIcon" aria-hidden>
              ✦
            </span>
            <select
              className={`atp-v2-pillSelect ${RF_NODE_INPUT_CLASS}`}
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="语音模型"
            >
              {modelPicks.map((p) => (
                <option key={p.selectId} value={p.selectId}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="atp-v2-pillChevron" aria-hidden />
          </label>

          <label className="atp-v2-pill atp-v2-pill--voice">
            <select
              className={`atp-v2-pillSelect ${RF_NODE_INPUT_CLASS}`}
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="音色"
            >
              {TTS_VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <span className="atp-v2-pillChevron" aria-hidden />
          </label>

          <span className="atp-v2-counter mono" aria-live="polite">
            {prompt.length}/{MAX_CHARS}
          </span>

          <button
            type="button"
            className={`atp-v2-generate audioTtsPanelSend${busy ? " generating" : ""}`}
            disabled={busy || !prompt.trim() || !projectPath}
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
