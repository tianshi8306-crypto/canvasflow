import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  loadHermesRefAssets,
  mentionNameFromRelPath,
  pinHermesRefAsset,
  saveHermesRefAssets,
  unpinHermesRefAsset,
  type HermesRefAsset,
} from "@/lib/hermes/hermesRefAssets";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { importMediaFiles } from "@/shared/api/assets";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  refs: HermesRefAsset[];
  onRefsChange: (next: HermesRefAsset[]) => void;
  onInsertMention: (mentionName: string) => void;
  disabled?: boolean;
};

function isImageRef(r: HermesRefAsset): boolean {
  const mt = r.mediaType.toLowerCase();
  if (mt.includes("image")) return true;
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(r.relPath);
}

export function HermesRefAssetsStrip({
  refs,
  onRefsChange,
  onInsertMention,
  disabled,
}: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);

  const thumbs = useMemo(() => {
    if (!projectPath) return [];
    return refs.map((r) => ({
      ref: r,
      src: isImageRef(r) ? resolveProjectAssetSrc(projectPath, r.relPath) : null,
    }));
  }, [projectPath, refs]);

  const handleAdd = useCallback(async () => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程后再添加参考素材");
      return;
    }
    if (!isTauri()) {
      setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    const paths = await pickImagePathsForImport(true);
    if (!paths?.length) return;
    setImporting(true);
    try {
      const items = await importMediaFiles(projectPath.trim(), paths);
      let list = refs;
      for (const item of items) {
        list = pinHermesRefAsset(projectPath, {
          assetId: item.assetId,
          relPath: item.relPath,
          mediaType: "image",
        });
      }
      onRefsChange(list);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assets.list(projectPath.trim()),
      });
      setStatusText(`已添加 ${items.length} 个参考素材，输入 @${mentionNameFromRelPath(items[0]!.relPath)} 可引用`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusText(`导入参考素材失败：${msg}`);
    } finally {
      setImporting(false);
    }
  }, [onRefsChange, projectPath, queryClient, refs, setStatusText]);

  const handleUnpin = useCallback(
    (pinId: string) => {
      const next = unpinHermesRefAsset(projectPath, pinId);
      onRefsChange(next);
    },
    [onRefsChange, projectPath],
  );

  if (!projectPath) {
    return null;
  }

  return (
    <div className="hermesRefStrip" role="region" aria-label="Hermes 参考素材">
      <div className="hermesRefStripHead">
        <span className="hermesRefStripTitle">参考素材</span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={disabled || importing}
          onClick={() => void handleAdd()}
        >
          {importing ? "导入中…" : "+ 添加"}
        </button>
      </div>
      <div className="hermesRefStripScroll">
        {thumbs.length === 0 ? null : (
          thumbs.map(({ ref: r, src }) => (
            <div key={r.pinId} className="hermesRefThumb">
              <button
                type="button"
                className="hermesRefThumbMain"
                title={`插入 @${r.mentionName}`}
                disabled={disabled}
                onClick={() => onInsertMention(r.mentionName)}
              >
                {src ? (
                  <img src={src} alt="" className="hermesRefThumbImg" />
                ) : (
                  <span className="hermesRefThumbPlaceholder" aria-hidden>
                    📎
                  </span>
                )}
                <span className="hermesRefThumbName">@{r.mentionName}</span>
              </button>
              <button
                type="button"
                className="hermesRefThumbRemove"
                aria-label={`移除 ${r.mentionName}`}
                disabled={disabled}
                onClick={() => handleUnpin(r.pinId)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** 工程切换时从 localStorage 恢复钉选列表 */
export function useHermesRefAssets(projectPath: string | null): [
  HermesRefAsset[],
  (next: HermesRefAsset[]) => void,
] {
  const [refs, setRefs] = useState<HermesRefAsset[]>(() =>
    loadHermesRefAssets(projectPath),
  );

  const sync = useCallback(
    (next: HermesRefAsset[]) => {
      saveHermesRefAssets(projectPath, next);
      setRefs(next);
    },
    [projectPath],
  );

  useEffect(() => {
    setRefs(loadHermesRefAssets(projectPath));
  }, [projectPath]);

  return [refs, sync];
}
