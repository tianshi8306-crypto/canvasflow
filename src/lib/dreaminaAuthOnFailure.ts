import { checkDreaminaAuthState } from "@/lib/dreaminaAuth";
import { notifyDreaminaAuthUpdated } from "@/lib/dreaminaAuthEvents";
import { isDreaminaModel } from "@/lib/dreamina/model";

export { DREAMINA_AUTH_UPDATED_EVENT } from "@/lib/dreaminaAuthEvents";

/** 即梦模型生成失败时刷新 CLI 登录态，并通知设置页等订阅方 */
export function refreshDreaminaAuthOnGenerationFailure(modelId: string | null | undefined): void {
  if (!isDreaminaModel(modelId)) return;
  void checkDreaminaAuthState(true, { preferCache: false })
    .then((state) => notifyDreaminaAuthUpdated(state))
    .catch(() => undefined);
}
