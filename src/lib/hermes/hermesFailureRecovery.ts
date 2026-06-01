import type { HermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import type {
  HermesDirectorPlan,
  HermesPlanStep,
  HermesToolId,
} from "@/lib/hermes/hermesDirectorTypes";

export type HermesFailureContext = {
  failedStep: HermesPlanStep;
  errorMessage: string;
  parentPlan: HermesDirectorPlan;
};

function step(
  toolId: HermesToolId,
  label: string,
  args?: Record<string, unknown>,
): HermesPlanStep {
  return { id: crypto.randomUUID(), toolId, label, args };
}

function cloneArgs(step: HermesPlanStep): Record<string, unknown> | undefined {
  if (!step.args) return undefined;
  return { ...step.args };
}

/**
 * 根据失败步骤与错误信息生成最多 2 步的修复计划（规则型，对话驱动自动执行）。
 */
export function proposeFailureRecoveryPlan(
  failure: HermesFailureContext,
  canvas: HermesCanvasContext,
): HermesDirectorPlan | null {
  const { failedStep, errorMessage, parentPlan } = failure;
  const msg = errorMessage.toLowerCase();
  const steps: HermesPlanStep[] = [];

  const push = (s: HermesPlanStep) => {
    if (steps.length < 2) steps.push(s);
  };

  switch (failedStep.toolId) {
    case "image.generate_for_beats":
      if (/失败|failed|重试|partial|部分/.test(msg) || /失败|partial/.test(errorMessage)) {
        push(step("image.retry_failed", "重试失败镜头的关键帧出图"));
      } else {
        push(
          step(
            "image.generate_for_beats",
            "重试批量关键帧出图",
            cloneArgs(failedStep),
          ),
        );
      }
      break;
    case "image.retry_failed":
      push(step("film.workflow_check", "检查流程断点与失败镜头"));
      push(step("canvas.summarize", "汇总当前制片状态"));
      break;
    case "video.generate_for_beats":
      if (/失败|failed|重试|partial|部分/.test(msg) || /失败|partial/.test(errorMessage)) {
        push(step("video.retry_failed", "重试失败镜头的视频生成"));
      } else {
        push(
          step(
            "video.generate_for_beats",
            "重试批量视频生成",
            cloneArgs(failedStep),
          ),
        );
      }
      break;
    case "video.retry_failed":
      push(step("film.workflow_check", "检查流程断点与失败镜头"));
      push(step("canvas.summarize", "汇总当前制片状态"));
      break;
    case "chain.spawn_media_nodes":
      push(step("chain.spawn_media_nodes", "重新创建图片/视频节点链"));
      break;
    case "script.generate_storyboard":
      if (canvas.storyboardReadyCount === 0 && canvas.beatCount > 0) {
        push(step("script.generate_storyboard", "重新生成分镜文案"));
      } else if (!canvas.scriptNodeId) {
        push(step("canvas.ensure_script", "创建脚本节点"));
      } else {
        push(step("script.generate_outline", "重新生成镜头大纲"));
      }
      break;
    case "script.generate_outline":
      push(step("script.generate_outline", "重新生成镜头大纲"));
      break;
    case "script.update_brief":
      push(
        step("script.update_brief", "重新写入创意梗概", cloneArgs(failedStep)),
      );
      break;
    case "compose.export_script":
      push(step("film.workflow_check", "导出前检查流程"));
      push(
        step(
          "compose.export_script",
          "重新合成并导出成片",
          cloneArgs(failedStep) ?? { autoRender: true },
        ),
      );
      break;
    case "film.shot_to_video_prompt":
      push(
        step(
          "film.shot_to_video_prompt",
          "重新写入视频提示词",
          cloneArgs(failedStep),
        ),
      );
      break;
    case "canvas.ensure_script":
      push(step("canvas.ensure_script", "重新创建脚本节点"));
      break;
    default:
      if (!canvas.projectPath) return null;
      push(step("film.workflow_check", "检查生产流程与断链"));
      if (steps.length < 2) {
        push(step("canvas.summarize", "汇总画布状态并给出建议"));
      }
  }

  if (steps.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    title: `自动修复：${failedStep.label}`,
    sourceMessage: parentPlan.sourceMessage,
    steps,
    referenceRelPaths: parentPlan.referenceRelPaths,
    plannerSource: "recovery",
    isRecovery: true,
    parentPlanId: parentPlan.id,
    proactiveRecovery: parentPlan.proactiveRecovery,
    orbSuggestionId: parentPlan.orbSuggestionId,
    plannerReply: `上一步「${failedStep.label}」未完成（${errorMessage.slice(0, 120)}），将自动尝试修复：`,
  };
}

export function formatRecoveryIntro(
  recovery: HermesDirectorPlan,
  failedStep: HermesPlanStep,
): string {
  const intro =
    recovery.plannerReply?.trim() ||
    `「${failedStep.label}」未完成，将自动尝试以下修复：`;
  const lines = recovery.steps.map((s, i) => `${i + 1}. ${s.label}`);
  return `${intro}\n\n${lines.join("\n")}\n\n正在自动执行修复…`;
}
