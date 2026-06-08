import { invoke } from "@tauri-apps/api/core";

async function wait(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function verifyApiKeyWithRetry(providerId: string, retries = 8): Promise<boolean> {
  for (let i = 0; i < retries; i += 1) {
    try {
      const ok = await invoke<boolean>("has_api_key", { providerId });
      if (ok) return true;
    } catch {
      // 凭据库读回偶发错误，短暂重试
    }
    if (i < retries - 1) await wait(280);
  }
  return false;
}
