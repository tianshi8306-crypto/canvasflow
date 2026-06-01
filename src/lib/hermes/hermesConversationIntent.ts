/** 用户明确只要聊天、不要动画布 */
export function wantsConversationOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/仅聊|只聊|别执行|不要执行|先别做|先不做|不要生成|别生成|先聊聊|只是问问|不要改画布|别动画布/.test(t)) {
    return true;
  }
  if (/^(什么是|怎么|如何|为什么|介绍|解释|能否|可以吗)/.test(t) && !/帮我|请|执行|出图|出视频|分镜/.test(t)) {
    return true;
  }
  return false;
}

import { hasHermesCanvasStructureIntent } from "@/lib/hermes/hermesCanvasStructureIntent";

/** 句子里有制片/执行意图（用于决定是否走 LLM 规划） */
export function hasHermesProductionIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (hasHermesCanvasStructureIntent(t)) return true;
  return /出图|出视频|分镜|脚本|建链|导出|模板|批量|生成|梗概|大纲|镜头|视频|关键帧|合成|重试|改.*镜|流程检查|圣经|时间线|seedance|润色|写.*梗概|更新.*圣经|一键|全流程|成片|自动跑/i.test(
    t,
  );
}
