import type { SyntheticEvent } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import type { TextNodeProviderOption } from "@/lib/textNodeProviders";

type Props = {
  selectedProviderId: string;
  providerOptions: TextNodeProviderOption[];
  modelInputLength: number;
  maxChars: number;
  onProviderChange: (providerId: string) => void;
  onOpenPasteImport: () => void;
  onSend: (e: SyntheticEvent) => void;
  onPointerDown: (e: SyntheticEvent) => void;
};

export function TextNodeComposerBar({
  selectedProviderId,
  providerOptions,
  modelInputLength,
  maxChars,
  onProviderChange,
  onOpenPasteImport,
  onSend,
  onPointerDown,
}: Props) {
  return (
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
        <span className="scriptGenComposerHint">文/A</span>
        <span className="scriptGenComposerHint">
          {modelInputLength}/{maxChars}
        </span>
        <button
          type="button"
          className="btn"
          style={{ padding: "2px 8px" }}
          onPointerDown={onPointerDown}
          onClick={onOpenPasteImport}
        >
          粘贴
        </button>
        <button
          type="button"
          className="scriptGenSend"
          title="从当前文本节点触发子图执行"
          aria-label="发送"
          onPointerDown={onPointerDown}
          onClick={onSend}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
