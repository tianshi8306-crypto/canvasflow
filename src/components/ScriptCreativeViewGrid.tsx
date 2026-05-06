import { useMemo } from "react";
import type { ScriptBeat, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";

function clip(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function parseTags(s: string): string[] {
  return s
    .split(/[,，;；]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4);
}

type Props = {
  beats: ScriptBeat[];
  shots: StoryboardShot[] | undefined;
  projectPath: string | null;
};

function PlaceholderThumb() {
  return (
    <div className="scriptCreativeThumbPlaceholder">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 16l4-4 4 4 4-8 4 8v2H4v-2z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="8" r="1.5" fill="currentColor" />
      </svg>
      <span>暂无图片</span>
    </div>
  );
}

/** 全屏「创意视图」：按镜头分镜缩略图网格展示 */
export function ScriptCreativeViewGrid({ beats, shots, projectPath }: Props) {
  const beatsNorm = useMemo(() => normalizeScriptBeats(beats), [beats]);
  const shotByBeat = useMemo(() => {
    const m = new Map<string, StoryboardShot>();
    for (const s of shots ?? []) m.set(s.scriptBeatId, s);
    return m;
  }, [shots]);

  const rows = useMemo(
    () => beatsNorm.map((b) => ({ beat: b, shot: shotByBeat.get(b.id) })),
    [beatsNorm, shotByBeat],
  );

  if (rows.length === 0) {
    return (
      <div className="scriptCreativeEmpty">暂无镜头条目。请在侧栏「脚本工作台」添加或生成脚本。</div>
    );
  }

  return (
    <div className="scriptCreativeGrid" role="list">
      {rows.map(({ beat, shot }, i) => {
        const imgSrc =
          resolveProjectAssetSrc(projectPath, shot?.imagePath) ||
          resolveProjectAssetSrc(projectPath, beat.reference?.trim() || undefined);
        const desc = (shot?.visualPrompt?.trim() || beat.description || "").trim();
        const tags = parseTags(beat.sceneTags);
        const shotNo = (beat.shotNumber || "").trim() || String(i + 1);
        const dur = (beat.durationHint || "").trim() || "—";
        const sceneLabel = beat.scene.trim() ? `场景 ${beat.scene.trim()}` : `场景 ${i + 1}`;
        const shotLabel = (beat.shotSize || "").trim();

        return (
          <div key={beat.id} className="scriptCreativeCard" role="listitem">
            <div className="scriptCreativeCardTop">
              <span className="scriptCreativeCardNo mono">{shotNo}</span>
              <span className="scriptCreativeCardDur mono">{dur}</span>
            </div>
            <div className="scriptCreativeThumb">
              {imgSrc ? (
                <img src={imgSrc} alt="" loading="lazy" />
              ) : (
                <PlaceholderThumb />
              )}
            </div>
            {tags.length > 0 ? (
              <div className="scriptCreativeTags">
                {tags.map((t, ti) => (
                  <span key={`${t}-${ti}`} className="scriptCreativeTag">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="scriptCreativeDesc">{clip(desc, 160)}</p>
            {shotLabel ? <div className="scriptCreativeTech mono">{shotLabel}</div> : null}
            <div className="scriptCreativeSceneFoot">{sceneLabel}</div>
          </div>
        );
      })}
    </div>
  );
}
