import { create } from "zustand";

/** Hermes 壳层活动态（Orb 共感可读，不依赖浮窗是否挂载） */
type HermesShellActivityState = {
  planning: boolean;
  streaming: boolean;
  setPlanning: (planning: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  reset: () => void;
};

export const useHermesShellActivityStore = create<HermesShellActivityState>((set) => ({
  planning: false,
  streaming: false,
  setPlanning: (planning) => set({ planning }),
  setStreaming: (streaming) => set({ streaming }),
  reset: () => set({ planning: false, streaming: false }),
}));
