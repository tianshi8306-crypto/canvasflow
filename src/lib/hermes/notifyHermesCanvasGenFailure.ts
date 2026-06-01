import type { HermesOrbSuggestion } from "@/lib/hermes/hermesOrbSuggestions.types";
import { parseImageGenError } from "@/lib/imageGeneration/formatImageGenError";
import { parseVideoGenError } from "@/lib/video/formatVideoGenError";
import { useHermesOrbSuggestStore } from "@/store/hermesOrbSuggestStore";

export type CanvasGenFailureKind = "image" | "video";

export type NotifyHermesCanvasGenFailureOpts = {
  nodeId: string;
  kind: CanvasGenFailureKind;
  error: string;
  nodeLabel?: string;
  /** 即梦任务过期时可附带 submit_id，便于灵体协助取回 */
  dreaminaSubmitId?: string | null;
};

function defaultNodeLabel(kind: CanvasGenFailureKind): string {
  return kind === "image" ? "图片节点" : "视频节点";
}

function buildCanvasGenFailureSuggestion(
  opts: NotifyHermesCanvasGenFailureOpts,
): HermesOrbSuggestion {
  const parsed =
    opts.kind === "image"
      ? parseImageGenError(opts.error)
      : parseVideoGenError(opts.error);
  const label = opts.nodeLabel?.trim() || defaultNodeLabel(opts.kind);
  const media = opts.kind === "image" ? "图片" : "视频";
  const submitHint = opts.dreaminaSubmitId?.trim()
    ? `（即梦 submit_id: ${opts.dreaminaSubmitId.trim()}，若任务已过期可尝试取回成片）`
    : "";

  const technical = parsed.technicalDetail?.trim();
  const detailBlock = technical ? `\n\n技术信息：\n${technical}` : "";

  return {
    id: `canvas_${opts.kind}_gen_failed_${opts.nodeId}`,
    severity: "warn",
    message: `${label}${media}生成失败：${parsed.summary}${submitHint}`,
    actionLabel: "让 H 排查",
    actionPrompt: [
      `${label}的${media}生成失败了。`,
      `错误：${parsed.summary}${submitHint}`,
      "请帮我分析原因，并给出可操作的下一步（例如改提示词、换模型、重试或检查 API 配置）。",
      detailBlock,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/** 画布图片/视频节点生成失败：由灵体气泡告知，不在参数面板内嵌错误条 */
export function notifyHermesCanvasGenFailure(opts: NotifyHermesCanvasGenFailureOpts): void {
  const err = opts.error.trim();
  if (!err) return;
  const suggestion = buildCanvasGenFailureSuggestion({ ...opts, error: err });
  useHermesOrbSuggestStore.getState().pushEphemeralSuggestion(suggestion);
}

export { buildCanvasGenFailureSuggestion };
