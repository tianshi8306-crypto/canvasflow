const SUBMIT_ID_JSON =
  /"submit_id"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i;
const SUBMIT_ID_LOOSE =
  /submit_id[=:\s"]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const UUID_ONLY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 从 activeJob.id 或错误原文中提取即梦 submit_id */
export function extractDreaminaSubmitId(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (UUID_ONLY.test(s)) return s;
  const fromJson = s.match(SUBMIT_ID_JSON)?.[1];
  if (fromJson) return fromJson;
  const loose = s.match(SUBMIT_ID_LOOSE)?.[1];
  if (loose) return loose;
  return null;
}

/** 合并 activeJob.id 与 error 字段，取第一个有效 submit_id */
export function resolveDreaminaSubmitId(input: {
  jobId?: string | null;
  error?: string | null;
}): string | null {
  return extractDreaminaSubmitId(input.jobId) ?? extractDreaminaSubmitId(input.error);
}
