/**
 * Seedance @语法适配层
 *
 * 解析 prompt 中的 @引用：
 * - @图N、@视频N、@音频N（索引形式）
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
}

/** @图N 正则：匹配 @图1、@图2 等 */
const AT_IMAGE_REGEX = /@图(\d+)/g;
/** @视频N 正则：匹配 @视频1、@视频2 等 */
const AT_VIDEO_REGEX = /@视频(\d+)/g;
/** @音频N 正则：匹配 @音频1、@音频2 等 */
const AT_AUDIO_REGEX = /@音频(\d+)/g;
/** @素材名 正则：匹配 @任意名称（不含空格），如 @女孩.png、@背景音乐 */
const AT_NAMED_REGEX = /@([^\s，。！？!?,."']+)/g;

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

/**
 * 解析 prompt 中的所有 @引用（支持索引和名称两种形式）
 */
export function parseAtReferences(prompt: string): ParsedAtReference[] {
  const refs: ParsedAtReference[] = [];
  let match: RegExpExecArray | null;

  // 解析 @图N
  AT_IMAGE_REGEX.lastIndex = 0;
  while ((match = AT_IMAGE_REGEX.exec(prompt)) !== null) {
    refs.push({
      kind: "image",
      index: parseInt(match[1], 10),
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // 解析 @视频N
  AT_VIDEO_REGEX.lastIndex = 0;
  while ((match = AT_VIDEO_REGEX.exec(prompt)) !== null) {
    refs.push({
      kind: "video",
      index: parseInt(match[1], 10),
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // 解析 @音频N
  AT_AUDIO_REGEX.lastIndex = 0;
  while ((match = AT_AUDIO_REGEX.exec(prompt)) !== null) {
    refs.push({
      kind: "audio",
      index: parseInt(match[1], 10),
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // 解析 @素材名（按名称引用）
  AT_NAMED_REGEX.lastIndex = 0;
  while ((match = AT_NAMED_REGEX.exec(prompt)) !== null) {
    const name = match[1];
    // 跳过已经是 @图N/@视频N/@音频N 的情况
    if (/^图\d+$/.test(name) || /^视频\d+$/.test(name) || /^音频\d+$/.test(name)) {
      continue;
    }
    const kind = inferKindFromName(name);
    if (kind) {
      refs.push({
        kind,
        index: 0, // 名称形式没有索引
        name,
        fullMatch: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
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
function findAssetByName(name: string, namedAssets: NamedAsset[]): NamedAsset | undefined {
  // 精确匹配
  const exact = namedAssets.find((a) => a.name === name);
  if (exact) return exact;
  // 去除扩展名后匹配
  const nameWithoutExt = name.replace(/\.[^.]+$/, "");
  return namedAssets.find((a) => {
    const aName = a.name.replace(/\.[^.]+$/, "");
    return aName === nameWithoutExt;
  });
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
  const refs = parseAtReferences(prompt);
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
export function buildSeedancePromptSimple(
  prompt: string,
  imagePaths?: string[],
  videoPaths?: string[],
  audioPaths?: string[],
): {
  expandedPrompt: string;
  imagePaths: string[];
  videoPaths: string[];
  audioPaths: string[];
} {
  const refs = parseAtReferences(prompt);
  const expandedPrompt = replaceAtRefs(prompt, refs);

  return {
    expandedPrompt,
    imagePaths: imagePaths ?? [],
    videoPaths: videoPaths ?? [],
    audioPaths: audioPaths ?? [],
  };
}
