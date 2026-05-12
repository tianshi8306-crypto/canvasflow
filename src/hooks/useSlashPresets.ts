import { useCallback, useMemo } from "react";
import { BUILT_IN_PRESETS, type SlashPreset } from "@/lib/slashPresets";

const PRESETS_KEY = "canvasflow.slashPresets.v1";
const USAGE_KEY = "canvasflow.slashPresetUsage.v1";

export function useSlashPresets() {
  // Load custom presets from localStorage
  const customPresets: SlashPreset[] = useMemo(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  // Load usage stats
  const usageStats: Record<string, number> = useMemo(() => {
    try {
      const raw = localStorage.getItem(USAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  // Merged + sorted by usageCount desc
  const presets = useMemo(() => {
    const all = [...BUILT_IN_PRESETS, ...customPresets];
    // Spread again to avoid mutating the original array
    return [...all].sort((a, b) => {
      const aCount = usageStats[a.id] ?? 0;
      const bCount = usageStats[b.id] ?? 0;
      return bCount - aCount;
    });
  }, [customPresets, usageStats]);

  const addCustomPreset = useCallback(
    (preset: Omit<SlashPreset, "id" | "isCustom" | "createdAt">) => {
      const id = `custom-${Date.now()}`;
      const newPreset: SlashPreset = { ...preset, id, isCustom: true, createdAt: Date.now() };
      const updated = [...customPresets, newPreset];
      localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
      return id;
    },
    [customPresets]
  );

  const removeCustomPreset = useCallback(
    (id: string) => {
      const updated = customPresets.filter((p) => p.id !== id);
      localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    },
    [customPresets]
  );

  const recordUsage = useCallback(
    (presetId: string) => {
      const updated = { ...usageStats, [presetId]: (usageStats[presetId] ?? 0) + 1 };
      localStorage.setItem(USAGE_KEY, JSON.stringify(updated));
    },
    [usageStats]
  );

  return { presets, addCustomPreset, removeCustomPreset, recordUsage };
}