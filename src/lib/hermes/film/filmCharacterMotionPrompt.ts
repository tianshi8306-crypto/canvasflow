import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  formatKnowledgeHitsForPrompt,
  hermesKnowledgeSearch,
} from "@/lib/hermes/knowledge/hermesKnowledgeSearch";
import { pickHermesLlmProvider } from "@/lib/hermes/pickHermesProvider";
import { buildSeedanceVideoPromptFromVisual } from "@/lib/hermes/film/filmShotToVideoPrompt";
import { extractJsonArray } from "@/lib/storyboardParse";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { patchStoryboardShot } from "@/lib/storyboard/patchStoryboardShot";
import { findVideoNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";
import type { ScriptBeat, StoryboardShot } from "@/lib/types";
import {
  defaultVideoGenerationDraft,
  defaultVideoNodePersisted,
} from "@/lib/videoNodeTypes";
import { useProjectStore } from "@/store/projectStore";

/** 用户话术：要写/补全图生视频人物动作层（非纯问答） */
export function wantsCharacterMotionVideoPrompt(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(text.trim())) return false;
  return /人物动作|动作提示|动作视频|运动提示|动态描述|图生视频.*动|视频.*动(?:作|态)|写.*视频.*(?:动|提示)|补全.*视频|videoMotion|主动作|辅助动态|按.*模板.*视频/i.test(
    text,
  );
}

export function shouldUseMotionTemplate(
  sourceMessage: string | undefined,
  stepArgs?: Record<string, unknown>,
): boolean {
  if (stepArgs?.useMotionTemplate === true) return true;
  if (sourceMessage?.trim() && wantsCharacterMotionVideoPrompt(sourceMessage)) {
    return true;
  }
  return false;
}

const MOTION_LLM_SYSTEM = `你是图生视频导演助理。严格按「人物动作提示词」规范为每个镜头写动态描述。

结构（每镜）：1 个主动作 + 1 个辅助动态 + 情绪状态 + 结束画面 + 一句镜头；简洁连贯，不要堆砌多个无关动作。
文末可加：人物需完成明确动作，不要只站立不动；动作保持简洁清晰。

输出 JSON 数组，每项字段：
- shotNumber：镜号字符串（与输入一致）
- videoMotionPrompt：写入镜头表的「视频运动提示词」字段（偏动态层，可含镜头句）
- seedancePrompt：完整 Seedance 图生视频 prompt（静态画面 + 动态 + 风格，一段中文）

若该镜典型为「单张分镜图 → 视频」，可在 seedancePrompt 末尾加「 @图1 」锚定参考图（仅当用户/流程已图生视频连线）；勿编造不存在的 @ 文件名。

只输出 JSON 数组，不要 markdown。`;

type MotionLlmRow = {
  shotNumber?: string;
  videoMotionPrompt?: string;
  seedancePrompt?: string;
};

async function loadMotionKnowledgeBlock(): Promise<string> {
  try {
    const hits = await hermesKnowledgeSearch({
      scene: "creative",
      query: "图生视频 人物动作 主动作 辅助动态 动作链 镜头",
      limit: 4,
    });
    return formatKnowledgeHitsForPrompt(hits).slice(0, 2400);
  } catch {
    return "";
  }
}

function shotRowsForLlm(
  shots: StoryboardShot[],
  beats: ScriptBeat[],
): { shotNumber: string; beatId: string; visual: string; scene?: string }[] {
  const beatById = new Map(beats.map((b) => [b.id, b]));
  return shots.map((s) => {
    const beat = beatById.get(s.scriptBeatId);
    return {
      shotNumber: beat?.shotNumber?.trim() || "?",
      beatId: s.scriptBeatId,
      visual: s.visualPrompt?.trim() || beat?.description?.trim() || "",
      scene: beat?.scene?.trim(),
    };
  });
}

export async function generateMotionPromptsViaLlm(opts: {
  shots: StoryboardShot[];
  beats: ScriptBeat[];
  sourceMessage: string;
  style?: string;
}): Promise<Map<string, { videoMotionPrompt: string; seedancePrompt: string }>> {
  const out = new Map<string, { videoMotionPrompt: string; seedancePrompt: string }>();
  if (!isTauri()) return out;

  const provider = await pickHermesLlmProvider();
  if (!provider) return out;

  const rows = shotRowsForLlm(opts.shots, opts.beats).filter((r) => r.visual);
  if (rows.length === 0) return out;

  const knowledge = await loadMotionKnowledgeBlock();
  const userPrompt = [
    "## 知识库（人物动作模板）",
    knowledge || "（内置：1主动作+1辅助动态+情绪+结束画面+镜头）",
    "",
    "## 用户指令",
    opts.sourceMessage.trim(),
    "",
    "## 镜头列表（为每镜写 videoMotionPrompt 与 seedancePrompt）",
    JSON.stringify(
      rows.map((r) => ({
        shotNumber: r.shotNumber,
        scene: r.scene,
        visualPrompt: r.visual,
      })),
      null,
      2,
    ),
    "",
    `视觉风格锚点：${opts.style?.trim() || "写实"}`,
  ].join("\n");

  try {
    const raw = await invoke<string>("llm_complete_text", {
      systemPrompt: MOTION_LLM_SYSTEM,
      userPrompt,
      providerId: provider.providerId,
      model: provider.model,
    });
    const parsed = extractJsonArray<MotionLlmRow>(raw) ?? [];
    const byShotNum = new Map(
      rows.map((r) => [r.shotNumber, r.beatId] as const),
    );
    for (const row of parsed) {
      const num = String(row.shotNumber ?? "").trim();
      const beatId = byShotNum.get(num);
      if (!beatId) continue;
      const motion = String(row.videoMotionPrompt ?? "").trim();
      const full = String(row.seedancePrompt ?? "").trim();
      if (!motion && !full) continue;
      out.set(beatId, {
        videoMotionPrompt: motion || full.slice(0, 400),
        seedancePrompt: full || motion,
      });
    }
  } catch {
    return out;
  }
  return out;
}

export function applyMotionPromptToCanvas(opts: {
  scriptNodeId: string;
  beatId: string;
  videoMotionPrompt: string;
  seedancePrompt: string;
  style?: string;
}): boolean {
  const state = useProjectStore.getState();
  const { scriptNodeId, beatId } = opts;
  const motion = opts.videoMotionPrompt.trim();
  const full = opts.seedancePrompt.trim();

  const scriptNode = state.nodes.find((n) => n.id === scriptNodeId);
  if (!scriptNode) return false;

  const beats = normalizeScriptBeats(scriptNode.data.scriptBeats).map((b) =>
    b.id === beatId ? { ...b, videoMotionPrompt: motion || b.videoMotionPrompt } : b,
  );
  state.updateNodeData(scriptNodeId, { scriptBeats: beats });

  const videoByBeat = findVideoNodesForScript(scriptNodeId, state.nodes, state.edges);
  const videoNodeId = videoByBeat.get(beatId);
  if (!videoNodeId) return Boolean(motion);

  const draftText =
    full ||
    buildSeedanceVideoPromptFromVisual(
      scriptNode.data.storyboardShots?.find((s) => s.scriptBeatId === beatId)
        ?.visualPrompt ?? "",
      { style: opts.style },
    );
  if (!draftText.trim()) return false;

  const vnode = state.nodes.find((n) => n.id === videoNodeId);
  const curVideo = vnode?.data.video ?? defaultVideoNodePersisted();
  state.updateNodeData(videoNodeId, {
    video: {
      ...curVideo,
      draft: {
        ...defaultVideoGenerationDraft(),
        ...curVideo.draft,
        prompt: draftText.slice(0, 1200),
      },
    },
  });
  return true;
}

/** 按人物动作模板批量写入 videoMotionPrompt + video draft（对话/导演自动触发） */
export async function enrichShotsWithCharacterMotionPrompts(opts: {
  scriptNodeId: string;
  shots: StoryboardShot[];
  beats: ScriptBeat[];
  sourceMessage: string;
  style?: string;
}): Promise<{ updated: number; skipped: number; usedLlm: boolean }> {
  const llmMap = await generateMotionPromptsViaLlm(opts);
  const usedLlm = llmMap.size > 0;
  let updated = 0;
  let skipped = 0;

  const ragFallback = usedLlm
    ? ""
    : formatKnowledgeHitsForPrompt(
        await hermesKnowledgeSearch({
          scene: "creative",
          query: "人物动作 主动作 辅助动态",
          limit: 2,
        }).catch(() => []),
      ).slice(0, 180);

  for (const shot of opts.shots) {
    const beatId = shot.scriptBeatId;
    const fromLlm = llmMap.get(beatId);
    let videoMotionPrompt = fromLlm?.videoMotionPrompt ?? "";
    let seedancePrompt = fromLlm?.seedancePrompt ?? "";

    if (!seedancePrompt) {
      seedancePrompt = buildSeedanceVideoPromptFromVisual(shot.visualPrompt ?? "", {
        style: opts.style,
        ragSnippet: ragFallback,
      });
      if (!videoMotionPrompt && ragFallback) {
        videoMotionPrompt = "按分镜完成一组连贯人物动作，含主动作与辅助动态，镜头平稳跟随。";
      }
    }

    if (!seedancePrompt.trim()) {
      skipped += 1;
      continue;
    }

    if (applyMotionPromptToCanvas({
      scriptNodeId: opts.scriptNodeId,
      beatId,
      videoMotionPrompt,
      seedancePrompt,
    })) {
      patchStoryboardShot(
        opts.scriptNodeId,
        beatId,
        { status: "generated", error: undefined },
        useProjectStore.getState().updateNodeData,
      );
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return { updated, skipped, usedLlm };
}
