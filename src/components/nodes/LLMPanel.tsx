import { useCallback, useEffect, useMemo, useState } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import {
  getProviderSelectionPatch,
  loadEnabledProviderOptions,
  type TextNodeProviderOption,
} from "@/lib/textNodeProviders";
import { resolveMentionTokens } from "@/lib/resolveMentionTokens";
import { useProjectStore } from "@/store/projectStore";
import { MentionInput } from "./MentionInput";

const MAX_CHARS = 4000;

type Props = {
  nodeId: string;
  prompt: string | undefined;
  modelInput: string | undefined;
  providerId: string | undefined;
};

export function LLMPanel({ nodeId, prompt, modelInput, providerId }: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const nodeLabels = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n.data.label ?? n.id])),
    [nodes],
  );

  const [providerOptions, setProviderOptions] = useState<TextNodeProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState(providerId ?? "");
  const [inputText, setInputText] = useState(modelInput ?? "");
  const [response, setResponse] = useState(prompt ?? "");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void loadEnabledProviderOptions().then(setProviderOptions);
  }, []);

  useEffect(() => {
    if (providerId !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedProviderId(providerId);
    }
  }, [providerId]);

  useEffect(() => {
    if (prompt !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResponse(prompt);
    }
  }, [prompt]);

  const onProviderChange = useCallback(
    (pid: string) => {
      setSelectedProviderId(pid);
      const patch = getProviderSelectionPatch(pid, providerOptions);
      updateNodeData(nodeId, { params: { providerId: patch.providerId, model: patch.model } });
    },
    [nodeId, providerOptions, updateNodeData],
  );

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputText.trim() || !projectPath) {
        setStatusText("请先打开工程目录");
        return;
      }
      setRunning(true);
      try {
        const rawPrompt = response ? `${response}\n\n${inputText}` : inputText;
        const resolvedPrompt = resolveMentionTokens(rawPrompt, nodes);
        // 将解析后的 prompt 写入节点 params，触发 DAG 执行
        const params = {
          prompt: resolvedPrompt,
          modelInput: inputText,
          providerId: selectedProviderId || undefined,
        };
        updateNodeData(nodeId, { params });
        setStatusText("LLM 任务已提交");
        setInputText("");
      } finally {
        setRunning(false);
      }
    },
    [inputText, selectedProviderId, nodeId, projectPath, response, setStatusText, updateNodeData, nodes],
  );

  
  return (
    <div className="llmPanel">
      {response ? (
        <div className="llmResponsePreview">
          <div className="llmResponseLabel">回复预览</div>
          <pre className="llmResponseText">{response.slice(0, 800)}{response.length > 800 ? "…" : ""}</pre>
        </div>
      ) : null}
      <form className="scriptGenComposer" onSubmit={handleSend} style={{ margin: 0 }}>
        <div className="scriptGenComposerBar">
          <div className="scriptGenModel">
            <span className="scriptGenModelLogo" aria-hidden />
            <select
              className={`scriptGenModelSelect ${RF_NODE_INPUT_CLASS}`}
              aria-label="模型"
              value={selectedProviderId}
              onChange={(e) => onProviderChange(e.currentTarget.value.trim())}
            >
              <option value="">默认模型（设置中优先级最高）</option>
              {providerOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {p.model}
                </option>
              ))}
            </select>
          </div>
          <div className="scriptGenComposerActions">
            <span className="scriptGenComposerHint">{inputText.length}/{MAX_CHARS}</span>
            <button
              type="submit"
              className="scriptGenSend"
              disabled={running || !inputText.trim()}
              title={running ? "生成中…" : "发送"}
              aria-label={running ? "生成中" : "发送"}
            >
              {running ? "…" : "▶"}
            </button>
          </div>
        </div>
        <MentionInput
          nodeId={nodeId}
          value={inputText}
          onChange={setInputText}
          placeholder="输入提示词，让 LLM 生成内容…"
          className="scriptGenComposerInput"
          nodeLabels={nodeLabels}
        />
      </form>
    </div>
  );
}
