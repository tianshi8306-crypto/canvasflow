import { isTauri } from "@tauri-apps/api/core";
import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import type { HermesToolRunResult } from "@/lib/hermes/hermesDirectorTypes";
import { resolveToolBeatIds } from "@/lib/hermes/hermesTools/toolBeatIds";
import {
  assessComposeExportScope,
  formatComposeExportReadinessHint,
} from "@/lib/storyboard/scriptProductionExport";
import { parseExportFormatArg } from "@/lib/compose/timelineExportFormat";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { useProjectStore } from "@/store/projectStore";

/**
 * 复用脚本工作台「合成导出」：建/更新 ffmpegConcat 时间线，可选 FFmpeg 渲染。
 */
export async function runComposeExportTool(
  step: HermesPlanStep,
  opts: { sourceMessage: string; scriptNodeId?: string | null },
): Promise<HermesToolRunResult> {
  if (!isTauri()) {
    return { ok: false, message: DESKTOP_SHELL_HINT };
  }

  const state = useProjectStore.getState();
  const projectPath = state.projectPath?.trim();
  if (!projectPath) {
    return { ok: false, message: "请先打开工程" };
  }

  const scriptNodeId =
    opts.scriptNodeId?.trim() ||
    findPrimaryScriptNode(state.nodes)?.id ||
    null;
  if (!scriptNodeId) {
    return { ok: false, message: "请先在画布上创建脚本节点" };
  }

  const scriptNode = state.nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");
  if (!scriptNode) {
    return { ok: false, message: "未找到脚本节点" };
  }

  const beatIds = resolveToolBeatIds(scriptNodeId, step.args, opts.sourceMessage);
  const autoRender = step.args?.autoRender !== false;

  const readiness = assessComposeExportScope({
    scriptNodeId,
    beats: scriptNode.data.scriptBeats ?? [],
    shots: scriptNode.data.storyboardShots,
    nodes: state.nodes,
    edges: state.edges,
    scriptBeatSelection: beatIds,
  });

  if (!("canExport" in readiness)) {
    return { ok: false, message: readiness.message, scriptNodeId };
  }
  if (!readiness.canExport) {
    return {
      ok: false,
      message: readiness.blockMessage || "当前没有可导出的成片片段",
      scriptNodeId,
    };
  }

  state.setStatusText(
    autoRender
      ? `Hermes：开始合成导出（${formatComposeExportReadinessHint(readiness)}）…`
      : `Hermes：准备时间线（${formatComposeExportReadinessHint(readiness)}）…`,
  );

  const exportFormat = parseExportFormatArg(step.args?.exportFormat, opts.sourceMessage);

  const result = await state.exportScriptCompose(scriptNodeId, {
    autoRender,
    beatIds,
    exportFormat,
  });

  if (!result) {
    return {
      ok: false,
      message: "合成导出未完成（请查看状态栏）",
      scriptNodeId,
    };
  }

  if (result.outputRelPath) {
    return {
      ok: true,
      message: `成片已导出：${result.outputRelPath}（${result.clipPaths.length} 段）`,
      scriptNodeId,
      mediaPreview: {
        kind: "video",
        assetRelPath: result.outputRelPath,
        label: "成片预览",
      },
    };
  }

  if (result.clipPaths.length === 0) {
    const miss = result.missing.length > 0 ? `；${result.missing.length} 镜缺素材` : "";
    return {
      ok: false,
      message: `没有可纳入时间线的视频片段${miss}`,
      scriptNodeId,
    };
  }

  return {
    ok: true,
    message: autoRender
      ? `已填入 ${result.clipPaths.length} 段；渲染未产出文件，请在合成节点检查`
      : `已准备时间线 ${result.clipPaths.length} 段，可在合成节点继续调整并导出`,
    scriptNodeId,
  };
}
