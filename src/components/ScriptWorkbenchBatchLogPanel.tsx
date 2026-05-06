import type { BatchLogEntry } from "@/lib/scriptWorkbenchTypes";

type Props = {
  open: boolean;
  entries: BatchLogEntry[];
  replayArm: { id: string; left: number } | null;
  onSetReplayArm: (arm: { id: string; left: number } | null) => void;
  onReplayEntry: (entry: BatchLogEntry) => void;
};

export function ScriptWorkbenchBatchLogPanel({
  open,
  entries,
  replayArm,
  onSetReplayArm,
  onReplayEntry,
}: Props) {
  if (!open || entries.length === 0) return null;
  return (
    <div className="scriptBatchLogPanel">
      <div className="scriptBatchLogHead">最近 3 条批量操作</div>
      {entries.map((entry) => (
        <div key={entry.id} className="scriptBatchLogItemRow">
          <div className="scriptBatchLogItem mono">{entry.line}</div>
          {entry.replay ? (
            <button
              type="button"
              className="btn"
              style={{ padding: "2px 8px", fontSize: 11 }}
              onClick={() => {
                if (replayArm?.id === entry.id) {
                  onSetReplayArm(null);
                  onReplayEntry(entry);
                  return;
                }
                onSetReplayArm({ id: entry.id, left: 2 });
              }}
              title="复用该批量操作到当前勾选条目"
            >
              {replayArm?.id === entry.id ? `确认执行（${replayArm.left}s）` : "再执行一次"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
