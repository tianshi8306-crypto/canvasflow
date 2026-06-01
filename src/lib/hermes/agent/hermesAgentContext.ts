import { formatHermesCanvasMcpForPrompt } from "@/lib/hermes/agent/hermesCanvasMcp";
import {
  formatAvoidSuggestionsForPrompt,
  formatTopLearnedProceduresForPrompt,
} from "@/lib/hermes/agent/hermesLearningAdaptation";
import {
  formatHermesMemoryForPrompt,
  loadHermesPersistentMemory,
} from "@/lib/hermes/agent/hermesPersistentMemory";
import { formatHermesExpertDoctrineForLlm } from "@/lib/hermes/hermesProductionExpert";
import {
  formatSpiritIdentityForPrompt,
  loadHermesSpiritIdentity,
} from "@/lib/hermes/agent/hermesSpiritIdentity";
import { hasHermesProductionIntent } from "@/lib/hermes/hermesConversationIntent";
import {
  formatHermesSkillCatalogForPrompt,
  listHermesRegisteredSkills,
  loadHermesSkillBody,
} from "@/lib/hermes/agent/hermesSkillRegistry";
import { rankSkillsForMessage } from "@/lib/hermes/agent/hermesSkillMatching";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import { inferHermesProductionProjectType } from "@/lib/hermes/hermesProjectProfile";
import { formatScriptVersionContextForAgent } from "@/lib/hermes/agent/hermesScriptVersionAgent";
import { resolvePrimaryScriptNodeId } from "@/lib/hermes/agent/hermesScriptVersion";
import { useProjectStore } from "@/store/projectStore";
import {
  formatCachedWorkstateForPrompt,
  loadHermesWorkstate,
  formatHermesWorkstateForPrompt,
} from "@/lib/hermes/agent/hermesWorkstate";
import { formatCachedCanvasEventsForPrompt } from "@/lib/hermes/agent/hermesCanvasEventCache";
import {
  enabledHermesMcpServers,
  formatExternalMcpToolsForPrompt,
  loadExternalMcpToolsMap,
} from "@/lib/hermes/agent/hermesExternalMcp";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";

/**
 * 构建自主 Agent 上下文块（记忆 + Skills + Canvas MCP），注入 Brain / Director。
 */
export async function buildHermesAgentContextBlock(
  projectPath: string | null,
  userMessage: string,
): Promise<string> {
  const parts: string[] = [formatHermesExpertDoctrineForLlm()];

  if (projectPath?.trim()) {
    const spirit = await loadHermesSpiritIdentity(projectPath);
    parts.unshift(formatSpiritIdentityForPrompt(spirit));
    const memory = await loadHermesPersistentMemory(projectPath);
    const memBlock = formatHermesMemoryForPrompt(memory, userMessage);
    if (memBlock) parts.push(`【记忆】\n${memBlock}`);
    if (hasHermesProductionIntent(userMessage)) {
      const learned = formatTopLearnedProceduresForPrompt(memory, userMessage);
      if (learned) parts.push(`【学习适应】\n${learned}`);

      const scriptNodeId = resolvePrimaryScriptNodeId(
        useProjectStore.getState().nodes,
      );
      if (scriptNodeId) {
        const versionBlock = await formatScriptVersionContextForAgent(
          projectPath,
          scriptNodeId,
        );
        if (versionBlock) parts.push(versionBlock);
      }
    }
    const avoid = formatAvoidSuggestionsForPrompt(memory);
    if (avoid) parts.push(`【学习适应】\n${avoid}`);

    const cachedWs = formatCachedWorkstateForPrompt();
    if (cachedWs) {
      parts.push(`【工作记忆】\n${cachedWs}`);
    } else {
      const ws = await loadHermesWorkstate(projectPath);
      const wsBlock = formatHermesWorkstateForPrompt(ws);
      if (wsBlock) parts.push(`【工作记忆】\n${wsBlock}`);
    }
    const canvasEv = formatCachedCanvasEventsForPrompt();
    if (canvasEv && !cachedWs?.includes("近期画布变化")) {
      parts.push(`【画布感知】\n${canvasEv}`);
    }
  }

  const skills = await listHermesRegisteredSkills(projectPath);
  const skillCatalog = formatHermesSkillCatalogForPrompt(skills);
  if (skillCatalog) parts.push(skillCatalog);

  let projectType: ReturnType<typeof inferHermesProductionProjectType> | undefined;
  if (projectPath?.trim()) {
    const { nodes, edges } = useProjectStore.getState();
    projectType = inferHermesProductionProjectType(
      buildHermesSituation(nodes, edges, projectPath),
    );
  }
  const ranked = rankSkillsForMessage(userMessage, skills, 3, { projectType });
  for (const { skill, score } of ranked) {
    const body = await loadHermesSkillBody(projectPath, skill.id);
    if (body) {
      parts.push(
        `【Skill 正文 · ${skill.id} · 相关度 ${score}】\n${body.slice(0, 1500)}`,
      );
    }
  }

  parts.push(formatHermesCanvasMcpForPrompt());

  if (isTauri()) {
    try {
      const app = await invoke<AppSettings>("load_settings");
      const servers = enabledHermesMcpServers(app);
      if (servers.length > 0) {
        const map = await loadExternalMcpToolsMap(servers);
        const block = formatExternalMcpToolsForPrompt(servers, map);
        if (block) parts.push(`【外接 MCP】\n${block}`);
      }
    } catch {
      /* 忽略外接 MCP 列举失败 */
    }
  }

  return parts.filter(Boolean).join("\n\n").slice(0, 6000);
}
