export type ParsedImageGenError = {
  /** 用户可见的一句人话 */
  summary: string;
  /** 完整 API / 调试原文（仅「技术详情」展示） */
  technicalDetail?: string;
};

function stripFailurePrefix(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("图片生成失败：")) s = s.slice("图片生成失败：".length).trim();
  if (s.startsWith("第 ") && s.includes("张图片生成失败:")) {
    const idx = s.indexOf("张图片生成失败:");
    if (idx >= 0) s = s.slice(idx + "张图片生成失败:".length).trim();
  }
  return s;
}

/** 将图片生成错误映射为人话；技术字段不进 summary */
export function parseImageGenError(raw: string): ParsedImageGenError {
  const original = raw.trim();
  const s = stripFailurePrefix(original);

  if (!s) {
    return { summary: "图片生成失败，请稍后重试" };
  }

  if (s.includes("所选图片模型不存在或已禁用") || s.includes("未找到图片模型配置")) {
    return {
      summary:
        "图片模型未在设置中启用或未配置。请打开 设置 → 图片模型 检查「模型标识」与 API Key",
    };
  }
  if (s.includes("未配置图片模型 API Key")) {
    return {
      summary: "未配置图片模型 API Key。请在 设置 → 图片模型 中填写并保存",
    };
  }
  if (s.includes("图片模型未配置 API 地址")) {
    return {
      summary: "图片模型未配置 API 地址。请在 设置 → 图片模型 中填写 API 地址并保存",
    };
  }
  if (s.includes("图片模型未配置模型型号")) {
    return {
      summary: "图片模型未配置模型型号。请在 设置 → 图片模型 中填写模型型号并保存",
    };
  }
  if (
    s.includes("InputImageSensitiveContentDetected") ||
    s.includes("PrivacyInformation") ||
    /real person/i.test(s) ||
    s.includes("真人") ||
    s.includes("敏感")
  ) {
    return {
      summary:
        "参考图未通过内容安全审核（可能被判定含真人肖像或隐私信息）。请换一张无真人面部的参考图，或改用纯 AI 生成图后再试",
      technicalDetail: original,
    };
  }
  if (s.includes("返回内容中未找到图片数据")) {
    return {
      summary: "服务商未返回可用图片，请稍后重试或更换模型",
      technicalDetail: original,
    };
  }

  const looksTechnical =
    /logid=/i.test(s) ||
    /submit_id/i.test(s) ||
    /fail_reason/i.test(s) ||
    /ret[=:]\s*\d+/i.test(s) ||
    s.length > 120;

  if (looksTechnical) {
    return {
      summary: "图片生成失败，请修正提示词或参考素材后重试",
      technicalDetail: original,
    };
  }

  return {
    summary: s.length > 280 ? `${s.slice(0, 277)}…` : s,
    technicalDetail: s.length > 280 ? original : undefined,
  };
}

/** @deprecated 使用 parseImageGenError().summary */
export function formatImageGenErrorLine(raw: string): string {
  return parseImageGenError(raw).summary;
}
