import {
  loadHermesPersistentMemory,
  saveHermesPersistentMemory,
  type HermesPersistentMemory,
} from "@/lib/hermes/agent/hermesPersistentMemory";
import { HERMES_SPIRIT_DEFAULT_NAME } from "@/lib/hermes/hermesAgentIdentity";

export type HermesSpiritIdentity = {
  spiritName: string;
  userHonorific: string;
  introShown: boolean;
};

function fromMemory(memory: HermesPersistentMemory): HermesSpiritIdentity {
  return {
    spiritName: String(memory.spiritName ?? "").trim(),
    userHonorific: String(memory.userHonorific ?? "").trim(),
    introShown: Boolean(memory.spiritIntroShown),
  };
}

export async function loadHermesSpiritIdentity(
  projectPath: string | null,
): Promise<HermesSpiritIdentity> {
  if (!projectPath?.trim()) {
    return { spiritName: "", userHonorific: "", introShown: false };
  }
  const memory = await loadHermesPersistentMemory(projectPath);
  return fromMemory(memory);
}

async function patchSpiritIdentity(
  projectPath: string,
  patch: Partial<{
    spiritName: string;
    userHonorific: string;
    spiritIntroShown: boolean;
  }>,
): Promise<HermesSpiritIdentity> {
  const memory = await loadHermesPersistentMemory(projectPath);
  if (patch.spiritName !== undefined) {
    memory.spiritName = patch.spiritName.trim().slice(0, 16);
  }
  if (patch.userHonorific !== undefined) {
    memory.userHonorific = patch.userHonorific.trim().slice(0, 12);
  }
  if (patch.spiritIntroShown !== undefined) {
    memory.spiritIntroShown = patch.spiritIntroShown;
  }
  await saveHermesPersistentMemory(projectPath, memory);
  return fromMemory(memory);
}

export async function setSpiritName(
  projectPath: string,
  name: string,
): Promise<HermesSpiritIdentity> {
  return patchSpiritIdentity(projectPath, { spiritName: name });
}

export async function setUserHonorific(
  projectPath: string,
  honorific: string,
): Promise<HermesSpiritIdentity> {
  return patchSpiritIdentity(projectPath, { userHonorific: honorific });
}

export async function markSpiritIntroShown(
  projectPath: string,
): Promise<HermesSpiritIdentity> {
  return patchSpiritIdentity(projectPath, { spiritIntroShown: true });
}

export function resolveSpiritDisplayName(identity: HermesSpiritIdentity): string {
  return identity.spiritName.trim() || HERMES_SPIRIT_DEFAULT_NAME;
}

/** Orb / 顶栏短标记：自定义名取首字，默认「灵」 */
export function resolveSpiritShortMark(identity: HermesSpiritIdentity): string {
  const name = identity.spiritName.trim();
  if (!name) return "灵";
  return name.length <= 2 ? name : name.slice(0, 1);
}

export function formatSpiritIdentityForPrompt(
  identity: HermesSpiritIdentity,
): string {
  const name = resolveSpiritDisplayName(identity);
  const lines = [
    "【灵体身份】",
    `- 你的名字：${name}（用此名自称；**禁止**说「我是 Hermes/H/内置助手」）`,
    `- 语气：像熟悉的同事聊天，自然口语；忌「已确认」「操作结果」「随时告诉我」等客服腔`,
  ];
  if (identity.userHonorific.trim()) {
    lines.push(`- 称呼用户：${identity.userHonorific.trim()}（优先于「你」）`);
  } else {
    lines.push("- 称呼用户：你（用户若指定新称呼，下轮起改用）");
  }
  lines.push(
    "- 能力：用户贴 API 资料时，可说「配置图片/视频/对话模型」由你写入应用设置（Key 进系统凭据，不进工程文件）",
  );
  return lines.join("\n");
}

export function buildSpiritFirstIntro(identity: HermesSpiritIdentity): string {
  const name = resolveSpiritDisplayName(identity);
  const self =
    name === HERMES_SPIRIT_DEFAULT_NAME
      ? "你画布里的灵体搭档"
      : name;
  const lines = [
    `嗨，我是${self}。`,
    "聊片子、问技法都可以；要说「出分镜图」「出视频」，我会自动动画布，不必自己去点面板。",
  ];
  if (identity.userHonorific.trim()) {
    lines.push(`我会叫你「${identity.userHonorific.trim()}」。`);
  } else {
    lines.push("想给我起名、指定称呼，或上传 `.env` / `.json` 配置文件导入节点模型 API，直接说就行。");
  }
  return lines.join("");
}

export function buildSpiritFloatIntroHint(identity: HermesSpiritIdentity): string {
  const name = resolveSpiritDisplayName(identity);
  return `和${name}聊片子，或下制片指令；也可 @ 引用画布素材。`;
}

export function formatSpiritNameAck(name: string): string {
  return `好，以后我就叫「${name}」。`;
}

export function formatUserHonorificAck(honorific: string): string {
  return `收到，以后叫你「${honorific}」。`;
}

const PRODUCTION_VERB = /出图|出视频|分镜|导出|执行|生成|重试|跑片|建链/;
const HONORIFIC_SUFFIX = /(?:就行|就好|吧|可以吗)$/;

function trimHonorific(raw: string): string {
  return raw.trim().replace(HONORIFIC_SUFFIX, "").trim();
}

/** 「你叫小蓝」「灵体名字叫…」 */
export function parseSpiritNamePayload(message: string): string | null {
  const t = message.trim();
  if (!t || PRODUCTION_VERB.test(t)) return null;

  const colon = t.match(
    /(?:灵体)?名字(?:叫)?[：:\s]*([^\s，。！？,.]{1,16})/,
  );
  if (colon?.[1]?.trim()) return colon[1].trim();

  const patterns = [
    /(?:你|灵体)(?:以后)?(?:就)?叫[：:\s]*([^\s，。！？,.]{1,16})/,
    /(?:以后)?叫(?:你|灵体)[：:\s]*([^\s，。！？,.]{1,16})/,
    /给你(?:取|起)(?:个)?名[：:\s]*([^\s，。！？,.]{1,16})/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

/** 「叫我老板」「称呼我为…」 */
export function parseUserHonorificPayload(message: string): string | null {
  const t = message.trim();
  if (!t || PRODUCTION_VERB.test(t)) return null;
  if (/叫我帮|叫我给|叫我去|叫我做/.test(t)) return null;

  const patterns = [
    /称呼(?:我)?为[：:\s]*([^\s，。！？,.]{1,12})/,
    /你(?:以后)?叫我[：:\s]*([^\s，。！？,.]{1,12})/,
    /^叫我[：:\s]*([^\s，。！？,.]{1,12})(?:就行|就好|吧|可以吗)?$/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    const hit = m?.[1]?.trim();
    if (hit) return trimHonorific(hit);
  }
  return null;
}

export function isSpiritNameIntent(message: string): boolean {
  return parseSpiritNamePayload(message) !== null;
}

export function isUserHonorificIntent(message: string): boolean {
  return parseUserHonorificPayload(message) !== null;
}
