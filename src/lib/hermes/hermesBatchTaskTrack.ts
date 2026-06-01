import type { HermesTaskKind } from "@/lib/hermes/hermesTaskTrack";
import { useHermesTaskStore } from "@/store/hermesTaskStore";

export type HermesBatchProgressReporter = {
  onProgress?: (current: number, total: number, detail?: string) => void;
  finish: (ok: boolean, message?: string) => void;
};

export function createHermesBatchProgressReporter(
  directorStepId: string | undefined,
  kind: HermesTaskKind,
  label: string,
): HermesBatchProgressReporter {
  if (!directorStepId?.trim()) {
    return { finish: () => {} };
  }
  const id = directorStepId.trim();
  const store = useHermesTaskStore.getState();
  return {
    onProgress: (current, total, detail) => {
      store.reportBatchProgress(id, { kind, label, current, total, detail });
    },
    finish: (ok, message) => {
      store.finishBatchStep(id, ok, message);
    },
  };
}
