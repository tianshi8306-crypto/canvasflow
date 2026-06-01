export type ParsedVideoGenError = {
  /** 用户可见的一句人话 */
  summary: string;
  /** 完整 API / 调试原文（仅「技术详情」展示） */
  technicalDetail?: string;
};

function stripFailurePrefix(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("视频生成失败：")) s = s.slice("视频生成失败：".length).trim();
  return s;
}

/** 即梦 CLI 失败 JSON 特征（含 submit_id / gen_status） */
function isDreaminaCliFailureText(s: string): boolean {
  return (
    s.includes("submit_id") ||
    s.includes("gen_status") ||
    s.includes("fail_reason")
  );
}

/** 从 API 原文提取可展示的技术详情（保留 logid 等，但默认折叠） */
export function videoGenErrorTechnicalDetail(raw: string): string | undefined {
  const s = stripFailurePrefix(raw);
  if (!s) return undefined;
  return s;
}

/** 将视频生成错误映射为人话；技术字段不进 summary */
export function parseVideoGenError(raw: string): ParsedVideoGenError {
  const original = raw.trim();
  const s = stripFailurePrefix(original);

  if (!s) {
    return { summary: "视频生成失败，请稍后重试" };
  }

  if (s.includes("视频模型不存在或已禁用")) {
    return {
      summary:
        "视频模型未在设置中启用或未配置 API Key。请打开 设置 → 视频模型 检查「模型标识」与 API Key",
    };
  }
  if (s.includes("未配置视频模型 API Key")) {
    return {
      summary: "未配置视频模型 API Key。请在 设置 → 视频模型 中填写并保存",
    };
  }
  if (
    s.includes("ExceedConcurrencyLimit") ||
    /ret[=:\s]*1310\b/i.test(s) ||
    s.includes("并发")
  ) {
    if (isDreaminaCliFailureText(s)) {
      return {
        summary:
          "即梦视频任务已创建并可能已扣积分，但应用未能自动下载成片。若网页创作记录里已有视频，请点击「取回即梦成片」；或重启应用后重新生成。仍失败请用 submit_id 联系即梦客服",
        technicalDetail: original,
      };
    }
    return {
      summary: "当前生成并发已满，请稍后重试",
      technicalDetail: original,
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

  const looksTechnical =
    /logid=/i.test(s) ||
    /bridge\s*模式/i.test(s) ||
    /不允许回退\s*mock/i.test(s) ||
    /video_gen_start/i.test(s) ||
    /ret[=:]\s*\d+/i.test(s) ||
    s.length > 120;

  if (looksTechnical) {
    return {
      summary: "视频生成失败，请修正提示词或参考素材后重试",
      technicalDetail: original,
    };
  }

  return {
    summary: s.length > 280 ? `${s.slice(0, 277)}…` : s,
    technicalDetail: s.length > 280 ? original : undefined,
  };
}

/** @deprecated 使用 parseVideoGenError().summary */
export function formatVideoGenErrorLine(raw: string): string {
  return parseVideoGenError(raw).summary;
}
