import type { ScriptBeat, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";

export type ScriptNodeExportPayload = {
  version: 1;
  exportedAt: number;
  nodeId: string;
  title: string;
  themePrompt: string;
  scriptBeats: ScriptBeat[];
  storyboardShots: StoryboardShot[];
};

/** 下载脚本节点 JSON（与全屏 Overlay 导出格式一致） */
export function downloadScriptNodeExportJson(payload: ScriptNodeExportPayload): string {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safeTitle = (payload.title || "script")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  const file = `${safeTitle || "script"}-export-${new Date().toISOString().slice(0, 10)}.json`;
  const a = document.createElement("a");
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return file;
}

export function buildScriptNodeExportPayload(args: {
  nodeId: string;
  label?: string;
  themePrompt: string;
  beats: ScriptBeat[];
  storyboardShots?: StoryboardShot[];
}): ScriptNodeExportPayload {
  const title =
    args.label?.trim() ||
    (args.themePrompt.trim() ? args.themePrompt.slice(0, 80) : "脚本生成器");
  return {
    version: 1,
    exportedAt: Date.now(),
    nodeId: args.nodeId,
    title,
    themePrompt: args.themePrompt,
    scriptBeats: normalizeScriptBeats(args.beats.length ? args.beats : []),
    storyboardShots: args.storyboardShots ?? [],
  };
}
