import { tabNameFromProjectPath } from "@/lib/canvasTabSync";

export type HermesShellChatIntent = "clear_history" | "show_scope";

export function resolveShellChatIntent(text: string): HermesShellChatIntent | null {
  const t = text.trim();
  if (!t) return null;
  if (
    /^(清空|清除|删除|擦掉)(?:对话|聊天记录|消息|历史|上下文)/.test(t) ||
    /对话.*(清空|清除|删掉)/.test(t) ||
    /^(新对话|新开对话|重新开始|换个话题)/.test(t)
  ) {
    return "clear_history";
  }
  if (/^(当前|本)(?:对话|工程|项目|画布).*(范围|归属|哪个)/.test(t) || /对话存在哪/.test(t)) {
    return "show_scope";
  }
  return null;
}

export function formatHermesChatScopeLabel(
  projectPath: string | null,
  tabName?: string | null,
): string {
  const project = projectPath?.trim()
    ? tabNameFromProjectPath(projectPath)
    : "未保存工程（临时画布）";
  const tab = tabName?.trim() || "当前画布 Tab";
  return `工程：${project} · Tab：${tab}`;
}

export function messageForShellChatIntent(
  intent: HermesShellChatIntent,
  opts: { projectPath: string | null; tabName?: string | null; cleared?: boolean },
): string {
  const scope = formatHermesChatScopeLabel(opts.projectPath, opts.tabName);
  if (intent === "show_scope") {
    return `当前 H 对话仅绑定本画布 Tab，不会与其它 Tab 混用：\n${scope}\n\n切换 Tab 或工程后会加载该上下文自己的记录。可说「清空对话」只清当前 Tab。`;
  }
  if (opts.cleared) {
    return `已清空当前 Tab 的对话记录（${scope}）。画布节点不受影响；需要执行任务请直接说指令。`;
  }
  return `将清空当前 Tab 的对话（${scope}）。`;
}
