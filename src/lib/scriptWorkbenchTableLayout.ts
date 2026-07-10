import type { ScriptBeatsTableLayout } from "@/lib/scriptBeatsTableModel";

const STORAGE_KEY = "scriptWorkbenchTableLayout";

export function loadWorkbenchTableLayout(): ScriptBeatsTableLayout {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v === "pro" ? "pro" : "basic";
  } catch {
    return "basic";
  }
}

export function persistWorkbenchTableLayout(layout: ScriptBeatsTableLayout): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, layout);
  } catch {
    /* ignore */
  }
}
