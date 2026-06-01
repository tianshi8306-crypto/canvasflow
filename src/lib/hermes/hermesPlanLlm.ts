import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Edge, Node } from "@xyflow/react";
import type { HermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import {
  buildHermesSituation,
  formatHermesSituationForLlm,
} from "@/lib/hermes/hermesSituation";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import type { HermesDirectorPlan, HermesPlanStep, HermesToolId } from "@/lib/hermes/hermesDirectorTypes";
import { extractJsonObject } from "@/lib/hermes/hermesPlanParse";
import { serializeCanvasGraphForHermes } from "@/lib/hermes/hermesGraph";
import { buildHermesAgentContextBlock } from "@/lib/hermes/agent/hermesAgentContext";
import {
  formatKnowledgeHitsForPrompt,
  hermesKnowledgeSearch,
} from "@/lib/hermes/knowledge/hermesKnowledgeSearch";
import {
  buildKnowledgeQueryFromSituation,
  pickKnowledgeScenesFromSituation,
} from "@/lib/hermes/hermesProductionExpert";
import {
  getHermesReplyLimits,
  inferHermesReplyStyle,
} from "@/lib/hermes/hermesReplyStyle";
import { pickHermesKnowledgeScenesForChat } from "@/lib/hermes/knowledge/hermesKnowledgeSearch";
import type { FlowNodeData } from "@/lib/types";

const ALLOWED_TOOLS = new Set<HermesToolId>([
  "canvas.add_text_node",
  "canvas.ensure_script",
  "script.update_brief",
  "script.generate_outline",
  "script.generate_storyboard",
  "storyboard.patch_shot",
  "canvas.focus",
  "bible.update",
  "chain.spawn_media_nodes",
  "image.generate_for_beats",
  "video.generate_for_beats",
  "image.retry_failed",
  "video.retry_failed",
  "compose.export_script",
  "canvas.summarize",
  "film.create_standard_workflow",
  "film.shot_to_video_prompt",
  "film.workflow_check",
  "film.batch_set_video_params",
  "template.run",
  "agent.delegate_parallel",
]);

type LlmPlanStep = {
  toolId?: string;
  label?: string;
  args?: Record<string, unknown>;
};

type LlmPlanPayload = {
  reply?: string;
  assumptions?: string[];
  risks?: string[];
  steps?: LlmPlanStep[];
};

function normalizeBeatIdsArg(args: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!args) return undefined;
  const raw = args.beatIds;
  if (!Array.isArray(raw)) return args;
  const nums = raw
    .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
    .filter((n) => Number.isFinite(n) && n >= 1 && n < 200);
  if (nums.length === 0) return { ...args, beatIds: undefined };
  return { ...args, beatIds: nums };
}

export function parseHermesLlmPlanPayload(
  raw: string,
  sourceMessage: string,
  ctx: HermesCanvasContext,
  referenceRelPaths?: string[],
): HermesDirectorPlan | null {
  const payload = extractJsonObject<LlmPlanPayload>(raw);
  if (!payload?.steps || !Array.isArray(payload.steps)) return null;

  const steps: HermesPlanStep[] = [];
  for (const row of payload.steps) {
    const toolId = String(row.toolId ?? "").trim() as HermesToolId;
    if (!ALLOWED_TOOLS.has(toolId)) continue;
    const label = String(row.label ?? "").trim();
    if (!label) continue;
    let args = normalizeBeatIdsArg(row.args);
    if (toolId === "script.update_brief" && !args?.briefText) {
      args = { ...args, briefText: sourceMessage };
    }
    if (
      (toolId === "image.generate_for_beats" || toolId === "video.generate_for_beats") &&
      referenceRelPaths?.length
    ) {
      args = { ...args, referenceRelPaths };
    }
    steps.push({
      id: crypto.randomUUID(),
      toolId,
      label,
      args,
    });
    if (steps.length >= 8) break;
  }

  if (steps.length === 0) return null;

  if (!ctx.projectPath && steps.some((s) => s.toolId !== "canvas.summarize")) {
    return {
      id: crypto.randomUUID(),
      title: "Hermes 执行计划",
      sourceMessage,
      steps: [
        {
          id: crypto.randomUUID(),
          toolId: "canvas.summarize",
          label: "请先打开或新建工程后再执行生成类操作",
        },
      ],
      plannerSource: "llm",
    };
  }

  const refPaths = referenceRelPaths?.filter((p) => p.trim()) ?? [];
  return {
    id: crypto.randomUUID(),
    title: "Hermes 执行计划",
    sourceMessage,
    steps,
    assumptions: payload.assumptions?.filter((a) => typeof a === "string" && a.trim()),
    risks: payload.risks?.filter((r) => typeof r === "string" && r.trim()),
    plannerReply: payload.reply?.trim() || undefined,
    plannerSource: "llm",
    ...(refPaths.length > 0 ? { referenceRelPaths: refPaths } : {}),
  };
}

export async function fetchHermesLlmPlan(opts: {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  userMessage: string;
  ctx: HermesCanvasContext;
  providerId: string;
  model: string;
  referenceRelPaths?: string[];
  projectPath?: string | null;
  messageMode?: "consult" | "execute" | "mixed";
}): Promise<HermesDirectorPlan | null> {
  if (!isTauri()) return null;
  const graphJson = serializeCanvasGraphForHermes(opts.nodes, opts.edges);
  const situation = buildHermesSituation(opts.nodes, opts.edges, opts.ctx.projectPath, {
    bible: useProjectBibleStore.getState().bible,
  });
  let situationSummary = formatHermesSituationForLlm(situation, {
    includeCanvasEvents: false,
    includeReferentHint: false,
  });
  try {
    const agentBlock = await buildHermesAgentContextBlock(
      opts.projectPath ?? null,
      opts.userMessage,
    );
    if (agentBlock) situationSummary += `\n\n${agentBlock}`;
  } catch {
    /* agent context optional */
  }
  const replyStyle = inferHermesReplyStyle({
    userMessage: opts.userMessage,
    messageMode: opts.messageMode,
  });
  try {
    const msgScenes = pickHermesKnowledgeScenesForChat(opts.userMessage);
    if (opts.messageMode === "mixed") {
      msgScenes.push("film_theory");
    }
    const canvasScenes = pickKnowledgeScenesFromSituation(situation);
    const scenes = [...new Set([...msgScenes, ...canvasScenes])].slice(0, 3);
    const q = buildKnowledgeQueryFromSituation(situation, opts.userMessage);

    const blocks: string[] = [];
    for (const scene of scenes) {
      const hits = await hermesKnowledgeSearch({
        scene,
        query: q,
        limit: 2,
        projectPath: opts.projectPath,
      });
      const block = formatKnowledgeHitsForPrompt(hits);
      if (block) blocks.push(block);
    }
    if (blocks.length > 0) {
      const { knowledgeSnippetMax } = getHermesReplyLimits(replyStyle);
      situationSummary += `\n\n【影视知识参考】\n${blocks.join("\n\n").slice(0, knowledgeSnippetMax)}`;
    }
    if (opts.messageMode === "mixed") {
      situationSummary +=
        "\n\n【混合意图】用户同时咨询与执行：reply 先 2～4 句概括风格/理论建议，steps 仍按执行意图排列。";
    }
  } catch {
    // 检索失败不阻断规划
  }
  const raw = await invoke<string>("hermes_plan", {
    graphJson,
    userMessage: opts.userMessage.trim(),
    replyStyle,
    messageMode: opts.messageMode ?? null,
    situationSummary,
    providerId: opts.providerId,
    model: opts.model,
  });
  return parseHermesLlmPlanPayload(raw, opts.userMessage, opts.ctx, opts.referenceRelPaths);
}
