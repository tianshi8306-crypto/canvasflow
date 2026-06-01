/**
 * Hermes 能力登记表（供导演规则 / LLM 规划 / 文档对照）。
 * **不在侧栏展示、不可点击**——用户只需与灵体对话，由 `hermesPlanFromIntent` 等自动识别并执行。
 */
export type HermesSkill = {
  id: string;
  label: string;
  hint: string;
  /** 规则规划或 LLM 规划时对应的典型用户话术 */
  exampleUtterance: string;
};

export const HERMES_SKILLS: HermesSkill[] = [
  {
    id: "short-drama",
    label: "搭短剧流程",
    hint: "搭建 text→脚本 标准生产链路",
    exampleUtterance: "帮我搭建 30 秒古风短剧标准流程，5 个镜头",
  },
  {
    id: "tpl-keyframes",
    label: "模板·出关键帧",
    hint: "分镜 → 建链 → 批量出图",
    exampleUtterance: "跑模板 分镜出关键帧",
  },
  {
    id: "tpl-video",
    label: "模板·出视频",
    hint: "人物动作提示词 → 批量出视频",
    exampleUtterance: "跑模板 关键帧到视频",
  },
  {
    id: "tpl-full",
    label: "模板·创意到成片",
    hint: "梗概到出视频完整链路",
    exampleUtterance: "跑模板 创意到成片",
  },
  {
    id: "tpl-list",
    label: "模板列表",
    hint: "查看内置与自定义模板",
    exampleUtterance: "有哪些计划模板",
  },
  {
    id: "workflow-check",
    label: "流程检查",
    hint: "按 SOP 检查画布断链与待办",
    exampleUtterance: "帮我检查一下当前短剧生产流程还缺什么",
  },
  {
    id: "production-summary",
    label: "制片摘要",
    hint: "分镜/出图/视频/导出进度一览",
    exampleUtterance: "帮我看看当前工程的制片进度和待办",
  },
  {
    id: "video-prompt",
    label: "视频提示词",
    hint: "分镜 visualPrompt → Seedance draft.prompt",
    exampleUtterance: "帮我把分镜转成 Seedance 视频提示词",
  },
  {
    id: "video-motion",
    label: "人物动作视频提示词",
    hint: "知识库人物动作模板 + LLM 补全 videoMotion / draft",
    exampleUtterance: "按人物动作模板为各镜补全视频提示词",
  },
  {
    id: "retry-video",
    label: "重试失败视频",
    hint: "仅重试 videoStatus=failed 的镜头",
    exampleUtterance: "帮我把失败镜头的视频重新生成",
  },
  {
    id: "storyboard",
    label: "分镜润色",
    hint: "优化 visualPrompt 与镜号节奏",
    exampleUtterance: "根据当前脚本与分镜，给出 3 条可改进的 visualPrompt 建议",
  },
  {
    id: "tts-delivery",
    label: "配音表演词",
    hint: "四层模板：音色/语速/气息 + 台词",
    exampleUtterance:
      "帮我把当前选中镜头的对白改成适合 TTS 的表演层提示词（音色、语速、气息、台词分行）",
  },
];
