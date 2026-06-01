import type { HermesProductionProjectType } from "@/lib/hermes/hermesProjectProfile";

/** 内置 Skill 的触发词、分类与关联计划模板 */
export type HermesSkillMeta = {
  category?: string;
  triggers?: string[];
  /** 命中且计划较弱时优先套用的 `hermesPlanTemplates` id */
  templateId?: string;
  priority?: number;
  /** 工程画像匹配时加分（freeform / single_shot / short_drama / ad_spot） */
  projectTypes?: HermesProductionProjectType[];
};

export const BUILTIN_SKILL_META: Record<string, HermesSkillMeta> = {
  "short-drama": {
    category: "pipeline",
    triggers: ["短剧", "搭建流程", "标准流程", "生产链路"],
    templateId: "creative-pipeline",
    priority: 2,
    projectTypes: ["short_drama", "ad_spot"],
  },
  "tpl-keyframes": {
    category: "template",
    triggers: ["关键帧", "分镜出图", "批量出图", "出关键帧"],
    templateId: "storyboard-keyframes",
    priority: 3,
    projectTypes: ["short_drama", "ad_spot"],
  },
  "tpl-video": {
    category: "template",
    triggers: ["出视频", "关键帧到视频", "批量视频"],
    templateId: "keyframes-to-video",
    priority: 3,
    projectTypes: ["single_shot", "ad_spot", "freeform"],
  },
  "tpl-full": {
    category: "template",
    triggers: ["全自动", "一条龙", "创意到成片", "端到端"],
    templateId: "full-auto-export",
    priority: 2,
    projectTypes: ["short_drama", "ad_spot"],
  },
  "tpl-list": {
    category: "meta",
    triggers: ["模板列表", "计划模板", "有哪些模板"],
  },
  "workflow-check": {
    category: "quality",
    triggers: ["流程检查", "断链", "还缺什么", "sop"],
    projectTypes: ["freeform", "short_drama"],
  },
  "production-summary": {
    category: "meta",
    triggers: ["制片进度", "进度摘要", "待办一览"],
    projectTypes: ["freeform"],
  },
  "video-prompt": {
    category: "video",
    triggers: ["视频提示词", "seedance", "转视频提示"],
    projectTypes: ["single_shot", "freeform"],
  },
  "video-motion": {
    category: "video",
    triggers: ["人物动作", "动作模板", "motion"],
    templateId: "keyframes-to-video",
    priority: 1,
    projectTypes: ["single_shot", "ad_spot", "freeform"],
  },
  "retry-video": {
    category: "video",
    triggers: ["重试视频", "失败镜头", "重新生成视频"],
    templateId: "retry-failed-video",
    priority: 2,
    projectTypes: ["single_shot", "short_drama", "ad_spot"],
  },
  storyboard: {
    category: "storyboard",
    triggers: ["分镜润色", "visualprompt", "镜号节奏"],
    projectTypes: ["short_drama"],
  },
  "tts-delivery": {
    category: "audio",
    triggers: ["配音", "tts", "表演词", "台词分行"],
  },
};

export const SKILL_CATEGORY_ORDER = [
  "pipeline",
  "template",
  "storyboard",
  "video",
  "audio",
  "quality",
  "meta",
  "custom",
] as const;

export const SKILL_CATEGORY_LABELS: Record<string, string> = {
  pipeline: "制片流程",
  template: "计划模板",
  storyboard: "分镜",
  video: "视频",
  audio: "音频",
  quality: "质检",
  meta: "查阅",
  custom: "用户 Skill",
};
