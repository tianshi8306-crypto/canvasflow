/** Hermes 侧栏「本轮参考素材」——工程 assets/ 内文件的会话级钉选（非画布节点 @） */

export type HermesRefAsset = {
  /** 会话内稳定 id（钉选时生成） */
  pinId: string;
  assetId: string;
  relPath: string;
  /** 用于 @ 匹配与展示，默认文件名（无扩展名） */
  mentionName: string;
  mediaType: string;
  pinnedAt: number;
};

const STORAGE_PREFIX = "canvasflow.hermesRefs.v1";

function storageKey(projectPath: string | null): string {
  return `${STORAGE_PREFIX}:${projectPath?.trim() || "__no_project__"}`;
}

export function mentionNameFromRelPath(relPath: string): string {
  const base = relPath.split(/[/\\]/).pop() ?? relPath;
  const dot = base.lastIndexOf(".");
  return (dot > 0 ? base.slice(0, dot) : base).trim() || "素材";
}

export function loadHermesRefAssets(projectPath: string | null): HermesRefAsset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(projectPath));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HermesRefAsset[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a) => a && typeof a.relPath === "string" && typeof a.mentionName === "string",
    );
  } catch {
    return [];
  }
}

export function saveHermesRefAssets(
  projectPath: string | null,
  assets: HermesRefAsset[],
): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(projectPath), JSON.stringify(assets.slice(0, 24)));
  } catch {
    /* quota */
  }
}

export function pinHermesRefAsset(
  projectPath: string | null,
  item: { assetId: string; relPath: string; mediaType: string },
  mentionName?: string,
): HermesRefAsset[] {
  const list = loadHermesRefAssets(projectPath);
  const rel = item.relPath.trim();
  const existing = list.find((a) => a.relPath === rel || a.assetId === item.assetId);
  if (existing) return list;
  const next: HermesRefAsset = {
    pinId: crypto.randomUUID(),
    assetId: item.assetId,
    relPath: rel,
    mentionName: (mentionName ?? mentionNameFromRelPath(rel)).trim(),
    mediaType: item.mediaType || "unknown",
    pinnedAt: Date.now(),
  };
  const merged = [...list, next];
  saveHermesRefAssets(projectPath, merged);
  return merged;
}

export function unpinHermesRefAsset(
  projectPath: string | null,
  pinId: string,
): HermesRefAsset[] {
  const next = loadHermesRefAssets(projectPath).filter((a) => a.pinId !== pinId);
  saveHermesRefAssets(projectPath, next);
  return next;
}

export function unpinHermesRefByMention(
  projectPath: string | null,
  token: string,
): { next: HermesRefAsset[]; removed: HermesRefAsset | null } {
  const list = loadHermesRefAssets(projectPath);
  const hit = list.find((a) => mentionMatches(a, token.trim()));
  if (!hit) return { next: list, removed: null };
  const next = list.filter((a) => a.pinId !== hit.pinId);
  saveHermesRefAssets(projectPath, next);
  return { next, removed: hit };
}

export function clearHermesRefAssets(projectPath: string | null): HermesRefAsset[] {
  saveHermesRefAssets(projectPath, []);
  return [];
}

export function formatHermesRefsForChat(refs: HermesRefAsset[]): string {
  if (refs.length === 0) {
    return "当前没有钉选的参考素材。可说「把 assets 里的 xxx 加为参考」或「导入参考图片」。";
  }
  const lines = refs.map(
    (r, i) => `${i + 1}. @${r.mentionName}（${r.relPath}）`,
  );
  return `当前参考素材（${refs.length} 个，出图/规划时可用 @ 引用）：\n${lines.join("\n")}`;
}

/** 从输入框解析 @素材名（不含 @ 符号） */
export function parseHermesMentions(text: string): string[] {
  const names = new Set<string>();
  const re = /@([\w\u4e00-\u9fff][\w\u4e00-\u9fff.-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1]!.trim();
    if (name) names.add(name);
  }
  return [...names];
}

function mentionMatches(asset: HermesRefAsset, token: string): boolean {
  const t = token.toLowerCase();
  const n = asset.mentionName.toLowerCase();
  const file = mentionNameFromRelPath(asset.relPath).toLowerCase();
  return n === t || file === t || asset.relPath.toLowerCase().includes(t);
}

/** 将 @ 名解析为已钉选素材；未匹配的名称忽略 */
export function resolveHermesMentions(
  text: string,
  pinned: HermesRefAsset[],
): HermesRefAsset[] {
  const tokens = parseHermesMentions(text);
  if (tokens.length === 0) return [];
  const out: HermesRefAsset[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const hit = pinned.find((a) => mentionMatches(a, token));
    if (hit && !seen.has(hit.pinId)) {
      seen.add(hit.pinId);
      out.push(hit);
    }
  }
  return out;
}

export function formatRefsForLlm(refs: HermesRefAsset[]): string {
  if (refs.length === 0) return "";
  const lines = refs.map((r) => `- ${r.mentionName}（${r.relPath}）`);
  return `\n\n[Hermes 参考素材]\n${lines.join("\n")}`;
}

export function imageRefPathsFromAssets(refs: HermesRefAsset[]): string[] {
  return refs
    .filter((r) => {
      const mt = r.mediaType.toLowerCase();
      if (mt.includes("image")) return true;
      return /\.(png|jpe?g|webp|gif|bmp)$/i.test(r.relPath);
    })
    .map((r) => r.relPath.trim())
    .filter(Boolean);
}
