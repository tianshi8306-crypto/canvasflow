import type { ScriptBeat } from "@/lib/types";
import { getBeatRoles, summarizeScriptRoles } from "@/lib/scriptBeatsTableModel";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";

type Props = {
  beat: ScriptBeat;
  projectPath: string | null;
  maxAvatars?: number;
};

/** 卡片/表格入口：角色名 + 参考图缩略条 */
export function ScriptBeatRoleSummary({ beat, projectPath, maxAvatars = 3 }: Props) {
  const roles = getBeatRoles(beat).filter(
    (r) => (r.name ?? "").trim() || resolveProjectAssetSrc(projectPath, r.imagePath ?? ""),
  );
  const label = summarizeScriptRoles(beat);

  if (roles.length === 0) {
    return <span className="scriptBeatRoleSummary scriptBeatRoleSummary--empty">{label}</span>;
  }

  return (
    <div className="scriptBeatRoleSummary" title={label}>
      <div className="scriptBeatRoleSummaryAvatars" aria-hidden>
        {roles.slice(0, maxAvatars).map((r, i) => {
          const src = resolveProjectAssetSrc(projectPath, r.imagePath ?? "");
          const name = (r.name ?? "").trim() || `角色 ${i + 1}`;
          return src ? (
            <img key={r.id || i} className="scriptBeatRoleSummaryAvatar" src={src} alt="" />
          ) : (
            <span key={r.id || i} className="scriptBeatRoleSummaryInitial">
              {name.slice(0, 1)}
            </span>
          );
        })}
        {roles.length > maxAvatars ? (
          <span className="scriptBeatRoleSummaryMore">+{roles.length - maxAvatars}</span>
        ) : null}
      </div>
      <span className="scriptBeatRoleSummaryLabel">{label}</span>
    </div>
  );
}
