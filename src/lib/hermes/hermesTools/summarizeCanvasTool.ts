import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesToolRunResult } from "@/lib/hermes/hermesDirectorTypes";
import { resolveToolBeatIds } from "@/lib/hermes/hermesTools/toolBeatIds";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import { formatTemplateCatalogForUser } from "@/lib/hermes/hermesPlanTemplates";
import {
  buildHermesSituation,
  formatHermesSituationForLlm,
  type HermesSituation,
} from "@/lib/hermes/hermesSituation";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  findImageNodesForScript,
  findVideoNodesForScript,
  shotHasGeneratedImage,
} from "@/lib/storyboard/storyboardMediaNodes";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import { useProjectStore } from "@/store/projectStore";

function formatBeatDetailLines(
  situation: HermesSituation,
  beatIds: string[],
): string[] {
  const scriptNodeId = situation.ctx.scriptNodeId;
  if (!scriptNodeId) return [];

  const state = useProjectStore.getState();
  const script = state.nodes.find((n) => n.id === scriptNodeId);
  if (!script) return [];

  const beats = normalizeScriptBeats(script.data.scriptBeats);
  const shots = script.data.storyboardShots ?? [];
  const imageByBeat = findImageNodesForScript(scriptNodeId, state.nodes, state.edges);
  const videoByBeat = findVideoNodesForScript(scriptNodeId, state.nodes, state.edges);

  const lines: string[] = ["", "【指定镜头】"];
  for (const beatId of beatIds) {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) continue;
    const shot = shots.find((s) => s.scriptBeatId === beatId);
    const label = beat.shotNumber?.trim() || beatId.slice(0, 6);
    const visual = shot?.visualPrompt?.trim();
    const storyboard =
      shot?.status === "generated" && visual
        ? "分镜就绪"
        : shot?.status === "failed"
          ? `分镜失败${shot.error ? `：${shot.error}` : ""}`
          : visual
            ? "分镜草稿"
            : "缺分镜";
    const imageNodeId = imageByBeat.get(beatId);
    const imageNode = imageNodeId
      ? state.nodes.find((n) => n.id === imageNodeId)
      : undefined;
    const hasImage = shotHasGeneratedImage(beatId, shot, imageNode);
    const image = imageNode
      ? hasImage
        ? "已出图"
        : "节点在、未成图"
      : "无图片节点";
    const videoStatus = shot?.videoStatus ?? "idle";
    const video =
      videoStatus === "generated"
        ? "视频已出"
        : videoStatus === "generating"
          ? "视频生成中"
          : videoStatus === "failed"
            ? `视频失败${shot?.videoError ? `：${shot.videoError}` : ""}`
            : videoByBeat.has(beatId)
              ? "待出视频"
              : "无视频节点";
    const visualSnippet = visual
      ? ` — ${visual.slice(0, 48)}${visual.length > 48 ? "…" : ""}`
      : "";
    lines.push(`· 镜 ${label}：${storyboard} · ${image} · ${video}${visualSnippet}`);
  }
  return lines;
}

/** 给用户/计划进度条看的制片摘要（只读，不调 API） */
export function formatHermesSituationForUser(situation: HermesSituation): string {
  const { headline, stageLabel, production, gaps } = situation;
  const lines = [
    `阶段：${stageLabel}`,
    headline,
    "",
    `镜头 ${production.beatCount} 条 · 分镜就绪 ${production.storyboardReady}（失败 ${production.storyboardFailed}）`,
    `关键帧 ${production.imageReady} 镜已有 · 缺 ${production.imageMissing} 镜`,
    `视频 已出 ${production.videoGenerated} · 失败 ${production.videoFailed} · 可批量 ${production.videoEligible}`,
    `导出 ${production.exportReady}/${production.exportTotal} 镜可合成`,
  ];
  if (gaps.length > 0) {
    lines.push("", "待办：");
    for (const g of gaps) {
      const icon = g.severity === "block" ? "⛔" : g.severity === "warn" ? "⚠" : "·";
      lines.push(`${icon} ${g.message}`);
    }
  }
  return lines.join("\n");
}

export function runCanvasSummarizeTool(
  step: HermesPlanStep,
  opts: { sourceMessage: string; scriptNodeId?: string | null },
): HermesToolRunResult {
  if (step.args?.catalogOnly === true) {
    return { ok: true, message: formatTemplateCatalogForUser() };
  }

  const state = useProjectStore.getState();
  const projectPath = state.projectPath?.trim();
  if (!projectPath) {
    return { ok: false, message: "请先打开或新建工程后再查看制片状态" };
  }

  const bible = useProjectBibleStore.getState().bible;
  const situation = buildHermesSituation(state.nodes, state.edges, projectPath, {
    selectedNodeIds: state.selectedNodeIds,
    bible,
  });

  const scriptNodeId =
    opts.scriptNodeId?.trim() ||
    situation.ctx.scriptNodeId ||
    findPrimaryScriptNode(state.nodes)?.id ||
    null;

  let message = formatHermesSituationForUser(situation);

  if (scriptNodeId) {
    const beatIds = resolveToolBeatIds(scriptNodeId, step.args, opts.sourceMessage);
    if (beatIds?.length) {
      message += formatBeatDetailLines(situation, beatIds).join("\n");
    }
  }

  const llmBlock = formatHermesSituationForLlm(situation);
  state.setStatusText(`Hermes：${situation.headline}`);

  return {
    ok: true,
    message: `${message}\n\n---\n${llmBlock}`,
    scriptNodeId: scriptNodeId ?? undefined,
  };
}
