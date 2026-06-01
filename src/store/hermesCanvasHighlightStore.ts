import { create } from "zustand";
import { hermesHighlightDurationMs } from "@/lib/hermes/hermesCanvasHighlightTiming";

export type HermesCanvasHighlightPulse = {
  nodeIds: string[];
  label?: string;
};

type HermesCanvasHighlightState = {
  pulse: HermesCanvasHighlightPulse | null;
  selectionAck: string | null;
  pulseAgentHighlight: (nodeIds: string[], label?: string) => void;
  setSelectionAck: (line: string | null) => void;
  clearPulse: () => void;
};

let pulseTimer: ReturnType<typeof setTimeout> | null = null;
let ackTimer: ReturnType<typeof setTimeout> | null = null;

const SELECTION_ACK_MS = 4000;

function clearPulseTimer() {
  if (pulseTimer != null) {
    clearTimeout(pulseTimer);
    pulseTimer = null;
  }
}

function clearAckTimer() {
  if (ackTimer != null) {
    clearTimeout(ackTimer);
    ackTimer = null;
  }
}

export const useHermesCanvasHighlightStore = create<HermesCanvasHighlightState>((set) => ({
  pulse: null,
  selectionAck: null,

  pulseAgentHighlight: (nodeIds, label) => {
    const ids = [...new Set(nodeIds.filter(Boolean))];
    if (ids.length === 0) return;
    clearPulseTimer();
    set({ pulse: { nodeIds: ids, label } });
    pulseTimer = setTimeout(() => {
      set({ pulse: null });
      pulseTimer = null;
    }, hermesHighlightDurationMs());
  },

  setSelectionAck: (line) => {
    clearAckTimer();
    set({ selectionAck: line });
    if (!line) return;
    ackTimer = setTimeout(() => {
      set({ selectionAck: null });
      ackTimer = null;
    }, SELECTION_ACK_MS);
  },

  clearPulse: () => {
    clearPulseTimer();
    set({ pulse: null });
  },
}));

export function pulseHermesAgentHighlight(nodeIds: string[], label?: string): void {
  useHermesCanvasHighlightStore.getState().pulseAgentHighlight(nodeIds, label);
}
