import type { ScriptBeat } from "@/lib/types";
import { readCameraMove } from "@/lib/scriptWorkbenchSceneTags";
import { ScriptBeatRoleSummary } from "@/components/script/ScriptBeatRoleSummary";

type Props = {
  rows: ScriptBeat[];
  selectedIds: string[];
  projectPath: string | null;
  onToggleSelect: (id: string) => void;
  onScrollTopChange: (top: number) => void;
};

/** 卡片视图（只读：所有字段纯文本展示，无删除/添加/编辑入口） */
export function ScriptWorkbenchCardView({
  rows,
  selectedIds,
  projectPath,
  onToggleSelect,
  onScrollTopChange,
}: Props) {
  return (
    <div
      className="scriptCardGrid scriptCardGrid--scroll"
      onScroll={(e) => {
        onScrollTopChange(e.currentTarget.scrollTop);
      }}
    >
      {rows.map((b, idx) => {
        const cameraMove = readCameraMove(b);

        return (
          <div
            key={b.id}
            className={`scriptCard${selectedIds.includes(b.id) ? " scriptCard--selected" : ""}`}
          >
            <div className="scriptCardHead">
              <label className="scriptCardSelect">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(b.id)}
                  onChange={() => onToggleSelect(b.id)}
                />
                <span className="mono">{(b.shotNumber || "").trim() || `条目 ${idx + 1}`}</span>
              </label>
            </div>
            <div className="field field-readonly">
              <label>镜号</label>
              <span className="field-value mono">{(b.shotNumber || "").trim() || "—"}</span>
            </div>
            <div className="field field-readonly">
              <label>场景</label>
              <span className="field-value">{(b.sceneHeading || "").trim() || "—"}</span>
            </div>
            <div className="field field-readonly">
              <label>时长建议</label>
              <span className="field-value mono">{(b.durationHint || "").trim() || "—"}</span>
            </div>
            <div className="field field-readonly">
              <label>景别</label>
              <span className="field-value">{(b.shotSize || "").trim() || "—"}</span>
            </div>
            <div className="field field-readonly">
              <label>运镜</label>
              <span className="field-value">{cameraMove || "—"}</span>
            </div>
            <div className="field field-readonly">
              <label>对白类型</label>
              <span className="field-value">{(b.dialogueType || "").trim() || "—"}</span>
            </div>
            <div className="field field-readonly">
              <label>表演</label>
              <span className="field-value">{(b.performanceNote || "").trim() || "—"}</span>
            </div>
            <div className="field field-readonly">
              <label>BGM</label>
              <span className="field-value">{(b.bgmHint || "").trim() || "—"}</span>
            </div>
            <div className="field field-readonly">
              <label>画面描述</label>
              <span className="field-value">{(b.description || "").trim() || "—"}</span>
            </div>
            <div className="field field-readonly scriptCardRolesField">
              <div className="scriptCardRolesHead">
                <label>角色</label>
              </div>
              <ScriptBeatRoleSummary beat={b} projectPath={projectPath} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
