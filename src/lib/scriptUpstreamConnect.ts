import {
  incomingTextUpstreamState,
  scriptSyncDisabledOnlyStatus,
} from "@/lib/incomingScriptBinding";
import {
  SCRIPT_PARSE_REQUIREMENT_WITH_UPSTREAM,
} from "@/lib/scriptParseDefaults";
import {
  listScriptUpstreamTextSources,
  scriptUpstreamImportStatusMessage,
} from "@/lib/scriptUpstreamText";
import type { ProjectState } from "@/store/projectStoreTypes";
import { useCanvasUiStore } from "@/store/canvasUiStore";

type SetState = (
  partial:
    | Partial<ProjectState>
    | ((state: ProjectState) => Partial<ProjectState> | ProjectState),
  replace?: false,
) => void;

/** 文本节点 → 脚本节点连线建立后的就绪反馈（不自动跑 DAG，只写默认解析要求并打开底栏） */
export function applyTextToScriptConnectionFeedback(
  get: () => ProjectState,
  set: SetState,
  scriptNodeId: string,
): void {
  const { nodes, edges, updateNodeData, setStatusText } = get();
  const upstreamState = incomingTextUpstreamState(nodes, edges, scriptNodeId);
  if (upstreamState === "none") return;

  if (upstreamState === "disabled_only") {
    setStatusText(scriptSyncDisabledOnlyStatus("解析剧本"));
    return;
  }

  const sources = listScriptUpstreamTextSources(nodes, edges, scriptNodeId);
  const script = nodes.find((n) => n.id === scriptNodeId);
  if (!script || script.type !== "scriptNode") return;

  useCanvasUiStore.getState().setScriptGenPanelPinnedNodeId(scriptNodeId);

  if (sources.length === 0) {
    setStatusText(
      "已连接文本节点：请先在文本节点预览区写入剧本正文，再在脚本节点底栏点击「AI 解析镜头」。",
    );
    set({ selectedNodeIds: [scriptNodeId], selectedNodeId: scriptNodeId });
    return;
  }

  const currentPrompt = (script.data.prompt ?? "").trim();
  if (!currentPrompt) {
    updateNodeData(scriptNodeId, { prompt: SCRIPT_PARSE_REQUIREMENT_WITH_UPSTREAM });
  }

  setStatusText(
    `${scriptUpstreamImportStatusMessage(sources)} 请在脚本节点底栏点击「AI 解析镜头」开始拆解。`,
  );
  set({ selectedNodeIds: [scriptNodeId], selectedNodeId: scriptNodeId });
}
