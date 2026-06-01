import type { Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";

export type HermesCanvasContext = {
  projectPath: string | null;
  scriptNodeId: string | null;
  beatCount: number;
  storyboardReadyCount: number;
  hasBrief: boolean;
  beatIds: string[];
};

function readyStoryboardShots(shots: StoryboardShot[] | undefined): StoryboardShot[] {
  return (shots ?? []).filter((s) => s.status === "generated" && Boolean(s.visualPrompt?.trim()));
}

export function findPrimaryScriptNode(nodes: Node<FlowNodeData>[]): Node<FlowNodeData> | null {
  const scripts = nodes.filter((n) => n.type === "scriptNode");
  if (scripts.length === 0) return null;
  return scripts.sort((a, b) => b.position.x - a.position.x)[0] ?? null;
}

export function buildHermesCanvasContext(
  nodes: Node<FlowNodeData>[],
  projectPath: string | null,
): HermesCanvasContext {
  const script = findPrimaryScriptNode(nodes);
  const beats = normalizeScriptBeats(script?.data.scriptBeats);
  const ready = readyStoryboardShots(script?.data.storyboardShots);
  const brief = (script?.data.prompt ?? "").toString().trim();
  return {
    projectPath,
    scriptNodeId: script?.id ?? null,
    beatCount: beats.length,
    storyboardReadyCount: ready.length,
    hasBrief: brief.length > 0,
    beatIds: beats.map((b) => b.id),
  };
}

/** 从用户句子里解析镜号（第 1 镜、镜2、beat 3）→ 0-based 索引列表 */
export function parseShotNumbersFromMessage(text: string): number[] {
  const found = new Set<number>();
  const patterns = [
    /第\s*(\d+)\s*镜/g,
    /镜\s*(\d+)/g,
    /(\d+)\s*号镜/g,
    /镜号\s*(\d+)/g,
    /beat\s*#?\s*(\d+)/gi,
    /镜头\s*(\d+)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1]!, 10);
      if (n >= 1 && n < 200) found.add(n);
    }
  }
  return [...found].sort((a, b) => a - b);
}

/** 将镜号（1-based）映射到 beatId；越界则忽略 */
export function beatIdsForShotNumbers(
  beats: ScriptBeat[],
  shotNumbers: number[],
): string[] {
  if (shotNumbers.length === 0) return [];
  const ids: string[] = [];
  for (const n of shotNumbers) {
    const beat = beats[n - 1];
    if (beat?.id) ids.push(beat.id);
  }
  return ids;
}

export function summarizeCanvasForDirector(ctx: HermesCanvasContext): string {
  const parts = [
    ctx.scriptNodeId ? `脚本节点：有（${ctx.beatCount} 条镜头）` : "脚本节点：无",
    `分镜就绪：${ctx.storyboardReadyCount} 镜`,
    ctx.hasBrief ? "梗概：已填写" : "梗概：未填写",
    ctx.projectPath ? "工程：已打开" : "工程：未打开",
  ];
  return parts.join("；");
}
