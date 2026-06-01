import type { Edge, Node } from "@xyflow/react";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import { assessBatchVideoReadiness } from "@/lib/storyboard/scriptProductionExport";
import { findVideoNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";
import type { ProjectBible } from "@/lib/projectBible/projectBible";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";
import { getOutputPortType } from "@/lib/flowConnectionPolicy";

export type WorkflowCheckStageStatus = "done" | "partial" | "todo";

export type WorkflowCheckStage = {
  id: string;
  label: string;
  status: WorkflowCheckStageStatus;
  detail: string;
  /** 建议用户下一句话术 */
  suggestedPrompt?: string;
};

export type FilmWorkflowCheckReport = {
  stages: WorkflowCheckStage[];
  summary: string;
  blockers: number;
  warnings: number;
  nextPrompt?: string;
};

function hasTextToScriptLink(
  scriptNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): boolean {
  for (const e of edges) {
    if (isEdgeDisabled(e)) continue;
    if (e.target !== scriptNodeId) continue;
    const source = nodes.find((n) => n.id === e.source);
    if (source?.type !== "textNode") continue;
    const out = getOutputPortType("textNode");
    const payload = (e.data as { payloadType?: string } | undefined)?.payloadType;
    if (!payload || payload === out) return true;
  }
  return false;
}

function countVideoDraftMissing(
  scriptNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): number {
  const script = nodes.find((n) => n.id === scriptNodeId);
  if (!script) return 0;
  const readiness = assessBatchVideoReadiness({
    scriptNodeId,
    beats: script.data.scriptBeats ?? [],
    shots: script.data.storyboardShots ?? [],
    nodes,
    edges,
    scriptBeatSelection: undefined,
  });
  if (!("canStart" in readiness)) return 0;
  return readiness.skipCounts.no_draft_prompt ?? 0;
}

export function buildFilmWorkflowCheckReport(opts: {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  projectPath: string | null;
  bible?: ProjectBible | null;
  selectedNodeIds?: string[];
}): FilmWorkflowCheckReport {
  const situation = buildHermesSituation(
    opts.nodes,
    opts.edges,
    opts.projectPath,
    { bible: opts.bible ?? null, selectedNodeIds: opts.selectedNodeIds },
  );
  const { ctx, production } = situation;
  const script = findPrimaryScriptNode(opts.nodes);
  const scriptNodeId = script?.id ?? ctx.scriptNodeId;
  const stages: WorkflowCheckStage[] = [];

  if (!opts.projectPath?.trim()) {
    stages.push({
      id: "project",
      label: "工程",
      status: "todo",
      detail: "未打开工程，生成类操作不可用",
      suggestedPrompt: "我先打开工程后再检查流程",
    });
  } else {
    stages.push({
      id: "project",
      label: "工程",
      status: "done",
      detail: "工程已打开",
    });
  }

  const hasOutline =
    Boolean(script?.data.prompt?.trim()) ||
    (scriptNodeId ? hasTextToScriptLink(scriptNodeId, opts.nodes, opts.edges) : false) ||
    opts.nodes.some((n) => n.type === "textNode" && (n.data.prompt ?? "").trim());

  stages.push({
    id: "outline",
    label: "大纲 / 梗概",
    status: hasOutline ? "done" : "todo",
    detail: hasOutline ? "已有创意梗概或大纲节点" : "缺少 textNode 大纲或脚本梗概",
    suggestedPrompt: hasOutline ? undefined : "帮我搭建 30 秒短剧标准流程",
  });

  stages.push({
    id: "script",
    label: "脚本节点",
    status: scriptNodeId ? "done" : "todo",
    detail: scriptNodeId ? "画布上已有 scriptNode" : "尚未创建脚本节点",
    suggestedPrompt: scriptNodeId ? undefined : "在画布上创建脚本节点",
  });

  if (production.beatCount === 0) {
    stages.push({
      id: "beats",
      label: "镜头表",
      status: "todo",
      detail: "scriptBeats 为空",
      suggestedPrompt: "帮我根据梗概生成镜头表",
    });
  } else {
    stages.push({
      id: "beats",
      label: "镜头表",
      status: "done",
      detail: `共 ${production.beatCount} 镜`,
    });
  }

  if (production.beatCount > 0) {
    if (production.storyboardReady === 0) {
      stages.push({
        id: "storyboard",
        label: "分镜文案",
        status: production.storyboardMissing > 0 ? "partial" : "todo",
        detail:
          production.storyboardFailed > 0
            ? `${production.storyboardFailed} 镜分镜失败，${production.storyboardMissing} 镜未就绪`
            : `0/${production.beatCount} 镜分镜就绪`,
        suggestedPrompt: "帮我把脚本生成分镜",
      });
    } else {
      stages.push({
        id: "storyboard",
        label: "分镜文案",
        status:
          production.storyboardMissing > 0 || production.storyboardFailed > 0
            ? "partial"
            : "done",
        detail: `${production.storyboardReady}/${production.beatCount} 镜 visualPrompt 就绪`,
        suggestedPrompt:
          production.storyboardMissing > 0 ? "帮我把脚本生成分镜" : undefined,
      });
    }
  }

  if (production.storyboardReady > 0) {
    const videoByBeat =
      scriptNodeId != null
        ? findVideoNodesForScript(scriptNodeId, opts.nodes, opts.edges)
        : new Map<string, string>();
    const mediaStatus =
      videoByBeat.size === 0 && production.imageReady === 0
        ? "todo"
        : production.imageMissing > 0 || videoByBeat.size < production.storyboardReady
          ? "partial"
          : "done";
    stages.push({
      id: "media_chain",
      label: "媒体建链",
      status: mediaStatus,
      detail:
        videoByBeat.size > 0
          ? `已绑定 ${videoByBeat.size} 个 videoNode，${production.imageReady} 镜有关键帧`
          : production.imageReady > 0
            ? `${production.imageReady} 镜有关键帧，建议建 video 节点`
            : "尚未为分镜创建 image/video 节点",
      suggestedPrompt:
        mediaStatus !== "done" ? "为分镜创建图片/视频节点配对" : undefined,
    });

    const missingDraft =
      scriptNodeId != null
        ? countVideoDraftMissing(scriptNodeId, opts.nodes, opts.edges)
        : 0;
    stages.push({
      id: "video_prompt",
      label: "视频提示词",
      status:
        missingDraft === 0 && production.videoEligible > 0
          ? "done"
          : missingDraft > 0
            ? "partial"
            : "todo",
      detail:
        missingDraft > 0
          ? `${missingDraft} 镜 videoNode 缺少 draft.prompt`
          : production.videoEligible > 0
            ? `${production.videoEligible} 镜可提交视频生成`
            : "分镜图或草稿未就绪",
      suggestedPrompt:
        missingDraft > 0 ? "帮我把分镜转成 Seedance 视频提示词" : undefined,
    });
  }

  if (production.exportTotal > 0) {
    stages.push({
      id: "export",
      label: "合成导出",
      status: production.exportReady > 0 ? "partial" : "todo",
      detail:
        production.exportReady > 0
          ? `${production.exportReady}/${production.exportTotal} 镜可导出成片`
          : "尚无已出片视频可合成",
      suggestedPrompt:
        production.exportReady > 0 ? "帮我把脚本导出成片" : undefined,
    });
  }

  const blockers = stages.filter((s) => s.status === "todo").length;
  const warnings = stages.filter((s) => s.status === "partial").length;
  const next = stages.find((s) => s.suggestedPrompt)?.suggestedPrompt;
  const summary =
    blockers === 0 && warnings === 0
      ? `流程就绪（${stages.length} 项检查通过）`
      : `发现 ${blockers} 项待办、${warnings} 项待完善`;

  return {
    stages,
    summary,
    blockers,
    warnings,
    ...(next ? { nextPrompt: next } : {}),
  };
}

export function formatFilmWorkflowCheckMessage(report: FilmWorkflowCheckReport): string {
  const icon = (s: WorkflowCheckStageStatus) =>
    s === "done" ? "✓" : s === "partial" ? "△" : "○";
  const lines = report.stages.map((s) => `${icon(s.status)} ${s.label}：${s.detail}`);
  const tail = report.nextPrompt
    ? `\n\n建议下一步：${report.nextPrompt}`
    : "";
  return `${report.summary}\n\n${lines.join("\n")}${tail}`;
}
