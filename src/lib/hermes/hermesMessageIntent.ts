import {
  hasHermesCanvasStructureIntent,
} from "@/lib/hermes/hermesCanvasStructureIntent";
import {
  hasHermesProductionIntent,
  wantsConversationOnly,
} from "@/lib/hermes/hermesConversationIntent";

/** 用户本轮主要意图：咨询 / 执行 / 二者兼有 */
export type HermesMessageMode = "consult" | "execute" | "mixed";

/** 电影理论、片单、行业、风格参考等咨询信号（非制片操作） */
export function hasHermesConsultIntent(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  if (/^(分镜出图|出图|出视频|跑模板|建链|导出)$/i.test(t)) return false;

  return (
    /蒙太奇|长镜头|跳切|景别|运镜|构图|三幕|叙事结构|类型片|悬疑片|科幻片|爱情片|恐怖片|纪录片/.test(
      t,
    ) ||
    /推荐.{0,12}(电影|片子|片单)|有什么.{0,8}(电影|片子)|经典.{0,6}片|影史|奥斯卡|戛纳|票房|影评|豆瓣/.test(
      t,
    ) ||
    /好莱坞|网剧|短剧.{0,6}(趋势|市场)|发行|审查|分账|制片|投资方|选角/.test(t) ||
    /色彩|灯光|美术|配乐|声音设计|表演|演员/.test(t) ||
    /参考.{0,8}《|像.{0,12}电影|风格.{0,6}(像|仿|参考)|诺兰|宫崎骏|王家卫|昆汀|希区柯克|库布里克/.test(
      t,
    ) ||
    /^(请问|想问|聊聊|讨论|科普|科普一下)/.test(t) ||
    /电影.{0,6}(是什么|怎么|如何|为什么)|导演.{0,6}怎么|编剧.{0,6}怎么/.test(t) ||
    /[？?]\s*$/.test(t)
  );
}

export function resolveHermesMessageMode(text: string): HermesMessageMode {
  const t = text.trim();
  const execute =
    hasHermesProductionIntent(t) || hasHermesCanvasStructureIntent(t);
  const consult =
    wantsConversationOnly(t) || (hasHermesConsultIntent(t) && !/^(执行|开始|继续|确认)$/.test(t));

  if (/不是咨询|非咨询|不要咨询|别咨询|直接执行|要执行/.test(t) && execute) {
    return "execute";
  }

  if (consult && execute) return "mixed";
  if (execute) return "execute";
  return "consult";
}

export function shouldRunDirectorPlan(mode: HermesMessageMode): boolean {
  return mode === "execute" || mode === "mixed";
}
