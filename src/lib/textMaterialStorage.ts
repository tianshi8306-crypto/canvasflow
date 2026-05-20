export type TextMaterialItem = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
};

const TEXT_MATERIALS_STORAGE_KEY = "textNode.materials.v1";
const TEXT_MATERIALS_MAX = 50;

export function loadTextMaterials(): TextMaterialItem[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(TEXT_MATERIALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is TextMaterialItem => Boolean(x && typeof x === "object"))
      .map((x) => ({
        id: typeof x.id === "string" && x.id.trim() ? x.id : crypto.randomUUID(),
        name: typeof x.name === "string" && x.name.trim() ? x.name.trim() : "未命名素材",
        content: typeof x.content === "string" ? x.content : "",
        createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now(),
      }))
      .slice(0, TEXT_MATERIALS_MAX);
  } catch {
    return [];
  }
}

export function saveTextMaterials(items: TextMaterialItem[]) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const normalized = items.slice(0, TEXT_MATERIALS_MAX);
    window.localStorage.setItem(TEXT_MATERIALS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
}

export function addTextMaterial(content: string, name?: string): TextMaterialItem {
  const items = loadTextMaterials();
  const newItem: TextMaterialItem = {
    id: crypto.randomUUID(),
    name: name || `文本素材 ${items.length + 1}`,
    content,
    createdAt: Date.now(),
  };
  items.unshift(newItem);
  saveTextMaterials(items);
  return newItem;
}
