/** Hermes Director 执行计划与步骤状态 */

export type HermesToolId =
  | "canvas.add_text_node"
  | "canvas.ensure_script"
  | "script.update_brief"
  | "script.generate_outline"
  | "script.generate_storyboard"
  | "storyboard.patch_shot"
  | "canvas.focus"
  | "bible.update"
  | "chain.spawn_media_nodes"
  | "image.generate_for_beats"
  | "image.retry_failed"
  | "video.generate_for_beats"
  | "video.retry_failed"
  | "compose.export_script"
  | "canvas.summarize"
  | "film.create_standard_workflow"
  | "film.shot_to_video_prompt"
  | "film.workflow_check"
  | "film.batch_set_video_params"
  | "template.run"
  | "agent.delegate_parallel";

export type HermesPlanStep = {
  id: string;
  toolId: HermesToolId;
  label: string;
  /** 工具入参（如 beatIds、briefText） */
  args?: Record<string, unknown>;
};

export type HermesDirectorPlan = {
  id: string;
  title: string;
  steps: HermesPlanStep[];
  /** 触发计划的用户原文 */
  sourceMessage: string;
  /** 会话 @ 解析出的工程内参考图路径（出图时注入） */
  referenceRelPaths?: string[];
  /** LLM 规划时的假设（展示用） */
  assumptions?: string[];
  risks?: string[];
  plannerReply?: string;
  plannerSource?: "rules" | "llm" | "template" | "recovery" | "learned" | "reasoned";
  /** 来自内置/用户计划模板时记录 id（全自动跑片、断点续跑） */
  templateId?: string;
  /** 自动修复计划：不再链式触发二次修复 */
  isRecovery?: boolean;
  /** 触发修复的原计划 id */
  parentPlanId?: string;
  /** 来自灵体主动恢复（自动或用户点气泡执行） */
  proactiveRecovery?: boolean;
  /** 关联的灵体建议 id（如 video_failed） */
  orbSuggestionId?: string;
};

export type HermesStepRunStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type HermesPlanExecutionState = {
  planId: string;
  stepStatuses: Record<string, HermesStepRunStatus>;
  currentStepId: string | null;
  error: string | null;
};

export type HermesToolRunResult = {
  ok: boolean;
  message: string;
  scriptNodeId?: string;
  /** 本次写脚本后自动存档的 id（若有） */
  scriptVersionId?: string;
  /** iter-111：聊天气泡内嵌媒体预览 */
  mediaPreview?: import("@/lib/hermes/hermesChatMediaPreview").HermesChatMediaPreview;
};
