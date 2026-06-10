import type { ScriptBeat } from "@/lib/types";

type Props = {
  beats: ScriptBeat[];
  themePrompt: string;
  generating?: boolean;
  progress?: number | null;
};

function generationLabel(progress: number | null): string {
  if (progress != null) return `正在解析脚本 ${progress}%…`;
  return "正在解析脚本…";
}

/** 脚本节点壳内紧凑镜头表：全部行渲染，网格内自然滚动 */
export function ScriptNodeMiniPreview({ beats, themePrompt, generating = false, progress }: Props) {
  return (
    <div className="scriptChrome-previewInner">
      {generating ? (
        <div className="scriptGenCenterCapsuleOverlay" aria-live="polite">
          <div className="scriptGenCenterCapsule">
            <span className="scriptGenCenterCapsule-label">
              {generationLabel(progress ?? null)}
            </span>
          </div>
        </div>
      ) : null}
      <span className="scriptNodeViewTag">脚本预览</span>
      {themePrompt.trim() ? (
        <p className="scriptChrome-themeSnippet" title={themePrompt}>
          {themePrompt.trim().slice(0, 80)}
          {themePrompt.trim().length > 80 ? "…" : ""}
        </p>
      ) : null}
      <div className="scriptNodeMiniGrid">
        <div className="scriptNodeMiniHead">
          <span>#</span>
          <span>画面</span>
        </div>
        {beats.map((beat, i) => (
          <div key={beat.id} className="scriptNodeMiniRow">
            <span className="scriptNodeMiniIdx">{beat.shotNumber || i + 1}</span>
            <span className="scriptNodeMiniDesc">
              {(beat.description || "—").slice(0, 120)}
            </span>
          </div>
        ))}
      </div>
      <p className="scriptNodeMiniFoot">
        {beats.length} 条镜头
      </p>
    </div>
  );
}
