import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import type { ScriptDocumentAnalysis } from "@/lib/scriptDocument/scriptDocumentGaps";
import type { ScriptDocumentExtract } from "@/lib/scriptDocument/importScriptDocument";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

const ACK_MAX = 160;

export type HermesComposerUploadPending = {
  extract: ScriptDocumentExtract;
  analysis: ScriptDocumentAnalysis;
};

/** 聊天区短确认（不自动写入工程） */
export function formatHermesComposerUploadAck(
  extract: ScriptDocumentExtract,
  analysis: ScriptDocumentAnalysis,
): string {
  const parts = [
    `已读取「${extract.fileName}」`,
    `${analysis.charCount.toLocaleString()} 字`,
    extract.format ? extract.format.toUpperCase() : "",
  ].filter(Boolean);

  const notable = analysis.gaps
    .filter((g) => g.severity === "block" || g.severity === "warn")
    .map((g) => g.message)
    .slice(0, 2);
  if (notable.length > 0) parts.push(notable.join("；"));

  parts.push("未写入画布。可点下方「写入脚本」或「导入并解析」。");

  let line = parts.join(" · ");
  if (line.length > ACK_MAX) {
    line = `${line.slice(0, ACK_MAX - 1)}…`;
  }
  return line;
}

export function resolveHermesUploadScriptNodeId(
  nodes: Node<FlowNodeData>[],
): string | null {
  return findPrimaryScriptNode(nodes)?.id ?? null;
}

export function composerUploadHasBlock(analysis: ScriptDocumentAnalysis): boolean {
  return analysis.gaps.some((g) => g.severity === "block");
}
