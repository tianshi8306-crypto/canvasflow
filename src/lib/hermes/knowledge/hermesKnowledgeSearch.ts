import { invoke, isTauri } from "@tauri-apps/api/core";
import type { HermesSituation } from "@/lib/hermes/hermesSituation";
import {
  buildKnowledgeQueryFromSituation,
  pickKnowledgeScenesFromSituation,
} from "@/lib/hermes/hermesProductionExpert";

export type HermesKnowledgeScene =
  | "workflow"
  | "param"
  | "creative"
  | "troubleshoot"
  | "film_theory"
  | "general_film";

export type HermesKnowledgeHit = {
  docId: string;
  category: string;
  title: string;
  body: string;
  sourcePath: string;
  score: number;
};

export async function hermesKnowledgeSearch(opts: {
  scene?: HermesKnowledgeScene;
  query: string;
  limit?: number;
  /** 当前工程路径：合并检索用户自建技巧库 */
  projectPath?: string | null;
}): Promise<HermesKnowledgeHit[]> {
  if (!isTauri()) return [];
  const query = opts.query.trim();
  if (!query) return [];
  const projectPath = opts.projectPath?.trim() || null;
  const rows = await invoke<
    {
      docId: string;
      category: string;
      title: string;
      body: string;
      sourcePath: string;
      score: number;
    }[]
  >("hermes_knowledge_search", {
    scene: opts.scene ?? null,
    query,
    limit: opts.limit ?? 3,
    projectPath,
  });
  return rows;
}

export async function hermesKnowledgeReindex(opts?: {
  knowledgeRoot?: string;
  projectPath?: string | null;
}): Promise<number> {
  if (!isTauri()) return 0;
  return invoke<number>("hermes_knowledge_reindex", {
    knowledgeRoot: opts?.knowledgeRoot ?? null,
    projectPath: opts?.projectPath?.trim() || null,
  });
}

/** 对话中是否值得检索知识库（排障 / 参数 / 分镜写法 / 流程） */
export function pickHermesKnowledgeSceneForChat(message: string): HermesKnowledgeScene | null {
  const t = message.trim();
  if (t.length < 4) return null;
  if (/排障|失败|抖动|畸变|报错|为什么.*(视频|出图)|无法.*生成/.test(t)) return "troubleshoot";
  if (/seedance|时长|竖屏|横屏|参数|分辨率|@图|draft\.prompt/i.test(t)) return "param";
  if (/角色一致|ip-adapter|lora|controlnet|运镜|animate|comfyui|全流程/i.test(t)) {
    return "creative";
  }
  if (
    /分镜|景别|运镜|镜头表|visualPrompt|文生图|关键帧|怎么写.*prompt/i.test(t)
  ) {
    return "creative";
  }
  if (
    /图生视频|人物动作|主动作|辅助动态|videoMotion|视频提示词|动作链|步态|身体联动|不动|动作太乱/i.test(
      t,
    )
  ) {
    return "creative";
  }
  if (
    /TTS|配音|旁白|音色|台词|表演|悲伤地说|愤怒地说|语音合成|声音设计师/i.test(t)
  ) {
    return "creative";
  }
  if (/流程|SOP|搭.*链路|短剧.*步骤|还缺什么/.test(t)) return "workflow";
  return null;
}

function hasFilmTheoryConsultSignal(message: string): boolean {
  const t = message.trim();
  return (
    /蒙太奇|长镜头|跳切|三幕|类型片|叙事结构|景别|运镜|构图|片单|推荐.*电影|影史|奥斯卡/.test(
      t,
    ) || /电影.{0,6}(是什么|怎么|如何)|导演|编剧|影评/.test(t)
  );
}

/** 顾问模式：可多场景检索（仍映射到内置 creative/sop 等目录） */
export function pickHermesKnowledgeScenesForChat(
  message: string,
  opts?: { advisorMode?: boolean },
): HermesKnowledgeScene[] {
  const scenes: HermesKnowledgeScene[] = [];
  const primary = pickHermesKnowledgeSceneForChat(message);
  if (primary) scenes.push(primary);
  if (hasFilmTheoryConsultSignal(message)) {
    scenes.push("film_theory");
  }
  if (opts?.advisorMode && scenes.length === 0) {
    scenes.push("film_theory");
  }
  return [...new Set(scenes)].slice(0, 3);
}

/** Brain 流式对话：按需拼接知识片段到 situation */
export async function fetchHermesKnowledgeBlockForChat(
  message: string,
  projectPath?: string | null,
  opts?: { advisorMode?: boolean },
): Promise<string> {
  const scenes = pickHermesKnowledgeScenesForChat(message, opts);
  if (scenes.length === 0) return "";
  return fetchKnowledgeBlockForScenes(scenes, message.trim().slice(0, 160), projectPath);
}

/** 按画布制片状态预取知识（灵体常驻对话、空输入规划） */
export async function fetchHermesKnowledgeBlockForSituation(
  situation: HermesSituation,
  projectPath?: string | null,
  userMessage?: string,
): Promise<string> {
  const fromMsg = userMessage?.trim()
    ? pickHermesKnowledgeScenesForChat(userMessage)
    : [];
  const fromCanvas = pickKnowledgeScenesFromSituation(situation);
  const scenes = [...new Set([...fromMsg, ...fromCanvas])].slice(0, 3);
  if (scenes.length === 0) return "";
  const query = buildKnowledgeQueryFromSituation(situation, userMessage);
  return fetchKnowledgeBlockForScenes(scenes, query, projectPath);
}

async function fetchKnowledgeBlockForScenes(
  scenes: HermesKnowledgeScene[],
  query: string,
  projectPath?: string | null,
): Promise<string> {
  if (!query.trim()) return "";
  try {
    const blocks: string[] = [];
    for (const scene of scenes) {
      const hits = await hermesKnowledgeSearch({
        scene,
        query,
        limit: 2,
        projectPath,
      });
      const block = formatKnowledgeHitsForPrompt(hits);
      if (block) blocks.push(`（${scene}）\n${block}`);
    }
    if (blocks.length === 0) return "";
    return `\n\n【知识库参考】\n${blocks.join("\n\n").slice(0, 2400)}`;
  } catch {
    return "";
  }
}

/** 将检索片段拼成 Planner / Tool 可用的短上下文（≤2000 字） */
export function formatKnowledgeHitsForPrompt(hits: HermesKnowledgeHit[]): string {
  if (hits.length === 0) return "";
  const parts = hits.map(
    (h, i) => `[${i + 1}] ${h.title}（${h.category}）\n${h.body.trim()}`,
  );
  return parts.join("\n\n").slice(0, 2000);
}
