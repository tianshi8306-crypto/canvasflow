/**
 * AI 服务商连接测试
 * 参考 AI CanvasPro: api/providerConnectionTestApi.js
 *
 * 四步检测流程：config → auth → model → upload
 * 错误分类：missing_key / missing_url / auth_failed / network_failed /
 *          rate_limited / quota_or_balance / model_unavailable /
 *          bad_base_url / upload_failed / provider_error
 */

import { DEFAULT_PROVIDER_TEST_IDS, getProviderMeta, type ProviderId } from "@/lib/providers";

/** 测试超时（毫秒） */
const TEST_TIMEOUT_MS = 30000;

/** 每一步的标签 */
const STEP_LABELS = {
  config: "配置",
  auth: "密钥",
  model: "模型",
  upload: "上传",
} as const;

/** 无需独立上传检测的 Provider */
const SKIPPED_UPLOAD_PROVIDERS: Partial<Record<ProviderId, string>> = {
  openai: "OpenAI 兼容接口通常直接接收远程 URL，本轮不做独立上传测试",
  ppio: "派欧云当前链路不需要独立厂商上传，本轮只检测密钥和模型列表",
};


// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function normalizeProviderId(id: string): ProviderId {
  return String(id || "").toLowerCase().replace(/[^a-z0-9_-]/g, "") as ProviderId;
}

function trimSlashes(s: string): string {
  return String(s || "").replace(/^\/+|\/+$/g, "");
}

function normalizeBaseUrl(url: string): string {
  return trimSlashes(String(url || "").toLowerCase());
}

function joinUrl(base: string, path: string): string {
  const b = normalizeBaseUrl(base);
  const p = trimSlashes(path);
  if (!b) return p;
  if (!p) return b;
  return b + "/" + p;
}

function stringifyProbePayload(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data || "");
  }
}

function humanizeCategory(
  category: string,
  providerId: ProviderId,
  fallback: string,
): string {
  const label = getProviderMeta(providerId)?.label || providerId;
  const msgs: Record<string, string> = {
    missing_key: `${label} 的 API Key 还没填写。`,
    missing_url: `${label} 的接口地址未配置。`,
    auth_failed: `${label} 的 API Key 无效、过期，或没有访问权限。`,
    network_failed: `无法连到 ${label}，请检查网络、本地服务或防火墙。`,
    rate_limited: `${label} 返回限流，请稍后再试。`,
    quota_or_balance: `${label} 账户额度或余额可能不足。`,
    model_unavailable: `${label} 的测试模型不可访问，可能未开通该模型或模型名不兼容。`,
    bad_base_url: `${label} 的接口地址不兼容，请检查 Base URL 是否填对。`,
    upload_failed: `${label} 上传链路未通过，参考图/视频上传可能会失败。`,
    provider_error: `${label} 返回异常，稍后重试或查看厂商后台状态。`,
    unsupported: `${label} 暂不支持连接测试。`,
  };
  return msgs[category] || fallback;
}

// ---------------------------------------------------------------------------
// OpenAI-like Provider 检测
// ---------------------------------------------------------------------------

/** OpenAI-like Provider 的模型探测 URL 构建 */
function buildModelsProbeUrl(providerId: ProviderId, baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";

  // 去掉常见的 /chat/completions 或 /models 尾巴
  const stripped = normalized
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/models$/i, "");

  if (providerId === "openai") {
    return joinUrl(stripped.replace(/\/openai\/v1$/i, ""), "openai/v1/models");
  }

  // 如果 URL 已经是 /v1 或 /v1/xxx 形式，直接追加 models
  if (/\/v\d+(?:beta)?$/i.test(stripped) || /\/openai\/v1$/i.test(stripped)) {
    return joinUrl(stripped, "models");
  }

  return joinUrl(stripped, "v1/models");
}

/** 检查是否为认证失败响应 */
function isAuthFailure(response: { status?: number; data?: unknown }): boolean {
  const status = Number(response.status || 0);
  if (status === 401 || status === 403) return true;

  const text = stringifyProbePayload(response);
  return /(?:\b401\b|\b403\b|unauthorized|forbidden|authentication|authorization|invalid\s+(?:api\s*)?key|invalid\s+token|api\s*key\s+invalid|apikey|bearer|access\s*token|鉴权|认证|未授权|无权限|密钥|令牌)/i.test(text);
}

/** 根据探测结果分类错误 */
function classifyProbeFailure(
  response: { status?: number; data?: unknown },
  fallback: string = "unknown",
): string {
  const status = Number(response.status || 0);
  const text = stringifyProbePayload(response);

  if (isAuthFailure(response)) return "auth_failed";
  if (status === 0 || /timeout|timed out|network|failed to fetch|dns|econn|请求超时|网络请求失败/i.test(text))
    return "network_failed";
  if (status === 429 || /rate limit|too many requests|限流|请求过于频繁/i.test(text))
    return "rate_limited";
  if (/insufficient|quota|balance|billing|credit|payment|额度|余额|欠费|付费|账户余额/i.test(text))
    return "quota_or_balance";
  if (/model.+(?:not found|not exist|unavailable|no access)|模型.*(?:不存在|不可用|无权限|未开通)|no permission.*model/i.test(text))
    return "model_unavailable";
  if (status === 404 || /not found|invalid url|unsupported endpoint|cannot post|cannot get|接口地址|地址不兼容/i.test(text))
    return "bad_base_url";

  return fallback;
}

/** 构建单步结果 */
function makeStep(
  id: keyof typeof STEP_LABELS,
  ok: boolean,
  message: string,
  detail: string = "",
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    label: STEP_LABELS[id],
    ok,
    skipped: extra["skipped"] === true,
    message,
    detail: detail.replace(/\s+/g, " ").trim(),
    category: (extra["category"] as string) || "",
  };
}

// ---------------------------------------------------------------------------
// 连接测试入口
// ---------------------------------------------------------------------------

export interface ProviderTestResult {
  ok: boolean;
  /** 是否部分通过（某些步骤跳过） */
  partial?: boolean;
  providerId: ProviderId;
  label: string;
  /** 通过 / 部分通过 / 未通过 */
  message: string;
  error?: string;
  summary: string;
  category: string;
  suggestion: string;
  /** 各步骤详细结果 */
  steps: ReturnType<typeof makeStep>[];
}

export type ConnectionTestResults = Partial<Record<ProviderId, ProviderTestResult>>;

interface ProbeResponse {
  status: number;
  data: unknown;
}

/** 发起 HTTP 请求（简化版，供探测使用） */
async function probeRequest(
  url: string,
  options: RequestInit & { timeout?: number },
): Promise<ProbeResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || TEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = await res.text();
    }
    return { status: res.status, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted") || msg.includes("timeout")) {
      return { status: 0, data: { error: "请求超时", message: msg } };
    }
    return { status: 0, data: { error: "网络请求失败", message: msg } };
  } finally {
    clearTimeout(timeout);
  }
}

/** 检测 OpenAI-like 提供商的连接状态 */
async function testOpenAILikeProvider(
  providerId: ProviderId,
  config: { apiUrl?: string; apiKey?: string; modelApiKey?: string },
): Promise<ProviderTestResult> {
  const steps: ReturnType<typeof makeStep>[] = [];

  // Step 1: config（接口地址）
  if (!config.apiUrl) {
    steps.push(makeStep("config", false, "接口地址未配置", "", { category: "missing_url" }));
    return failResult(providerId, steps);
  }
  steps.push(makeStep("config", true, "接口地址和 API Key 已填写"));

  // Step 2: auth（API Key）
  if (!config.apiKey) {
    steps.push(makeStep("auth", false, "API Key 未填写", "", { category: "missing_key" }));
    return failResult(providerId, steps);
  }
  steps.push(makeStep("auth", true, "API Key 已填写"));

  // Step 3: model（模型列表）
  const modelsProbeUrl = buildModelsProbeUrl(providerId, config.apiUrl);
  if (modelsProbeUrl) {
    const probe = await probeRequest(modelsProbeUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (probe.status >= 200 && probe.status < 300 && !isAuthFailure(probe)) {
      steps.push(makeStep("model", true, "API Key 可用，模型列表可访问", stringifyProbePayload(probe.data)));
    } else {
      const category = classifyProbeFailure(probe);
      steps.push(
        makeStep("model", false, humanizeCategory(category, providerId, "模型不可用"), stringifyProbePayload(probe.data), {
          category,
        }),
      );
      return failResult(providerId, steps);
    }
  }

  // Step 4: upload（上传探测，跳过大部分厂商）
  const skipMsg = SKIPPED_UPLOAD_PROVIDERS[providerId];
  if (skipMsg) {
    steps.push(makeStep("upload", true, skipMsg, "", { skipped: true }));
  } else {
    // 通用上传检测逻辑（GRSAI/APIMart/RunningHub 有专用实现）
    steps.push(makeStep("upload", true, "上传链路检测已跳过", "", { skipped: true }));
  }

  return passResult(providerId, steps);
}

/** 构建通过结果 */
function passResult(providerId: ProviderId, steps: ReturnType<typeof makeStep>[]): ProviderTestResult {
  return {
    ok: true,
    providerId,
    label: getProviderMeta(providerId)?.label || providerId,
    message: "通过",
    summary: "连接测试通过",
    category: "",
    suggestion: "",
    steps,
  };
}

/** 构建失败结果 */
function failResult(
  providerId: ProviderId,
  steps: ReturnType<typeof makeStep>[],
  fallbackCategory = "unknown",
): ProviderTestResult {
  const failedStep = steps.find((s) => !s.ok && !s.skipped);
  const category = failedStep?.category || fallbackCategory;
  const suggestion = humanizeCategory(category, providerId, failedStep?.message || "连接测试未通过");

  return {
    ok: false,
    providerId,
    label: getProviderMeta(providerId)?.label || providerId,
    message: "未通过",
    error: failedStep?.message,
    summary: failedStep?.message || "连接测试未通过",
    category,
    suggestion,
    steps,
  };
}

/**
 * 测试单个 Provider 的连接状态
 */
export async function testProviderConnection(
  providerId: string,
  config: { apiUrl?: string; apiKey?: string; modelApiKey?: string },
): Promise<ProviderTestResult> {
  const id = normalizeProviderId(providerId);

  if (!id) {
    return {
      ok: false,
      providerId: id,
      label: providerId,
      message: "未通过",
      error: "未知 Provider ID",
      summary: "未知 Provider ID",
      category: "unsupported",
      suggestion: "暂不支持该厂商的连接测试",
      steps: [],
    };
  }

  // RunningHUB 有特殊的双 Key 结构
  if (id === "runninghub") {
    return testRunningHubProvider(config);
  }

  return testOpenAILikeProvider(id, config);
}

/**
 * 测试 RunningHUB 的连接状态（双 Key 检测）
 */
async function testRunningHubProvider(
  config: { apiUrl?: string; apiKey?: string; modelApiKey?: string },
): Promise<ProviderTestResult> {
  const steps: ReturnType<typeof makeStep>[] = [];

  if (!config.apiKey && !config.modelApiKey) {
    steps.push(makeStep("auth", false, "API Key 未填写", "", { category: "missing_key" }));
    return failResult("runninghub", steps);
  }

  steps.push(makeStep("auth", true, "已填写至少一个 RunningHUB API Key"));

  // 工作流 API Key 检测
  if (config.apiKey) {
    try {
      const res = await probeRequest("https://www.runninghub.cn/openapi/v2/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: config.apiKey, taskId: "aic-connection-test" }),
      });

      if (res.status >= 200 && res.status < 500 && !isAuthFailure(res)) {
        steps.push(makeStep("model", true, "工作流 API Key 可用"));
      } else {
        const category = classifyProbeFailure(res);
        steps.push(makeStep("model", false, humanizeCategory(category, "runninghub", "工作流 API Key 测试未通过"), stringifyProbePayload(res.data), { category }));
        return failResult("runninghub", steps);
      }
    } catch {
      steps.push(makeStep("model", false, "工作流 API Key 测试未通过", "", { category: "network_failed" }));
      return failResult("runninghub", steps);
    }
  }

  // 模型 API Key 检测
  if (config.modelApiKey) {
    try {
      const res = await probeRequest("https://www.runninghub.cn/openapi/v2/media/upload/binary", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.modelApiKey}` },
      });

      if (res.status >= 200 && res.status < 500) {
        steps.push(makeStep("upload", true, "模型 API Key 可用"));
      } else {
        const category = classifyProbeFailure(res);
        steps.push(makeStep("upload", false, humanizeCategory(category, "runninghub", "模型 API Key 测试未通过"), stringifyProbePayload(res.data), { category }));
        return failResult("runninghub", steps);
      }
    } catch {
      steps.push(makeStep("upload", false, "模型 API Key 测试未通过", "", { category: "network_failed" }));
      return failResult("runninghub", steps);
    }
  }

  return passResult("runninghub", steps);
}

/**
 * 批量测试多个 Provider 的连接状态
 */
export async function testProviderConnections(
  providerConfigs: Partial<Record<ProviderId, { apiUrl?: string; apiKey?: string; modelApiKey?: string }>>,
  providerIds: ProviderId[] = [...DEFAULT_PROVIDER_TEST_IDS],
): Promise<ConnectionTestResults> {
  const results = await Promise.all(
    providerIds.map(async (id) => {
      const config = providerConfigs[id] || {};
      const result = await testProviderConnection(id, config);
      return [id, result] as const;
    }),
  );

  return Object.fromEntries(results);
}