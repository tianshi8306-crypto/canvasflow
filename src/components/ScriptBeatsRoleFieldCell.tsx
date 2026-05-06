import type { ScriptBeat } from "@/lib/types";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { importSingleProjectMedia } from "@/lib/scriptMediaImport";
import {
  getRoleCompat,
  normalizeRoleDescDisplayText,
  roleDescDisplayText,
  roleDescFromDisplayText,
  updateRoleField,
} from "@/lib/scriptBeatsTableModel";

type Props = {
  beat: ScriptBeat;
  rowIndex: number;
  normRows: ScriptBeat[];
  colKey: string;
  projectPath?: string | null;
  onStatusText?: (msg: string) => void;
  onPersistRows: (next: ScriptBeat[]) => void;
};

export function ScriptBeatsRoleFieldCell({
  beat,
  rowIndex,
  normRows,
  colKey,
  projectPath,
  onStatusText,
  onPersistRows,
}: Props) {
  const [kind, rawIdx] = colKey.split(":");
  const roleIdx = Number(rawIdx);
  const role = getRoleCompat(beat, roleIdx);
  const value = kind === "roleName" ? role.name : kind === "roleDesc" ? role.description : role.imagePath;

  const apply = (nextValue: string) => {
    if (kind === "roleName") {
      onPersistRows(updateRoleField(normRows, rowIndex, roleIdx, { name: nextValue }));
    } else if (kind === "roleDesc") {
      onPersistRows(updateRoleField(normRows, rowIndex, roleIdx, { description: nextValue }));
    } else {
      onPersistRows(updateRoleField(normRows, rowIndex, roleIdx, { imagePath: nextValue }));
    }
  };

  if (kind === "roleDesc") {
    return (
      <textarea
        rows={5}
        placeholder={"主体身份/类别\n视觉特征与属性\n服饰与配饰\n材质与特殊状态\n风格与场景约束"}
        value={roleDescDisplayText(value)}
        onChange={(e) => apply(roleDescFromDisplayText(e.target.value))}
        onBlur={(e) => {
          const normalized = normalizeRoleDescDisplayText(e.target.value);
          if (normalized !== e.target.value) {
            apply(roleDescFromDisplayText(normalized));
          }
        }}
        title="按 5 行填写：身份、特征、服饰、材质状态、风格场景"
      />
    );
  }

  if (kind === "roleImage") {
    const previewSrc = resolveProjectAssetSrc(projectPath, value);
    return (
      <button
        type="button"
        className={`scriptImageTileBtn${previewSrc ? " has-preview" : ""}`}
        style={previewSrc ? { backgroundImage: `url("${previewSrc}")` } : undefined}
        onClick={() => {
          void (async () => {
            const relPath = await importSingleProjectMedia(projectPath, "image", onStatusText);
            if (!relPath) return;
            apply(relPath);
          })();
        }}
        title={previewSrc ? "替换角色参考图" : "上传角色参考图"}
      >
        {!previewSrc ? <span className="scriptImageTilePlus" aria-hidden>+</span> : null}
      </button>
    );
  }

  return <input value={value} onChange={(e) => apply(e.target.value)} />;
}
