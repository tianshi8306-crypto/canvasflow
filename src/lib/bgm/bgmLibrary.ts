/** BGM 预设——按情绪/用途分类的曲目元数据 */
export type BgmPreset = {
  id: string;
  name: string;
  category: BgmCategory;
  description: string;
  /** 推荐视频类型 */
  tags: string[];
  /** 推荐 BPM 范围 */
  bpmHint?: [number, number];
};

export type BgmCategory =
  | "epic"
  | "cinematic"
  | "upbeat"
  | "chill"
  | "ambient"
  | "corporate"
  | "lo-fi"
  | "electronic"
  | "acoustic";

export const BGM_CATEGORIES: { id: BgmCategory; label: string; icon: string }[] = [
  { id: "epic", label: "史诗激昂", icon: "🔥" },
  { id: "cinematic", label: "电影叙事", icon: "🎬" },
  { id: "upbeat", label: "活力快节奏", icon: "⚡" },
  { id: "chill", label: "轻松舒缓", icon: "🌿" },
  { id: "ambient", label: "氛围意境", icon: "🌌" },
  { id: "corporate", label: "商务科技", icon: "💼" },
  { id: "lo-fi", label: "Lo-Fi 学习", icon: "🎧" },
  { id: "electronic", label: "电子合成", icon: "🎹" },
  { id: "acoustic", label: "原声民谣", icon: "🎸" },
];

export const BGM_PRESETS: BgmPreset[] = [
  // === 史诗激昂 ===
  {
    id: "epic_adventure",
    name: "冒险启程",
    category: "epic",
    description: "管弦乐开场，恢弘渐进，适合旅行/户外/挑战类视频",
    tags: ["户外", "旅行", "运动", "挑战"],
    bpmHint: [100, 130],
  },
  {
    id: "epic_victory",
    name: "胜利凯旋",
    category: "epic",
    description: "打击乐+铜管齐鸣，强力高潮，适合赛事集锦/成就展示",
    tags: ["赛事", "集锦", "成就", "电竞"],
    bpmHint: [110, 140],
  },
  {
    id: "epic_rising",
    name: "渐入佳境",
    category: "epic",
    description: "从低沉到激昂的渐进式编排，适合故事高潮/产品发布",
    tags: ["产品发布", "故事", "品牌", "宣传"],
    bpmHint: [80, 120],
  },

  // === 电影叙事 ===
  {
    id: "cinematic_piano",
    name: "钢琴叙事",
    category: "cinematic",
    description: "悠扬钢琴独奏，情感细腻，适合 Vlog/人物/文艺短片",
    tags: ["Vlog", "人物", "文艺", "情感"],
    bpmHint: [60, 90],
  },
  {
    id: "cinematic_wonder",
    name: "惊奇探索",
    category: "cinematic",
    description: "弦乐铺底+钢琴点缀，带有好奇与发现感",
    tags: ["科技", "探索", "自然", "纪录片"],
    bpmHint: [70, 100],
  },
  {
    id: "cinematic_tension",
    name: "紧张悬疑",
    category: "cinematic",
    description: "低频弦乐+电子纹理，紧凑不安，适合悬疑/惊悚/推理",
    tags: ["悬疑", "推理", "惊悚", "解说"],
    bpmHint: [90, 120],
  },

  // === 活力快节奏 ===
  {
    id: "upbeat_pop",
    name: "流行活力",
    category: "upbeat",
    description: "吉他+鼓点驱动的流行曲风，明快积极",
    tags: ["时尚", "美妆", "日常", "教程"],
    bpmHint: [100, 130],
  },
  {
    id: "upbeat_funk",
    name: "放克律动",
    category: "upbeat",
    description: "Bass 线+切分鼓，Groove 感十足，适合舞蹈/街拍",
    tags: ["舞蹈", "街拍", "派对", "潮流"],
    bpmHint: [105, 125],
  },
  {
    id: "upbeat_rock",
    name: "热血摇滚",
    category: "upbeat",
    description: "电吉他强力和弦+快速鼓点，适合运动/赛车/极限项目",
    tags: ["运动", "赛车", "极限", "游戏"],
    bpmHint: [120, 160],
  },

  // === 轻松舒缓 ===
  {
    id: "chill_acoustic",
    name: "午后原声",
    category: "chill",
    description: "木吉他扫弦，温暖放松，适合生活类/手工/美食",
    tags: ["生活", "手工", "美食", "日常"],
    bpmHint: [70, 95],
  },
  {
    id: "chill_jazz",
    name: "爵士午后",
    category: "chill",
    description: "钢琴 trio 或萨克斯旋律，慵懒优雅",
    tags: ["咖啡", "阅读", "城市", "慢生活"],
    bpmHint: [60, 90],
  },
  {
    id: "chill_rnb",
    name: "RNB 律动",
    category: "chill",
    description: "柔和电子节拍+人声切片，现代都市感",
    tags: ["都市", "夜景", "恋爱", "穿搭"],
    bpmHint: [75, 95],
  },

  // === 氛围意境 ===
  {
    id: "ambient_space",
    name: "星空漫游",
    category: "ambient",
    description: "长尾音合成器铺底，空旷深邃，适合科普/天文/冥想",
    tags: ["科普", "天文", "冥想", "太空"],
    bpmHint: [40, 70],
  },
  {
    id: "ambient_nature",
    name: "自然之声",
    category: "ambient",
    description: "环境音+轻和弦，极简温暖，适合风景/延时摄影",
    tags: ["风景", "延时", "自然", "空镜"],
    bpmHint: [50, 80],
  },
  {
    id: "ambient_dream",
    name: "梦境边缘",
    category: "ambient",
    description: "混合电子+反向混响，迷幻飘渺，适合创意/视觉艺术",
    tags: ["创意", "视觉", "艺术", "迷幻"],
    bpmHint: [50, 80],
  },

  // === 商务科技 ===
  {
    id: "corporate_inspire",
    name: "激励启程",
    category: "corporate",
    description: "钢琴+弦乐+轻打击，温暖专业，适合企业宣传/产品介绍",
    tags: ["企业", "产品", "介绍", "培训"],
    bpmHint: [90, 120],
  },
  {
    id: "corporate_tech",
    name: "科技脉动",
    category: "corporate",
    description: "电子合成器琶音+脉冲贝斯，现代科技感",
    tags: ["科技", "AI", "数据", "软件"],
    bpmHint: [100, 130],
  },
  {
    id: "corporate_minimal",
    name: "极简商务",
    category: "corporate",
    description: "干净钢琴+电子垫，留白充分，适合演讲/配音/教程",
    tags: ["演讲", "教程", "配音", "金融"],
    bpmHint: [70, 100],
  },

  // === Lo-Fi ===
  {
    id: "lofi_study",
    name: "学习时光",
    category: "lo-fi",
    description: "经典 Lo-Fi 节拍+钢琴旋律，柔和循环",
    tags: ["学习", "工作", "背景", "长视频"],
    bpmHint: [70, 90],
  },
  {
    id: "lofi_rain",
    name: "雨夜书桌",
    category: "lo-fi",
    description: "Lo-Fi + 雨声环境，安静治愈",
    tags: ["安静", "治愈", "雨季", "深夜"],
    bpmHint: [65, 85],
  },

  // === 电子合成 ===
  {
    id: "electronic_synthwave",
    name: "合成波浪",
    category: "electronic",
    description: "80 年代复古合成器+重型鼓机，霓虹感十足",
    tags: ["复古", "游戏", "霓虹", "科幻"],
    bpmHint: [110, 140],
  },
  {
    id: "electronic_house",
    name: "浩室律动",
    category: "electronic",
    description: "四拍鼓+合成器 Bass，持续能量感",
    tags: ["派对", "舞曲", "时尚", "运动"],
    bpmHint: [120, 130],
  },

  // === 原声民谣 ===
  {
    id: "acoustic_folk",
    name: "田园民谣",
    category: "acoustic",
    description: "木吉他+口琴+手指鼓，质朴温暖",
    tags: ["田园", "乡村", "旅行", "纪实"],
    bpmHint: [80, 110],
  },
  {
    id: "acoustic_uke",
    name: "尤克里里",
    category: "acoustic",
    description: "尤克里里扫弦，轻快活泼，适合亲子/宠物/搞笑",
    tags: ["亲子", "宠物", "搞笑", "可爱"],
    bpmHint: [90, 120],
  },
];

/** 按分类获取预设 */
export function getPresetsByCategory(category: BgmCategory): BgmPreset[] {
  return BGM_PRESETS.filter((p) => p.category === category);
}

/** 按 id 查找预设 */
export function getPresetById(id: string): BgmPreset | undefined {
  return BGM_PRESETS.find((p) => p.id === id);
}

/** 按标签搜索预设 */
export function searchPresetsByTag(keyword: string): BgmPreset[] {
  const kw = keyword.toLowerCase();
  return BGM_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(kw) ||
      p.description.toLowerCase().includes(kw) ||
      p.tags.some((t) => t.toLowerCase().includes(kw)),
  );
}
