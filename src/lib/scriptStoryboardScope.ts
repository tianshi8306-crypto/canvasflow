import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import type { ScriptBeat } from "@/lib/types";

/** 生成分镜文案时的镜头范围（画布顶栏 / 全屏 / 侧栏「勾选」按钮共用） */
export type StoryboardBeatScope = {
  beats: ScriptBeat[];
  mode: "selected" | "all";
  selectedCount: number;
  totalCount: number;
};

export type StoryboardBeatScopeResult =
  | { ok: true; scope: StoryboardBeatScope }
  | { ok: false; message: string };

/**
 * 有有效勾选 → 仅勾选镜头；否则 → 全部镜头。
 * 与 `ScriptNodeFullscreenOverlay` 历史行为一致。
 */
export function resolveStoryboardBeatScope(
  beats: ScriptBeat[],
  storedSelection: string[] | undefined,
): StoryboardBeatScopeResult {
  const normalized = normalizeScriptBeats(beats);
  const totalCount = normalized.length;
  const rawSelection = storedSelection ?? [];
  const validSelected = rawSelection.filter((id) => normalized.some((b) => b.id === id));

  if (rawSelection.length > 0 && validSelected.length === 0) {
    return { ok: false, message: "所选镜头已不存在，请重新勾选" };
  }

  if (validSelected.length > 0) {
    const selectedSet = new Set(validSelected);
    return {
      ok: true,
      scope: {
        beats: normalized.filter((b) => selectedSet.has(b.id)),
        mode: "selected",
        selectedCount: validSelected.length,
        totalCount,
      },
    };
  }

  return {
    ok: true,
    scope: {
      beats: normalized,
      mode: "all",
      selectedCount: 0,
      totalCount,
    },
  };
}

export function storyboardScopeActionHint(scope: StoryboardBeatScope): string {
  if (scope.mode === "selected") {
    return `为 ${scope.selectedCount} 条勾选镜头生成分镜文案`;
  }
  return `为全部 ${scope.totalCount} 条镜头生成分镜文案`;
}

export function storyboardScopeToolbarLabel(
  scope: StoryboardBeatScope,
  busy = false,
): string {
  if (busy) return "分镜中…";
  if (scope.mode === "selected") return `生成分镜（${scope.selectedCount}）`;
  return "生成分镜";
}

/** 批量建链（图/视频/音频）范围提示 */
export function storyboardChainScopeHint(scope: StoryboardBeatScope): string {
  if (scope.mode === "selected") {
    return `已勾选 ${scope.selectedCount} / ${scope.totalCount} 镜：建链仅作用于勾选镜头`;
  }
  return `未勾选镜头：建链将作用于全部 ${scope.totalCount} 镜`;
}
