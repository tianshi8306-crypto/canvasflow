import type {
  HermesProductionSnapshot,
  HermesSituation,
} from "@/lib/hermes/hermesSituation";
import type { HermesCreativeStageId } from "@/lib/hermes/hermesCreativeStage";

export type HermesPipelinePhaseId =
  | "setup"
  | "storyboard"
  | "image"
  | "video"
  | "export"
  | "done";

export type HermesPipelinePhase = {
  id: HermesPipelinePhaseId;
  label: string;
  /** 0–100 全片进度估计 */
  progressPct: number;
  bottleneck?: string;
  recommendedNext?: string;
};

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.min(100, Math.round((num / den) * 100));
}

export function inferHermesPipelinePhase(
  production: HermesProductionSnapshot,
  _stageId: HermesCreativeStageId,
  hasScript: boolean,
  hasBrief = false,
): HermesPipelinePhase {
  const beats = Math.max(production.beatCount, 1);

  if (!hasScript) {
    return {
      id: "setup",
      label: "自由编排",
      progressPct: 0,
      recommendedNext: "按需添加节点或描述目标，由 H 协助执行",
    };
  }

  if (production.beatCount === 0) {
    return {
      id: "setup",
      label: hasBrief ? "梗概就绪" : "脚本筹备",
      progressPct: hasBrief ? 12 : 6,
      bottleneck: hasBrief ? undefined : "镜头表未展开",
      recommendedNext: hasBrief
        ? "可生成镜头表，或先搭单镜/单链试探"
        : "填写梗概或直接在画布描述目标",
    };
  }

  if (production.storyboardReady < production.beatCount) {
    const p = pct(production.storyboardReady, beats);
    return {
      id: "storyboard",
      label: "分镜文案",
      progressPct: Math.max(10, Math.round(p * 0.35)),
      bottleneck:
        production.storyboardFailed > 0
          ? `${production.storyboardFailed} 镜分镜失败`
          : `缺 ${production.storyboardMissing} 镜分镜`,
      recommendedNext: "生成分镜或重试失败镜",
    };
  }

  if (production.imageReady < production.storyboardReady) {
    const denom = Math.max(production.storyboardReady, 1);
    const p = pct(production.imageReady, denom);
    return {
      id: "image",
      label: "关键帧出图",
      progressPct: 35 + Math.round(p * 0.25),
      bottleneck: `缺 ${production.imageMissing} 镜关键帧`,
      recommendedNext: "批量提交关键帧出图",
    };
  }

  if (production.videoGenerated < production.imageReady) {
    const denom = Math.max(production.imageReady, 1);
    const p = pct(production.videoGenerated, denom);
    return {
      id: "video",
      label: "镜头视频",
      progressPct: 60 + Math.round(p * 0.25),
      bottleneck:
        production.videoFailed > 0
          ? `${production.videoFailed} 镜视频失败`
          : production.videoEligible > 0
            ? `${production.videoEligible} 镜可提交出视频`
            : `${production.videoMissing} 镜尚不能出视频`,
      recommendedNext:
        production.videoFailed > 0 ? "重试失败视频" : "批量出视频",
    };
  }

  if (production.exportReady < production.exportTotal && production.exportTotal > 0) {
    return {
      id: "export",
      label: "合成导出",
      progressPct: 88,
      bottleneck: `仅 ${production.exportReady}/${production.exportTotal} 镜可导出`,
      recommendedNext: "补齐视频后导出时间线",
    };
  }

  if (production.exportReady > 0) {
    return {
      id: "export",
      label: "合成导出",
      progressPct: 95,
      recommendedNext: "导出时间线成片",
    };
  }

  if (production.videoGenerated > 0 && production.exportReady === 0) {
    return {
      id: "done",
      label: "审核收尾",
      progressPct: 100,
      recommendedNext: "在画布审核镜头，或增量改镜",
    };
  }

  return {
    id: "video",
    label: "镜头视频",
    progressPct: 70,
    recommendedNext: "检查流程并排期出视频",
  };
}

export function formatHermesGlobalUnderstandingForLlm(
  situation: HermesSituation,
): string {
  const { production, ctx, stageLabel } = situation;
  const phase = inferHermesPipelinePhase(
    production,
    situation.stageId,
    Boolean(ctx.scriptNodeId),
    ctx.hasBrief,
  );

  const lines: string[] = [
    "【全片理解】",
    `当前主阶段：${phase.label}（约 ${phase.progressPct}%）· 创作阶段标签：${stageLabel}`,
    `镜头 ${production.beatCount} · 分镜 ${production.storyboardReady}/${production.beatCount} · 关键帧 ${production.imageReady} · 视频 ${production.videoGenerated} · 可导出 ${production.exportReady}/${production.exportTotal || production.beatCount}`,
  ];

  if (phase.bottleneck) {
    lines.push(`瓶颈：${phase.bottleneck}`);
  }
  if (phase.recommendedNext) {
    lines.push(`建议下一步：${phase.recommendedNext}`);
  }

  if (situation.gaps.length > 0) {
    const top = situation.gaps
      .filter((g) => g.severity !== "info")
      .slice(0, 2)
      .map((g) => g.message);
    const info = situation.gaps
      .filter((g) => g.severity === "info")
      .slice(0, 1)
      .map((g) => g.message);
    const todo = [...top, ...info];
    if (todo.length > 0) {
      lines.push(`待办优先：${todo.join("；")}`);
    }
  }

  return lines.join("\n");
}

export function formatPipelinePhaseHeadline(
  situation: HermesSituation,
): string | null {
  const phase = inferHermesPipelinePhase(
    situation.production,
    situation.stageId,
    Boolean(situation.ctx.scriptNodeId),
  );
  if (!situation.ctx.scriptNodeId) return null;
  return `${phase.label} · ${phase.progressPct}%`;
}
