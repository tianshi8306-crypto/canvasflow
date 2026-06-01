import type {
  HermesDirectorPlan,
  HermesPlanStep,
  HermesToolId,
} from "@/lib/hermes/hermesDirectorTypes";

export type HermesPlanTemplateStepDef = {
  toolId: HermesToolId;
  label: string;
  args?: Record<string, unknown>;
};

export type HermesPlanTemplate = {
  id: string;
  title: string;
  description: string;
  /** 内置模板不可删除 */
  builtin: boolean;
  steps: HermesPlanTemplateStepDef[];
};

export const HERMES_USER_TEMPLATES_STORAGE_KEY = "canvasflow.hermesPlanTemplates.v1";

const BUILTIN_TEMPLATES: HermesPlanTemplate[] = [
  {
    id: "full-auto-export",
    title: "全自动跑片（到导出）",
    description:
      "梗概 → 镜头表 → 分镜 → 建链 → 出图 → 视频提示词 → 出视频 → 流程检查 → 导出 mp4（大批量默认免确认）",
    builtin: true,
    steps: [
      { toolId: "canvas.ensure_script", label: "创建脚本节点" },
      {
        toolId: "script.update_brief",
        label: "写入创意梗概",
        args: { useSourceMessageAsBrief: true },
      },
      { toolId: "script.generate_outline", label: "生成镜头大纲" },
      { toolId: "script.generate_storyboard", label: "生成分镜文案" },
      { toolId: "chain.spawn_media_nodes", label: "创建图片/视频节点" },
      { toolId: "image.generate_for_beats", label: "批量提交关键帧出图" },
      {
        toolId: "film.shot_to_video_prompt",
        label: "写入视频提示词（人物动作模板）",
        args: { useMotionTemplate: true },
      },
      { toolId: "video.generate_for_beats", label: "批量提交视频生成" },
      { toolId: "film.workflow_check", label: "检查生产流程与断链" },
      {
        toolId: "compose.export_script",
        label: "合成时间线并导出成片",
        args: { autoRender: true },
      },
    ],
  },
  {
    id: "creative-pipeline",
    title: "创意到成片",
    description: "梗概 → 镜头表 → 分镜 → 建链 → 批量出图 → 批量出视频",
    builtin: true,
    steps: [
      { toolId: "canvas.ensure_script", label: "创建脚本节点" },
      {
        toolId: "script.update_brief",
        label: "写入创意梗概",
        args: { useSourceMessageAsBrief: true },
      },
      { toolId: "script.generate_outline", label: "生成镜头大纲" },
      { toolId: "script.generate_storyboard", label: "生成分镜文案" },
      { toolId: "chain.spawn_media_nodes", label: "创建图片/视频节点" },
      { toolId: "image.generate_for_beats", label: "批量提交关键帧出图" },
      { toolId: "video.generate_for_beats", label: "批量提交视频生成" },
    ],
  },
  {
    id: "storyboard-keyframes",
    title: "分镜出关键帧",
    description: "已有脚本：生成分镜 → 建链 → 批量出图",
    builtin: true,
    steps: [
      { toolId: "script.generate_storyboard", label: "为镜头生成分镜文案" },
      { toolId: "chain.spawn_media_nodes", label: "创建图片/视频节点" },
      { toolId: "image.generate_for_beats", label: "批量提交关键帧出图" },
    ],
  },
  {
    id: "keyframes-to-video",
    title: "关键帧到视频",
    description: "写入视频提示词 → 建链检查 → 批量出视频",
    builtin: true,
    steps: [
      {
        toolId: "film.shot_to_video_prompt",
        label: "按人物动作模板写入视频提示词",
        args: { useMotionTemplate: true },
      },
      { toolId: "chain.spawn_media_nodes", label: "确保图片/视频节点已建链" },
      { toolId: "video.generate_for_beats", label: "批量提交视频生成" },
    ],
  },
  {
    id: "finish-export",
    title: "检查并导出成片",
    description: "流程检查 → 合成时间线并渲染 mp4",
    builtin: true,
    steps: [
      { toolId: "film.workflow_check", label: "检查生产流程与断链" },
      {
        toolId: "compose.export_script",
        label: "合成时间线并导出成片",
        args: { autoRender: true },
      },
    ],
  },
  {
    id: "retry-failed-video",
    title: "重试失败视频",
    description: "仅对 videoStatus=failed 的镜头重新提交",
    builtin: true,
    steps: [{ toolId: "video.retry_failed", label: "重试失败镜头的视频" }],
  },
  {
    id: "retry-failed-keyframe",
    title: "重试失败关键帧",
    description: "仅对分镜 status=failed 的镜头重新提交出图",
    builtin: true,
    steps: [{ toolId: "image.retry_failed", label: "重试失败镜头的关键帧" }],
  },
];

export const HERMES_FULL_AUTO_TEMPLATE_ID = "full-auto-export";

const TEMPLATE_ALIASES: Record<string, string> = {
  全自动跑片: HERMES_FULL_AUTO_TEMPLATE_ID,
  全自动: HERMES_FULL_AUTO_TEMPLATE_ID,
  一键出片: HERMES_FULL_AUTO_TEMPLATE_ID,
  从零到成片: HERMES_FULL_AUTO_TEMPLATE_ID,
  自动跑完全片: HERMES_FULL_AUTO_TEMPLATE_ID,
  端到端: HERMES_FULL_AUTO_TEMPLATE_ID,
  一条龙: HERMES_FULL_AUTO_TEMPLATE_ID,
  创意到成片: "creative-pipeline",
  创意全流程: "creative-pipeline",
  全流程: HERMES_FULL_AUTO_TEMPLATE_ID,
  从头开始: HERMES_FULL_AUTO_TEMPLATE_ID,
  分镜出图: "storyboard-keyframes",
  分镜出关键帧: "storyboard-keyframes",
  出关键帧: "storyboard-keyframes",
  批量出图: "storyboard-keyframes",
  出图到视频: "keyframes-to-video",
  关键帧到视频: "keyframes-to-video",
  批量出视频: "keyframes-to-video",
  导出成片: "finish-export",
  合成导出: "finish-export",
  重试视频: "retry-failed-video",
  重试关键帧: "retry-failed-keyframe",
  重试出图: "retry-failed-keyframe",
};

function normalizeTemplate(raw: unknown): HermesPlanTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const title = String(o.title ?? "").trim();
  if (!id || !title) return null;
  const stepsRaw = o.steps;
  if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) return null;
  const steps: HermesPlanTemplateStepDef[] = [];
  for (const row of stepsRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const toolId = String(r.toolId ?? "").trim() as HermesToolId;
    const label = String(r.label ?? "").trim();
    if (!toolId || !label) continue;
    steps.push({
      toolId,
      label,
      args:
        r.args && typeof r.args === "object"
          ? (r.args as Record<string, unknown>)
          : undefined,
    });
  }
  if (steps.length === 0) return null;
  return {
    id,
    title,
    description: String(o.description ?? "").trim() || title,
    builtin: Boolean(o.builtin),
    steps,
  };
}

export function loadUserHermesPlanTemplates(): HermesPlanTemplate[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HERMES_USER_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    const out: HermesPlanTemplate[] = [];
    for (const row of parsed) {
      const t = normalizeTemplate(row);
      if (t && !t.builtin) out.push(t);
    }
    return out;
  } catch {
    return [];
  }
}

function persistUserTemplates(templates: HermesPlanTemplate[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(HERMES_USER_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    /* quota */
  }
}

export function listHermesPlanTemplates(): HermesPlanTemplate[] {
  return [...BUILTIN_TEMPLATES, ...loadUserHermesPlanTemplates()];
}

export function getHermesPlanTemplate(templateId: string): HermesPlanTemplate | undefined {
  const id = templateId.trim();
  return listHermesPlanTemplates().find((t) => t.id === id);
}

export function saveUserHermesPlanTemplate(template: {
  id: string;
  title: string;
  description?: string;
  steps: HermesPlanTemplateStepDef[];
}): HermesPlanTemplate {
  const id = template.id.trim();
  const title = template.title.trim();
  const next: HermesPlanTemplate = {
    id,
    title,
    description: template.description?.trim() || title,
    builtin: false,
    steps: template.steps,
  };
  const users = loadUserHermesPlanTemplates().filter((t) => t.id !== id);
  users.push(next);
  persistUserTemplates(users);
  return next;
}

export function deleteUserHermesPlanTemplate(templateId: string): boolean {
  const id = templateId.trim();
  const users = loadUserHermesPlanTemplates();
  const next = users.filter((t) => t.id !== id);
  if (next.length === users.length) return false;
  persistUserTemplates(next);
  return true;
}

export function resolveTemplateIdFromMessage(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const tpl of listHermesPlanTemplates()) {
    if (trimmed.includes(tpl.id)) return tpl.id;
    if (trimmed.includes(tpl.title)) return tpl.id;
  }
  for (const [alias, id] of Object.entries(TEMPLATE_ALIASES)) {
    if (trimmed.includes(alias)) return id;
  }
  return null;
}

export function defaultTemplateIdForContext(opts: {
  hasScript: boolean;
  storyboardReadyCount: number;
}): string {
  if (opts.hasScript && opts.storyboardReadyCount > 0) {
    return "keyframes-to-video";
  }
  if (opts.hasScript) {
    return "storyboard-keyframes";
  }
  return "creative-pipeline";
}

export function formatTemplateCatalogForUser(): string {
  const lines = ["可用计划模板："];
  for (const tpl of listHermesPlanTemplates()) {
    const tag = tpl.builtin ? "内置" : "自定义";
    lines.push(`· [${tpl.id}] ${tpl.title}（${tag}）— ${tpl.description}`);
  }
  lines.push("", "可说：「跑模板 分镜出关键帧」或「用模板 keyframes-to-video」");
  return lines.join("\n");
}

function cloneStepDef(
  def: HermesPlanTemplateStepDef,
  sourceMessage: string,
): HermesPlanStep {
  const args = def.args ? { ...def.args } : undefined;
  if (
    def.toolId === "script.update_brief" &&
    args?.useSourceMessageAsBrief === true
  ) {
    delete args.useSourceMessageAsBrief;
    args.briefText = sourceMessage;
  }
  return {
    id: crypto.randomUUID(),
    toolId: def.toolId,
    label: def.label,
    ...(args && Object.keys(args).length > 0 ? { args } : {}),
  };
}

export function instantiateTemplatePlan(
  templateId: string,
  sourceMessage: string,
  opts?: { referenceRelPaths?: string[] },
): HermesDirectorPlan | null {
  const tpl = getHermesPlanTemplate(templateId);
  if (!tpl) return null;
  const steps = tpl.steps.map((def) => cloneStepDef(def, sourceMessage));
  return {
    id: crypto.randomUUID(),
    title: `模板：${tpl.title}`,
    sourceMessage,
    steps,
    templateId: tpl.id,
    plannerSource: "template",
    assumptions: [tpl.description],
    ...(opts?.referenceRelPaths?.length
      ? { referenceRelPaths: opts.referenceRelPaths }
      : {}),
  };
}

export function planFromPendingSteps(
  title: string,
  description: string,
  _sourceMessage: string,
  steps: HermesPlanStep[],
): HermesPlanTemplate {
  return saveUserHermesPlanTemplate({
    id: `user-${Date.now()}`,
    title,
    description,
    steps: steps.map((s) => ({
      toolId: s.toolId,
      label: s.label,
      args: s.args,
    })),
  });
}

/** 将计划中的 `template.run` 步骤展开为模板内步骤 */
export function expandTemplateStepsInPlan(plan: HermesDirectorPlan): HermesDirectorPlan {
  const expanded: HermesPlanStep[] = [];
  let title = plan.title;

  for (const step of plan.steps) {
    if (step.toolId !== "template.run") {
      expanded.push(step);
      continue;
    }
    const templateId = String(step.args?.templateId ?? "").trim();
    const sub = instantiateTemplatePlan(templateId, plan.sourceMessage, {
      referenceRelPaths: plan.referenceRelPaths,
    });
    if (sub) {
      expanded.push(...sub.steps);
      if (title === plan.title) title = sub.title;
    } else {
      expanded.push({
        ...step,
        label: `未知模板：${templateId || "（未指定 templateId）"}`,
      });
    }
  }

  return {
    ...plan,
    title,
    steps: expanded,
    plannerSource: plan.plannerSource ?? "template",
  };
}
