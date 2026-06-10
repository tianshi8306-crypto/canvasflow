import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { incomingTextUpstreamState, orderedIncomingTextNodeIds } from "@/lib/incomingScriptBinding";
import { analyzeScriptDocument, type ScriptDocumentAnalysis } from "@/lib/scriptDocument/scriptDocumentGaps";
import { scriptNodeDispatchAgentRuntime } from "@/lib/nodeAgentRuntime/dagnodeDispatchAgents";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { preflightScriptNodeLlm } from "@/lib/scriptNodeLlmParams";
import { scriptParseCompleteStatus } from "@/lib/scriptNodeFeedback";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import type { FlowNodeData } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";
import type { Edge, Node } from "@xyflow/react";

export type ScriptDocumentExtract = {
  fileName: string;
  format: string;
  text: string;
  charCount: number;
};

const PARSE_REQUIREMENT_WITH_UPSTREAM =
  "自动提取角色、分镜并逐镜生成 Seedance 2.0 视觉化参数。";

export async function pickScriptDocumentPath(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "剧本文档",
        extensions: ["txt", "md", "markdown", "docx"],
      },
    ],
  });
  if (!selected) return null;
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}

export async function extractScriptDocument(absPath: string): Promise<ScriptDocumentExtract> {
  const raw = await invoke<ScriptDocumentExtract>("extract_script_document", {
    absPath,
  });
  return {
    fileName: raw.fileName,
    format: raw.format,
    text: raw.text,
    charCount: raw.charCount,
  };
}

export async function pickAndAnalyzeScriptDocument(): Promise<{
  extract: ScriptDocumentExtract;
  analysis: ScriptDocumentAnalysis;
} | null> {
  if (!isTauri()) return null;
  const path = await pickScriptDocumentPath();
  if (!path) return null;
  const extract = await extractScriptDocument(path);
  const analysis = analyzeScriptDocument(extract.text);
  return { extract, analysis };
}

function resolveUpstreamTextNodeId(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  scriptNodeId: string,
): string | null {
  const state = incomingTextUpstreamState(nodes, edges, scriptNodeId);
  if (state !== "enabled") return null;
  const ids = orderedIncomingTextNodeIds(nodes, edges, scriptNodeId);
  return ids[0] ?? null;
}

export type ApplyScriptDocumentResult = {
  ok: boolean;
  message: string;
  beatCount?: number;
};

/** 将剧本正文写入上游文本或脚本 prompt，并可选触发 AI 解析 */
export async function applyScriptDocumentImport(opts: {
  scriptNodeId: string;
  analysis: ScriptDocumentAnalysis;
  parseAfter: boolean;
}): Promise<ApplyScriptDocumentResult> {
  if (!isTauri()) {
    return { ok: false, message: DESKTOP_SHELL_HINT };
  }

  const state = useProjectStore.getState();
  const projectPath = state.projectPath?.trim();
  if (!projectPath) {
    return { ok: false, message: "请先打开工程" };
  }

  const scriptNode = state.nodes.find((n) => n.id === opts.scriptNodeId);
  if (!scriptNode || scriptNode.type !== "scriptNode") {
    return { ok: false, message: "未找到脚本节点" };
  }

  const { analysis } = opts;
  const text = analysis.importText.trim();
  if (!text) {
    return { ok: false, message: "剧本正文为空" };
  }

  if (analysis.gaps.some((g) => g.id === "too_short")) {
    return { ok: false, message: "剧本过短，无法导入" };
  }

  const upstreamTextId = resolveUpstreamTextNodeId(
    state.nodes,
    state.edges,
    opts.scriptNodeId,
  );

  if (upstreamTextId) {
    // 原子性更新：同时写入上游文本和脚本节点，避免部分成功
    useProjectStore.setState((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id === upstreamTextId) return { ...n, data: { ...n.data, prompt: text } };
        if (n.id === opts.scriptNodeId) return { ...n, data: { ...n.data, prompt: PARSE_REQUIREMENT_WITH_UPSTREAM } };
        return n;
      }),
    }));
  } else {
    state.updateNodeData(opts.scriptNodeId, { prompt: text });
  }

  if (!opts.parseAfter) {
    const hint = upstreamTextId
      ? "已写入上游文本节点，请点击「AI 解析」生成分镜表"
      : "已写入脚本底栏，请补充解析要求后点击「AI 解析」";
    return {
      ok: true,
      message: analysis.truncated ? `${hint}（正文已截断）` : hint,
    };
  }

  const params =
    scriptNode.data.params && typeof scriptNode.data.params === "object"
      ? (scriptNode.data.params as Record<string, unknown>)
      : undefined;
  if (!(await preflightScriptNodeLlm(params, state.setStatusText))) {
    return { ok: false, message: "未配置可用的对话模型" };
  }

  const promptForRun = upstreamTextId
    ? PARSE_REQUIREMENT_WITH_UPSTREAM
    : text;

  try {
    await runNodeTaskAgent(
      scriptNodeDispatchAgentRuntime,
      {
        prompt: promptForRun,
        dispatch: state.runNodeSubgraph,
      },
      {
        nodeId: opts.scriptNodeId,
        projectPath,
        updateNodeData: state.updateNodeData,
        setStatusText: state.setStatusText,
      },
    );
    const latest = useProjectStore.getState().nodes.find((n) => n.id === opts.scriptNodeId);
    const count = normalizeScriptBeats(latest?.data.scriptBeats ?? []).length;
    const status = scriptParseCompleteStatus(count);
    state.setStatusText(status);
    return { ok: true, message: status, beatCount: count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}
