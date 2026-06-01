import type { Edge, Node } from "@xyflow/react";
import type {
  HermesDirectorPlan,
  HermesPlanStep,
  HermesToolId,
} from "@/lib/hermes/hermesDirectorTypes";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import type { FlowNodeData } from "@/lib/types";
import type { ProjectBible } from "@/lib/projectBible/projectBible";

const MEDIA_TOOLS = new Set<HermesToolId>([
  "image.generate_for_beats",
  "image.retry_failed",
  "video.generate_for_beats",
  "video.retry_failed",
]);

const EXPORT_TOOLS = new Set<HermesToolId>(["compose.export_script"]);

function makeStep(
  toolId: HermesToolId,
  label: string,
  args?: Record<string, unknown>,
): HermesPlanStep {
  return { id: crypto.randomUUID(), toolId, label, args };
}

function planUsesMedia(plan: HermesDirectorPlan): boolean {
  return plan.steps.some((s) => MEDIA_TOOLS.has(s.toolId));
}

function planUsesExport(plan: HermesDirectorPlan): boolean {
  return plan.steps.some((s) => EXPORT_TOOLS.has(s.toolId));
}

/** 在计划前/步骤间插入缺失依赖（R3 规则推理，不调用 LLM） */
export function completePlanWithLogicalSteps(
  plan: HermesDirectorPlan,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  projectPath: string | null,
  bible: ProjectBible | null,
): HermesDirectorPlan {
  if (!plan.steps.length || !projectPath) return plan;

  const situation = buildHermesSituation(nodes, edges, projectPath, { bible });
  const p = situation.production;
  const ctx = situation.ctx;
  const prefix: HermesPlanStep[] = [];
  const seen = new Set(plan.steps.map((s) => s.toolId));

  const pushPrefix = (step: HermesPlanStep) => {
    if (seen.has(step.toolId)) return;
    seen.add(step.toolId);
    prefix.push(step);
  };

  if (!ctx.scriptNodeId && planUsesMedia(plan)) {
    pushPrefix(makeStep("canvas.ensure_script", "推理：先创建脚本节点"));
  }

  if (
    ctx.scriptNodeId &&
    p.beatCount > 0 &&
    p.storyboardReady < p.beatCount &&
    planUsesMedia(plan)
  ) {
    pushPrefix(makeStep("script.generate_storyboard", "推理：出图/出视频前补充分镜"));
  }

  if (p.storyboardFailed > 0 && planUsesMedia(plan)) {
    if (p.storyboardReady > 0) {
      pushPrefix(makeStep("image.retry_failed", "推理：先重试失败关键帧"));
    } else {
      pushPrefix(makeStep("script.generate_storyboard", "推理：先修复失败分镜"));
    }
  }

  if (
    p.imageMissing > 0 &&
    p.storyboardReady > 0 &&
    plan.steps.some((s) => s.toolId === "video.generate_for_beats")
  ) {
    pushPrefix(
      makeStep("image.generate_for_beats", "推理：出视频前补齐关键帧"),
    );
  }

  if (p.videoFailed > 0 && plan.steps.some((s) => s.toolId === "video.generate_for_beats")) {
    pushPrefix(makeStep("video.retry_failed", "推理：先处理失败视频"));
  }

  if (planUsesExport(plan) && (p.exportReady === 0 || p.videoGenerated === 0)) {
    if (!seen.has("film.workflow_check")) {
      pushPrefix(makeStep("film.workflow_check", "推理：导出前检查流程"));
    }
  }

  if (prefix.length === 0) return plan;

  return {
    ...plan,
    title: plan.title.includes("推理") ? plan.title : `${plan.title}（补全依赖）`,
    steps: [...prefix, ...plan.steps],
    assumptions: [
      ...(plan.assumptions ?? []),
      `规则推理插入 ${prefix.length} 步：${prefix.map((s) => s.label).join(" → ")}`,
    ],
    plannerSource:
      plan.plannerSource === "learned" ? "learned" : ("reasoned" as const),
  };
}

export function countSparseVisualPrompts(nodes: Node<FlowNodeData>[]): number {
  let sparse = 0;
  for (const n of nodes) {
    if (n.type !== "scriptNode") continue;
    const shots = n.data.storyboardShots ?? [];
    for (const s of shots) {
      if (s.status === "generated" && !String(s.visualPrompt ?? "").trim()) {
        sparse += 1;
      }
    }
  }
  return sparse;
}
