import type { ScriptBeat, ScriptRole } from "@/lib/types";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import { CAMERA_MOVE_OPTIONS, EMOTION_OPTIONS, SHOT_TYPE_OPTIONS } from "@/lib/scriptWorkbenchConstants";
import { extractCameraMove, toSceneTags } from "@/lib/scriptWorkbenchSceneTags";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { importSingleProjectMedia } from "@/lib/scriptMediaImport";

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
  const summarizeRoles = (b: ScriptBeat): string => {
    const roles = b.characters ?? [];
    if (roles.length === 0) return "无角色";
    const first = roles[0];
    const head = first?.name?.trim() ? first.name.trim() : "未命名角色";
    return roles.length === 1 ? head : `${head} 等 ${roles.length} 人`;
  };

  const updateRow = (idx: number, patch: Partial<ScriptBeat>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onPersistRows(next);
  };

  const updateCardRoleRows = (idx: number, roles: ScriptRole[]) => {
    const r1 = roles[0];
    const r2 = roles[1];
    const next = rows.map((r, i) =>
      i === idx
        ? normalizeScriptBeat({
            ...r,
            characters: roles,
            character1: r1?.name ?? "",
            character1Desc: r1?.description ?? "",
            character1Image: r1?.imagePath ?? "",
            character2: r2?.name ?? "",
            character2Desc: r2?.description ?? "",
            character2Image: r2?.imagePath ?? "",
            characterAction: r1?.action ?? "",
            emotion: r1?.emotion ?? "",
            dialogue: r1?.lines ?? "",
          })
        : r,
    );
    onPersistRows(next);
  };

  return (
    <div
      className="scriptCardGrid scriptCardGrid--scroll"
      onScroll={(e) => {
        onScrollTopChange(e.currentTarget.scrollTop);
      }}
    >
      {rows.map((b, idx) => (
        <div key={b.id} className="scriptCard">
          <div className="scriptCardHead">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
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
            <input className="mono" value={b.shotNumber} onChange={(e) => updateRow(idx, { shotNumber: e.target.value })} />
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
            <input className="mono" value={b.durationHint} onChange={(e) => updateRow(idx, { durationHint: e.target.value })} />
          </div>
          <div className="field">
            <label>运镜</label>
            <select value={extractCameraMove(b.sceneTags)} onChange={(e) => updateRow(idx, { sceneTags: toSceneTags(e.target.value) })}>
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
            <textarea rows={3} value={b.description} onChange={(e) => updateRow(idx, { description: e.target.value })} />
          </div>
          <div className="field">
            <label>角色(1-n)</label>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>当前：{summarizeRoles(b)}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {(b.characters ?? []).map((role, roleIdx) => {
                const imageSrc = resolveProjectAssetSrc(projectPath, role.imagePath ?? "");
                return (
                  <div
                    key={role.id || `${b.id}-role-${roleIdx}`}
                    style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 8, display: "grid", gap: 6 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                        角色 {roleIdx + 1}
                      </div>
                      <button
                        type="button"
                        className="btn btnDanger"
                        style={{ padding: "2px 8px", fontSize: 11 }}
                        onClick={() => {
                          const roles = (b.characters ?? []).filter((_, i) => i !== roleIdx);
                          updateCardRoleRows(idx, roles);
                        }}
                      >
                        删除角色
                      </button>
                    </div>
                    <input
                      value={role.name ?? ""}
                      placeholder="角色名"
                      onChange={(e) => {
                        const roles = [...(b.characters ?? [])];
                        roles[roleIdx] = { ...roles[roleIdx], name: e.target.value };
                        updateCardRoleRows(idx, roles);
                      }}
                    />
                    <input
                      value={role.description ?? ""}
                      placeholder="角色描述"
                      onChange={(e) => {
                        const roles = [...(b.characters ?? [])];
                        roles[roleIdx] = { ...roles[roleIdx], description: e.target.value };
                        updateCardRoleRows(idx, roles);
                      }}
                    />
                    <button
                      type="button"
                      className={`scriptImageTileBtn${imageSrc ? " has-preview" : ""}`}
                      style={imageSrc ? { backgroundImage: `url("${imageSrc}")` } : undefined}
                      onClick={() => {
                        void (async () => {
                          const relPath = await importSingleProjectMedia(projectPath, "image", onStatusText);
                          if (!relPath) return;
                          const roles = [...(b.characters ?? [])];
                          roles[roleIdx] = { ...roles[roleIdx], imagePath: relPath };
                          updateCardRoleRows(idx, roles);
                        })();
                      }}
                      title="上传角色参考图"
                    >
                      {!imageSrc ? <span className="scriptImageTilePlus" aria-hidden>+</span> : null}
                    </button>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <input
                        value={role.action ?? ""}
                        placeholder="动作"
                        onChange={(e) => {
                          const roles = [...(b.characters ?? [])];
                          roles[roleIdx] = { ...roles[roleIdx], action: e.target.value };
                          updateCardRoleRows(idx, roles);
                        }}
                      />
                      <select
                        value={role.emotion ?? ""}
                        onChange={(e) => {
                          const roles = [...(b.characters ?? [])];
                          roles[roleIdx] = { ...roles[roleIdx], emotion: e.target.value };
                          updateCardRoleRows(idx, roles);
                        }}
                      >
                        <option value="">选择情绪</option>
                        {EMOTION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      value={role.lines ?? ""}
                      placeholder="对白"
                      onChange={(e) => {
                        const roles = [...(b.characters ?? [])];
                        roles[roleIdx] = { ...roles[roleIdx], lines: e.target.value };
                        updateCardRoleRows(idx, roles);
                      }}
                    />
                  </div>
                );
              })}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const roles = [
                    ...(b.characters ?? []),
                    {
                      id: crypto.randomUUID(),
                      name: "",
                      description: "",
                      imagePath: "",
                      reference: "",
                      action: "",
                      emotion: "",
                      lines: "",
                    } satisfies ScriptRole,
                  ];
                  updateCardRoleRows(idx, roles);
                }}
              >
                + 添加角色
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => onPersistRows([...rows, normalizeScriptBeat({ id: crypto.randomUUID() })])}
      >
        添加镜头卡片
      </button>
    </div>
  );
}
