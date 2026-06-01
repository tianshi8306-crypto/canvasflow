/**
 * 从对话中识别「教给 Hermes / 写入记忆」意图，提取要记住的正文。
 */

const MEMORY_PREFIX =
  /^(?:请)?记住(?:一下|住)?|(?:请)?帮我记住|(?:保存|写入)(?:到)?(?:本工程)?(?:的)?记忆|教给(?:你|hermes)|让\s*hermes\s*记住/i;

const PROFILE_PREFIX =
  /^(?:请)?(?:更新|设置)(?:用户)?画像|(?:用户)?画像[：:]/i;

export function parseHermesTeachPayload(message: string): string | null {
  const t = message.trim();
  if (!t) return null;

  const colonMatch = t.match(
    /^(?:请)?(?:记住|帮我记住|保存到记忆|写入记忆|教给你|教给\s*hermes)[：:]\s*([\s\S]+)/i,
  );
  if (colonMatch?.[1]?.trim()) {
    return colonMatch[1].trim();
  }

  if (MEMORY_PREFIX.test(t)) {
    const rest = t.replace(MEMORY_PREFIX, "").replace(/^[：:\s]+/, "").trim();
    if (rest.length >= 6) return rest;
    return "";
  }

  return null;
}

/** 是否为「写入长期记忆」类指令（含仅有前缀、待补充内容） */
export function parseHermesProfilePayload(message: string): string | null {
  const t = message.trim();
  if (!t) return null;
  const colon = t.match(
    /^(?:请)?(?:更新|设置)(?:用户)?画像[：:]\s*([\s\S]+)/i,
  );
  if (colon?.[1]?.trim()) return colon[1].trim();
  const short = t.match(/^(?:用户)?画像[：:]\s*([\s\S]+)/i);
  if (short?.[1]?.trim()) return short[1].trim();
  if (PROFILE_PREFIX.test(t)) {
    const rest = t.replace(PROFILE_PREFIX, "").replace(/^[：:\s]+/, "").trim();
    if (rest.length >= 4) return rest;
    return "";
  }
  return null;
}

export function isHermesProfileIntent(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  return parseHermesProfilePayload(t) !== null || PROFILE_PREFIX.test(t);
}

export function isHermesTeachIntent(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (isHermesProfileIntent(t)) return false;
  if (parseHermesTeachPayload(t) !== null) return true;
  return MEMORY_PREFIX.test(t);
}
