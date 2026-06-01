/** DAG 媒体节点 `outputs` / 运行记录中的 M3 产出形状 */
export type NodeMediaOutputPayload = {
  relPath: string;
  assetId?: string;
};

/** 解析媒体节点 output（裸路径或 `{"relPath","assetId"}` JSON） */
export function parseNodeMediaOutput(raw: string | undefined | null): NodeMediaOutputPayload | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const v = JSON.parse(trimmed) as { relPath?: string; assetId?: string };
      const relPath = v.relPath?.trim();
      if (!relPath) return null;
      const assetId = v.assetId?.trim() || undefined;
      return { relPath, assetId };
    } catch {
      return { relPath: trimmed };
    }
  }
  return { relPath: trimmed };
}
