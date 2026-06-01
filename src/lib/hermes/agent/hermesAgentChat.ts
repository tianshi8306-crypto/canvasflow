import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import {
  formatAutomationsForUser,
  loadHermesAutomations,
  parseAutomationFromMessage,
  upsertHermesAutomation,
} from "@/lib/hermes/agent/hermesAutomation";
import {
  formatMemoryCatalogForUser,
  loadHermesPersistentMemory,
} from "@/lib/hermes/agent/hermesPersistentMemory";
import {
  formatSkillCatalogForUser,
  listHermesRegisteredSkills,
  loadHermesSkillBody,
} from "@/lib/hermes/agent/hermesSkillRegistry";
import { rankSkillsForMessage } from "@/lib/hermes/agent/hermesSkillMatching";
import {
  buildDirectorJobQueueSnapshot,
  formatDirectorJobQueueForChat,
} from "@/lib/hermes/agent/hermesJobOrchestration";
import {
  executeHermesNlJobCancel,
  parseHermesNlJobCancelRequest,
} from "@/lib/hermes/agent/hermesNlJobCancel";
import { useHermesJobStore } from "@/lib/hermes/agent/hermesJobStore";
import { formatHermesToolRegistryForUser } from "@/lib/hermes/mcp/hermesToolRegistry";
import { formatHermesCanvasMcpForPrompt } from "@/lib/hermes/agent/hermesCanvasMcp";
import {
  callExternalMcpTool,
  enabledHermesMcpServers,
  findMcpServerByLabelOrId,
  formatExternalMcpToolsForPrompt,
  loadExternalMcpToolsMap,
  parseExternalMcpInvokeMessage,
} from "@/lib/hermes/agent/hermesExternalMcp";
import {
  captureScriptVersionFromStore,
  formatScriptVersionList,
  listScriptVersionsForNode,
  loadHermesScriptVersions,
  parseScriptVersionIdFromMessage,
  resolvePrimaryScriptNodeId,
  rollbackScriptVersion,
  summarizeScriptVersionDiff,
} from "@/lib/hermes/agent/hermesScriptVersion";
import { useProjectStore } from "@/store/projectStore";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";

export type HermesAgentChatIntent =
  | "list_memory"
  | "list_skills"
  | "list_mcp"
  | "list_external_mcp"
  | "invoke_external_mcp"
  | "list_automations"
  | "schedule_automation"
  | "list_script_versions"
  | "save_script_version"
  | "rollback_script_version"
  | "compare_script_versions"
  | "use_skill"
  | "list_tool_registry"
  | "list_job_queue"
  | "cancel_queued_jobs"
  | "cancel_jobs_nl";

export function resolveHermesAgentChatIntent(text: string): HermesAgentChatIntent | null {
  const t = text.trim();
  if (/^(我的)?记忆|长期记忆|记忆列表/.test(t)) return "list_memory";
  if (/有哪些\s*skills?|^(有哪些)?skills?|技能列表|专业技能/i.test(t)) return "list_skills";
  if (/外接\s*mcp|外部\s*mcp/i.test(t)) return "list_external_mcp";
  if (/^调用\s*mcp\s+/i.test(t)) return "invoke_external_mcp";
  if (/mcp.*工具|画布.*工具|canvas.*mcp/i.test(t)) return "list_mcp";
  if (/定时任务|自动化列表|有哪些自动化/.test(t)) return "list_automations";
  if (/每\s*\d+\s*分钟|每小时.*(检查|跑|执行)/.test(t)) return "schedule_automation";
  if (/脚本版本|版本列表|有哪些快照|列出.*版本/.test(t)) return "list_script_versions";
  if (/保存脚本快照|保存版本|存档脚本/.test(t)) return "save_script_version";
  if (/回滚脚本|恢复上一版|回滚到|恢复脚本版本/.test(t)) return "rollback_script_version";
  if (/版本对比|对比版本|比较版本/.test(t)) return "compare_script_versions";
  if (/使用\s*skill|按\s*.+\s*技能|skill\s*[:：]/i.test(t)) return "use_skill";
  if (/工具\s*registry|工具表|registry\s*工具/i.test(t)) return "list_tool_registry";
  if (/制片队列|任务队列|排队情况|队列状态/.test(t)) return "list_job_queue";
  if (/取消全部排队|清空排队|取消排队任务/.test(t)) return "cancel_queued_jobs";
  if (parseHermesNlJobCancelRequest(t)) return "cancel_jobs_nl";
  return null;
}

async function loadAppSettings(): Promise<AppSettings | null> {
  if (!isTauri()) return null;
  return invoke<AppSettings>("load_settings");
}

export type HermesAgentChatResponse = {
  message: string;
  /** iter-114：规划后队列有变更，需刷新 composer status */
  refreshPlanningQueue?: boolean;
};

export async function messageForHermesAgentChatIntent(
  intent: HermesAgentChatIntent,
  text: string,
  projectPath: string | null,
): Promise<HermesAgentChatResponse> {
  if (intent === "list_external_mcp" || intent === "invoke_external_mcp") {
    if (!isTauri()) return { message: DESKTOP_SHELL_HINT };
  } else if (!projectPath?.trim()) {
    return {
      message:
        "请先打开或保存工程，再使用记忆 / Skill / 自动化（数据存在工程 `.canvasflow/hermes/`）。",
    };
  }

  const path = projectPath?.trim() ?? "";

  if (intent === "list_memory") {
    const memory = await loadHermesPersistentMemory(path);
    return { message: formatMemoryCatalogForUser(memory) };
  }
  if (intent === "list_skills") {
    const skills = await listHermesRegisteredSkills(path);
    return { message: formatSkillCatalogForUser(skills) };
  }
  if (intent === "list_tool_registry") {
    return { message: formatHermesToolRegistryForUser() };
  }
  if (intent === "list_job_queue") {
    const snap = buildDirectorJobQueueSnapshot(
      useHermesJobStore.getState().jobs,
      path,
    );
    return {
      message: snap
        ? formatDirectorJobQueueForChat(snap)
        : "当前无制片 Job 队列。",
    };
  }
  if (intent === "cancel_queued_jobs") {
    const n = useHermesJobStore.getState().cancelAllQueuedDirectorPlans(path);
    return {
      message:
        n > 0
          ? `已取消 ${n} 个排队中的制片任务。`
          : "没有可取消的排队任务。",
    };
  }
  if (intent === "cancel_jobs_nl") {
    const target = parseHermesNlJobCancelRequest(text);
    if (!target) {
      return { message: "未识别取消目标，可说「取消第 2 镜出图」或「取消规划队列」。" };
    }
    const scriptNode = findPrimaryScriptNode(useProjectStore.getState().nodes);
    const result = executeHermesNlJobCancel(target, {
      projectPath: path,
      scriptNodeId: scriptNode?.id ?? null,
      nodes: useProjectStore.getState().nodes,
    });
    return {
      message: result.message,
      refreshPlanningQueue: result.planningRemoved > 0,
    };
  }
  if (intent === "use_skill") {
    const skills = await listHermesRegisteredSkills(path);
    const ranked = rankSkillsForMessage(text, skills, 3);
    if (ranked.length === 0) {
      return {
        message: `${formatSkillCatalogForUser(skills)}\n\n未从话术中匹配到 Skill，请点名 id 或触发词（如「分镜出关键帧」）。`,
      };
    }
    const lines = ["已匹配 Skills（按相关度）："];
    for (const { skill, score } of ranked) {
      const body = await loadHermesSkillBody(path, skill.id);
      lines.push(
        `\n### ${skill.label} [${skill.id}] · ${score}`,
        skill.templateId ? `关联模板：\`${skill.templateId}\`` : "",
        body.slice(0, 800),
      );
    }
    lines.push("\n可说「跑模板 分镜出关键帧」或直接描述制片目标，导演会自动套用。");
    return { message: lines.filter(Boolean).join("\n") };
  }
  if (intent === "list_mcp") {
    return {
      message: `${formatHermesCanvasMcpForPrompt()}\n\n外接 MCP 请说「外接 mcp 工具」；对外暴露画布 MCP 见 设置 → Agent → 对外 Canvas MCP。`,
    };
  }
  if (intent === "list_external_mcp") {
    const rawSettings = await loadAppSettings();
    const servers = enabledHermesMcpServers(rawSettings);
    if (servers.length === 0) {
      return {
        message:
          "尚未配置外接 MCP。请在 设置 → Agent 下方「外接 MCP」添加并测试连接。",
      };
    }
    const map = await loadExternalMcpToolsMap(servers);
    return { message: formatExternalMcpToolsForPrompt(servers, map) };
  }
  if (intent === "invoke_external_mcp") {
    const parsed = parseExternalMcpInvokeMessage(text);
    if (!parsed) {
      return {
        message:
          '格式：调用 mcp <服务名> <工具名> [JSON参数]，例如：调用 mcp Filesystem list_directory {"path":"."}',
      };
    }
    const rawSettings = await loadAppSettings();
    const servers = enabledHermesMcpServers(rawSettings);
    const server = findMcpServerByLabelOrId(servers, parsed.serverLabel);
    if (!server) {
      return {
        message: `未找到 MCP 服务「${parsed.serverLabel}」。可说「外接 mcp 工具」查看已配置服务。`,
      };
    }
    let args: Record<string, unknown> = {};
    if (parsed.argsJson) {
      try {
        args = JSON.parse(parsed.argsJson) as Record<string, unknown>;
      } catch {
        return { message: "JSON 参数解析失败，请检查格式。" };
      }
    }
    const result = await callExternalMcpTool(server.id, parsed.toolName, args);
    return {
      message: result.isError
        ? `外接 MCP 失败：${result.content}`
        : `外接 MCP「${server.label}」· ${parsed.toolName}：\n${result.content}`,
    };
  }
  if (intent === "list_automations") {
    const store = await loadHermesAutomations(path);
    return { message: formatAutomationsForUser(store) };
  }
  if (intent === "schedule_automation") {
    const parsed = parseAutomationFromMessage(text);
    if (!parsed) {
      return {
        message: "请说明间隔与任务，例如：「每 30 分钟检查流程并汇报」。",
      };
    }
    const job = await upsertHermesAutomation(path, {
      title: parsed.title,
      prompt: parsed.prompt,
      enabled: true,
      intervalMinutes: parsed.intervalMinutes,
    });
    return {
      message: `已创建自动化「${job.title}」：${job.prompt}\n（App 打开且工程加载时执行）`,
    };
  }

  const scriptNodeId = resolvePrimaryScriptNodeId(useProjectStore.getState().nodes);
  if (
    intent === "list_script_versions" ||
    intent === "save_script_version" ||
    intent === "rollback_script_version" ||
    intent === "compare_script_versions"
  ) {
    if (!scriptNodeId) {
      return { message: "请先在画布上创建脚本节点，再使用版本功能。" };
    }
  }

  if (intent === "list_script_versions") {
    const store = await loadHermesScriptVersions(path);
    const list = listScriptVersionsForNode(store, scriptNodeId!);
    return { message: formatScriptVersionList(list) };
  }
  if (intent === "save_script_version") {
    const entry = await captureScriptVersionFromStore({
      projectPath: path,
      scriptNodeId: scriptNodeId!,
      label: "manual",
    });
    return {
      message: entry
        ? `已保存脚本快照 \`${entry.id.slice(0, 12)}\`（${entry.beatCount} 镜表 / ${entry.shotCount} 分镜）`
        : "脚本内容为空，未保存。",
    };
  }
  if (intent === "rollback_script_version") {
    const prefix = parseScriptVersionIdFromMessage(text);
    const result = await rollbackScriptVersion({
      projectPath: path,
      scriptNodeId: scriptNodeId!,
      versionIdPrefix: prefix,
    });
    return { message: result.message };
  }
  if (intent === "compare_script_versions") {
    const store = await loadHermesScriptVersions(path);
    const list = listScriptVersionsForNode(store, scriptNodeId!);
    if (list.length < 2) {
      return {
        message: "至少需要 2 个版本才能对比。Agent 改脚本后会自动存档。",
      };
    }
    const newer = list[list.length - 1]!;
    const older = list[list.length - 2]!;
    const diff = summarizeScriptVersionDiff(older.payload, newer.payload);
    return {
      message: `对比 \`${older.id.slice(0, 12)}\` → \`${newer.id.slice(0, 12)}\`：\n${diff}\n\n（已打开可视化对比面板，也可点输入框上方「版本对比」）`,
    };
  }

  return { message: "" };
}
