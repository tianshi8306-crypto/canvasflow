import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextProviderPicker } from "@/components/nodes/TextProviderPicker";
import {
  getProviderSelectionPatch,
  loadEnabledChatProviderOptions,
  type TextNodeProviderOption,
} from "@/lib/textNodeProviders";
import { resolveMentionTokens } from "@/lib/resolveMentionTokens";
import { useProjectStore } from "@/store/projectStore";
import { MentionInput } from "./MentionInput";
import { SlashPresetPanel } from "./SlashPresetPanel";
import type { MentionInputRef } from "./MentionInput";

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
  const [providersLoading, setProvidersLoading] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState(providerId ?? "");
  const [inputText, setInputText] = useState(modelInput ?? "");
  const [response, setResponse] = useState(prompt ?? "");
  const [running, setRunning] = useState(false);
  const [slashCursorRect, setSlashCursorRect] = useState<DOMRect | null>(null);
  const mentionRef = useRef<MentionInputRef>(null);

  useEffect(() => {
    let cancelled = false;
    setProvidersLoading(true);
    void (async () => {
      const list = await loadEnabledChatProviderOptions();
      if (!cancelled) {
        setProviderOptions(list);
        setProvidersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const handleSlashTrigger = useCallback((rect: DOMRect) => {
    setSlashCursorRect(rect);
  }, []);

  const handlePresetSelect = useCallback((template: string) => {
    mentionRef.current?.insertPresetTemplate(template);
    setSlashCursorRect(null);
  }, []);

  
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
            <TextProviderPicker
              providers={providerOptions}
              value={selectedProviderId}
              loading={providersLoading}
              onChange={onProviderChange}
            />
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
          ref={mentionRef}
          nodeId={nodeId}
          value={inputText}
          onChange={setInputText}
          onSlashTrigger={handleSlashTrigger}
          placeholder="输入提示词，让 LLM 生成内容…"
          className="scriptGenComposerInput"
          nodeLabels={nodeLabels}
        />
        {slashCursorRect && (
          <SlashPresetPanel
            cursorRect={slashCursorRect}
            onSelect={handlePresetSelect}
            onClose={() => setSlashCursorRect(null)}
          />
        )}
      </form>
    </div>
  );
}
