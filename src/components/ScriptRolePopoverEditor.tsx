import type { ScriptBeat } from "@/lib/types";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { importSingleProjectMedia } from "@/lib/scriptMediaImport";
import { EMOTION_OPTIONS, patchRowCharacters } from "@/lib/scriptBeatsTableModel";

type Props = {
  beat: ScriptBeat;
  rowIndex: number;
  normRows: ScriptBeat[];
  projectPath?: string | null;
  onStatusText?: (msg: string) => void;
  onPersistRows: (next: ScriptBeat[]) => void;
  onClose: () => void;
};

function createEmptyRole() {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    imagePath: "",
    reference: "",
    action: "",
    emotion: "",
    lines: "",
  };
}

export function ScriptRolePopoverEditor({
  beat,
  rowIndex,
  normRows,
  projectPath,
  onStatusText,
  onPersistRows,
  onClose,
}: Props) {
  const roles = beat.characters ?? [];

  return (
    <div className="scriptRolePopover" role="dialog" aria-label="角色编辑器" onMouseDown={(e) => e.stopPropagation()}>
      <div className="scriptRolePopoverHead">
        <span>角色编辑器</span>
        <button type="button" className="scriptFieldPopoverLink" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="scriptRolePopoverBody">
        {roles.map((r, roleIdx) => (
          <div key={r.id || `${beat.id}-role-${roleIdx}`} className="scriptRoleCard">
            <div className="scriptRoleCardHead">
              <span className="mono">角色 {roleIdx + 1}</span>
              <button
                type="button"
                className="btn btnDanger"
                style={{ padding: "2px 8px", fontSize: 11 }}
                onClick={() => {
                  const next = roles.filter((_, i) => i !== roleIdx);
                  onPersistRows(patchRowCharacters(normRows, rowIndex, next));
                }}
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
                onPersistRows(patchRowCharacters(normRows, rowIndex, next));
              }}
            />
            <input
              placeholder="角色描述"
              value={r.description ?? ""}
              onChange={(e) => {
                const next = [...roles];
                next[roleIdx] = { ...next[roleIdx], description: e.target.value };
                onPersistRows(patchRowCharacters(normRows, rowIndex, next));
              }}
            />
            <button
              type="button"
              className={`scriptImageTileBtn${resolveProjectAssetSrc(projectPath, r.imagePath ?? "") ? " has-preview" : ""}`}
              style={
                resolveProjectAssetSrc(projectPath, r.imagePath ?? "")
                  ? { backgroundImage: `url("${resolveProjectAssetSrc(projectPath, r.imagePath ?? "")}")` }
                  : undefined
              }
              onClick={() => {
                void (async () => {
                  const relPath = await importSingleProjectMedia(projectPath, "image", onStatusText);
                  if (!relPath) return;
                  const next = [...roles];
                  next[roleIdx] = { ...next[roleIdx], imagePath: relPath };
                  onPersistRows(patchRowCharacters(normRows, rowIndex, next));
                })();
              }}
              title="上传角色参考图"
            >
              {!resolveProjectAssetSrc(projectPath, r.imagePath ?? "") ? (
                <span className="scriptImageTilePlus" aria-hidden>
                  +
                </span>
              ) : null}
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <input
                placeholder="动作"
                value={r.action ?? ""}
                onChange={(e) => {
                  const next = [...roles];
                  next[roleIdx] = { ...next[roleIdx], action: e.target.value };
                  onPersistRows(patchRowCharacters(normRows, rowIndex, next));
                }}
              />
              <select
                value={r.emotion ?? ""}
                onChange={(e) => {
                  const next = [...roles];
                  next[roleIdx] = { ...next[roleIdx], emotion: e.target.value };
                  onPersistRows(patchRowCharacters(normRows, rowIndex, next));
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
                onPersistRows(patchRowCharacters(normRows, rowIndex, next));
              }}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn"
        style={{ marginTop: 8 }}
        onClick={() => onPersistRows(patchRowCharacters(normRows, rowIndex, [...roles, createEmptyRole()]))}
      >
        + 添加角色
      </button>
    </div>
  );
}
