import type { HermesSituation } from "@/lib/hermes/hermesSituation";
import type { HermesKnowledgeScene } from "@/lib/hermes/knowledge/hermesKnowledgeSearch";
import type { HermesMessageMode } from "@/lib/hermes/hermesMessageIntent";
import {
  getHermesReplyLimits,
  inferHermesReplyStyle,
} from "@/lib/hermes/hermesReplyStyle";

/** 注入 system / situation 的专家身份与领域边界（中文） */
export const HERMES_PRODUCTION_EXPERT_DOCTRINE = `【Hermes 制片专家身份】
你是嵌在 CanvasFlow 无限画布里的 AI 影视制片搭档。
原则：画布非线性；建议可执行（镜号/工具）；区分工程事实与常识；先答当前一句。
回复默认≤120字，禁止套话与长清单。`;

/** 按画布状态选取知识库场景（与纯关键词互补） */
export function pickKnowledgeScenesFromSituation(
  situation: HermesSituation,
): HermesKnowledgeScene[] {
  const scenes: HermesKnowledgeScene[] = ["workflow"];
  const { production: p, ctx } = situation;

  if (!ctx.scriptNodeId) {
    return ["workflow", "creative"];
  }

  if (p.storyboardFailed > 0 || p.videoFailed > 0) {
    scenes.push("troubleshoot");
  }
  if (p.videoGenerated > 0 || p.videoEligible > 0 || p.videoFailed > 0) {
    scenes.push("param");
  }
  if (
    p.storyboardReady > 0 ||
    p.storyboardMissing > 0 ||
    p.imageReady > 0 ||
    p.imageMissing > 0
  ) {
    scenes.push("creative");
  }
  if (p.beatCount >= 6) {
    scenes.push("film_theory");
  }

  return [...new Set(scenes)].slice(0, 3);
}

/** 供 FTS 检索的查询串：结合用户句 + 制片快照 */
export function buildKnowledgeQueryFromSituation(
  situation: HermesSituation,
  userMessage?: string,
): string {
  const parts: string[] = [];
  const msg = userMessage?.trim().slice(0, 120);
  if (msg) parts.push(msg);

  const { production: p, ctx } = situation;
  if (!ctx.scriptNodeId) {
    parts.push("无限画布 非线性 单镜 图生视频");
    return parts.join(" ").slice(0, 160);
  }
  if (p.videoFailed > 0) parts.push("视频生成失败 重试");
  if (p.storyboardFailed > 0) parts.push("分镜失败");
  if (p.imageMissing > 0 && p.storyboardReady > 0) parts.push("关键帧 出图");
  if (p.videoEligible > 0) parts.push("图生视频 人物动作");
  if (p.beatCount > 0 && p.storyboardMissing > 0) parts.push("分镜文案");
  if (parts.length === 0) parts.push("AI视频 制片 分镜 出图 角色一致性 运镜");

  return parts.join(" ").slice(0, 160);
}

export function formatHermesExpertDoctrineForLlm(ctx?: {
  userMessage?: string;
  messageMode?: HermesMessageMode;
  advisorMode?: boolean;
}): string {
  const s = inferHermesReplyStyle({
    userMessage: ctx?.userMessage ?? "",
    messageMode: ctx?.messageMode,
    advisorMode: ctx?.advisorMode,
  });
  const base = `【Hermes 制片专家身份】
你是嵌在 CanvasFlow 无限画布里的 AI 影视制片搭档。
原则：画布非线性；建议可执行（镜号/工具）；区分工程事实与常识；先答当前一句。`;
  if (s === "detailed") {
    return `${base}\n回复可充分展开，仍避免无意义套话与编造执行结果。`;
  }
  if (s === "standard") {
    return `${base}\n回复宜简明（约≤200字），避免空话套话。`;
  }
  const limits = getHermesReplyLimits("concise");
  return `${base}\n回复默认≤${limits.chatSoftMaxHint}字，禁止套话与长清单。`;
}
