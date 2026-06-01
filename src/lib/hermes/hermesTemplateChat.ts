import {
  deleteUserHermesPlanTemplate,
  formatTemplateCatalogForUser,
  getHermesPlanTemplate,
  listHermesPlanTemplates,
  saveUserHermesPlanTemplate,
  type HermesPlanTemplate,
} from "@/lib/hermes/hermesPlanTemplates";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";

export const HERMES_TEMPLATES_UPDATED_EVENT = "canvasflow-hermes-templates-updated";

export function notifyHermesTemplatesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HERMES_TEMPLATES_UPDATED_EVENT));
}

export type HermesTemplateChatResult =
  | { kind: "list"; message: string }
  | { kind: "delete"; message: string; ok: boolean }
  | { kind: "save"; message: string; ok: boolean; template?: HermesPlanTemplate };

function slugFromTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .slice(0, 32);
  return base || `tpl-${Date.now()}`;
}

export function resolveTemplateChatIntent(text: string): "list" | "delete" | "save" | null {
  const t = text.trim();
  if (!t) return null;
  if (/有哪些模板|模板列表|列出模板|计划模板/.test(t) && !/跑|执行|套用|删除|保存|存为/.test(t)) {
    return "list";
  }
  if (/删除.*模板|移除.*模板|去掉.*模板/.test(t)) {
    return "delete";
  }
  if (/保存.*模板|存为.*模板|存成.*模板/.test(t)) {
    return "save";
  }
  return null;
}

function resolveDeleteTemplateId(text: string): string | null {
  const users = listHermesPlanTemplates().filter((t) => !t.builtin);
  for (const tpl of users) {
    if (text.includes(tpl.id) || text.includes(tpl.title)) return tpl.id;
  }
  const quoted = text.match(/[「『"']([^」』"']+)[」』"']/);
  if (quoted?.[1]) {
    const name = quoted[1].trim();
    const hit = users.find((t) => t.title === name || t.id === name);
    if (hit) return hit.id;
  }
  return null;
}

function resolveSaveTemplateTitle(text: string): string | null {
  const quoted = text.match(/[「『"']([^」』"']+)[」』"']/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  const m = text.match(/(?:保存|存为|存成)(?:为)?(?:计划)?模板[：:\s]*(.+?)$/);
  if (m?.[1]?.trim()) return m[1].trim().slice(0, 48);
  return null;
}

export function runTemplateChatAction(
  intent: "list" | "delete" | "save",
  text: string,
  lastPlan: HermesDirectorPlan | null,
): HermesTemplateChatResult {
  if (intent === "list") {
    return { kind: "list", message: formatTemplateCatalogForUser() };
  }

  if (intent === "delete") {
    const id = resolveDeleteTemplateId(text);
    if (!id) {
      return {
        kind: "delete",
        ok: false,
        message:
          "请说明要删除的自定义模板名称，例如：删除模板「我的夜景流程」。内置模板不可删除。",
      };
    }
    const tpl = getHermesPlanTemplate(id);
    if (tpl?.builtin) {
      return { kind: "delete", ok: false, message: `「${tpl.title}」是内置模板，不能删除。` };
    }
    const ok = deleteUserHermesPlanTemplate(id);
    if (ok) notifyHermesTemplatesUpdated();
    return ok
      ? { kind: "delete", ok: true, message: `已删除自定义模板「${tpl?.title ?? id}」。` }
      : {
          kind: "delete",
          ok: false,
          message: `未找到可删除的自定义模板「${id}」。可说「有哪些模板」查看列表。`,
        };
  }

  const title = resolveSaveTemplateTitle(text);
  if (!title) {
    return {
      kind: "save",
      ok: false,
      message: "请说明模板名称，例如：保存模板为「夜景三镜快剪」。",
    };
  }
  if (!lastPlan?.steps.length) {
    return {
      kind: "save",
      ok: false,
      message: "还没有可保存的执行计划。先让我跑完一轮任务，或说「跑模板 分镜出关键帧」后再保存。",
    };
  }
  const id = slugFromTitle(title);
  const saved = saveUserHermesPlanTemplate({
    id,
    title,
    description: lastPlan.title,
    steps: lastPlan.steps.map((s) => ({
      toolId: s.toolId,
      label: s.label,
      args: s.args,
    })),
  });
  notifyHermesTemplatesUpdated();
  return {
    kind: "save",
    ok: true,
    template: saved,
    message: `已保存自定义模板「${saved.title}」（${saved.steps.length} 步）。之后可说「跑模板 ${saved.title}」。`,
  };
}
