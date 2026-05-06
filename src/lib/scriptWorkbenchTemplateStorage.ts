import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { SCRIPT_TEMPLATE_MAX, SCRIPT_TEMPLATES_STORAGE_KEY } from "./scriptWorkbenchConstants";
import type { ScriptTemplateItem } from "./scriptWorkbenchTypes";

export function loadScriptTemplatesV1(): ScriptTemplateItem[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(SCRIPT_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is ScriptTemplateItem => Boolean(x && typeof x === "object"))
      .map((x) => ({
        id: typeof x.id === "string" && x.id.trim() ? x.id : crypto.randomUUID(),
        name: typeof x.name === "string" && x.name.trim() ? x.name.trim() : "未命名模板",
        styleTag:
          x.styleTag === "shortDrama" ||
          x.styleTag === "film" ||
          x.styleTag === "anime" ||
          x.styleTag === "ad" ||
          x.styleTag === "general"
            ? x.styleTag
            : "general",
        createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now(),
        beats: normalizeScriptBeats(Array.isArray(x.beats) ? x.beats : []),
      }))
      .slice(0, SCRIPT_TEMPLATE_MAX);
  } catch {
    return [];
  }
}

export function saveScriptTemplatesV1(items: ScriptTemplateItem[]) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const normalized = items
      .map((x) => ({
        id: x.id,
        name: x.name.trim() || "未命名模板",
        styleTag: x.styleTag ?? "general",
        createdAt: x.createdAt,
        beats: normalizeScriptBeats(x.beats),
      }))
      .slice(0, SCRIPT_TEMPLATE_MAX);
    window.localStorage.setItem(SCRIPT_TEMPLATES_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
}
