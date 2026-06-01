import type { ProjectBible, BibleCharacter } from "@/lib/projectBible/projectBible";
import {
  normalizeCharacterName,
  normalizeProjectBible,
} from "@/lib/projectBible/projectBible";
import { normalizeScriptBeat, normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import type { ScriptBeat, ScriptRole } from "@/lib/types";

export function listBeatRoles(beat: ScriptBeat): ScriptRole[] {
  return normalizeScriptBeat(beat).characters ?? [];
}

function findBibleCharacter(bible: ProjectBible, roleName: string): BibleCharacter | undefined {
  const key = normalizeCharacterName(roleName);
  if (!key) return undefined;
  return bible.characters.find((c) => {
    if (normalizeCharacterName(c.name) === key) return true;
    return c.aliases.some((a) => normalizeCharacterName(a) === key);
  });
}

/** 单镜角色参考：镜头角色图优先，其次项目圣经同名角色默认参考图 */
export function collectBeatRoleReferencePaths(
  beat: ScriptBeat,
  bible: ProjectBible | null,
): string[] {
  const out: string[] = [];
  const push = (p: string) => {
    const t = p.trim();
    if (!t || out.includes(t)) return;
    out.push(t);
  };

  for (const role of listBeatRoles(beat)) {
    push(role.imagePath ?? "");
    if (bible && role.name.trim()) {
      const bc = findBibleCharacter(bible, role.name);
      if (bc?.referencePath) push(bc.referencePath);
    }
  }
  return out.slice(0, 4);
}

export function mergeReferencePaths(...groups: string[][]): string[] {
  const out: string[] = [];
  for (const group of groups) {
    for (const p of group) {
      const t = p.trim();
      if (!t || out.includes(t)) continue;
      out.push(t);
      if (out.length >= 4) return out;
    }
  }
  return out;
}

/** 从镜头表聚合角色写入圣经（按角色名合并，保留已有圣经参考图除非镜头表有新图） */
export function syncBibleCharactersFromScriptBeats(
  bible: ProjectBible,
  beats: ScriptBeat[] | undefined,
): ProjectBible {
  const normalized = normalizeProjectBible(bible);
  const byName = new Map<string, BibleCharacter>();
  for (const c of normalized.characters) {
    const key = normalizeCharacterName(c.name);
    if (key) byName.set(key, c);
  }

  for (const beat of normalizeScriptBeats(beats)) {
    for (const role of listBeatRoles(beat)) {
      const name = role.name.trim();
      if (!name) continue;
      const key = normalizeCharacterName(name);
      const existing = byName.get(key);
      const beatRef = (role.imagePath ?? "").trim();
      if (existing) {
        const desc = role.description.trim() || existing.description;
        const referencePath = beatRef || existing.referencePath;
        byName.set(key, {
          ...existing,
          description: desc,
          referencePath,
        });
      } else {
        byName.set(key, {
          id: role.id || crypto.randomUUID(),
          name,
          description: role.description.trim(),
          referencePath: beatRef,
          aliases: [],
        });
      }
    }
  }

  return {
    ...normalized,
    characters: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "zh")),
    updatedAt: new Date().toISOString(),
  };
}

export function formatBibleForHermesContext(bible: ProjectBible | null): string {
  if (!bible) return "项目圣经：未加载";
  const parts: string[] = [];
  if (bible.logline.trim()) parts.push(`梗概：${bible.logline.trim()}`);
  if (bible.visualStyle.trim()) parts.push(`视觉风格：${bible.visualStyle.trim()}`);
  if (bible.taboos.trim()) parts.push(`禁忌：${bible.taboos.trim()}`);
  const refCount = bible.characters.filter((c) => c.referencePath.trim()).length;
  parts.push(`角色库：${bible.characters.length} 人（${refCount} 张默认参考图）`);
  if (bible.characters.length > 0) {
    const names = bible.characters
      .slice(0, 8)
      .map((c) => (c.referencePath.trim() ? `${c.name}✓` : c.name))
      .join("、");
    parts.push(`角色：${names}${bible.characters.length > 8 ? "…" : ""}`);
  }
  return parts.length > 0 ? parts.join("\n") : "项目圣经：空（可从镜头表同步角色）";
}
