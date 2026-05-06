/** 从 LLM 返回文本中尽量抽出 JSON 数组（容忍 ```json 围栏） */
export function extractJsonArray<T>(raw: string): T[] | null {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```/im.exec(s);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(s.slice(start, end + 1)) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}
