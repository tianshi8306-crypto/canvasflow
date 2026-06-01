import {
  listCanvasMcpCatalogTools,
  type CanvasMcpCatalogTool,
} from "@/lib/hermes/mcp/canvasMcpToolsCatalog";
import type { HermesToolId } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesAgentSettings } from "@/lib/hermes/agent/hermesAgentSettings";

export type HermesToolRegistryCategory =
  | "read_only"
  | "script_write"
  | "canvas_structure"
  | "media_gen"
  | "export_compose"
  | "orchestration";

export type HermesToolSideEffect =
  | "none"
  | "writes_canvas"
  | "submits_jobs"
  | "exports_file";

/** 规划/执行风险提示（与 Agent 设置 gate 对齐） */
export type HermesToolRiskTier = "safe" | "write" | "submit" | "export";

export type HermesToolAgentGate = "script_edit" | "media_submit" | null;

export type HermesToolRegistryEntry = {
  name: string;
  toolId: string;
  description: string;
  category: HermesToolRegistryCategory;
  sideEffects: HermesToolSideEffect;
  riskTier: HermesToolRiskTier;
  agentGate: HermesToolAgentGate;
  /** 来自 catalog inputSchema 的一行摘要 */
  inputSummary: string;
};

const CATEGORY_ORDER: HermesToolRegistryCategory[] = [
  "read_only",
  "script_write",
  "canvas_structure",
  "media_gen",
  "export_compose",
  "orchestration",
];

const CATEGORY_META: Record<
  HermesToolRegistryCategory,
  { title: string; policy: string }
> = {
  read_only: { title: "只读 / 诊断", policy: "不修改画布与资产" },
  script_write: { title: "脚本 / 分镜", policy: "写入脚本节点与分镜字段" },
  canvas_structure: { title: "画布结构", policy: "创建或调整节点与连线" },
  media_gen: { title: "媒体生成", policy: "提交出图/出视频任务（异步）" },
  export_compose: { title: "合成导出", policy: "写入时间线并可能导出成片" },
  orchestration: { title: "编排", policy: "并行调度其他画布工具" },
};

const SIDE_EFFECT_LABEL: Record<HermesToolSideEffect, string> = {
  none: "无副作用",
  writes_canvas: "写画布",
  submits_jobs: "提交任务",
  exports_file: "导出文件",
};

const RISK_LABEL: Record<HermesToolRiskTier, string> = {
  safe: "安全",
  write: "写画布",
  submit: "提交生成",
  export: "导出",
};

/** catalog 未收录的 Director 工具补充说明 */
const SUPPLEMENT: Partial<
  Record<
    HermesToolId,
    Pick<HermesToolRegistryEntry, "name" | "description" | "inputSummary">
  >
> = {
  "canvas.add_text_node": {
    name: "canvas_add_text_node",
    description: "在画布上新建 textNode 文本节点",
    inputSummary: "initialPrompt?",
  },
  "canvas.focus": {
    name: "canvas_focus",
    description: "定位并选中画布节点/镜号",
    inputSummary: "shotNumber?, nodeId?",
  },
  "bible.update": {
    name: "bible_update",
    description: "更新项目圣经字段",
    inputSummary: "field, value",
  },
  "image.retry_failed": {
    name: "image_retry_failed",
    description: "仅重试分镜 status=failed 的关键帧出图",
    inputSummary: "beatIds?",
  },
  "video.retry_failed": {
    name: "video_retry_failed",
    description: "仅重试 videoStatus=failed 的镜头",
    inputSummary: "beatIds?",
  },
  "film.create_standard_workflow": {
    name: "film_create_standard_workflow",
    description: "搭建 text→脚本 标准短剧链路",
    inputSummary: "—",
  },
  "film.shot_to_video_prompt": {
    name: "film_shot_to_video_prompt",
    description: "分镜 visualPrompt → 视频 draft.prompt",
    inputSummary: "useMotionTemplate?, beatIds?",
  },
  "film.batch_set_video_params": {
    name: "film_batch_set_video_params",
    description: "批量写入视频节点参数",
    inputSummary: "beatIds?",
  },
  "template.run": {
    name: "template_run",
    description: "展开并执行计划模板",
    inputSummary: "templateId",
  },
  "canvas.summarize": {
    name: "canvas_summarize",
    description: "汇总画布制片进度（只读）",
    inputSummary: "catalogOnly?",
  },
};

/** 按 toolId 归类（catalog 外工具同样适用） */
export function classifyHermesToolId(toolId: string): HermesToolRegistryCategory {
  if (
    toolId === "film.workflow_check" ||
    toolId === "canvas.summarize" ||
    toolId.startsWith("canvas.inspect")
  ) {
    return "read_only";
  }
  if (toolId.startsWith("script.") || toolId === "storyboard.patch_shot") {
    return "script_write";
  }
  if (toolId.startsWith("canvas.") || toolId.startsWith("chain.")) {
    return "canvas_structure";
  }
  if (
    toolId.startsWith("image.") ||
    toolId.startsWith("video.") ||
    toolId === "film.shot_to_video_prompt" ||
    toolId === "film.batch_set_video_params"
  ) {
    return "media_gen";
  }
  if (toolId.startsWith("compose.")) {
    return "export_compose";
  }
  if (
    toolId.startsWith("agent.") ||
    toolId === "template.run" ||
    toolId === "film.create_standard_workflow"
  ) {
    return "orchestration";
  }
  if (toolId === "bible.update") {
    return "script_write";
  }
  return "canvas_structure";
}

export function riskTierForCategory(
  category: HermesToolRegistryCategory,
): HermesToolRiskTier {
  switch (category) {
    case "read_only":
      return "safe";
    case "script_write":
    case "canvas_structure":
      return "write";
    case "media_gen":
      return "submit";
    case "export_compose":
      return "export";
    case "orchestration":
      return "write";
    default:
      return "write";
  }
}

export function agentGateForToolId(toolId: string): HermesToolAgentGate {
  if (
    toolId.startsWith("script.") ||
    toolId === "storyboard.patch_shot" ||
    toolId === "bible.update" ||
    toolId === "film.create_standard_workflow"
  ) {
    return "script_edit";
  }
  if (
    toolId.startsWith("image.") ||
    toolId.startsWith("video.") ||
    toolId === "film.shot_to_video_prompt" ||
    toolId === "film.batch_set_video_params"
  ) {
    return "media_submit";
  }
  return null;
}

export function sideEffectForCategory(
  category: HermesToolRegistryCategory,
): HermesToolSideEffect {
  switch (category) {
    case "read_only":
      return "none";
    case "script_write":
    case "canvas_structure":
      return "writes_canvas";
    case "media_gen":
      return "submits_jobs";
    case "export_compose":
      return "exports_file";
    case "orchestration":
      return "submits_jobs";
    default:
      return "writes_canvas";
  }
}

export function summarizeToolInputSchema(
  schema: Record<string, unknown> | undefined,
): string {
  if (!schema || typeof schema !== "object") return "—";
  const props = schema.properties;
  if (!props || typeof props !== "object") return "—";
  const keys = Object.keys(props as Record<string, unknown>);
  if (keys.length === 0) return "—";
  return keys.slice(0, 6).join(", ");
}

export function entryFromCatalogTool(
  tool: CanvasMcpCatalogTool,
): HermesToolRegistryEntry {
  const category = classifyHermesToolId(tool.toolId);
  return {
    name: tool.name,
    toolId: tool.toolId,
    description: tool.description,
    category,
    sideEffects: sideEffectForCategory(category),
    riskTier: riskTierForCategory(category),
    agentGate: agentGateForToolId(tool.toolId),
    inputSummary: summarizeToolInputSchema(tool.inputSchema),
  };
}

function entryFromToolId(toolId: HermesToolId): HermesToolRegistryEntry {
  const catalog = listCanvasMcpCatalogTools().find((t) => t.toolId === toolId);
  if (catalog) return entryFromCatalogTool(catalog);
  const category = classifyHermesToolId(toolId);
  const sup = SUPPLEMENT[toolId];
  return {
    name: sup?.name ?? toolId.replace(/\./g, "_"),
    toolId,
    description: sup?.description ?? toolId,
    category,
    sideEffects: sideEffectForCategory(category),
    riskTier: riskTierForCategory(category),
    agentGate: agentGateForToolId(toolId),
    inputSummary: sup?.inputSummary ?? "—",
  };
}

export function buildHermesToolRegistry(): HermesToolRegistryEntry[] {
  const fromCatalog = listCanvasMcpCatalogTools().map(entryFromCatalogTool);
  const catalogIds = new Set(fromCatalog.map((e) => e.toolId));
  const extras = (Object.keys(SUPPLEMENT) as HermesToolId[])
    .filter((id) => !catalogIds.has(id))
    .map((id) => entryFromToolId(id));
  return [...fromCatalog, ...extras];
}

export function buildHermesToolRegistryMap(): Map<string, HermesToolRegistryEntry> {
  return new Map(buildHermesToolRegistry().map((e) => [e.toolId, e]));
}

export function getHermesToolRegistryEntry(
  toolId: string,
): HermesToolRegistryEntry | undefined {
  return buildHermesToolRegistryMap().get(toolId);
}

export function isRegistryToolAllowed(
  entry: HermesToolRegistryEntry,
  settings: HermesAgentSettings,
): { allowed: boolean; reason?: string } {
  if (entry.agentGate === "script_edit" && !settings.agentAllowScriptEdit) {
    return { allowed: false, reason: "设置中已关闭「自动改脚本/分镜」" };
  }
  if (entry.agentGate === "media_submit" && !settings.agentAllowMediaSubmit) {
    return { allowed: false, reason: "设置中已关闭「自动提交出图/出视频」" };
  }
  return { allowed: true };
}

export function formatHermesToolRegistryForPrompt(): string {
  const entries = buildHermesToolRegistry();
  const byCategory = new Map<HermesToolRegistryCategory, HermesToolRegistryEntry[]>();
  for (const cat of CATEGORY_ORDER) {
    byCategory.set(cat, []);
  }
  for (const e of entries) {
    byCategory.get(e.category)!.push(e);
  }

  const sections = CATEGORY_ORDER.filter(
    (cat) => (byCategory.get(cat)?.length ?? 0) > 0,
  ).map((cat) => {
    const meta = CATEGORY_META[cat];
    const lines = byCategory.get(cat)!.map((t) => {
      const fx = SIDE_EFFECT_LABEL[t.sideEffects];
      const risk = RISK_LABEL[t.riskTier];
      const gate =
        t.agentGate === "script_edit"
          ? "需 scriptEdit"
          : t.agentGate === "media_submit"
            ? "需 mediaSubmit"
            : "";
      const gateSuffix = gate ? ` · ${gate}` : "";
      return `  · ${t.name}（${t.toolId}）— ${t.description} [${fx}·${risk}] 参数: ${t.inputSummary}${gateSuffix}`;
    });
    return `【${meta.title}】${meta.policy}\n${lines.join("\n")}`;
  });

  return [
    "【Canvas MCP 工具表】指挥画布节点（Hermes 本地 invoke，非外网端口）。",
    "按副作用与风险分组；规划时优先只读诊断，再写脚本/画布，最后批量媒体与导出。",
    "agentGate：需对应设置开关（自动改脚本 / 自动提交媒体）。",
    sections.join("\n\n"),
  ].join("\n");
}

/** 用户可读的工具表（对话「工具 registry」） */
export function formatHermesToolRegistryForUser(): string {
  const entries = buildHermesToolRegistry();
  const lines = ["Canvas 工具 Registry（按分类）："];
  let lastCat = "";
  for (const e of entries.sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  )) {
    if (e.category !== lastCat) {
      lastCat = e.category;
      lines.push("", `## ${CATEGORY_META[e.category].title}`);
    }
    lines.push(
      `· ${e.toolId} — ${e.description} [${RISK_LABEL[e.riskTier]}] 参数: ${e.inputSummary}`,
    );
  }
  return lines.join("\n");
}
