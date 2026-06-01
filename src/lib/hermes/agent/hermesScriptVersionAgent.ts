import {
  formatScriptVersionList,
  listScriptVersionsForNode,
  loadHermesScriptVersions,
  summarizeScriptVersionDiff,
  type HermesScriptVersionEntry,
  type HermesScriptVersionStore,
} from "@/lib/hermes/agent/hermesScriptVersion";

/** 工具执行成功后附在 message 上的版本提示 */
export function formatScriptVersionSnapshotNote(
  entry: HermesScriptVersionEntry,
): string {
  const shortId = entry.id.slice(0, 12);
  return `（脚本快照 \`${shortId}\` · ${entry.beatCount} 镜表 / ${entry.shotCount} 分镜，可说「版本对比」）`;
}

/** 注入 Brain / Director 的近期版本链摘要 */
export async function formatScriptVersionContextForAgent(
  projectPath: string,
  scriptNodeId: string,
): Promise<string> {
  const store = await loadHermesScriptVersions(projectPath);
  const list = listScriptVersionsForNode(store, scriptNodeId);
  if (list.length === 0) return "";

  const lines = [
    "【脚本版本链】",
    formatScriptVersionList(list.slice(-4)),
  ];

  if (list.length >= 2) {
    const newer = list[list.length - 1]!;
    const older = list[list.length - 2]!;
    const diff = summarizeScriptVersionDiff(older.payload, newer.payload);
    lines.push(
      `最近变更 \`${older.id.slice(0, 10)}\` → \`${newer.id.slice(0, 10)}\`：${diff.slice(0, 360)}`,
    );
  }

  lines.push("可说「版本对比」「回滚脚本」「保存脚本快照」；改脚本/分镜前会自动预快照。");
  return lines.join("\n");
}

export function countScriptVersionsInStore(
  store: HermesScriptVersionStore,
  scriptNodeId: string,
): number {
  return listScriptVersionsForNode(store, scriptNodeId).length;
}
