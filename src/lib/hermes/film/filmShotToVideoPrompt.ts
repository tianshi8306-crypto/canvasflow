import {
  formatKnowledgeHitsForPrompt,
  hermesKnowledgeSearch,
  type HermesKnowledgeHit,
} from "@/lib/hermes/knowledge/hermesKnowledgeSearch";
import {
  beatIdsForShotNumbers,
  findPrimaryScriptNode,
} from "@/lib/hermes/hermesCanvasContext";
import { resolveHermesShotNumbers } from "@/lib/hermes/hermesReferentResolution";
import { handleScriptNodeCompleted } from "@/lib/hermes/autoChain";
import { findVideoNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  defaultVideoGenerationDraft,
  defaultVideoNodePersisted,
} from "@/lib/videoNodeTypes";
import {
  enrichShotsWithCharacterMotionPrompts,
  shouldUseMotionTemplate,
} from "@/lib/hermes/film/filmCharacterMotionPrompt";
import type { StoryboardShot } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";

const STYLE_SUFFIX: Record<string, string> = {
  古风: "中国古风，胶片质感，柔和光影，服饰细节清晰",
  写实: "电影级写实，自然光，浅景深",
  动漫: "二次元赛璐璐，线条清晰，色块分明",
  赛博: "赛博朋克，霓虹灯，雨夜反光，高对比",
};

const DEFAULT_MOTION = "镜头运动平稳，画面稳定";

export function buildSeedanceVideoPromptFromVisual(
  visualPrompt: string,
  opts?: { style?: string; ragSnippet?: string },
): string {
  const base = visualPrompt.trim();
  if (!base) return "";
  const styleKey = opts?.style?.trim() || "写实";
  const styleWords = STYLE_SUFFIX[styleKey] ?? STYLE_SUFFIX["写实"];
  const rag =
    opts?.ragSnippet?.trim() && opts.ragSnippet.length < 120
      ? `。${opts.ragSnippet.trim()}`
      : "";
  return `${base}。${DEFAULT_MOTION}。${styleWords}${rag}`.slice(0, 1200);
}

export type ShotToVideoPromptInput = {
  scriptNodeId?: string;
  beatIds?: number[];
  style?: string;
  sourceMessage?: string;
  ensureChain?: boolean;
  /** 对话意图：按内置人物动作模板 + LLM 补全（导演自动触发，非用户点技能） */
  useMotionTemplate?: boolean;
};

export type ShotToVideoPromptResult = {
  updated: number;
  skipped: number;
  message: string;
};

function resolveTargetBeatIds(
  scriptNodeId: string,
  beatIds: number[] | undefined,
  sourceMessage: string | undefined,
): string[] | undefined {
  if (beatIds?.length) {
    const beats = normalizeScriptBeats(
      useProjectStore.getState().nodes.find((n) => n.id === scriptNodeId)?.data
        .scriptBeats,
    );
    return beatIdsForShotNumbers(beats, beatIds);
  }
  const nums = sourceMessage ? resolveHermesShotNumbers(sourceMessage) : [];
  if (nums.length === 0) return undefined;
  const beats = normalizeScriptBeats(
    useProjectStore.getState().nodes.find((n) => n.id === scriptNodeId)?.data
      .scriptBeats,
  );
  const ids = beatIdsForShotNumbers(beats, nums);
  return ids.length > 0 ? ids : undefined;
}

function shotsForBeats(
  shots: StoryboardShot[],
  beatIdFilter: string[] | undefined,
): StoryboardShot[] {
  const withVisual = shots.filter((s) => s.visualPrompt?.trim());
  if (!beatIdFilter?.length) return withVisual;
  const set = new Set(beatIdFilter);
  return withVisual.filter((s) => set.has(s.scriptBeatId));
}

export async function runShotToVideoPromptTool(
  input: ShotToVideoPromptInput,
): Promise<ShotToVideoPromptResult> {
  const state = useProjectStore.getState();
  const scriptNodeId =
    input.scriptNodeId?.trim() ||
    findPrimaryScriptNode(state.nodes)?.id ||
    "";
  if (!scriptNodeId) {
    return { updated: 0, skipped: 0, message: "请先在画布上创建脚本节点" };
  }

  const scriptNode = state.nodes.find((n) => n.id === scriptNodeId);
  if (!scriptNode) {
    return { updated: 0, skipped: 0, message: "未找到脚本节点" };
  }

  let nodes = state.nodes;
  let edges = state.edges;

  if (input.ensureChain !== false) {
    const beatFilter = resolveTargetBeatIds(
      scriptNodeId,
      input.beatIds,
      input.sourceMessage,
    );
    handleScriptNodeCompleted(scriptNodeId, beatFilter ? { beatIds: beatFilter } : undefined);
    const fresh = useProjectStore.getState();
    nodes = fresh.nodes;
    edges = fresh.edges;
  }

  const shots = scriptNode.data.storyboardShots ?? [];
  const beatFilter = resolveTargetBeatIds(
    scriptNodeId,
    input.beatIds,
    input.sourceMessage,
  );
  const targetShots = shotsForBeats(shots, beatFilter);
  if (targetShots.length === 0) {
    return {
      updated: 0,
      skipped: 0,
      message: "没有带 visualPrompt 的分镜可生成视频提示词",
    };
  }

  const useMotion = shouldUseMotionTemplate(input.sourceMessage, {
    useMotionTemplate: input.useMotionTemplate,
  });
  if (useMotion) {
    const beats = normalizeScriptBeats(scriptNode.data.scriptBeats);
    const style = input.style ?? (/古风/.test(input.sourceMessage ?? "") ? "古风" : undefined);
    state.setStatusText("Hermes：按人物动作模板补全视频提示词…");
    const enriched = await enrichShotsWithCharacterMotionPrompts({
      scriptNodeId,
      shots: targetShots,
      beats,
      sourceMessage: input.sourceMessage?.trim() || "为各镜补全图生视频人物动作提示词",
      style,
    });
    const message =
      enriched.updated > 0
        ? `已按人物动作模板写入 ${enriched.updated} 镜视频提示词（${enriched.usedLlm ? "LLM+知识库" : "规则+知识库"}，跳过 ${enriched.skipped}）`
        : `未能写入视频提示词（跳过 ${enriched.skipped}；请确认已建链且分镜有 visualPrompt）`;
    state.setStatusText(`Hermes：${message}`);
    return { updated: enriched.updated, skipped: enriched.skipped, message };
  }

  let ragHits: HermesKnowledgeHit[] = [];
  try {
    ragHits = await hermesKnowledgeSearch({
      scene: "param",
      query: `Seedance 视频 人物动作 主动作 辅助动态 ${input.style ?? "写实"} 运镜`,
      limit: 3,
    });
  } catch {
    ragHits = [];
  }
  const ragSnippet = formatKnowledgeHitsForPrompt(ragHits).slice(0, 200);

  const videoByBeat = findVideoNodesForScript(scriptNodeId, nodes, edges);
  let updated = 0;
  let skipped = 0;

  for (const shot of targetShots) {
    const videoNodeId = videoByBeat.get(shot.scriptBeatId);
    if (!videoNodeId) {
      skipped += 1;
      continue;
    }
    const prompt = buildSeedanceVideoPromptFromVisual(shot.visualPrompt ?? "", {
      style: input.style,
      ragSnippet,
    });
    if (!prompt) {
      skipped += 1;
      continue;
    }
    const vnode = nodes.find((n) => n.id === videoNodeId);
    const curVideo = vnode?.data.video ?? defaultVideoNodePersisted();
    state.updateNodeData(videoNodeId, {
      video: {
        ...curVideo,
        draft: {
          ...defaultVideoGenerationDraft(),
          ...curVideo.draft,
          prompt,
        },
      },
    });
    updated += 1;
  }

  const message =
    updated > 0
      ? `已为 ${updated} 个视频节点写入 Seedance 提示词（跳过 ${skipped}）`
      : `未写入任何视频提示词：请先建链或生成分镜（跳过 ${skipped}）`;

  state.setStatusText(`Hermes：${message}`);
  return { updated, skipped, message };
}
