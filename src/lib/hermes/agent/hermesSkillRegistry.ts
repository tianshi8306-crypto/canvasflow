import { invoke, isTauri } from "@tauri-apps/api/core";
import { HERMES_SKILLS, type HermesSkill } from "@/lib/hermes/hermesSkills";
import {
  BUILTIN_SKILL_META,
  SKILL_CATEGORY_LABELS,
  SKILL_CATEGORY_ORDER,
} from "@/lib/hermes/agent/hermesSkillMetadata";
import { rankSkillsForMessage } from "@/lib/hermes/agent/hermesSkillMatching";

export const HERMES_USER_SKILLS_DIR = ".canvasflow/hermes/skills";

export type HermesRegisteredSkill = HermesSkill & {
  builtin: boolean;
  /** 用户 skill 的工程相对路径 */
  relPath?: string;
  body?: string;
  triggers?: string[];
  category?: string;
  templateId?: string;
  priority?: number;
  projectTypes?: import("@/lib/hermes/hermesProjectProfile").HermesProductionProjectType[];
};

function parseCommaList(val: string): string[] {
  return val
    .split(/[,，;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeSkillMeta(skill: HermesRegisteredSkill): HermesRegisteredSkill {
  const meta = skill.builtin ? BUILTIN_SKILL_META[skill.id] : undefined;
  return {
    ...skill,
    category: skill.category ?? meta?.category ?? (skill.builtin ? "meta" : "custom"),
    triggers: [...(skill.triggers ?? []), ...(meta?.triggers ?? [])],
    templateId: skill.templateId ?? meta?.templateId,
    priority: skill.priority ?? meta?.priority ?? 0,
    projectTypes: skill.projectTypes ?? meta?.projectTypes,
  };
}

function parseSkillMarkdown(raw: string, relPath: string): HermesRegisteredSkill | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let title = "";
  let description = "";
  let id = relPath.replace(/\.md$/i, "").split("/").pop() ?? "custom";
  let category: string | undefined;
  let templateId: string | undefined;
  let triggers: string[] | undefined;
  let priority: number | undefined;
  const fm = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const body = fm ? fm[2]!.trim() : trimmed;
  if (fm) {
    for (const line of fm[1]!.split(/\r?\n/)) {
      const m = line.match(/^([a-zA-Z_-]+)\s*:\s*(.+)$/);
      if (!m) continue;
      const key = m[1]!.toLowerCase();
      const val = m[2]!.trim().replace(/^["']|["']$/g, "");
      if (key === "name" || key === "title") title = val;
      if (key === "description" || key === "desc") description = val;
      if (key === "id") id = val;
      if (key === "category") category = val;
      if (key === "templateid" || key === "template_id") templateId = val;
      if (key === "triggers") triggers = parseCommaList(val);
      if (key === "priority") {
        const n = Number(val);
        if (!Number.isNaN(n)) priority = n;
      }
    }
  }
  if (!title) {
    const h1 = body.match(/^#\s+(.+)/m);
    title = h1?.[1]?.trim() ?? id;
  }
  return mergeSkillMeta({
    id: id.replace(/\s+/g, "-").toLowerCase(),
    label: title,
    hint: description || body.slice(0, 120),
    exampleUtterance: description || `使用技能 ${title}`,
    builtin: false,
    relPath,
    body: body.slice(0, 4000),
    category: category ?? "custom",
    templateId,
    triggers,
    priority,
  });
}

export async function listHermesRegisteredSkills(
  projectPath: string | null,
): Promise<HermesRegisteredSkill[]> {
  const builtin: HermesRegisteredSkill[] = HERMES_SKILLS.map((s) =>
    mergeSkillMeta({ ...s, builtin: true }),
  );
  if (!projectPath?.trim() || !isTauri()) return builtin;

  let files: string[] = [];
  try {
    files = await invoke<string[]>("list_project_rel_dir_files", {
      projectPath: projectPath.trim(),
      relDir: HERMES_USER_SKILLS_DIR,
    });
  } catch {
    return builtin;
  }

  const userSkills: HermesRegisteredSkill[] = [];
  for (const rel of files.filter((f) => f.endsWith(".md"))) {
    try {
      const raw = await invoke<string>("read_project_rel_text_file", {
        projectPath: projectPath.trim(),
        relPath: rel,
      });
      const skill = parseSkillMarkdown(raw, rel);
      if (skill) userSkills.push(skill);
    } catch {
      /* skip broken skill file */
    }
  }
  const byId = new Map<string, HermesRegisteredSkill>();
  for (const s of [...builtin, ...userSkills.map(mergeSkillMeta)]) {
    byId.set(s.id, s);
  }
  return [...byId.values()];
}

export async function loadHermesSkillBody(
  projectPath: string | null,
  skillId: string,
): Promise<string> {
  const skills = await listHermesRegisteredSkills(projectPath);
  const hit = skills.find((s) => s.id === skillId);
  if (!hit) return "";
  if (hit.body) return hit.body;
  return `${hit.label}：${hit.hint}`;
}

export function formatHermesSkillCatalogForPrompt(skills: HermesRegisteredSkill[]): string {
  if (skills.length === 0) return "";
  const grouped = new Map<string, HermesRegisteredSkill[]>();
  for (const s of skills) {
    const cat = s.category ?? "custom";
    const list = grouped.get(cat) ?? [];
    list.push(s);
    grouped.set(cat, list);
  }
  const lines: string[] = [];
  const order = [...SKILL_CATEGORY_ORDER];
  for (const cat of order) {
    const list = grouped.get(cat);
    if (!list?.length) continue;
    const label = SKILL_CATEGORY_LABELS[cat] ?? cat;
    lines.push(`【${label}】`);
    for (const s of list) {
      const tpl = s.templateId ? ` →模板 ${s.templateId}` : "";
      lines.push(
        `· [${s.id}] ${s.label}${s.builtin ? "" : "（用户）"} — ${s.hint}${tpl}`,
      );
    }
  }
  return `可用 Skills（按分类；命中触发词或 id 会注入正文）：\n${lines.join("\n")}`;
}

export function formatSkillCatalogForUser(skills: HermesRegisteredSkill[]): string {
  const lines = ["Hermes Skills（内置 + 工程内 `.canvasflow/hermes/skills/*.md`）："];
  for (const s of skills) {
    lines.push(`· ${s.id} — ${s.label}：${s.hint}`);
  }
  lines.push(
    "",
    "自定义 Skill：`.canvasflow/hermes/skills/*.md`，frontmatter 支持 name/description/id/triggers/category/templateId/priority。",
  );
  return lines.join("\n");
}

export function matchSkillIdsFromMessage(
  message: string,
  skills: HermesRegisteredSkill[],
): string[] {
  return rankSkillsForMessage(message, skills, 3).map((r) => r.skill.id);
}
