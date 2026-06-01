import { create } from "zustand";

export type HermesJobToastKind = "success" | "error" | "info";

export type HermesJobToast = {
  id: string;
  kind: HermesJobToastKind;
  message: string;
  createdAt: number;
};

type HermesJobToastState = {
  toasts: HermesJobToast[];
  push: (toast: Omit<HermesJobToast, "id" | "createdAt">) => string;
  dismiss: (id: string) => void;
};

let toastSeq = 0;

export const useHermesJobToastStore = create<HermesJobToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `hermes-toast-${Date.now()}-${++toastSeq}`;
    set((s) => ({
      toasts: [...s.toasts, { ...toast, id, createdAt: Date.now() }].slice(-4),
    }));
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function pushHermesJobToast(
  toast: Omit<HermesJobToast, "id" | "createdAt">,
): string {
  return useHermesJobToastStore.getState().push(toast);
}
