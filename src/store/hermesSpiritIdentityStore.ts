import { create } from "zustand";
import {
  loadHermesSpiritIdentity,
  type HermesSpiritIdentity,
} from "@/lib/hermes/agent/hermesSpiritIdentity";

type State = HermesSpiritIdentity & {
  loadedProjectPath: string | null;
  hydrate: (projectPath: string | null) => Promise<void>;
  applyLocal: (patch: Partial<HermesSpiritIdentity>) => void;
};

const emptyIdentity = (): HermesSpiritIdentity => ({
  spiritName: "",
  userHonorific: "",
  introShown: false,
});

export const useHermesSpiritIdentityStore = create<State>((set, get) => ({
  ...emptyIdentity(),
  loadedProjectPath: null,

  hydrate: async (projectPath) => {
    if (!projectPath?.trim()) {
      const cur = get();
      if (
        cur.loadedProjectPath === null &&
        !cur.spiritName &&
        !cur.userHonorific &&
        !cur.introShown
      ) {
        return;
      }
      set({ ...emptyIdentity(), loadedProjectPath: null });
      return;
    }
    const path = projectPath.trim();
    if (get().loadedProjectPath === path) return;
    const identity = await loadHermesSpiritIdentity(path);
    set({ ...identity, loadedProjectPath: path });
  },

  applyLocal: (patch) => {
    set((s) => ({
      spiritName: patch.spiritName ?? s.spiritName,
      userHonorific: patch.userHonorific ?? s.userHonorific,
      introShown: patch.introShown ?? s.introShown,
    }));
  },
}));
