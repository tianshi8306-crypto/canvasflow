import type { StyleCategory, StylePreset } from "./types";

let _cache: Promise<StylePreset[]> | null = null;

/** 加载风格库（从 public/styleLibrary.json），带内存缓存和并发去重 */
export async function fetchStyleLibrary(): Promise<StylePreset[]> {
  if (_cache) return _cache;
  _cache = (async () => {
    const res = await fetch("/styleLibrary.json");
    if (!res.ok) {
      _cache = null;
      throw new Error(`style library load failed: ${res.status}`);
    }
    return (await res.json()) as StylePreset[];
  })();
  return _cache;
}

export function getStylePreset(id: string, library: StylePreset[]): StylePreset | undefined {
  return library.find((s) => s.id === id);
}

export function filterByCategory(library: StylePreset[], category: StyleCategory | "all"): StylePreset[] {
  if (category === "all") return library;
  return library.filter((s) => s.category === category);
}

export function searchStyles(library: StylePreset[], query: string): StylePreset[] {
  const q = query.toLowerCase().trim();
  if (!q) return library;
  return library.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)) ||
      s.hints.some((h) => h.toLowerCase().includes(q)),
  );
}
