/** 有上游剧本文本时，脚本节点底栏默认解析要求（用户也可只写「短剧」「电影」「先输出第一集」等） */
export const SCRIPT_PARSE_REQUIREMENT_WITH_UPSTREAM = "短剧";

/** 有上游时是否可触发解析（brief 可空，由后端自动规划） */
export function canStartScriptParse(
  prompt: string,
  hasUpstreamText: boolean,
): boolean {
  if (hasUpstreamText) return true;
  return prompt.trim().length > 0;
}

/** 解析触发前：用户自填优先；有上游且底栏为空时传空 brief（后端 LLM 自动规划） */
export function resolveScriptParseRequirement(
  prompt: string,
  _hasUpstreamText: boolean,
): string {
  return prompt.trim();
}
