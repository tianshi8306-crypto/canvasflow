import { invoke, isTauri } from "@tauri-apps/api/core";

export type HermesFormattedUserTip = {
  title: string;
  docId: string;
  category: string;
  markdown: string;
};

export type HermesUserTipListItem = {
  docId: string;
  title: string;
  relPath: string;
};

export async function formatHermesUserTip(rawTip: string, opts: {
  providerId: string;
  model: string;
}): Promise<HermesFormattedUserTip> {
  if (!isTauri()) throw new Error("仅桌面端可用");
  return invoke<HermesFormattedUserTip>("hermes_knowledge_format_user_tip", {
    rawTip: rawTip.trim(),
    providerId: opts.providerId,
    model: opts.model,
  });
}

export async function saveHermesUserTip(
  projectPath: string,
  markdown: string,
): Promise<{ relPath: string; chunkCount: number }> {
  if (!isTauri()) throw new Error("仅桌面端可用");
  const [relPath, chunkCount] = await invoke<[string, number]>(
    "hermes_knowledge_save_user_tip",
    {
      projectPath: projectPath.trim(),
      markdown: markdown.trim(),
    },
  );
  return { relPath, chunkCount };
}

export async function listHermesUserTips(
  projectPath: string,
): Promise<HermesUserTipListItem[]> {
  if (!isTauri()) return [];
  return invoke<HermesUserTipListItem[]>("hermes_knowledge_list_user_tips", {
    projectPath: projectPath.trim(),
  });
}
