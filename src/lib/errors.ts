/** 将任意异常转为适合展示在状态栏的简短文案 */
export function formatUserError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  const s = String(error);
  if (s && s !== "[object Object]") {
    return s;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "未知错误";
  }
}
