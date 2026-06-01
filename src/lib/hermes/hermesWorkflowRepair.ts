import type { Edge, Node } from "@xyflow/react";
import type { HermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import type {
  HermesDirectorPlan,
  HermesPlanStep,
  HermesToolId,
} from "@/lib/hermes/hermesDirectorTypes";
import {
  buildFilmWorkflowCheckReport,
  type FilmWorkflowCheckReport,
  type WorkflowCheckStage,
} from "@/lib/hermes/film/filmWorkflowCheck";
import { proposeFailureRecoveryPlan } from "@/lib/hermes/hermesFailureRecovery";
import {
  detectProductionIssues,
  repairStepsFromProductionIssues,
} from "@/lib/hermes/hermesProductionIssues";
import type { HermesProductionSnapshot } from "@/lib/hermes/hermesSituation";
import type { FlowNodeData } from "@/lib/types";
import type { ProjectBible } from "@/lib/projectBible/projectBible";

export const WORKFLOW_REPAIR_MAX_STEPS = 4;

/** 「检查并修复」「修好断链」等 */
export function wantsWorkflowRepair(text: string): boolean {
  return /并修复|自动修|修好|修复流程|修一下|补齐断链|修复断链/.test(text);
}

function makeStep(
  toolId: HermesToolId,
  label: string,
  args?: Record<string, unknown>,
): HermesPlanStep {
  return { id: crypto.randomUUID(), toolId, label, args };
}

function stageToRepairStep(stage: WorkflowCheckStage): HermesPlanStep | null {
  if (stage.status === "done") return null;

  switch (stage.id) {
    case "project":
      return null;
    case "outline":
      return makeStep(
        "film.create_standard_workflow",
        "搭建标准短剧流程（补大纲/脚本）",
      );
    case "script":
      return makeStep("canvas.ensure_script", "创建脚本节点");
    case "beats":
      return makeStep("script.generate_outline", "生成镜头表");
    case "storyboard":
      return makeStep("script.generate_storyboard", "补充分镜文案");
    case "media_chain":
      return makeStep("chain.spawn_media_nodes", "为分镜创建图片/视频节点链");
    case "video_prompt":
      return makeStep(
        "film.shot_to_video_prompt",
        "补全视频提示词（Seedance draft）",
        { useMotionTemplate: true },
      );
    case "export":
      return null;
    default:
      return null;
  }
}

function pushUnique(
  out: HermesPlanStep[],
  step: HermesPlanStep | null,
  seen: Set<HermesToolId>,
): void {
  if (!step || seen.has(step.toolId)) return;
  if (out.length >= WORKFLOW_REPAIR_MAX_STEPS) return;
  seen.add(step.toolId);
  out.push(step);
}

/** 由 workflow_check 报告生成修复步骤（规则，最多 4 步） */
export function proposeRepairStepsFromWorkflowReport(
  report: FilmWorkflowCheckReport,
  opts?: { includeExport?: boolean },
): HermesPlanStep[] {
  const steps: HermesPlanStep[] = [];
  const seen = new Set<HermesToolId>();

  const ordered = [...report.stages].sort((a, b) => {
    const rank = (s: WorkflowCheckStage) =>
      s.status === "todo" ? 0 : s.status === "partial" ? 1 : 2;
    return rank(a) - rank(b);
  });

  for (const stage of ordered) {
    if (stage.id === "export" && !opts?.includeExport) continue;
    pushUnique(steps, stageToRepairStep(stage), seen);
  }

  return steps;
}

/** 由制片快照快速生成高优先级修复步（无需完整 report） */
export function proposeRepairStepsFromProduction(
  production: HermesProductionSnapshot,
  canvas: HermesCanvasContext,
): HermesPlanStep[] {
  const steps: HermesPlanStep[] = [];
  const seen = new Set<HermesToolId>();

  if (!canvas.projectPath) return steps;

  if (production.videoFailed > 0) {
    pushUnique(steps, makeStep("video.retry_failed", "重试失败镜头的视频生成"), seen);
  }

  if (!canvas.scriptNodeId) {
    pushUnique(steps, makeStep("canvas.ensure_script", "创建脚本节点"), seen);
    return steps;
  }

  if (
    production.beatCount > 0 &&
    production.storyboardReady < production.beatCount
  ) {
    pushUnique(
      steps,
      makeStep("script.generate_storyboard", "补充分镜文案"),
      seen,
    );
  }

  if (production.imageMissing > 0 && production.storyboardReady > 0) {
    pushUnique(
      steps,
      makeStep("image.generate_for_beats", "补齐缺失的关键帧出图"),
      seen,
    );
  }

  if (production.storyboardFailed > 0) {
    if (production.storyboardReady > 0) {
      pushUnique(
        steps,
        makeStep("image.retry_failed", "重试失败镜头的关键帧出图"),
        seen,
      );
    } else {
      pushUnique(
        steps,
        makeStep("script.generate_storyboard", "重试失败的分镜文案"),
        seen,
      );
    }
  }

  return steps;
}

/** 失败后：优先全链路修复，再回退 iter-42 recovery */
export function proposeWorkflowAwareRecoverySteps(
  failedStep: HermesPlanStep,
  errorMessage: string,
  parentPlan: HermesDirectorPlan,
  production: HermesProductionSnapshot,
  canvas: HermesCanvasContext,
  graph?: {
    nodes: Node<FlowNodeData>[];
    edges: Edge[];
    projectPath?: string | null;
    bible?: ProjectBible | null;
  },
): HermesPlanStep[] | null {
  const fromIssues = repairStepsFromProductionIssues(
    detectProductionIssues(production, canvas),
    WORKFLOW_REPAIR_MAX_STEPS,
  );
  if (fromIssues.length > 0) {
    const sameToolRetry = fromIssues.find((s) => s.toolId === failedStep.toolId);
    if (sameToolRetry) return [sameToolRetry];
    return fromIssues;
  }

  const fromProduction = proposeRepairStepsFromProduction(production, canvas);
  if (fromProduction.length > 0) {
    const sameToolRetry = fromProduction.find((s) => s.toolId === failedStep.toolId);
    if (sameToolRetry) return [sameToolRetry];
    return fromProduction.slice(0, WORKFLOW_REPAIR_MAX_STEPS);
  }

  if (graph?.nodes) {
    const report = buildFilmWorkflowCheckReport({
      nodes: graph.nodes,
      edges: graph.edges,
      projectPath: graph.projectPath ?? canvas.projectPath,
      bible: graph.bible ?? null,
    });
    const fromReport = proposeRepairStepsFromWorkflowReport(report);
    if (fromReport.length > 0) return fromReport;
  }

  const legacy = proposeFailureRecoveryPlan(
    { failedStep, errorMessage, parentPlan },
    canvas,
  );
  return legacy?.steps ?? null;
}

/** workflow_check 成功后按报告插入修复队列 */
export function proposeRepairStepsAfterWorkflowCheck(
  report: FilmWorkflowCheckReport,
  production: HermesProductionSnapshot,
  canvas: HermesCanvasContext,
): HermesPlanStep[] {
  const fromReport = proposeRepairStepsFromWorkflowReport(report);
  if (fromReport.length > 0) return fromReport;

  return proposeRepairStepsFromProduction(production, canvas);
}

/** 高风险步骤执行前：导出/批量视频前的断点修复 */
export function preflightWorkflowRepairSteps(
  nextStep: HermesPlanStep,
  production: HermesProductionSnapshot,
  canvas: HermesCanvasContext,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  bible: ProjectBible | null,
): HermesPlanStep[] {
  const highRisk: HermesToolId[] = [
    "compose.export_script",
    "video.generate_for_beats",
    "image.generate_for_beats",
  ];
  if (!highRisk.includes(nextStep.toolId)) return [];

  const report = buildFilmWorkflowCheckReport({
    nodes,
    edges,
    projectPath: canvas.projectPath,
    bible,
  });
  if (report.blockers === 0 && report.warnings === 0) {
    return proposeRepairStepsFromProduction(production, canvas).filter(
      (s) => s.toolId !== nextStep.toolId,
    );
  }

  const repairs = proposeRepairStepsFromWorkflowReport(report, {
    includeExport: nextStep.toolId === "compose.export_script",
  });
  return repairs.filter((s) => s.toolId !== nextStep.toolId);
}
