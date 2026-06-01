import { useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import {
  filterMaterialLibraryItems,
  loadMaterialLibrary,
  MATERIAL_LIBRARY_FILTER_TABS,
  removeMaterialLibraryItem,
  type MaterialLibraryFilterTab,
  type MaterialLibraryItem,
} from "@/lib/materialLibrary";
import { assetNodeKindForMediaType } from "@/lib/canvasAssets";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";

function MaterialLibraryTileThumb({ item }: { item: MaterialLibraryItem }) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const resolveRoot = item.projectPath || projectPath;
  const src = useMemo(
    () => resolveProjectAssetSrc(resolveRoot, item.relPath),
    [resolveRoot, item.relPath],
  );
  const [broken, setBroken] = useState(false);

  if (!resolveRoot) {
    return <div className="materialLibraryTilePlaceholder">打开工程后可预览</div>;
  }
  if (!src || broken) {
    return <div className="materialLibraryTilePlaceholder">{broken ? "预览失败" : "暂无预览"}</div>;
  }

  if (item.mediaType === "video") {
    return (
      <>
        <video src={src} muted playsInline preload="metadata" onError={() => setBroken(true)} />
        <span className="materialLibraryTileBadge">视频</span>
      </>
    );
  }
  if (item.mediaType === "audio") {
    return (
      <>
        <div className="materialLibraryTilePlaceholder">音频</div>
        <span className="materialLibraryTileBadge">音频</span>
      </>
    );
  }

  return <img src={src} alt={item.name} loading="lazy" onError={() => setBroken(true)} />;
}

type ContentProps = {
  onInserted?: () => void;
};

/** 素材库内容：分类 Pill + 缩略图网格 */
export function MaterialLibraryContent({ onInserted }: ContentProps) {
  const addNode = useProjectStore((s) => s.addNode);
  const viewport = useProjectStore((s) => s.viewport);
  const projectPath = useProjectStore((s) => s.projectPath);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const [activeTab, setActiveTab] = useState<MaterialLibraryFilterTab>("all");
  const [version, setVersion] = useState(0);

  const allItems = useMemo(() => {
    void version;
    return loadMaterialLibrary();
  }, [version]);
  const items = filterMaterialLibraryItems(allItems, activeTab);

  const removeItem = (item: MaterialLibraryItem) => {
    removeMaterialLibraryItem(item.id);
    setVersion((v) => v + 1);
    setStatusText(`已从素材库移除：${item.name}（工程文件未删除）`);
  };

  const insertItem = (item: MaterialLibraryItem) => {
    const kind = assetNodeKindForMediaType(item.mediaType);
    if (!kind) {
      setStatusText("该素材类型暂不支持插入节点");
      return;
    }
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程后再插入素材库节点");
      return;
    }
    if (item.projectPath && item.projectPath !== projectPath) {
      setStatusText("该素材来自其他工程，暂不支持直接跨工程插入");
      return;
    }
    const x = -viewport.x / Math.max(0.0001, viewport.zoom) + 120;
    const y = -viewport.y / Math.max(0.0001, viewport.zoom) + 120;
    const labelByKind = {
      imageNode: "图片",
      videoNode: "视频",
      audioNode: "音频",
    } as const;
    addNode({
      id: crypto.randomUUID(),
      type: kind,
      position: { x, y },
      data: {
        label: item.name || labelByKind[kind],
        path: item.relPath,
        assetId: item.assetId,
      },
    });
    setStatusText(`已从素材库插入：${item.name}`);
    onInserted?.();
  };

  return (
    <>
      <div className="materialLibraryCats" role="tablist" aria-label="素材分类">
        {MATERIAL_LIBRARY_FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`materialLibraryCatBtn${activeTab === tab.id ? " materialLibraryCatBtn--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="materialLibraryBody">
        {!items.length ? (
          <div className="materialLibraryEmpty">暂无素材</div>
        ) : (
          <div className="materialLibraryGrid">
            {items.map((item) => (
              <div key={item.id} className="materialLibraryTile">
                <div className="materialLibraryTileThumb">
                  <button
                    type="button"
                    className="materialLibraryTileMain"
                    title={item.name}
                    onClick={() => insertItem(item)}
                  >
                    <MaterialLibraryTileThumb item={item} />
                  </button>
                  <button
                    type="button"
                    className="materialLibraryTileDelete"
                    title="从素材库移除（不删除工程文件）"
                    aria-label={`从素材库移除 ${item.name}`}
                    onClick={() => removeItem(item)}
                  >
                    ×
                  </button>
                </div>
                <div className="materialLibraryTileLabel">{item.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
