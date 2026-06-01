import type { ScriptRole } from "@/lib/types";
import { EMOTION_OPTIONS } from "@/lib/scriptWorkbenchConstants";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { importSingleProjectMedia } from "@/lib/scriptMediaImport";
import { createEmptyScriptRole } from "@/lib/scriptBeatsTableModel";

type Props = {
  roles: ScriptRole[];
  projectPath: string | null;
  onRolesChange: (next: ScriptRole[]) => void;
  onStatusText?: (msg: string) => void;
  compact?: boolean;
};

/** 共享角色编辑表单：表格 Popover 与卡片视图共用 */
export function ScriptBeatRolesEditor({
  roles,
  projectPath,
  onRolesChange,
  onStatusText,
  compact = false,
}: Props) {
  return (
    <div className={`scriptBeatRolesEditor${compact ? " scriptBeatRolesEditor--compact" : ""}`}>
      {roles.map((r, roleIdx) => {
        const imageSrc = resolveProjectAssetSrc(projectPath, r.imagePath ?? "");
        return (
          <div key={r.id || `role-${roleIdx}`} className="scriptRoleCard">
            <div className="scriptRoleCardHead">
              <span className="mono">角色 {roleIdx + 1}</span>
              <button
                type="button"
                className="btn btnDanger"
                style={{ padding: "2px 8px", fontSize: 11 }}
                onClick={() => onRolesChange(roles.filter((_, i) => i !== roleIdx))}
              >
                删除
              </button>
            </div>
            <input
              placeholder="角色名"
              value={r.name ?? ""}
              onChange={(e) => {
                const next = [...roles];
                next[roleIdx] = { ...next[roleIdx], name: e.target.value };
                onRolesChange(next);
              }}
            />
            <input
              placeholder="角色描述"
              value={r.description ?? ""}
              onChange={(e) => {
                const next = [...roles];
                next[roleIdx] = { ...next[roleIdx], description: e.target.value };
                onRolesChange(next);
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
                  const next = [...roles];
                  next[roleIdx] = { ...next[roleIdx], imagePath: relPath };
                  onRolesChange(next);
                  onStatusText?.(`已上传角色参考图：${relPath}`);
                })();
              }}
              title="上传角色参考图（同步表格「角色图」列）"
            >
              {!imageSrc ? (
                <span className="scriptImageTilePlus" aria-hidden>
                  +
                </span>
              ) : (
                <span className="scriptImageTileHint">换图</span>
              )}
            </button>
            <div className="scriptBeatRolesEditorRow2">
              <input
                placeholder="动作"
                value={r.action ?? ""}
                onChange={(e) => {
                  const next = [...roles];
                  next[roleIdx] = { ...next[roleIdx], action: e.target.value };
                  onRolesChange(next);
                }}
              />
              <select
                value={r.emotion ?? ""}
                onChange={(e) => {
                  const next = [...roles];
                  next[roleIdx] = { ...next[roleIdx], emotion: e.target.value };
                  onRolesChange(next);
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
              placeholder="对白"
              value={r.lines ?? ""}
              onChange={(e) => {
                const next = [...roles];
                next[roleIdx] = { ...next[roleIdx], lines: e.target.value };
                onRolesChange(next);
              }}
            />
          </div>
        );
      })}
      <button
        type="button"
        className="btn scriptBeatRolesEditorAdd"
        onClick={() => onRolesChange([...roles, createEmptyScriptRole()])}
      >
        + 添加角色
      </button>
    </div>
  );
}
