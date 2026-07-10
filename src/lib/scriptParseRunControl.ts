/** 脚本节点解析 run 序号：底栏与预览胶囊共用，用于取消后忽略在途 Agent 回调 */
const runSeqByNode = new Map<string, number>();

export function beginScriptParseRun(nodeId: string): number {
  const next = (runSeqByNode.get(nodeId) ?? 0) + 1;
  runSeqByNode.set(nodeId, next);
  return next;
}

export function cancelScriptParseRun(nodeId: string): number {
  return beginScriptParseRun(nodeId);
}

export function isScriptParseRunCurrent(nodeId: string, runId: number): boolean {
  return (runSeqByNode.get(nodeId) ?? 0) === runId;
}
