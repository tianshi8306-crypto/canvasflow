import { invoke, isTauri } from "@tauri-apps/api/core";

export const PROJECT_BIBLE_REL_PATH = ".canvasflow/bible.json";

export type BibleCharacter = {
  id: string;
  name: string;
  description: string;
  /** 工程相对路径，如 assets/hero.png */
  referencePath: string;
  aliases: string[];
};

export type ProjectBible = {
  version: 1;
  logline: string;
  visualStyle: string;
  taboos: string;
  targetDurationSec: number | null;
  characters: BibleCharacter[];
  updatedAt: string;
};

export function emptyProjectBible(): ProjectBible {
  return {
    version: 1,
    logline: "",
    visualStyle: "",
    taboos: "",
    targetDurationSec: null,
    characters: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeCharacter(raw: unknown): BibleCharacter | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  if (!name) return null;
  const aliases = Array.isArray(o.aliases)
    ? o.aliases.map((a) => String(a).trim()).filter(Boolean)
    : [];
  return {
    id: String(o.id ?? crypto.randomUUID()),
    name,
    description: String(o.description ?? "").trim(),
    referencePath: String(o.referencePath ?? o.imagePath ?? "").trim(),
    aliases,
  };
}

export function normalizeProjectBible(input: unknown): ProjectBible {
  const base = emptyProjectBible();
  if (!input || typeof input !== "object") return base;
  const o = input as Record<string, unknown>;
  const characters: BibleCharacter[] = [];
  if (Array.isArray(o.characters)) {
    for (const row of o.characters) {
      const c = normalizeCharacter(row);
      if (c) characters.push(c);
    }
  }
  const durationRaw = o.targetDurationSec;
  const targetDurationSec =
    typeof durationRaw === "number" && Number.isFinite(durationRaw) && durationRaw > 0
      ? Math.round(durationRaw)
      : null;
  return {
    version: 1,
    logline: String(o.logline ?? "").trim(),
    visualStyle: String(o.visualStyle ?? "").trim(),
    taboos: String(o.taboos ?? "").trim(),
    targetDurationSec,
    characters,
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
  };
}

export function serializeProjectBible(bible: ProjectBible): string {
  const payload = {
    ...bible,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

export async function loadProjectBible(projectPath: string): Promise<ProjectBible> {
  if (!isTauri() || !projectPath.trim()) return emptyProjectBible();
  try {
    const raw = await invoke<string>("read_project_rel_text_file", {
      projectPath,
      relPath: PROJECT_BIBLE_REL_PATH,
    });
    return normalizeProjectBible(JSON.parse(raw));
  } catch {
    return emptyProjectBible();
  }
}

export async function saveProjectBible(
  projectPath: string,
  bible: ProjectBible,
): Promise<void> {
  if (!isTauri() || !projectPath.trim()) return;
  await invoke("ensure_project_structure", { projectPath });
  await invoke("write_project_rel_text_file", {
    projectPath,
    relPath: PROJECT_BIBLE_REL_PATH,
    content: serializeProjectBible(bible),
  });
}

export function bibleCharacterRefCount(bible: ProjectBible): number {
  return bible.characters.filter((c) => c.referencePath.trim()).length;
}

export function normalizeCharacterName(name: string): string {
  return name.trim().toLowerCase();
}
