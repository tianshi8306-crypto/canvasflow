import { useState } from "react";
import type { ScriptBeat, ScriptRole } from "@/lib/types";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import { CAMERA_MOVE_OPTIONS, SHOT_TYPE_OPTIONS } from "@/lib/scriptWorkbenchConstants";
import { extractCameraMove, toSceneTags } from "@/lib/scriptWorkbenchSceneTags";
import { getBeatRoles, patchRowCharacters } from "@/lib/scriptBeatsTableModel";
import { ScriptBeatRoleSummary } from "@/components/script/ScriptBeatRoleSummary";
import { ScriptBeatRolesEditor } from "@/components/script/ScriptBeatRolesEditor";

type Props = {
  rows: ScriptBeat[];
  selectedIds: string[];
  projectPath: string | null;
  onToggleSelect: (id: string) => void;
  onPersistRows: (next: ScriptBeat[]) => void;
  onStatusText: (msg: string) => void;
  onScrollTopChange: (top: number) => void;
};

export function ScriptWorkbenchCardView({
  rows,
  selectedIds,
  projectPath,
  onToggleSelect,
  onPersistRows,
  onStatusText,
  onScrollTopChange,
}: Props) {
  const [expandedRoleCardId, setExpandedRoleCardId] = useState<string | null>(null);

  const updateRow = (idx: number, patch: Partial<ScriptBeat>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onPersistRows(next);
  };

  const persistRoles = (idx: number, roles: ScriptRole[]) => {
    onPersistRows(patchRowCharacters(rows, idx, roles));
  };

  return (
    <div
      className="scriptCardGrid scriptCardGrid--scroll"
      onScroll={(e) => {
        onScrollTopChange(e.currentTarget.scrollTop);
      }}
    >
      {rows.map((b, idx) => {
        const rolesExpanded = expandedRoleCardId === b.id;
        const roles = getBeatRoles(b);

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
              <button
                type="button"
                className="btn btnDanger"
                style={{ padding: "2px 8px", fontSize: 11 }}
                onClick={() => onPersistRows(rows.filter((r) => r.id !== b.id))}
              >
                删除
              </button>
            </div>
            <div className="field">
              <label>镜号</label>
              <input
                className="mono"
                value={b.shotNumber}
                onChange={(e) => updateRow(idx, { shotNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label>景别</label>
              <select value={b.shotSize} onChange={(e) => updateRow(idx, { shotSize: e.target.value })}>
                <option value="">选择景别</option>
                {SHOT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>时长建议</label>
              <input
                className="mono"
                value={b.durationHint}
                onChange={(e) => updateRow(idx, { durationHint: e.target.value })}
              />
            </div>
            <div className="field">
              <label>运镜</label>
              <select
                value={extractCameraMove(b.sceneTags)}
                onChange={(e) => updateRow(idx, { sceneTags: toSceneTags(e.target.value) })}
              >
                <option value="">选择运镜</option>
                {CAMERA_MOVE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>画面描述</label>
              <textarea
                rows={3}
                value={b.description}
                onChange={(e) => updateRow(idx, { description: e.target.value })}
              />
            </div>
            <div className="field scriptCardRolesField">
              <div className="scriptCardRolesHead">
                <label>角色</label>
                <button
                  type="button"
                  className="btn scriptCardRolesToggle"
                  onClick={() => setExpandedRoleCardId((cur) => (cur === b.id ? null : b.id))}
                >
                  {rolesExpanded ? "收起" : "编辑角色"}
                </button>
              </div>
              <ScriptBeatRoleSummary beat={b} projectPath={projectPath} />
              {rolesExpanded ? (
                <ScriptBeatRolesEditor
                  roles={roles}
                  projectPath={projectPath}
                  onStatusText={onStatusText}
                  compact
                  onRolesChange={(next) => persistRoles(idx, next)}
                />
              ) : null}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className="btn scriptCardAddBtn"
        onClick={() => onPersistRows([...rows, normalizeScriptBeat({ id: crypto.randomUUID() })])}
      >
        添加镜头卡片
      </button>
    </div>
  );
}
