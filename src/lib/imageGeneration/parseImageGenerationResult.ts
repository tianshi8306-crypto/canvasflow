/**
 * 解析 `generate_image_asset` 返回值：单张为 assets/… 字符串，多张为 JSON 数组字符串。
 */
export function parseImageGenerationRelPaths(rel: string): string[] {
  const trimmed = rel.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim());
      }
    } catch {
      /* 非 JSON 数组则按单路径处理 */
    }
  }
  return [trimmed];
}
