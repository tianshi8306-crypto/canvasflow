/**
 * 灵体 / 侧栏芯片的主动建议策略：无限画布非线性编辑下，
 * 不推销「缺某节点」或「该进入下一阶段」，只对失败与用户已启动的断点提示。
 */

/** 不弹出灵体/芯片的 situation 缺口（仍可在对话上下文中体现） */
export const PROACTIVE_EXCLUDED_GAP_IDS = new Set([
  "no_beats",
  "production_empty_beats",
  "image_missing",
  "video_ready_batch",
  "video_blocked",
  "export_not_ready",
  "production_export_not_ready_yet",
  "production_video_stalled",
  "bible_no_refs",
]);

/** 不进入主动建议列表的固定 id（顾问向 / 稳态催促） */
export const PROACTIVE_EXCLUDED_SUGGESTION_IDS = new Set([
  "image_missing",
  "video_eligible",
  "optimize_video_prompts",
  "optimize_shot_count",
  "optimize_beat_pacing",
  "optimize_sparse_visuals",
]);

/** 仅当存在真实断链/失败时提示「流程检查并修复」 */
export const WORKFLOW_REPAIR_ISSUE_IDS = new Set([
  "storyboard_failed_batch",
  "keyframe_failed_batch",
  "video_failed_batch",
  "storyboard_gap_before_media",
  "video_before_all_images",
]);

export function isGapProactiveEligible(gapId: string): boolean {
  return !PROACTIVE_EXCLUDED_GAP_IDS.has(gapId);
}

/** 侧栏 Situation 卡展示的缺口（与灵体/芯片排除策略一致，失败与真实断链仍展示） */
export function isGapSituationCardVisible(gapId: string): boolean {
  if (PROACTIVE_EXCLUDED_GAP_IDS.has(gapId)) return false;
  if (gapId.startsWith("production_")) {
    const bare = gapId.slice("production_".length);
    if (PROACTIVE_EXCLUDED_GAP_IDS.has(bare)) return false;
  }
  return true;
}

export function filterGapsForSituationCard<T extends { id: string }>(
  gaps: readonly T[],
): T[] {
  return gaps.filter((g) => isGapSituationCardVisible(g.id));
}

export function isProactiveSuggestionEligible(suggestionId: string): boolean {
  return !PROACTIVE_EXCLUDED_SUGGESTION_IDS.has(suggestionId);
}

export function shouldSuggestWorkflowAutoRepair(
  issueIds: readonly string[],
): boolean {
  return issueIds.some((id) => WORKFLOW_REPAIR_ISSUE_IDS.has(id));
}

/** 规则命中后可用轻量 LLM 改写文案（失败 / 跃迁 / 断链 / 续跑） */
export const ORB_LLM_ENHANCE_SUGGESTION_IDS = new Set([
  "agent_tasks_failed",
  "video_failed",
  "gap_video_failed",
  "storyboard_failed",
  "gap_storyboard_failed",
  "gap_storyboard_missing",
  "storyboard_complete_chain",
  "images_ready_video",
  "shot_edited_regen_image",
  "shot_edited_regen_video",
  "brief_updated_sync",
  "pipeline_checkpoint_resume",
  "workflow_auto_repair",
  "production_storyboard_failed_batch",
  "production_keyframe_failed_batch",
  "production_video_failed_batch",
  "production_storyboard_gap_before_media",
  "production_video_before_all_images",
]);

export function shouldEnhanceOrbSuggestionWithLlm(suggestionId: string): boolean {
  if (ORB_LLM_ENHANCE_SUGGESTION_IDS.has(suggestionId)) return true;
  if (suggestionId.startsWith("gap_")) {
    const bare = suggestionId.slice(4);
    return ORB_LLM_ENHANCE_SUGGESTION_IDS.has(bare) || ORB_LLM_ENHANCE_SUGGESTION_IDS.has(`gap_${bare}`);
  }
  return false;
}

/** 灵体建议可自动提交 Director（失败重试 / 断链修复 / 续跑），不含跃迁推销 */
export const ORB_PROACTIVE_AUTO_ACT_IDS = new Set([
  "agent_tasks_failed",
  "video_failed",
  "gap_video_failed",
  "storyboard_failed",
  "gap_storyboard_failed",
  "pipeline_checkpoint_resume",
  "workflow_auto_repair",
  "production_storyboard_failed_batch",
  "production_keyframe_failed_batch",
  "production_video_failed_batch",
  "production_storyboard_gap_before_media",
  "production_video_before_all_images",
]);

export function shouldAutoActOrbSuggestion(suggestionId: string): boolean {
  if (ORB_PROACTIVE_AUTO_ACT_IDS.has(suggestionId)) return true;
  if (suggestionId.startsWith("gap_")) {
    const bare = suggestionId.slice(4);
    return ORB_PROACTIVE_AUTO_ACT_IDS.has(bare);
  }
  if (suggestionId.startsWith("production_")) {
    const bare = suggestionId.slice("production_".length);
    return ORB_PROACTIVE_AUTO_ACT_IDS.has(`production_${bare}`);
  }
  return false;
}
