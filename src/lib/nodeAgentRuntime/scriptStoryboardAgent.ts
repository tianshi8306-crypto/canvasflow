import { invoke } from "@tauri-apps/api/core";
import { extractJsonArray } from "@/lib/storyboardParse";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import type { ScriptBeat, StoryboardShot, StoryboardShotStatus } from "@/lib/types";
import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";
import { appLogger } from "@/lib/appLogger";

const SB_SYSTEM = `你是影视分镜助理。用户会给出多条「脚本镜头」JSON，每条含 id、场次、景别、描述等。
请为**用户列出的每一条镜头**输出一条用于文生图关键帧的画面描述（visualPrompt）。

写作规则：
- 每条镜**一个主要动作**；用现在时、可视画面（谁在哪做什么），勿写抽象情绪而无画面
- visualPrompt 须含：主体、环境、光线/色调、景别（远景/全景/中景/近景/特写择一）
- **不要**把对白/旁白原文塞进 visualPrompt（台词走音频轨）
- 全剧 visualStyle/氛围与用户在「全剧主题」中一致；古风/赛博等风格词写入画面而非空泛形容词
- compositionNote：构图、色温、镜头感补充；negativePrompt：低质量、水印、多余肢体等（可空）

务必只输出一个 JSON 数组，不要用 markdown 代码块，不要输出数组以外的任何文字。
数组元素必须为对象，且包含字段：
- scriptBeatId：字符串，必须与输入条目的 id **完全一致**
- visualPrompt：字符串，中文
- compositionNote：字符串，可为空
- negativePrompt：字符串，可为空

示例（格式示意）：
[{"scriptBeatId":"uuid-1","visualPrompt":"...","compositionNote":"","negativePrompt":""}]`;

type ParsedRow = {
  scriptBeatId?: string;
  visualPrompt?: string;
  compositionNote?: string;
  negativePrompt?: string;
};

function mergeShots(prev: StoryboardShot[] | undefined, parsed: ParsedRow[]): StoryboardShot[] {
  const map = new Map((prev ?? []).map((s) => [s.scriptBeatId, { ...s }]));
  for (const p of parsed) {
    const id = typeof p.scriptBeatId === "string" ? p.scriptBeatId.trim() : "";
    if (!id) continue;
    const existing = map.get(id);
    map.set(id, {
      scriptBeatId: id,
      visualPrompt: typeof p.visualPrompt === "string" ? p.visualPrompt : "",
      compositionNote:
        typeof p.compositionNote === "string" && p.compositionNote ? p.compositionNote : undefined,
      negativePrompt:
        typeof p.negativePrompt === "string" && p.negativePrompt ? p.negativePrompt : undefined,
      status: "generated",
      error: undefined,
      ...(existing?.imagePath ? { imagePath: existing.imagePath } : {}),
      ...(existing?.imageAssetId ? { imageAssetId: existing.imageAssetId } : {}),
    });
  }
  return [...map.values()];
}

function setShotsStatus(
  shots: StoryboardShot[] | undefined,
  targetIds: string[],
  status: StoryboardShotStatus,
  error?: string,
): StoryboardShot[] {
  const targetSet = new Set(targetIds);
  return (shots ?? []).map((s) =>
    targetSet.has(s.scriptBeatId)
      ? { ...s, status, ...(error ? { error } : {}), ...(status === "generating" ? { retryCount: (s.retryCount ?? 0) + 1 } : {}) }
      : s,
  );
}

type StoryboardLlmParams = {
  providerId?: string;
  model?: string;
};

type StoryboardGenerateInput = {
  targetBeats: ScriptBeat[];
  themePrompt: string;
  prevShots: StoryboardShot[] | undefined;
  llmParams?: StoryboardLlmParams;
};

type StoryboardGenerateSensed = {
  payload: ScriptBeat[];
  theme: string;
  prevShots: StoryboardShot[] | undefined;
  llmParams: StoryboardLlmParams;
};

type StoryboardGenerateExecuted = {
  parsed: ParsedRow[];
  prevShots: StoryboardShot[] | undefined;
};

type StoryboardGenerateCommitted = {
  storyboardShots: StoryboardShot[];
  parsedCount: number;
};

/**
 * 脚本分镜文案生成 Agent：LLM 解析 -> Schema 校验 -> 回写 storyboardShots。
 */
export const scriptStoryboardGenerateAgentRuntime: NodeTaskAgentRuntime<
  StoryboardGenerateInput,
  StoryboardGenerateSensed,
  StoryboardGenerateExecuted,
  StoryboardGenerateCommitted
> = {
  agentName: "分镜生成 Agent",
  sense: ({ targetBeats, themePrompt, prevShots, llmParams }) => {
    if (targetBeats.length === 0) {
      throw new Error("没有可生成分镜的脚本条目");
    }
    const payload = targetBeats.map((b) => normalizeScriptBeat(b));
    const theme = themePrompt.trim() || "（未填主题）";
    return { payload, theme, prevShots, llmParams: llmParams ?? {} };
  },
  execute: async ({ payload, theme, prevShots, llmParams }, ctx) => {
    const targetIds = payload.map((b) => b.id);
    ctx.setStatusText(`正在请求 LLM 生成分镜文案（${payload.length} 条）…`);

    if (ctx.cancelToken?.cancelled) {
      // 已被取消，不标记 generating，直接抛出
      throw new Error("任务已取消");
    }

    // Mark targets as generating before LLM call
    ctx.updateNodeData(ctx.nodeId, {
      storyboardShots: setShotsStatus(prevShots, targetIds, "generating"),
    });
    try {
      const user = `全剧主题/梗概：${theme}\n\n请为以下脚本镜头生成分镜 JSON 数组：\n${JSON.stringify(payload, null, 2)}`;
      const raw = await invoke<string>("llm_complete_text", {
        systemPrompt: SB_SYSTEM,
        userPrompt: user,
        ...llmParams,
      });
      const parsed = extractJsonArray<ParsedRow>(raw);
      if (!parsed || parsed.length === 0) {
        appLogger.warn("[scriptStoryboardAgent] LLM 返回无法解析为有效分镜数组", { raw: raw.slice(0, 500) });
        return { parsed: [], prevShots };
      }
      return { parsed, prevShots };
    } catch (err) {
      const isCancelled = ctx.cancelToken?.cancelled;
      // 取消时回退到 idle，而非 marked as failed
      ctx.updateNodeData(ctx.nodeId, {
        storyboardShots: setShotsStatus(prevShots, targetIds, isCancelled ? "idle" : "failed", isCancelled ? undefined : String(err)),
      });
      throw err;
    }
  },
  validate: ({ parsed, prevShots }) => {
    if (!parsed || parsed.length === 0) {
      throw new Error("分镜解析失败：模型未返回有效 JSON 数组，请查看运行日志或重试");
    }
    const storyboardShots = mergeShots(prevShots, parsed);
    return { storyboardShots, parsedCount: parsed.length };
  },
  commit: ({ storyboardShots, parsedCount }, ctx) => {
    ctx.updateNodeData(ctx.nodeId, { storyboardShots });
    ctx.setStatusText(`已更新分镜文案（解析 ${parsedCount} 条，合并后 ${storyboardShots.length} 条缓存）`);
  },
};

