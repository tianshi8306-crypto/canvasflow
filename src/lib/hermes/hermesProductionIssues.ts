import type { HermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import type { HermesPlanStep, HermesToolId } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesProductionSnapshot } from "@/lib/hermes/hermesSituation";

export type ProductionIssueSeverity = "info" | "warn" | "block";

export type ProductionIssue = {
  id: string;
  severity: ProductionIssueSeverity;
  message: string;
  suggestedPrompt: string;
  repairToolId?: HermesToolId;
};

function issue(
  id: string,
  severity: ProductionIssueSeverity,
  message: string,
  suggestedPrompt: string,
  repairToolId?: HermesToolId,
): ProductionIssue {
  return { id, severity, message, suggestedPrompt, repairToolId };
}

/** 规则检测制片断链 / 矛盾（E3） */
export function detectProductionIssues(
  production: HermesProductionSnapshot,
  canvas: HermesCanvasContext,
): ProductionIssue[] {
  const out: ProductionIssue[] = [];
  if (!canvas.projectPath) return out;

  if (!canvas.scriptNodeId) {
    return out;
  }

  if (production.beatCount === 0 && canvas.hasBrief) {
    out.push(
      issue(
        "empty_beats",
        "warn",
        "镜头表为空",
        "帮我根据梗概生成镜头表",
        "script.generate_outline",
      ),
    );
  }

  if (production.storyboardFailed > 0) {
    if (production.storyboardReady > 0) {
      out.push(
        issue(
          "keyframe_failed_batch",
          "warn",
          `${production.storyboardFailed} 镜关键帧出图失败`,
          "帮我把失败镜头的关键帧重新出图",
          "image.retry_failed",
        ),
      );
    } else {
      out.push(
        issue(
          "storyboard_failed_batch",
          "warn",
          `${production.storyboardFailed} 镜分镜生成失败，后续出图/出视频可能无效`,
          "帮我把失败镜头的分镜重新生成",
          "script.generate_storyboard",
        ),
      );
    }
  }

  if (
    production.beatCount > 0 &&
    production.storyboardMissing > 0 &&
    production.imageMissing + production.imageReady > 0
  ) {
    out.push(
      issue(
        "storyboard_gap_before_media",
        "warn",
        `尚有 ${production.storyboardMissing} 镜无分镜文案，但已有镜在走出图/视频`,
        "帮我把脚本生成分镜",
        "script.generate_storyboard",
      ),
    );
  }

  if (production.imageMissing > 0 && production.videoGenerated > 0) {
    out.push(
      issue(
        "video_before_all_images",
        "warn",
        `仍有 ${production.imageMissing} 镜缺关键帧，但已有镜在出视频`,
        "帮我把缺图镜头先批量出图",
        "image.generate_for_beats",
      ),
    );
  }

  if (production.videoFailed > 0) {
    out.push(
      issue(
        "video_failed_batch",
        "warn",
        `${production.videoFailed} 镜视频生成失败`,
        "帮我把失败镜头的视频重新生成",
        "video.retry_failed",
      ),
    );
  }

  if (
    production.exportTotal > 0 &&
    production.exportReady === 0 &&
    production.videoGenerated > 0
  ) {
    out.push(
      issue(
        "export_not_ready_yet",
        "info",
        "尚无满足导出条件的成片镜头",
        "帮我看看还要补哪些镜头才能导出时间线成片",
        "film.workflow_check",
      ),
    );
  }

  return out.slice(0, 5);
}

export function productionIssueToGap(iss: ProductionIssue): {
  id: string;
  severity: "info" | "warn" | "block";
  message: string;
  suggestedPrompt?: string;
} {
  return {
    id: `production_${iss.id}`,
    severity: iss.severity === "block" ? "block" : iss.severity,
    message: iss.message,
    suggestedPrompt: iss.suggestedPrompt,
  };
}

export function repairStepsFromProductionIssues(
  issues: ProductionIssue[],
  max = 4,
): HermesPlanStep[] {
  const steps: HermesPlanStep[] = [];
  const seen = new Set<HermesToolId>();
  for (const iss of issues) {
    if (!iss.repairToolId || seen.has(iss.repairToolId)) continue;
    seen.add(iss.repairToolId);
    steps.push({
      id: crypto.randomUUID(),
      toolId: iss.repairToolId,
      label: iss.message.slice(0, 40),
    });
    if (steps.length >= max) break;
  }
  return steps;
}
