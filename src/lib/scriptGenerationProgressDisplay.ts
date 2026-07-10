export type ScriptGenerationProgressInput = {
  progress?: number | null;
  isGraphRunning?: boolean;
  isStoryboardBusy?: boolean;
};

/** 脚本解析/分镜进度：过滤 DAG 阶段 Agent execute 占位 50% */
export function getScriptGenerationProgressPercent(
  input: ScriptGenerationProgressInput,
): number | undefined {
  if (input.progress == null || Number.isNaN(input.progress)) return undefined;
  const rounded = Math.round(input.progress);
  if (input.isGraphRunning && rounded === 50) return undefined;
  if (rounded >= 0 && rounded <= 99) return rounded;
  return undefined;
}

/** 预览胶囊与右上角 meta 共用文案 */
export function getScriptGenerationDisplayLabel(input: ScriptGenerationProgressInput): string {
  if (input.isStoryboardBusy) {
    const percent = getScriptGenerationProgressPercent(input);
    return percent != null ? `正在生成分镜 ${percent}%…` : "正在生成分镜…";
  }

  const percent = getScriptGenerationProgressPercent(input);
  if (percent != null && percent > 50) return `正在逐镜解析 ${percent}%…`;
  if (percent != null) return `正在解析脚本 ${percent}%…`;
  if (input.isGraphRunning) return "正在逐镜解析剧本…";
  return "正在解析脚本…";
}
