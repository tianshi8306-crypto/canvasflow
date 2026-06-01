/**
 * Seedance @语法适配层
 *
 * 解析 prompt 中的 @引用：
 * - @图片N、@视频N、@声音N（N = 生成面板参考条顺序）
 * - @图N、@音频N（旧版按类型计数，仍兼容）
 * - @素材名（名称形式，自动识别类型）
 *
 * 将引用替换为描述性文字，并提取对应的 asset 路径。
 */

/** @引用类型 */
export type AtReferenceKind = "image" | "video" | "audio";

/** 解析出的 @引用项 */
export interface ParsedAtReference {
  kind: AtReferenceKind;
  index: number; // 1-based（索引形式）
  name?: string; // 名称（名称形式）
  fullMatch: string; // 原始匹配文本，如 "@图1" 或 "@女孩.png"
  startIndex: number;
  endIndex: number;
}

/** 素材名称映射 */
export interface NamedAsset {
  name: string;
  path: string;
  kind: "image" | "video" | "audio";
  /** 无扩展名简称、源节点标签等，用于强制匹配连线素材 */
  aliases?: string[];
}

export function assetFileBaseName(pathOrName: string): string {
  return pathOrName.split(/[/\\]/).pop()?.trim() ?? "";
}

export function assetNameStem(name: string): string {
  const base = assetFileBaseName(name);
  return base.replace(/\.[^.]+$/, "");
}

function spansOverlap(start: number, end: number, ref: ParsedAtReference): boolean {
  return start < ref.endIndex && end > ref.startIndex;
}

/** @图片N：N 为参考条顺序（与面板缩略图序号一致） */
const AT_IMAGE_REGEX = /@图片(\d+)/g;
const AT_VIDEO_REGEX = /@视频(\d+)/g;
const AT_AUDIO_REGEX = /@声音(\d+)/g;
/** 旧版 @图N / @音频N：按类型内序号（无 panelOrder 时回退） */
const AT_IMAGE_LEGACY_REGEX = /@图(\d+)/g;
const AT_AUDIO_LEGACY_REGEX = /@音频(\d+)/g;
/** @素材名 正则：匹配 @文件名（允许扩展名中的 `.`） */
const AT_NAMED_REGEX = /@([^\s，。！？!?,。"'\n]+)/g;

/** LibTV / 分镜导出：{{Portrait 4}}、{{mixed 5}} 等 */
const BRACE_REF_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g;

function parseBraceRefInner(inner: string): { kind: AtReferenceKind; index: number } | null {
  const t = inner.trim();
  let m: RegExpExecArray | null;
  if ((m = /^portrait\s*(\d+)$/i.exec(t))) return { kind: "image", index: parseInt(m[1], 10) };
  if ((m = /^mixed\s*(\d+)$/i.exec(t))) return { kind: "image", index: parseInt(m[1], 10) };
  if ((m = /^图片\s*(\d+)$/.exec(t))) return { kind: "image", index: parseInt(m[1], 10) };
  if ((m = /^图\s*(\d+)$/.exec(t))) return { kind: "image", index: parseInt(m[1], 10) };
  if ((m = /^视频\s*(\d+)$/.exec(t))) return { kind: "video", index: parseInt(m[1], 10) };
  if ((m = /^声音\s*(\d+)$/.exec(t))) return { kind: "audio", index: parseInt(m[1], 10) };
  return null;
}

function parseBraceReferences(prompt: string): ParsedAtReference[] {
  const refs: ParsedAtReference[] = [];
  BRACE_REF_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BRACE_REF_REGEX.exec(prompt)) !== null) {
    const parsed = parseBraceRefInner(match[1]);
    if (!parsed || parsed.index < 1) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (refs.some((r) => spansOverlap(start, end, r))) continue;
    refs.push({
      kind: parsed.kind,
      index: parsed.index,
      fullMatch: match[0],
      startIndex: start,
      endIndex: end,
    });
  }
  return refs;
}

/** 参考条序号 token：@图片N / @文本N 或 {{Portrait N}} / {{mixed N}} */
export function isPanelOrderReferenceToken(fullMatch: string): boolean {
  if (
    /^@图片\d+$/.test(fullMatch) ||
    /^@视频\d+$/.test(fullMatch) ||
    /^@声音\d+$/.test(fullMatch) ||
    /^@文本\d+$/.test(fullMatch)
  ) {
    return true;
  }
  const brace = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(fullMatch.trim());
  if (!brace) return false;
  return parseBraceRefInner(brace[1]) !== null;
}

/**
 * 从名称推断素材类型
 */
function inferKindFromName(name: string): "image" | "video" | "audio" | null {
  const lower = name.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp)$/.test(lower)) return "image";
  if (/\.(mp4|mov|avi|mkv)$/.test(lower)) return "video";
  if (/\.(mp3|wav|ogg|aac|flac)$/.test(lower)) return "audio";
  return null;
}

function resolveNamedRefKind(
  name: string,
  namedAssets?: NamedAsset[],
): AtReferenceKind | null {
  const fromExt = inferKindFromName(name);
  if (fromExt) return fromExt;
  if (!namedAssets?.length) return null;
  const asset = findAssetByName(name, namedAssets);
  return asset?.kind ?? null;
}

/**
 * 解析 prompt 中的所有 @引用（支持索引和名称两种形式）
 * @param namedAssets 传入时，@名称 可匹配连线素材（含无扩展名、节点标签）
 */
export function parseAtReferences(prompt: string, namedAssets?: NamedAsset[]): ParsedAtReference[] {
  const refs: ParsedAtReference[] = [];
  let match: RegExpExecArray | null;

  const pushIndexed = (
    regex: RegExp,
    kind: AtReferenceKind,
  ) => {
    regex.lastIndex = 0;
    while ((match = regex.exec(prompt)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (refs.some((r) => spansOverlap(start, end, r))) continue;
      refs.push({
        kind,
        index: parseInt(match[1], 10),
        fullMatch: match[0],
        startIndex: start,
        endIndex: end,
      });
    }
  };

  pushIndexed(AT_IMAGE_REGEX, "image");
  pushIndexed(AT_VIDEO_REGEX, "video");
  pushIndexed(AT_AUDIO_REGEX, "audio");

  pushIndexed(AT_IMAGE_LEGACY_REGEX, "image");
  pushIndexed(AT_AUDIO_LEGACY_REGEX, "audio");

  // 解析 @素材名（按名称引用）
  AT_NAMED_REGEX.lastIndex = 0;
  while ((match = AT_NAMED_REGEX.exec(prompt)) !== null) {
    const name = match[1];
    if (
      /^图片\d+$/.test(name) ||
      /^图\d+$/.test(name) ||
      /^视频\d+$/.test(name) ||
      /^声音\d+$/.test(name) ||
      /^音频\d+$/.test(name)
    ) {
      continue;
    }
    const start = match.index;
    const end = start + match[0].length;
    if (refs.some((r) => spansOverlap(start, end, r))) continue;

    const kind = resolveNamedRefKind(name, namedAssets);
    if (!kind) continue;

    refs.push({
      kind,
      index: 0,
      name,
      fullMatch: match[0],
      startIndex: start,
      endIndex: end,
    });
  }

  for (const ref of parseBraceReferences(prompt)) {
    if (refs.some((r) => spansOverlap(ref.startIndex, ref.endIndex, r))) continue;
    refs.push(ref);
  }

  return refs;
}

/**
 * 获取引用类型的描述文字
 * 格式：@{type}#{index}:{filename}
 * 例如：@image#1:image.png
 */
function getRefRoleLabel(kind: "image" | "video" | "audio", index: number, name?: string): string {
  if (name) {
    // 名称形式：保留素材名作为描述
    return name;
  }
  switch (kind) {
    case "image": {
      // 提取文件名（如果有路径的话）
      const fileName = index > 0 ? `image.png` : `image.png`;
      return `@image#${index}:${fileName}`;
    }
    case "video":
      return `@video#${index}:video.mp4`;
    case "audio":
      return `@audio#${index}:audio.mp3`;
  }
}

/**
 * 替换 prompt 中的 @引用为描述文字
 */
function replaceAtRefs(prompt: string, refs: ParsedAtReference[]): string {
  // 按 startIndex 降序排列，避免替换后位置偏移
  const sortedRefs = [...refs].sort((a, b) => b.startIndex - a.startIndex);

  let result = prompt;
  for (const ref of sortedRefs) {
    const label = getRefRoleLabel(ref.kind, ref.index, ref.name);
    result = result.slice(0, ref.startIndex) + label + result.slice(ref.endIndex);
  }

  return result;
}

/**
 * 按名称查找素材
 */
function assetNameMatchesQuery(asset: NamedAsset, query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (asset.name === q) return true;

  const qStem = assetNameStem(q);
  const aStem = assetNameStem(asset.name);
  if (qStem && (aStem === qStem || asset.name === qStem || q === aStem)) return true;

  return (asset.aliases ?? []).some((alias) => {
    const aliasTrim = alias.trim();
    if (!aliasTrim) return false;
    if (aliasTrim === q) return true;
    const aliasStem = assetNameStem(aliasTrim);
    return aliasStem === q || aliasStem === qStem || aliasTrim === qStem;
  });
}

/** 按文件名、无扩展名简称、aliases（如源节点标签）匹配连线素材 */
export function findAssetByName(name: string, namedAssets: NamedAsset[]): NamedAsset | undefined {
  return namedAssets.find((a) => assetNameMatchesQuery(a, name));
}

/**
 * 构建 Seedance API 的 prompt 和引用资产
 *
 * @param prompt - 原始 prompt（可能包含 @图N、@视频N、@音频N 或 @素材名 引用）
 * @param assetPaths - 所有可引用的资产路径（按引用索引顺序排列，索引形式使用）
 * @param namedAssets - 名称映射列表（名称形式使用）
 * @returns 解析后的 prompt 和分类的引用资产
 */
export function buildSeedancePrompt(
  prompt: string,
  assetPaths: string[],
  namedAssets?: NamedAsset[],
): {
  expandedPrompt: string;
  imagePaths: string[];
  videoPaths: string[];
  audioPaths: string[];
} {
  const refs = parseAtReferences(prompt, namedAssets);
  const expandedPrompt = replaceAtRefs(prompt, refs);

  // 按引用索引分组
  const imageRefs: { index: number; path: string }[] = [];
  const videoRefs: { index: number; path: string }[] = [];
  const audioRefs: { index: number; path: string }[] = [];

  for (const ref of refs) {
    if (ref.name && namedAssets) {
      // 名称形式：从 namedAssets 查找
      const asset = findAssetByName(ref.name, namedAssets);
      if (asset) {
        switch (ref.kind) {
          case "image":
            imageRefs.push({ index: ref.index, path: asset.path });
            break;
          case "video":
            videoRefs.push({ index: ref.index, path: asset.path });
            break;
          case "audio":
            audioRefs.push({ index: ref.index, path: asset.path });
            break;
        }
      } else {
        console.warn(`[Seedance] 未找到素材: ${ref.name}`);
      }
    } else {
      // 索引形式：从 assetPaths 查找
      const assetIndex = ref.index - 1;
      if (assetIndex < 0 || assetIndex >= assetPaths.length) {
        console.warn(`[Seedance] @引用索引 ${ref.index} 超出范围`);
        continue;
      }
      const assetPath = assetPaths[assetIndex];

      switch (ref.kind) {
        case "image":
          imageRefs.push({ index: ref.index, path: assetPath });
          break;
        case "video":
          videoRefs.push({ index: ref.index, path: assetPath });
          break;
        case "audio":
          audioRefs.push({ index: ref.index, path: assetPath });
          break;
      }
    }
  }

  return {
    expandedPrompt,
    imagePaths: imageRefs.map((r) => r.path),
    videoPaths: videoRefs.map((r) => r.path),
    audioPaths: audioRefs.map((r) => r.path),
  };
}

/**
 * 简化版本：根据路径列表构建 Seedance prompt
 *
 * @param prompt - 原始 prompt（可能包含 @引用）
 * @param imagePaths - 参考图片路径列表（按 @图1、@图2 顺序）
 * @param videoPaths - 参考视频路径列表（按 @视频1、@视频2 顺序）
 * @param audioPaths - 参考音频路径列表（按 @音频1、@音频2 顺序）
 */
function pushUnique(list: string[], path: string) {
  if (path && !list.includes(path)) list.push(path);
}

function isPanelOrderSlotToken(fullMatch: string): boolean {
  return isPanelOrderReferenceToken(fullMatch);
}

/** prompt 含 @ 引用时，仅收集被点名的路径（索引 + 文件名） */
export type PanelOrderedRef = {
  slot: number;
  kind: AtReferenceKind;
  path: string;
};

function collectAtRefPaths(
  refs: ParsedAtReference[],
  imagePaths: string[],
  videoPaths: string[],
  audioPaths: string[],
  namedAssets?: NamedAsset[],
  panelOrder?: PanelOrderedRef[],
): { imagePaths: string[]; videoPaths: string[]; audioPaths: string[] } | null {
  const active = refs.filter(
    (r) => (!r.name && r.index > 0) || (r.name && namedAssets && namedAssets.length > 0),
  );
  if (active.length === 0) return null;

  const images: string[] = [];
  const videos: string[] = [];
  const audios: string[] = [];

  for (const ref of active) {
    if (ref.name && namedAssets) {
      const asset = findAssetByName(ref.name, namedAssets);
      if (!asset) continue;
      switch (asset.kind) {
        case "image":
          pushUnique(images, asset.path);
          break;
        case "video":
          pushUnique(videos, asset.path);
          break;
        case "audio":
          pushUnique(audios, asset.path);
          break;
      }
      continue;
    }
    if (panelOrder?.length && isPanelOrderSlotToken(ref.fullMatch)) {
      const panelHit = panelOrder.find(
        (p) => p.slot === ref.index && p.kind === ref.kind,
      );
      if (panelHit?.path) {
        switch (panelHit.kind) {
          case "image":
            pushUnique(images, panelHit.path);
            break;
          case "video":
            pushUnique(videos, panelHit.path);
            break;
          case "audio":
            pushUnique(audios, panelHit.path);
            break;
        }
      }
      continue;
    }

    const idx = ref.index - 1;
    switch (ref.kind) {
      case "image": {
        const path = imagePaths[idx];
        if (path) pushUnique(images, path);
        break;
      }
      case "video": {
        const path = videoPaths[idx];
        if (path) pushUnique(videos, path);
        break;
      }
      case "audio": {
        const path = audioPaths[idx];
        if (path) pushUnique(audios, path);
        break;
      }
    }
  }

  return { imagePaths: images, videoPaths: videos, audioPaths: audios };
}

export function buildSeedancePromptSimple(
  prompt: string,
  imagePaths?: string[],
  videoPaths?: string[],
  audioPaths?: string[],
  namedAssets?: NamedAsset[],
  panelOrder?: PanelOrderedRef[],
): {
  expandedPrompt: string;
  imagePaths: string[];
  videoPaths: string[];
  audioPaths: string[];
} {
  const refs = parseAtReferences(prompt, namedAssets);
  const expandedPrompt = replaceAtRefs(prompt, refs);

  const imgs = imagePaths ?? [];
  const vids = videoPaths ?? [];
  const auds = audioPaths ?? [];
  const fromRefs = collectAtRefPaths(refs, imgs, vids, auds, namedAssets, panelOrder);

  if (fromRefs) {
    return {
      expandedPrompt,
      imagePaths: fromRefs.imagePaths,
      videoPaths: fromRefs.videoPaths,
      audioPaths: fromRefs.audioPaths,
    };
  }

  return {
    expandedPrompt,
    imagePaths: imgs,
    videoPaths: vids,
    audioPaths: auds,
  };
}
