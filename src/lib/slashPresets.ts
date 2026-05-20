/**
 * Slash command presets for AI-CanvasPro migration
 */

export const USER_INPUT_PLACEHOLDER = "__SLASH_INPUT__";

export type Category =
  | "人物参考"
  | "场景构图"
  | "脚本结构"
  | "信息提取"
  | "多宫格"
  | "通用";

export const CATEGORIES: Category[] = [
  "人物参考",
  "场景构图",
  "脚本结构",
  "信息提取",
  "多宫格",
  "通用",
];

export interface SlashPreset {
  id: string;
  title: string;
  desc: string;
  icon: string;
  template: string;
  category: Category;
  nodeTypes?: string[];
  isCustom: boolean;
  createdAt: number;
}

export interface PresetUsageStats {
  [presetId: string]: number;
}

export const BUILT_IN_PRESETS: SlashPreset[] = [
  {
    id: "builtin-person-3view",
    title: "人物三视图",
    desc: "一键生成人物多视图",
    icon: "🧍",
    template: `生成角色 ${USER_INPUT_PLACEHOLDER} 的正视图、侧视图、后视图，包含站姿比例参考`,
    category: "人物参考",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-person-3view-face",
    title: "三视图+脸部",
    desc: "生成人物三视图加脸部特写，多角度展示角色",
    icon: "🧍",
    template: `生成角色 ${USER_INPUT_PLACEHOLDER} 的全身三视图 + 脸部特写，多角度展示`,
    category: "人物参考",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-person-analysis",
    title: "人设解析图",
    desc: "生成角色人设解析图，包含多视角和细节拆解",
    icon: "🧍",
    template: `生成角色 ${USER_INPUT_PLACEHOLDER} 的人设解析图，包含正视图、侧视图、背视图、细节拆解`,
    category: "人物参考",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-scene-reference",
    title: "场景参考图",
    desc: "生成场景参考图，包含多视角展示",
    icon: "📐",
    template: `生成场景参考图，包含顶视图、正交立面图、轴测图，${USER_INPUT_PLACEHOLDER}`,
    category: "场景构图",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-grid-4",
    title: "四宫格",
    desc: "生成四宫格连贯剧情分镜图",
    icon: "🟦",
    template: `生成一张无缝的四宫格（2x2）连贯剧情分镜图，${USER_INPUT_PLACEHOLDER}`,
    category: "多宫格",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-grid-9",
    title: "九宫格",
    desc: "生成九宫格连贯剧情分镜图（多机位）",
    icon: "🟦",
    template: `生成一张无缝的九宫格（3x3）多机位连贯剧情分镜图，${USER_INPUT_PLACEHOLDER}`,
    category: "多宫格",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-grid-25",
    title: "25宫格分镜",
    desc: "LibTV：25 宫格连贯分镜推演",
    icon: "🟦",
    template: `生成一张 5x5 共 25 格的连贯分镜推演图，按时间顺序叙事，${USER_INPUT_PLACEHOLDER}`,
    category: "多宫格",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-plot-4",
    title: "剧情四宫格",
    desc: "LibTV：剧情推演四宫格",
    icon: "🟦",
    template: `生成剧情推演四宫格（2x2），展示起承转合，${USER_INPUT_PLACEHOLDER}`,
    category: "多宫格",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-cinematic-light",
    title: "电影级光影",
    desc: "LibTV：电影级光影矫正描述",
    icon: "📐",
    template: `电影级光影矫正，统一主光方向与色温，层次丰富，${USER_INPUT_PLACEHOLDER}`,
    category: "场景构图",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-grid-16",
    title: "十六宫格",
    desc: "生成十六宫格连贯剧情分镜图",
    icon: "🟦",
    template: `生成一张无缝的十六宫格（4x4）连贯剧情分镜图，${USER_INPUT_PLACEHOLDER}`,
    category: "多宫格",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-storyboard-v1",
    title: "叙事分镜脚本-v1",
    desc: "影视级叙事分镜脚本生成",
    icon: "🎬",
    template: `影视级叙事分镜脚本，包含以下要素：${USER_INPUT_PLACEHOLDER}`,
    category: "脚本结构",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-storyboard-sec",
    title: "秒级分镜脚本",
    desc: "生成秒级分镜脚本，每镜标注详细",
    icon: "🎬",
    template: `生成秒级分镜脚本，每镜标注序号、时长、景别、画面描述、台词、音效，${USER_INPUT_PLACEHOLDER}`,
    category: "脚本结构",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-extract-info",
    title: "提取信息",
    desc: "从文本中提取人物、场景、道具、动作信息",
    icon: "📝",
    template: `从以下文本中提取人物、场景、道具、动作信息：${USER_INPUT_PLACEHOLDER}`,
    category: "信息提取",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-summarize",
    title: "长篇精缩",
    desc: "将长篇内容精缩成短篇，保留核心信息",
    icon: "📝",
    template: `将以下长篇内容精缩成短篇，保留核心信息：${USER_INPUT_PLACEHOLDER}`,
    category: "信息提取",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-continue",
    title: "通用续写",
    desc: "基于内容续写，要求风格一致",
    icon: "✏️",
    template: `基于以下内容续写，要求风格一致：${USER_INPUT_PLACEHOLDER}`,
    category: "通用",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-panorama",
    title: "全景",
    desc: "生成宽画幅全景画面",
    icon: "🌄",
    template: `生成宽画幅全景画面，环境完整、透视自然，${USER_INPUT_PLACEHOLDER}`,
    category: "通用",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-multi-angle",
    title: "多角度",
    desc: "同主体多角度展示",
    icon: "🔄",
    template: `同主体多角度展示（正面、侧面、俯视、仰视），${USER_INPUT_PLACEHOLDER}`,
    category: "通用",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-grid-9-multicam",
    title: "多机位九宫格",
    desc: "多机位视角九宫格分镜",
    icon: "🟦",
    template: `生成多机位视角的无缝九宫格（3x3）分镜图，${USER_INPUT_PLACEHOLDER}`,
    category: "多宫格",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-product-3view",
    title: "产品三视图",
    desc: "产品正视、侧视、顶视",
    icon: "📦",
    template: `生成产品的正视图、侧视图、顶视图三视图，${USER_INPUT_PLACEHOLDER}`,
    category: "人物参考",
    isCustom: false,
    createdAt: 0,
  },
];