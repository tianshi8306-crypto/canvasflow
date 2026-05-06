import { invoke } from "@tauri-apps/api/core";

async function wait(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function verifyApiKeyWithRetry(providerId: string, retries = 4): Promise<boolean> {
  for (let i = 0; i < retries; i += 1) {
    const ok = await invoke<boolean>("has_api_key", { providerId });
    if (ok) return true;
    if (i < retries - 1) await wait(180);
  }
  return false;
}
