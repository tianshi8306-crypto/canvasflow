import type { DreaminaAuthState } from "@/lib/dreaminaAuth";

export const DREAMINA_AUTH_UPDATED_EVENT = "canvasflow:dreamina-auth-updated";

export function notifyDreaminaAuthUpdated(state: DreaminaAuthState): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new CustomEvent<DreaminaAuthState>(DREAMINA_AUTH_UPDATED_EVENT, { detail: state }));
}
