import { invoke, isTauri } from "@tauri-apps/api/core";

export const HERMES_MEMORY_REL_PATH = ".canvasflow/hermes/memory.json";

export type HermesMemoryFactTag =
  | "user"
  | "procedure"
  | "failure"
  | "avoid"
  | "reflect"
  | "pref"
  | "other";

export type HermesMemoryFact = {
  id: string;
  text: string;
  source: "user" | "agent";
  createdAt: string;
};

export type HermesPersistentMemory = {
  version: 1;
  userProfile: string;
  facts: HermesMemoryFact[];
  /** 灵体自定义名（对话写入） */
  spiritName?: string;
  /** 灵体对用户的称呼 */
  userHonorific?: string;
  /** 是否已展示过首次自我介绍 */
  spiritIntroShown?: boolean;
  updatedAt: string;
};

function emptyMemory(): HermesPersistentMemory {
  const now = new Date().toISOString();
  return { version: 1, userProfile: "", facts: [], updatedAt: now };
}

export async function loadHermesPersistentMemory(
  projectPath: string | null,
): Promise<HermesPersistentMemory> {
  if (!projectPath?.trim() || !isTauri()) return emptyMemory();
  try {
    const raw = await invoke<string>("read_project_rel_text_file", {
      projectPath: projectPath.trim(),
      relPath: HERMES_MEMORY_REL_PATH,
    });
    const parsed = JSON.parse(raw) as Partial<HermesPersistentMemory>;
    if (parsed.version !== 1 || !Array.isArray(parsed.facts)) return emptyMemory();
    return {
      version: 1,
      userProfile: String(parsed.userProfile ?? "").trim(),
      spiritName: String(parsed.spiritName ?? "").trim(),
      userHonorific: String(parsed.userHonorific ?? "").trim(),
      spiritIntroShown: Boolean(parsed.spiritIntroShown),
      facts: parsed.facts
        .filter((f) => f && typeof f.text === "string" && f.text.trim())
        .map((f) => ({
          id: String(f.id ?? crypto.randomUUID()),
          text: String(f.text).trim(),
          source: f.source === "agent" ? "agent" : "user",
          createdAt: String(f.createdAt ?? new Date().toISOString()),
        })),
      updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
    };
  } catch {
    return emptyMemory();
  }
}

export async function saveHermesPersistentMemory(
  projectPath: string,
  memory: HermesPersistentMemory,
): Promise<void> {
  if (!isTauri()) return;
  const payload: HermesPersistentMemory = {
    ...memory,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await invoke("write_project_rel_text_file", {
    projectPath: projectPath.trim(),
    relPath: HERMES_MEMORY_REL_PATH,
    content: JSON.stringify(payload, null, 2),
  });
}

export async function appendHermesMemoryFact(
  projectPath: string,
  text: string,
  source: HermesMemoryFact["source"] = "user",
): Promise<HermesMemoryFact> {
  const memory = await loadHermesPersistentMemory(projectPath);
  const fact: HermesMemoryFact = {
    id: crypto.randomUUID(),
    text: text.trim(),
    source,
    createdAt: new Date().toISOString(),
  };
  memory.facts = dedupeMemoryFacts([...memory.facts, fact]).slice(-80);
  await saveHermesPersistentMemory(projectPath, memory);
  return fact;
}

/** 按文本前缀去重后批量追加；返回实际写入条数 */
export async function appendHermesMemoryFactsIfNew(
  projectPath: string,
  texts: string[],
  source: HermesMemoryFact["source"] = "agent",
): Promise<number> {
  const memory = await loadHermesPersistentMemory(projectPath);
  let added = 0;
  const next = [...memory.facts];
  for (const raw of texts) {
    const text = raw.trim();
    if (!text) continue;
    const prefix = text.slice(0, 36);
    if (next.some((f) => f.text.slice(0, 36) === prefix)) continue;
    next.push({
      id: crypto.randomUUID(),
      text,
      source,
      createdAt: new Date().toISOString(),
    });
    added += 1;
  }
  if (added === 0) return 0;
  memory.facts = dedupeMemoryFacts(next).slice(-80);
  await saveHermesPersistentMemory(projectPath, memory);
  return added;
}

export async function mergeHermesUserProfile(
  projectPath: string,
  snippet: string,
): Promise<void> {
  const add = snippet.trim();
  if (!add) return;
  const memory = await loadHermesPersistentMemory(projectPath);
  const prev = memory.userProfile.trim();
  if (prev.includes(add)) return;
  memory.userProfile = prev ? `${prev}；${add}` : add;
  memory.userProfile = memory.userProfile.slice(0, 500);
  await saveHermesPersistentMemory(projectPath, memory);
}

export async function setHermesUserProfile(
  projectPath: string,
  profile: string,
): Promise<void> {
  const memory = await loadHermesPersistentMemory(projectPath);
  memory.userProfile = profile.trim().slice(0, 500);
  await saveHermesPersistentMemory(projectPath, memory);
}

export function parseMemoryFactTag(text: string): HermesMemoryFactTag {
  const t = text.trim();
  if (t.startsWith("[proc:")) return "procedure";
  if (t.startsWith("[fail:")) return "failure";
  if (t.startsWith("[avoid:")) return "avoid";
  if (t.startsWith("[reflect]")) return "reflect";
  if (t.startsWith("[pref:")) return "pref";
  return t.startsWith("[") ? "other" : "user";
}

const TAG_SECTION_TITLE: Record<HermesMemoryFactTag, string> = {
  user: "用户备注",
  procedure: "成功流程",
  failure: "失败教训",
  avoid: "应避免",
  reflect: "任务复盘",
  pref: "偏好",
  other: "其它",
};

function tokenizeMemoryQuery(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const parts = q.split(/[\s,，。；;]+/).filter((p) => p.length >= 2);
  const cjk = q.replace(/[^\u4e00-\u9fff]/g, "");
  if (cjk.length >= 2) {
    for (let i = 0; i < cjk.length - 1; i++) {
      parts.push(cjk.slice(i, i + 2));
    }
  }
  return [...new Set(parts)];
}

function scoreMemoryFact(fact: HermesMemoryFact, tokens: string[]): number {
  const t = fact.text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (t.includes(token)) score += 1;
  }
  const ageBoost = fact.source === "agent" ? 0.1 : 0.2;
  return score + ageBoost;
}

export function dedupeMemoryFacts(facts: HermesMemoryFact[]): HermesMemoryFact[] {
  const seen = new Set<string>();
  const out: HermesMemoryFact[] = [];
  for (const f of facts) {
    const key = f.text.trim().slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function searchHermesMemoryFacts(
  memory: HermesPersistentMemory,
  query: string,
  limit = 8,
): HermesMemoryFact[] {
  const tokens = tokenizeMemoryQuery(query);
  if (tokens.length === 0) return memory.facts.slice(-limit);
  const scored = memory.facts.map((f) => ({
    f,
    score: scoreMemoryFact(f, tokens),
  }));
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}

function formatFactsGrouped(facts: HermesMemoryFact[]): string[] {
  const groups = new Map<HermesMemoryFactTag, HermesMemoryFact[]>();
  for (const f of facts) {
    const tag = parseMemoryFactTag(f.text);
    const list = groups.get(tag) ?? [];
    list.push(f);
    groups.set(tag, list);
  }
  const order: HermesMemoryFactTag[] = [
    "pref",
    "procedure",
    "reflect",
    "avoid",
    "failure",
    "user",
    "other",
  ];
  const lines: string[] = [];
  for (const tag of order) {
    const list = groups.get(tag);
    if (!list?.length) continue;
    lines.push(`${TAG_SECTION_TITLE[tag]}：`);
    for (const f of list) {
      lines.push(`- [${f.source}] ${f.text}`);
    }
  }
  return lines;
}

export function formatHermesMemoryForPrompt(memory: HermesPersistentMemory, query?: string): string {
  const hits = query ? searchHermesMemoryFacts(memory, query, 10) : memory.facts.slice(-8);
  const lines: string[] = [];
  if (memory.userProfile.trim()) {
    lines.push(`用户画像：${memory.userProfile.trim()}`);
  }
  if (hits.length === 0) return lines.join("\n");
  lines.push("长期记忆（本工程）：");
  lines.push(...formatFactsGrouped(hits));
  return lines.join("\n");
}

export function formatMemoryCatalogForUser(memory: HermesPersistentMemory): string {
  if (
    memory.facts.length === 0 &&
    !memory.userProfile.trim() &&
    !memory.spiritName?.trim() &&
    !memory.userHonorific?.trim()
  ) {
    return "当前工程尚无长期记忆。可说「记住：…」写入；也可「你叫小蓝」「叫我老板」定制灵体。";
  }
  const lines = ["本工程记忆："];
  if (memory.spiritName?.trim()) {
    lines.push(`· 灵体名：${memory.spiritName.trim()}`);
  }
  if (memory.userHonorific?.trim()) {
    lines.push(`· 对你的称呼：${memory.userHonorific.trim()}`);
  }
  if (memory.userProfile.trim()) lines.push(`· 用户画像：${memory.userProfile}`);
  for (const f of memory.facts.slice(-20)) {
    lines.push(`· ${f.text}`);
  }
  return lines.join("\n");
}
