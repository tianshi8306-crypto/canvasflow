import { isTauri } from "@tauri-apps/api/core";
import {
  clearHermesRefAssets,
  formatHermesRefsForChat,
  loadHermesRefAssets,
  mentionNameFromRelPath,
  pinHermesRefAsset,
  unpinHermesRefByMention,
  type HermesRefAsset,
} from "@/lib/hermes/hermesRefAssets";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { importMediaFiles, listAssets, type AssetSummary } from "@/shared/api/assets";

export type HermesRefAssetsChatIntent = "list" | "add" | "remove" | "clear" | "import";

export type HermesRefAssetsChatResult = {
  ok: boolean;
  message: string;
  refs: HermesRefAsset[];
};

function extractQuoted(text: string): string[] {
  const out: string[] = [];
  const re = /[「『"']([^」』"']+)[」』"']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[1]!.trim();
    if (s) out.push(s);
  }
  return out;
}

function extractAddQuery(text: string): string | null {
  const quoted = extractQuoted(text);
  if (quoted[0]) return quoted[0];
  const m = text.match(
    /(?:添加|加|设为|作为|当作|钉|固定)(?:为)?(?:参考|参考素材|参考图)[：:\s]*(.+?)$/i,
  );
  if (m?.[1]?.trim()) return m[1].trim().slice(0, 120);
  if (/最新.*图|刚导入|刚拖|最近.*图|最后.*图/.test(text)) return "__latest_image__";
  return null;
}

function extractRemoveToken(text: string): string | null {
  const quoted = extractQuoted(text);
  if (quoted[0]) return quoted[0].replace(/^@/, "");
  const m = text.match(/@([\w\u4e00-\u9fff][\w\u4e00-\u9fff.-]*)/);
  if (m?.[1]) return m[1].trim();
  const tail = text.match(
    /(?:去掉|移除|删除|取消)(?:参考|参考素材)[：:\s]*(.+?)$/i,
  );
  if (tail?.[1]?.trim()) return tail[1].trim().replace(/^@/, "");
  return null;
}

function isImageAsset(a: AssetSummary): boolean {
  const mt = a.mediaType.toLowerCase();
  if (mt.includes("image")) return true;
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(a.relPath);
}

function scoreAssetMatch(a: AssetSummary, query: string): number {
  const q = query.toLowerCase();
  const rel = a.relPath.toLowerCase();
  const name = mentionNameFromRelPath(a.relPath).toLowerCase();
  if (rel === q || rel.endsWith(`/${q}`) || rel.includes(q)) return 100;
  if (name === q) return 90;
  if (name.includes(q) || q.includes(name)) return 70;
  if (rel.includes(q)) return 50;
  return 0;
}

function findAssetsForQuery(
  assets: AssetSummary[],
  query: string,
  limit = 3,
): AssetSummary[] {
  if (query === "__latest_image__") {
    const images = assets.filter(isImageAsset);
    images.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return images[0] ? [images[0]] : [];
  }
  const q = query.trim();
  if (!q) return [];
  const normalized = q.replace(/^@/, "").replace(/^assets[/\\]/i, "");
  const ranked = assets
    .map((a) => ({ a, score: scoreAssetMatch(a, normalized) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  return ranked.slice(0, limit).map((x) => x.a);
}

export function resolveRefAssetsChatIntent(text: string): HermesRefAssetsChatIntent | null {
  const t = text.trim();
  if (!t) return null;
  if (/^(列出|查看|有哪些|显示|当前).*(参考|参考素材)/.test(t)) return "list";
  if (/参考素材列表|参考列表/.test(t)) return "list";
  if (/清空.*参考|清除.*参考|去掉全部参考/.test(t)) return "clear";
  if (/导入.*参考|上传.*参考|添加参考图/.test(t)) return "import";
  if (/(去掉|移除|删除|取消).*(参考|@)/.test(t)) return "remove";
  if (/(添加|加|设为|作为|当作|钉|固定).*(参考|参考素材|参考图)/.test(t)) {
    return "add";
  }
  if (/把.+加为参考|.+当作参考/.test(t)) return "add";
  return null;
}

export async function runRefAssetsChatAction(
  intent: HermesRefAssetsChatIntent,
  text: string,
  projectPath: string | null,
  _currentRefs: HermesRefAsset[],
): Promise<HermesRefAssetsChatResult> {
  if (!projectPath?.trim()) {
    return {
      ok: false,
      message: "请先打开或保存工程，再管理参考素材。",
      refs: loadHermesRefAssets(projectPath),
    };
  }
  if (!isTauri()) {
    return {
      ok: false,
      message: DESKTOP_SHELL_HINT,
      refs: loadHermesRefAssets(projectPath),
    };
  }

  const root = projectPath.trim();

  if (intent === "list") {
    const refs = loadHermesRefAssets(projectPath);
    return { ok: true, message: formatHermesRefsForChat(refs), refs };
  }

  if (intent === "clear") {
    const refs = clearHermesRefAssets(projectPath);
    return { ok: true, message: "已清空全部参考素材。", refs };
  }

  if (intent === "remove") {
    const token = extractRemoveToken(text);
    if (!token) {
      return {
        ok: false,
        message: "请说明要移除的参考名，例如：去掉参考 @霓虹 或 移除参考「街景」。",
        refs: loadHermesRefAssets(projectPath),
      };
    }
    const { next, removed } = unpinHermesRefByMention(projectPath, token);
    if (!removed) {
      return {
        ok: false,
        message: `未找到参考 @${token}。${formatHermesRefsForChat(next)}`,
        refs: next,
      };
    }
    return {
      ok: true,
      message: `已移除参考 @${removed.mentionName}。${formatHermesRefsForChat(next)}`,
      refs: next,
    };
  }

  if (intent === "import") {
    const paths = await pickImagePathsForImport(true);
    if (!paths?.length) {
      return {
        ok: false,
        message: "未选择图片。",
        refs: loadHermesRefAssets(projectPath),
      };
    }
    try {
      const items = await importMediaFiles(root, paths);
      let refs = loadHermesRefAssets(projectPath);
      const added: string[] = [];
      for (const item of items) {
        refs = pinHermesRefAsset(projectPath, {
          assetId: item.assetId,
          relPath: item.relPath,
          mediaType: "image",
        });
        added.push(`@${mentionNameFromRelPath(item.relPath)}`);
      }
      return {
        ok: true,
        message: `已导入并钉选 ${items.length} 张参考图：${added.join("、")}。出图时可在指令里写 ${added[0] ?? "@素材名"}。`,
        refs,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `导入失败：${msg}`,
        refs: loadHermesRefAssets(projectPath),
      };
    }
  }

  const query = extractAddQuery(text);
  if (!query) {
    return {
      ok: false,
      message:
        "请说明要钉选的文件，例如：把「霓虹街景.png」加为参考，或「把最新导入的图加为参考」。",
      refs: loadHermesRefAssets(projectPath),
    };
  }

  let assets: AssetSummary[] = [];
  try {
    assets = await listAssets(root, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `读取工程素材失败：${msg}`,
      refs: loadHermesRefAssets(projectPath),
    };
  }

  const hits = findAssetsForQuery(assets, query);
  if (hits.length === 0) {
    return {
      ok: false,
      message: `工程 assets 中未找到与「${query === "__latest_image__" ? "最新图片" : query}」匹配的素材。可先拖入画布或说「导入参考图片」。`,
      refs: loadHermesRefAssets(projectPath),
    };
  }

  let refs = loadHermesRefAssets(projectPath);
  const pinned: string[] = [];
  for (const hit of hits) {
    refs = pinHermesRefAsset(
      projectPath,
      {
        assetId: hit.assetId,
        relPath: hit.relPath,
        mediaType: hit.mediaType,
      },
      mentionNameFromRelPath(hit.relPath),
    );
    pinned.push(`@${mentionNameFromRelPath(hit.relPath)}`);
  }

  const note =
    hits.length > 1
      ? `已钉选 ${hits.length} 个匹配素材`
      : `已钉选参考 ${pinned[0]}`;

  return {
    ok: true,
    message: `${note}。出图/改镜时可在指令中使用 ${pinned.join("、")}。`,
    refs,
  };
}
