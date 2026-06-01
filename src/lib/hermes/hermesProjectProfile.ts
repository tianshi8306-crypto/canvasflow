import type { HermesSituation } from "@/lib/hermes/hermesSituation";

/** 工程制片画像（用于 Skill 加权与 LLM 上下文） */
export type HermesProductionProjectType =
  | "freeform"
  | "single_shot"
  | "short_drama"
  | "ad_spot";

export const PROJECT_TYPE_SKILL_BOOST: Record<
  HermesProductionProjectType,
  readonly string[]
> = {
  freeform: ["workflow-check", "production-summary", "video-motion", "video-prompt"],
  single_shot: ["retry-video", "video-motion", "video-prompt", "tpl-video"],
  short_drama: ["short-drama", "tpl-full", "tpl-keyframes", "storyboard", "workflow-check"],
  ad_spot: ["tpl-video", "tpl-full", "video-motion", "retry-video", "tpl-keyframes"],
};

const PROJECT_TYPE_LABELS: Record<HermesProductionProjectType, string> = {
  freeform: "自由编排（无限画布，可无脚本）",
  single_shot: "单镜/小段（镜头少，偏图生视频）",
  short_drama: "短剧/多镜（镜头较多，走完整链路）",
  ad_spot: "广告短片（镜数少、偏成片导出）",
};

export function inferHermesProductionProjectType(
  situation: HermesSituation,
): HermesProductionProjectType {
  const { ctx, production: p } = situation;
  if (!ctx.scriptNodeId) return "freeform";
  if (p.beatCount <= 2) return "single_shot";
  if (p.beatCount >= 8) return "short_drama";
  if (p.beatCount <= 5 && p.exportTotal > 0 && p.exportTotal <= 6) {
    return "ad_spot";
  }
  if (p.beatCount >= 6) return "short_drama";
  return "single_shot";
}

export function projectTypeBoostForSkill(
  projectType: HermesProductionProjectType,
  skillId: string,
): number {
  return PROJECT_TYPE_SKILL_BOOST[projectType].includes(skillId) ? 8 : 0;
}

export function formatHermesProjectProfileForLlm(
  projectType: HermesProductionProjectType,
): string {
  return `【工程画像】${PROJECT_TYPE_LABELS[projectType]}`;
}
