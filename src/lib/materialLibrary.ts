export type MaterialCategory = "role" | "prop" | "scene" | "style";
export type MaterialMediaType = "image" | "video" | "audio";
export type MaterialLibraryFilterTab = "all" | MaterialCategory;

export type MaterialLibraryItem = {
  id: string;
  name: string;
  category: MaterialCategory;
  mediaType: MaterialMediaType;
  relPath: string;
  assetId?: string;
  projectPath?: string;
  createdAt: number;
};

const STORAGE_KEY = "canvasflow-material-library-v1";

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  role: "人物",
  prop: "物品",
  scene: "场景",
  style: "风格",
};

export const MATERIAL_LIBRARY_FILTER_TABS: { id: MaterialLibraryFilterTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "role", label: "人物" },
  { id: "scene", label: "场景" },
  { id: "prop", label: "物品" },
  { id: "style", label: "风格" },
];

export function materialCategoryLabel(category: MaterialCategory): string {
  return MATERIAL_CATEGORY_LABELS[category];
}

export function filterMaterialLibraryItems(
  items: MaterialLibraryItem[],
  tab: MaterialLibraryFilterTab,
): MaterialLibraryItem[] {
  if (tab === "all") return items;
  return items.filter((it) => it.category === tab);
}

function normalizeItem(raw: unknown): MaterialLibraryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<MaterialLibraryItem>;
  const id = item.id?.trim();
  const name = item.name?.trim();
  const relPath = item.relPath?.trim();
  if (!id || !name || !relPath) return null;
  if (
    item.category !== "role" &&
    item.category !== "prop" &&
    item.category !== "scene" &&
    item.category !== "style"
  ) {
    return null;
  }
  if (item.mediaType !== "image" && item.mediaType !== "video" && item.mediaType !== "audio") return null;
  return {
    id,
    name,
    category: item.category,
    mediaType: item.mediaType,
    relPath,
    assetId: item.assetId?.trim() || undefined,
    projectPath: item.projectPath?.trim() || undefined,
    createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
  };
}

export function loadMaterialLibrary(): MaterialLibraryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr
      .map(normalizeItem)
      .filter((x): x is MaterialLibraryItem => Boolean(x))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function saveMaterialLibrary(items: MaterialLibraryItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function upsertMaterialLibraryItem(input: Omit<MaterialLibraryItem, "id" | "createdAt">): MaterialLibraryItem {
  const now = Date.now();
  const items = loadMaterialLibrary();
  const dupIdx = items.findIndex(
    (it) =>
      it.category === input.category &&
      it.mediaType === input.mediaType &&
      it.relPath === input.relPath &&
      (it.assetId ?? "") === (input.assetId ?? "") &&
      (it.projectPath ?? "") === (input.projectPath ?? ""),
  );
  const next: MaterialLibraryItem =
    dupIdx >= 0
      ? { ...items[dupIdx]!, name: input.name.trim() || items[dupIdx]!.name }
      : {
          id: crypto.randomUUID(),
          name: input.name.trim() || "未命名素材",
          category: input.category,
          mediaType: input.mediaType,
          relPath: input.relPath.trim(),
          assetId: input.assetId?.trim() || undefined,
          projectPath: input.projectPath?.trim() || undefined,
          createdAt: now,
        };
  const merged = dupIdx >= 0 ? items.map((it, i) => (i === dupIdx ? next : it)) : [next, ...items];
  saveMaterialLibrary(merged);
  return next;
}

/** 仅从素材库列表移除条目，不删除工程磁盘文件。 */
export function removeMaterialLibraryItem(id: string): void {
  const keep = loadMaterialLibrary().filter((it) => it.id !== id);
  saveMaterialLibrary(keep);
}