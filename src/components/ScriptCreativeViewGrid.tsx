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
  selectedIds: string[];
  onToggleSelect: (beatId: string) => void;
  /** 从脚本表定位高亮对应卡片 */
  highlightBeatId?: string | null;
  /** 分镜失败时跳回脚本表 */
  onLocateBeatInScript?: (beatId: string) => void;
  /** 本机选图（分镜图 assets） */
  onPickImage?: (beatId: string) => void;
  /** 在创意视图网格中聚焦该镜头 */
  onFocusStoryboardBeat?: (beatId: string) => void;
};

function PlaceholderThumb({ onPickImage }: { onPickImage?: () => void }) {
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
      {onPickImage ? (
        <button type="button" className="scriptCreativePickBtn" onClick={onPickImage}>
          本机选图
        </button>
      ) : null}
    </div>
  );
}

/** 全屏「创意视图」：按镜头分镜缩略图网格展示 */
export function ScriptCreativeViewGrid({
  beats,
  shots,
  projectPath,
  selectedIds,
  onToggleSelect,
  highlightBeatId,
  onLocateBeatInScript,
  onPickImage,
  onFocusStoryboardBeat,
}: Props) {
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
      <div className="scriptCreativeEmpty">
        暂无镜头条目。请切换到「脚本」视图添加镜头，或使用顶栏 AI 解析生成。
      </div>
    );
  }

  return (
    <div className="scriptCreativeGrid" role="list">
      {rows.map(({ beat, shot }, i) => {
        const imgSrc =
          resolveProjectAssetSrc(projectPath, shot?.imagePath) ||
          resolveProjectAssetSrc(projectPath, beat.reference?.trim() || undefined);
        const desc = (shot?.visualPrompt?.trim() || beat.description || "").trim();
        const tags = parseTags(beat.rhythmTag || beat.sceneTags);
        const shotNo = (beat.shotNumber || "").trim() || String(i + 1);
        const dur = (beat.durationHint || "").trim() || "—";
        const sceneLabel = (beat.sceneHeading || beat.scene || "").trim()
          ? `场景 ${(beat.sceneHeading || beat.scene).trim()}`
          : `场景 ${i + 1}`;
        const status = shot?.status ?? "idle";
        const isGenerating = status === "generating";
        const isFailed = status === "failed";
        const isSelected = selectedIds.includes(beat.id);
        const isHighlighted = highlightBeatId === beat.id;

        return (
          <div
            key={beat.id}
            data-beat-id={beat.id}
            className={[
              "scriptCreativeCard",
              isSelected ? "scriptCreativeCard--selected" : "",
              isGenerating ? "scriptCreativeCard--generating" : "",
              isFailed ? "scriptCreativeCard--failed" : "",
              isHighlighted ? "scriptCreativeCard--highlight" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="listitem"
          >
            <div className="scriptCreativeCardTop">
              <label className="scriptCreativeSelect" title="与脚本表、分镜区勾选一致">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(beat.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="scriptCreativeCardNo mono">{shotNo}</span>
              </label>
              <span className="scriptCreativeCardDur mono">{dur}</span>
              {isGenerating ? (
                <span className="storyboardStatusBadge storyboardStatusBadge--generating">生成中</span>
              ) : null}
              {isFailed ? (
                <span className="storyboardStatusBadge storyboardStatusBadge--failed" title={shot?.error}>
                  失败{shot?.retryCount ? ` · ${shot.retryCount}` : ""}
                </span>
              ) : null}
            </div>
            <div className="scriptCreativeThumb">
              {imgSrc ? (
                <>
                  <img src={imgSrc} alt="" loading="lazy" />
                  {onPickImage ? (
                    <button
                      type="button"
                      className="scriptCreativeThumbAction"
                      onClick={() => onPickImage(beat.id)}
                    >
                      换图
                    </button>
                  ) : null}
                </>
              ) : (
                <PlaceholderThumb onPickImage={onPickImage ? () => onPickImage(beat.id) : undefined} />
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
            <div className="scriptCreativeSceneFoot">{sceneLabel}</div>
            <div className="scriptCreativeCardActions">
              {onFocusStoryboardBeat ? (
                <button
                  type="button"
                  className="scriptCreativeActionBtn"
                  title="在本视图滚动并高亮该镜头卡片"
                  onClick={() => onFocusStoryboardBeat(beat.id)}
                >
                  聚焦镜头
                </button>
              ) : null}
              {isFailed && onLocateBeatInScript ? (
                <button
                  type="button"
                  className="scriptCreativeActionBtn"
                  onClick={() => onLocateBeatInScript(beat.id)}
                >
                  定位镜头
                </button>
              ) : null}
            </div>
            {isFailed && shot?.error ? (
              <p className="scriptCreativeFailMsg mono" title={shot.error}>
                {clip(shot.error, 120)}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
