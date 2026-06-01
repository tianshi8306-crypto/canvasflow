import { create } from "zustand";
import {
  emptyProjectBible,
  loadProjectBible,
  saveProjectBible,
  type ProjectBible,
} from "@/lib/projectBible/projectBible";
import { syncBibleCharactersFromScriptBeats } from "@/lib/projectBible/bibleRoleBindings";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import { useProjectStore } from "@/store/projectStore";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

type State = {
  projectPath: string | null;
  bible: ProjectBible;
  bibleDirty: boolean;
  loading: boolean;
};

type Actions = {
  loadForProject: (projectPath: string | null) => Promise<void>;
  patchBible: (patch: Partial<Pick<ProjectBible, "logline" | "visualStyle" | "taboos" | "targetDurationSec">>) => void;
  setBible: (bible: ProjectBible) => void;
  syncCharactersFromCanvas: () => Promise<{ count: number }>;
  flushSave: () => Promise<void>;
  reset: () => void;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(get: () => State & Actions) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void get().flushSave();
  }, 600);
}

export const useProjectBibleStore = create<State & Actions>((set, get) => ({
  projectPath: null,
  bible: emptyProjectBible(),
  bibleDirty: false,
  loading: false,

  reset: () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    set({
      projectPath: null,
      bible: emptyProjectBible(),
      bibleDirty: false,
      loading: false,
    });
  },

  loadForProject: async (projectPath) => {
    if (!projectPath?.trim()) {
      get().reset();
      return;
    }
    if (get().projectPath === projectPath && !get().loading) {
      return;
    }
    set({ loading: true, projectPath });
    const bible = await loadProjectBible(projectPath);
    set({ bible, bibleDirty: false, loading: false, projectPath });
  },

  patchBible: (patch) => {
    set((s) => ({
      bible: { ...s.bible, ...patch, updatedAt: new Date().toISOString() },
      bibleDirty: true,
    }));
    scheduleSave(get);
  },

  setBible: (bible) => {
    set({ bible, bibleDirty: true });
    scheduleSave(get);
  },

  syncCharactersFromCanvas: async () => {
    const path = get().projectPath;
    if (!path) return { count: 0 };
    const nodes = useProjectStore.getState().nodes as Node<FlowNodeData>[];
    const script = findPrimaryScriptNode(nodes);
    const beats = script?.data.scriptBeats;
    const next = syncBibleCharactersFromScriptBeats(get().bible, beats);
    set({ bible: next, bibleDirty: true });
    await get().flushSave();
    return { count: next.characters.length };
  },

  flushSave: async () => {
    const { projectPath, bible, bibleDirty } = get();
    if (!projectPath?.trim() || !bibleDirty) return;
    await saveProjectBible(projectPath, bible);
    set({ bibleDirty: false });
  },
}));
