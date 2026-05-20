/**
 * AI 服务提供商（Provider）元数据抽象层
 * 参考 AI CanvasPro: src/modules/providers.js
 *
 * 所有 AI 厂商的 ID、名称、默认 URL、Logo 等元数据在此定义，
 * 供配置读取、连接测试、UI 渲染等模块统一使用。
 */

/** Provider 唯一标识符 */
export type ProviderId =
  | "openai"
  | "grsai"
  | "ppio"
  | "apimart"
  | "runninghub"
  | "runninghubwf"
  | "dreamina"
  | "aicanvas";

export interface ProviderMeta {
  id: ProviderId;
  /** 显示名称 */
  label: string;
  /** 默认 API Base URL */
  defaultUrl: string;
  /** Logo 图片路径（null 表示使用文字徽章） */
  logoPath: string | null;
  /** 是否支持双 Key（apiKey + modelApiKey） */
  supportsModelKey: boolean;
  /** 是否需要 OAuth 登录流程 */
  needsOAuth: boolean;
  /** 获取 Key 的外链地址 */
  getKeyUrl: string | null;
}

/**
 * 厂商元数据表
 * 注意：dreamina (即梦) 需要 OAuth 登录，aicanvas 为前端占位
 */
export const PROVIDERS_META: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultUrl: "https://api.openai.com",
    logoPath: null,
    supportsModelKey: false,
    needsOAuth: false,
    getKeyUrl: "https://platform.openai.com/api-keys",
  },
  grsai: {
    id: "grsai",
    label: "GRSAI",
    defaultUrl: "https://grsai.dakka.com.cn",
    logoPath: null,
    supportsModelKey: false,
    needsOAuth: false,
    getKeyUrl: "https://grsai.com/zh/dashboard/user-info",
  },
  ppio: {
    id: "ppio",
    label: "派欧云 (PPIO)",
    defaultUrl: "https://api.ppio.com",
    logoPath: null,
    supportsModelKey: false,
    needsOAuth: false,
    getKeyUrl: "https://ppio.com/user/register?invited_by=SF4VL3",
  },
  apimart: {
    id: "apimart",
    label: "APIMart",
    defaultUrl: "https://api.apimart.ai",
    logoPath: null,
    supportsModelKey: false,
    needsOAuth: false,
    getKeyUrl: "https://apimart.ai/zh/register?aff=ashuoai",
  },
  runninghub: {
    id: "runninghub",
    label: "RunningHUB",
    defaultUrl: "https://www.runninghub.cn",
    logoPath: null,
    supportsModelKey: true,
    needsOAuth: false,
    getKeyUrl: "https://www.runninghub.cn/?inviteCode=rh-v1312",
  },
  runninghubwf: {
    id: "runninghubwf",
    label: "RunningHUB 工作流",
    defaultUrl: "https://www.runninghub.cn",
    logoPath: null,
    supportsModelKey: true,
    needsOAuth: false,
    getKeyUrl: "https://www.runninghub.cn/?inviteCode=rh-v1312",
  },
  dreamina: {
    id: "dreamina",
    label: "即梦",
    defaultUrl: "",
    logoPath: null,
    supportsModelKey: false,
    needsOAuth: true,
    getKeyUrl: null, // 通过 OAuth 登录获取
  },
  aicanvas: {
    id: "aicanvas",
    label: "本地模型",
    defaultUrl: "",
    logoPath: null,
    supportsModelKey: false,
    needsOAuth: false,
    getKeyUrl: null,
  },
};

/** 获取所有 Provider ID 列表 */
export function getAllProviderIds(): ProviderId[] {
  return Object.keys(PROVIDERS_META) as ProviderId[];
}

/** 根据 ID 获取 Provider 元数据 */
export function getProviderMeta(id: string): ProviderMeta | undefined {
  return PROVIDERS_META[id as ProviderId];
}

/** 模型 ID → 中文显示名 映射表（来自 AI CanvasPro providers.js） */
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "minimax/minimax-m2.5-highspeed": "MiniMax M2.5-highspeed",
  "qwen/qwen3.5-397b-a17b": "Qwen3.5-397B-A17B",
  "deepseek/deepseek-v3.2": "DeepSeek-V3.2",
  "moonshotai/kimi-k2.5": "Kimi K2.5",
  "ppio/seedream-5.0-lite": "Seedream 图片生成 5.0 lite",
  "ppio/seedream-4.5": "即梦 4.5",
  "ppio/seedream-4.0": "Seedream 图片生成 4.0",
  "apimart/deepseek-v3.2": "DeepSeek-V3.2",
  "apimart/gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview",
  "apimart/gemini-3-flash-preview-nothinking": "Gemini 3 Flash (No Thinking)",
  "apimart/nano-banana-2": "Nano Banana 2",
  "apimart/nano-banana-pro": "Nano Banana Pro",
  "apimart/nano-banana-dot": "Nano Banana .",
  "apimart/gpt-image-2": "GPT image 2",
  "grsai/gpt-image-2": "GPT image 2",
  "grsai/gpt-image-2-vip": "GPT image 2",
  "gpt-image-2": "GPT image 2",
  "gpt-image-2-vip": "GPT image 2",
  "nano-banana": "NanoBanana",
  "nano-banana-fast": "Nanobanana",
  "nano-banana-pro": "NanobananaPRO",
  "nano-banana-pro-vt": "NanobananaPRO",
  "nano-banana-pro-cl": "NanobananaPRO",
  "nano-banana-pro-vip": "NanobananaPRO",
  "nano-banana-pro-4k-vip": "NanobananaPRO",
  "nano-banana-2": "Nanobanana2",
  "nano-banana-2-cl": "Nanobanana2",
  "nano-banana-2-4k-cl": "Nanobanana2",
  "apimart/seedream-4.0": "即梦 3.0",
  "apimart/seedream-4.5": "Seedream 4.5",
  "apimart/seedream-5.0-lite": "Seedream 5.0 Lite",
  "apimart/gpt-5.4": "GPT-5.4",
  "seedance-2.0-fast": "即梦 Seedance 2.0 Fast",
  "seedance-2.0": "即梦 Seedance 2.0",
  "runninghub-model/rhart-image-v1": "漫画转真人",
  "runninghub-model/rhart-image-v1-official": "漫画转真人",
  "runninghub-model/rhart-image-n-pro": "人物替换图片编辑V3",
  "runninghub-model/rhart-image-n-pro-official": "人物替换图片编辑V3",
  "runninghub-model/rhart-image-n-g31-flash": "Nanobanana2",
  "runninghub-model/rhart-image-n-g31-flash-official": "Banana2",
  "runninghub-model/rhart-image-g-2": "GPT image 2",
  "runninghub-model/rhart-image-g-2-official": "GPT image 2",
  "runninghub-model/seedream-v4": "Seedream V4",
  "runninghub-model/seedream-v4.5": "Seedream V4.5",
  "runninghub-model/seedream-v5-lite": "Seedream V5 Lite",
  "runninghub-model/rhart-text-g-3-flash-preview-cv/image-to-text": "AICanvas Text Lite",
  "runninghub-model/rhart-text-g-3-pro-preview-cv/image-to-text": "AICanvas Text Pro",
  "aicanvas/text-lite": "AICanvas Text Lite",
  "aicanvas/text-pro": "AICanvas Text Pro",
  "aicanvas/image-lite": "AICanvas Image Lite",
  "aicanvas/image-pro": "AICanvas Image Pro",
  "runninghub/1971148165531475969": "视频编辑-基础版",
  "runninghub/2041741496667348994": "视频对口型",
  "runninghub/2039336644536442882": "即梦 图生图",
  "runninghub/2048498452966940673": "即梦4.0",
  "runninghub/2041177685895946242": "即梦 3.0",
  "runninghub/2037743729716498433": "即梦 3.0",
  "runninghub/2050313968069165058": "人物替换人物替换V2.1",
  "runninghub/1994711386552999938": "人物替换图片编辑V3",
  "runninghub/1994718111704158209": "人物替换图片编辑V3",
  "runninghub/2050306122774532097": "即梦 Seedance 2.0",
  "runninghub/video_matting": "视频抠像",
  "dreamina/text2image": "即梦 文生图",
  "dreamina/image2image": "即梦 图生图",
  "dreamina/4.0": "即梦 4.0",
  "dreamina/4.1": "即梦4.1",
  "dreamina/4.5": "即梦4.5",
  "dreamina/5.0": "即梦5.0",
  "dreamina/text2video": "即梦 文生视频",
  "dreamina/image2video": "即梦 图生视频",
  "dreamina/seedance2.0fast": "即梦 Seedance 2.0 Fast",
  "dreamina/seedance2.0": "即梦 Seedance 2.0",
  "dreamina/seedance2.0_vip": "即梦 Seedance 2.0 VIP",
  "dreamina/seedance2.0fast_vip": "即梦 Seedance 2.0 Fast VIP",
  "dreamina/3.0": "即梦 3.0",
  "dreamina/3.0fast": "即梦 3.0 Fast",
  "dreamina/3.0pro": "即梦 3.0 Pro",
  "dreamina/3.5pro": "即梦 3.5 Pro",
};

/**
 * 根据模型 ID 获取中文显示名
 * @param modelId 模型 ID 字符串
 */
export function getDisplayModelName(modelId: string): string {
  if (!modelId) return "";
  return MODEL_DISPLAY_NAMES[modelId] || modelId;
}

/** 需要连接测试的 Provider ID 列表（按优先级） */
export const DEFAULT_PROVIDER_TEST_IDS: ProviderId[] = [
  "apimart",
  "openai",
  "ppio",
  "grsai",
  "runninghub",
];

/** 需要加密存储的 Provider ID 列表（包含所有提供商的 apiKey 和 modelApiKey 字段） */
export const SECURE_PROVIDER_FIELDS = ["apiKey", "modelApiKey"] as const;

/** 默认需要安全存储的 Provider IDs */
export const DEFAULT_SECURE_PROVIDER_IDS: ProviderId[] = [
  ...getAllProviderIds(),
  "openai",
  "ppio",
  "apimart",
  "runninghub",
  "aicanvas",
];