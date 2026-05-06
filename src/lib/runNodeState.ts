import type { RunEventRow } from "@/entities";

/** 与后端 `node_state` 事件的 `state` 字段对齐 */
export type NodeRunState = "running" | "succeeded" | "failed" | "skipped";

/**
 * 从一次 run 的事件列表推导各节点最终状态（同节点多条 `node_state` 时取时间顺序上最后一条）。
 */
export function deriveNodeRunStatesFromEvents(events: RunEventRow[]): Record<string, NodeRunState> {
  const out: Record<string, NodeRunState> = {};
  for (const ev of events) {
    if (ev.kind !== "node_state" || !ev.nodeId) continue;
    let payload: { state?: string };
    try {
      payload = JSON.parse(ev.payloadJson || "{}") as { state?: string };
    } catch {
      continue;
    }
    const st = payload.state;
    if (st === "running" || st === "succeeded" || st === "failed" || st === "skipped") {
      out[ev.nodeId] = st;
    }
  }
  return out;
}

export function runHadAnyFailure(events: RunEventRow[]): boolean {
  const summary = events.find((e) => e.kind === "run_summary");
  if (!summary) return false;
  try {
    const p = JSON.parse(summary.payloadJson || "{}") as { anyNodeFailed?: boolean };
    return Boolean(p.anyNodeFailed);
  } catch {
    return false;
  }
}

export function deriveRunFailureMessage(events: RunEventRow[]): string | null {
  const toFriendlyMessage = (raw: string): string => {
    const msg = raw.trim();
    if (!msg) return "";
    if (/未配置 API Key|No API key|missing api key/i.test(msg)) {
      return "模型 API Key 未配置，请到顶栏设置中检查对应模型通道";
    }
    if (/请先输入|输入为空|empty input|prompt is empty/i.test(msg)) {
      return "输入内容为空，请先填写剧情或生成要求";
    }
    if (/timeout|超时|timed out/i.test(msg)) {
      return "模型请求超时，请稍后重试或更换模型";
    }
    if (/429|rate limit|too many requests/i.test(msg)) {
      return "模型请求过于频繁，请稍后再试";
    }
    if (/401|403|unauthorized|forbidden|鉴权|认证/i.test(msg)) {
      return "模型鉴权失败，请检查 API Key 与模型配置";
    }
    return msg;
  };

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev.kind !== "node_state") continue;
    let payload: { state?: string; error?: string };
    try {
      payload = JSON.parse(ev.payloadJson || "{}") as { state?: string; error?: string };
    } catch {
      continue;
    }
    if (payload.state !== "failed") continue;
    const msg = (payload.error ?? "").trim();
    if (msg) {
      const friendly = toFriendlyMessage(msg);
      return ev.nodeId ? `${ev.nodeId}：${friendly}` : friendly;
    }
    if (ev.nodeId) return `${ev.nodeId} 执行失败`;
    return "节点执行失败";
  }
  return null;
}
