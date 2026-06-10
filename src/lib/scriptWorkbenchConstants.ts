import type { ScriptBeat } from "@/lib/types";
import scriptEnums from "@/shared/config/script-enums.json";
import type { ScriptTemplateItem } from "./scriptWorkbenchTypes";

export const EMOTION_OPTIONS = scriptEnums.emotion;
export const CAMERA_MOVE_OPTIONS = scriptEnums.cameraMove;
export const CAMERA_MOVE_PRESETS = ["固定机位", "推镜", "拉镜", "摇镜", "跟拍"];

export const BATCH_PRESETS_STORAGE_KEY = "scriptWorkbench.batchPresets.v1";
export const BATCH_FAV_MAX = 5;

export const SCRIPT_TEMPLATES_STORAGE_KEY = "scriptWorkbench.templates.v1";
export const SCRIPT_TEMPLATE_MAX = 30;
export const TEMPLATE_STYLE_OPTIONS = [
  { value: "all", label: "全部风格" },
  { value: "shortDrama", label: "短剧" },
  { value: "film", label: "电影" },
  { value: "anime", label: "动漫" },
  { value: "ad", label: "广告" },
  { value: "general", label: "通用" },
] as const;

export const PRESET_TEMPLATE_PACK: Array<{
  name: string;
  styleTag: ScriptTemplateItem["styleTag"];
  beats: Array<Partial<ScriptBeat>>;
}> = [
  {
    name: "预置-短剧爆款-冲突反转",
    styleTag: "shortDrama",
    beats: [
      { shotNumber: "1", durationHint: "2s", description: "女主在走廊停步，收到匿名消息，表情骤变。", dialogue: "这不可能…" },
      { shotNumber: "2", durationHint: "3s", description: "男主从阴影处走出，压低声音逼问，气氛紧绷。", dialogue: "你早就知道真相，对吗？" },
      { shotNumber: "3", durationHint: "2s", description: "手机屏幕特写，关键证据弹出，形成反转钩子。", dialogue: "" },
    ],
  },
  {
    name: "预置-电影叙事-情绪推进",
    styleTag: "film",
    beats: [
      { shotNumber: "1", durationHint: "4s", description: "傍晚街道长镜头，人物独行，环境声铺陈孤独感。", dialogue: "" },
      { shotNumber: "2", durationHint: "5s", description: "人物在橱窗前停下，倒影与本人同框，情绪内化。", dialogue: "如果当时我没离开…" },
      { shotNumber: "3", durationHint: "4s", description: "人物抬眼看向远处灯光，呼吸放缓，情绪进入下一段。", dialogue: "" },
    ],
  },
  {
    name: "预置-动漫分镜-动作强化",
    styleTag: "anime",
    beats: [
      { shotNumber: "1", durationHint: "2s", description: "主角跃起拔刀，残影拉出速度线，背景高对比。", dialogue: "接招吧！" },
      { shotNumber: "2", durationHint: "2s", description: "眼神特写，瞳孔高光增强，情绪由冷静转为决绝。", dialogue: "" },
      { shotNumber: "3", durationHint: "3s", description: "技能爆发，能量波扩散，镜头跟随冲击方向推进。", dialogue: "" },
    ],
  },
  {
    name: "预置-广告转化-产品卖点",
    styleTag: "ad",
    beats: [
      { shotNumber: "1", durationHint: "2s", description: "产品开箱特写，材质细节与品牌标识清晰可见。", dialogue: "" },
      { shotNumber: "2", durationHint: "3s", description: "用户在真实场景使用产品，痛点被快速解决。", dialogue: "原来这么简单。" },
      { shotNumber: "3", durationHint: "2s", description: "产品与核心卖点字幕同屏，出现行动引导。", dialogue: "现在就试试。" },
    ],
  },
  {
    name: "预置-通用商用-稳定出片",
    styleTag: "general",
    beats: [
      { shotNumber: "1", durationHint: "3s", description: "交代场景与人物关系，画面干净，信息明确。", dialogue: "" },
      { shotNumber: "2", durationHint: "3s", description: "推进事件核心动作，主体与道具关系清晰。", dialogue: "" },
      { shotNumber: "3", durationHint: "3s", description: "收束情绪与结果，给下一个镜头留出承接点。", dialogue: "" },
    ],
  },
];

export const PRESET_TEMPLATE_GUIDE: Record<
  string,
  {
    scene: string;
    tips: string[];
  }
> = {
  "预置-短剧爆款-冲突反转": {
    scene: "适合竖屏短剧连更，强调冲突、反转和留钩子。",
    tips: [
      "先把角色关系写清：谁压谁、谁藏秘密。",
      "第 3 条镜头尽量保留“反转信息”，提升追更欲望。",
    ],
  },
  "预置-电影叙事-情绪推进": {
    scene: "适合电影感叙事，强调氛围和人物情绪弧线。",
    tips: [
      "描述里多写环境声、光线和机位运动方向。",
      "对白控制在短句，避免破坏镜头沉浸感。",
    ],
  },
  "预置-动漫分镜-动作强化": {
    scene: "适合二次元动作场景，强调速度线、特效和表情张力。",
    tips: [
      "动作镜头优先写“起手-爆发-收势”的节奏。",
      "情绪字段可搭配夸张表情词，增强风格一致性。",
    ],
  },
  "预置-广告转化-产品卖点": {
    scene: "适合产品广告，强调卖点、使用场景和转化动作。",
    tips: [
      "第 1 条突出产品细节，第 2 条展示真实场景，第 3 条给行动指令。",
      "镜头时长保持短促，信息点集中表达。",
    ],
  },
  "预置-通用商用-稳定出片": {
    scene: "适合未知题材快速起步，先稳后精修。",
    tips: [
      "先跑通全链路，再按项目风格细化每个字段。",
      "角色描述优先补全身份、服饰、材质和场景约束。",
    ],
  },
};
