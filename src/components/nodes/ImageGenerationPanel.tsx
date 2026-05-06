import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import {
  IMAGE_MODEL_OPTIONS,
  IMAGE_TASK_OPTIONS,
  type ImageTaskMode,
} from "@/lib/imageGeneration/catalog";
import {
  buildPromptFromScriptBeatBinding,
  getScriptBeatIdFromParams,
  incomingScriptUpstreamState,
  scriptSyncButtonTitle,
  scriptSyncDisabledOnlyStatus,
} from "@/lib/incomingScriptBinding";
import { ScriptBeatBindingInline } from "@/components/nodes/ScriptBeatBindingInline";
import { imageGenerationAgentRuntime } from "@/lib/nodeAgentRuntime/imageGenerationAgent";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { IMAGE_GENERATION_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { useProjectStore } from "@/store/projectStore";

type ImageGenerationPanelProps = {
  nodeId: string;
  /** 图生图：当前参考图，显示在工具栏为缩略图 */
  referenceImagePath?: string;
  referenceImageAssetId?: string;
};

/**
 * 图片节点左键选中后的底部生成面板。
 */
export function ImageGenerationPanel({
  nodeId,
  referenceImagePath,
  referenceImageAssetId,
}: ImageGenerationPanelProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const prompt = (node?.data.prompt ?? "").slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS);
  const [customModels, setCustomModels] = useState<
    Array<{ id: string; label: string; model: string; priority: number; enabled: boolean }>
  >([]);
  const allModelOptions = useMemo(() => {
    const custom = [...customModels]
      .sort((a, b) => a.priority - b.priority)
      .filter((m) => m.enabled)
      .map((m) => ({ id: `custom:${m.id}`, label: `${m.label}（自定义）`, model: m.model.trim() }))
      .filter((m) => m.model)
      .map((m) => ({ id: m.id, label: m.label }))
      .filter((m) => m.id);
    return [...IMAGE_MODEL_OPTIONS, ...custom];
  }, [customModels]);
  const [model, setModel] = useState(IMAGE_MODEL_OPTIONS[0]?.id ?? "omnigen-v2");
  const [task, setTask] = useState<ImageTaskMode>("text_to_image");
  const [generating, setGenerating] = useState(false);
  const hasRef = Boolean(referenceImagePath?.trim() || referenceImageAssetId?.trim());
  const taskNeedsRef = task !== "text_to_image";
  const canGenerate = useMemo(() => {
    if (!projectPath) return false;
    if (!prompt.trim()) return false;
    if (taskNeedsRef && !hasRef) return false;
    return !generating;
  }, [generating, hasRef, projectPath, prompt, taskNeedsRef]);

  const scriptFillText = useMemo(
    () => buildPromptFromScriptBeatBinding(nodes, edges, nodeId),
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
    void (async () => {
      try {
        const s = await invoke<{
          imageModels?: Array<{ id: string; label: string; model: string; enabled: boolean; priority: number }>;
        }>("load_settings");
        setCustomModels(s.imageModels ?? []);
      } catch {
        setCustomModels([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!allModelOptions.some((m) => m.id === model)) {
      setModel(allModelOptions[0]?.id ?? "omnigen-v2");
    }
  }, [allModelOptions, model]);

  useEffect(() => {
    autoFilledRef.current = false;
  }, [scriptBeatKey, nodeId]);

  useEffect(() => {
    const st = useProjectStore.getState();
    const n = st.nodes.find((x) => x.id === nodeId);
    if (!n || (n.type !== "imageNode" && n.type !== "imageAsset")) return;
    const bound = buildPromptFromScriptBeatBinding(st.nodes, st.edges, nodeId);
    if (!bound?.trim()) return;
    const cur = (n.data.prompt ?? "").trim();
    if (cur !== "") return;
    if (autoFilledRef.current) return;
    updateNodeData(nodeId, { prompt: bound.slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS) });
    autoFilledRef.current = true;
  }, [nodeId, nodes, edges, updateNodeData]);

  const onGenerate = () => {
    if (!projectPath) {
      setStatusText("请先新建或打开工程目录后再生成图片。");
      return;
    }
    if (!prompt.trim()) {
      setStatusText("请输入图片提示词。");
      return;
    }
    if (taskNeedsRef && !hasRef) {
      setStatusText("当前任务需要至少 1 张参考图，请先给图片节点添加左侧输入。");
      return;
    }
    void (async () => {
      setGenerating(true);
      try {
        await runNodeTaskAgent(
          imageGenerationAgentRuntime,
          {
            prompt: prompt.slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS),
            modelId: model,
            customModels,
            task,
            referenceImagePath,
            referenceImageAssetId,
          },
          {
            nodeId,
            projectPath,
            updateNodeData,
            setStatusText,
          },
        );
      } catch {
        // runNodeTaskAgent 已统一写入失败状态
      } finally {
        setGenerating(false);
      }
    })();
  };

  return (
    <div className={`imageGenPanel ${RF_NODE_INPUT_CLASS}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="imageGenPanelRefRow">
        {hasRef ? (
          <div className="imageGenPanelRefSlot">
            <div className="imageGenPanelRefThumb" title="当前图生图参考">
              <span className="imageGenPanelRefBadge" aria-hidden>
                1
              </span>
              <NodeMediaPreview relPath={referenceImagePath} assetId={referenceImageAssetId} kind="image" />
            </div>
            <span className="imageGenPanelInputStatus">输入已连接</span>
          </div>
        ) : (
          <span className="imageGenPanelInputStatus">暂无参考图</span>
        )}
        <span className="imageGenPanelToolbarSpacer" />
        <span className="imageGenPanelExpandHint mono">{generating ? "生成中…" : "就绪"}</span>
      </div>
      <textarea
        className={`imageGenPanelTextarea ${RF_NODE_INPUT_CLASS}`}
        placeholder="制作图中女性角色的摄影三视图穿着日本校服，纯白背景，画面结构与参考图一致，超高细节..."
        rows={4}
        value={prompt}
        onChange={(e) =>
          updateNodeData(nodeId, {
            prompt: e.target.value.slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS),
          })
        }
      />
      <ScriptBeatBindingInline nodeId={nodeId} dense />
      <div className="imageGenPanelScriptFill">
        <button
          type="button"
          className="btn"
          disabled={!scriptFillText}
          title={scriptSyncButtonTitle(scriptUpstreamState, "根据属性里绑定的 scriptBeatId 与上游脚本节点填入提示词")}
          onClick={() => {
            if (scriptFillText)
              updateNodeData(nodeId, {
                prompt: scriptFillText.slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS),
              });
            else if (scriptUpstreamState === "disabled_only") {
              setStatusText(scriptSyncDisabledOnlyStatus("从脚本镜头填入"));
            }
          }}
        >
          从脚本镜头填入提示
        </button>
      </div>
      <div className="imageGenPanelMetaRow">
        <select
          className="imageGenPanelFeat imageGenPanelFeat--compact"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          title="图片模型"
        >
          {allModelOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          className="imageGenPanelFeat imageGenPanelFeat--compact"
          value={task}
          onChange={(e) => setTask(e.target.value as ImageTaskMode)}
          title="任务类型"
        >
          {IMAGE_TASK_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="imageGenPanelMetaChip">16:9</span>
        <span className="imageGenPanelMetaChip">4K</span>
        <span className="imageGenPanelMetaChip">摄影机</span>
        <span className="imageGenPanelMetaChip">全景</span>
        <span className="imageGenPanelMeta imageGenPanelMeta--inline mono">{prompt.length}</span>
      </div>
      <div className="imageGenPanelFoot">
        <span className="imageGenPanelFootHint mono">{taskNeedsRef ? "需参考图输入" : "可直接文生图"}</span>
        <button type="button" className="imageGenPanelSend" disabled={!canGenerate} onClick={onGenerate}>
          ↑
        </button>
      </div>
    </div>
  );
}
