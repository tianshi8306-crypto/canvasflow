import { useCallback, useEffect } from "react";
import { bibleCharacterRefCount } from "@/lib/projectBible/projectBible";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  projectPath: string | null;
  disabled?: boolean;
};

export function HermesBibleStrip({ projectPath, disabled }: Props) {
  const loadForProject = useProjectBibleStore((s) => s.loadForProject);
  const bible = useProjectBibleStore((s) => s.bible);
  const patchBible = useProjectBibleStore((s) => s.patchBible);
  const syncCharactersFromCanvas = useProjectBibleStore((s) => s.syncCharactersFromCanvas);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  useEffect(() => {
    void loadForProject(projectPath);
  }, [loadForProject, projectPath]);

  const handleSync = useCallback(async () => {
    const { count } = await syncCharactersFromCanvas();
    setStatusText(`项目圣经：已同步 ${count} 个角色`);
  }, [setStatusText, syncCharactersFromCanvas]);

  if (!projectPath) return null;

  const refCount = bibleCharacterRefCount(bible);

  return (
    <details className="hermesBibleStrip" open>
      <summary className="hermesBibleStripSummary">
        项目圣经
        <span className="hermesBibleStripMeta">
          {bible.characters.length} 角色 · {refCount} 参考图
        </span>
      </summary>
      <div className="hermesBibleStripBody">
        <label className="hermesBibleField">
          <span>一句话梗概</span>
          <textarea
            className="hermesBibleInput"
            rows={2}
            value={bible.logline}
            disabled={disabled}
            placeholder="例如：雨夜赛博都市里的追车与抉择…"
            onChange={(e) => patchBible({ logline: e.target.value })}
          />
        </label>
        <label className="hermesBibleField">
          <span>视觉风格</span>
          <textarea
            className="hermesBibleInput"
            rows={2}
            value={bible.visualStyle}
            disabled={disabled}
            placeholder="色调、镜头质感、时代参考…"
            onChange={(e) => patchBible({ visualStyle: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn btn--ghost btn--sm hermesBibleSyncBtn"
          disabled={disabled}
          onClick={() => void handleSync()}
        >
          从镜头表同步角色
        </button>
        <p className="hermesBibleHint">
          批量出图会自动合并镜头「角色图」与圣经默认参考图（每镜最多 4 张）。
        </p>
      </div>
    </details>
  );
}
