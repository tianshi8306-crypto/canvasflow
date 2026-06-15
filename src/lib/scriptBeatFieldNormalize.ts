import scriptEnums from "@/shared/config/script-enums.json";

const SHOT_TYPES = scriptEnums.shotType as string[];
const CAMERA_MOVES = scriptEnums.cameraMove as string[];
const DIALOGUE_TYPES = scriptEnums.dialogueType as string[];
const BGM_MOODS = scriptEnums.bgmMood as string[];

/** 规则引擎细粒度运镜 → 工作台枚举 */
export function normalizeCameraMove(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (CAMERA_MOVES.includes(t)) return t;
  if (t.includes("跟")) return "跟";
  if (t.includes("推")) return "推";
  if (t.includes("拉")) return "拉";
  if (t.includes("摇")) return "摇";
  if (t.includes("移") || t.includes("横移")) return "移";
  if (t.includes("环绕")) return "环绕";
  if (t.includes("固定") || t === "无") return "固定";
  return t;
}

/** 规则景别 → 枚举（中近景等映射到最接近项） */
export function normalizeShotSize(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (SHOT_TYPES.includes(t)) return t;
  if (t.includes("黑场")) return "全景";
  if (t.includes("大特写")) return "大特写";
  if (t.includes("特写")) return "特写";
  if (t.includes("中近景") || t.includes("中景")) return "中景";
  if (t.includes("全景")) return "全景";
  if (t.includes("近景")) return "近景";
  if (t.includes("主观")) return "特写";
  return t;
}

export const SHOT_TYPE_OPTIONS = SHOT_TYPES;
export const DIALOGUE_TYPE_OPTIONS = DIALOGUE_TYPES;
export const BGM_MOOD_OPTIONS = BGM_MOODS;
