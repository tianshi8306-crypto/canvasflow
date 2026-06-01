import { isTauri } from "@tauri-apps/api/core";
import type { Node } from "@xyflow/react";
import {
  buildGroupTemplateSnapshot,
  buildNodesFromGroupTemplate,
  GROUP_TEMPLATE_REL_DIR,
  loadLocalGroupTemplates,
  saveLocalGroupTemplates,
  type CanvasGroupTemplateV1,
} from "@/lib/canvasGroupTemplate";
import type { GroupColorToken } from "@/lib/canvasGroupColors";
import {
  evaluateConvertGroupToStoryboard,
  groupKindLabel,
} from "@/lib/canvasGroupStoryboard";
import {
  countGroupMembers,
  computeGroupSizeFromMembers,
  normalizeGroupNodesForCanvas,
} from "@/lib/canvasGroup";
import { buildGroupDuplicatePaste } from "@/lib/canvasGroupDuplicate";
import { runGroupHermesImages } from "@/lib/hermes/groupHermesImages";
import { formatUserError } from "@/lib/errors";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import {
  readProjectGroupTemplate,
  writeProjectGroupTemplate,
} from "@/shared/api/groupTemplates";
import type { ProjectState } from "./projectStoreTypes";
import { recordBeforeDiscreteMutation } from "./projectHistory";
import { scheduleSave } from "./projectSaveDebounce";

type SetState = (
  partial:
    | Partial<ProjectState>
    | ((state: ProjectState) => Partial<ProjectState> | ProjectState),
  replace?: false,
) => void;

export function setGroupColorTokenImpl(get: () => ProjectState, set: SetState) {
  return (groupId: string, token: GroupColorToken | null) => {
    const group = get().nodes.find((n) => n.id === groupId && n.type === "group");
    if (!group) {
      get().setStatusText("请先选中分组节点");
      return;
    }
    recordBeforeDiscreteMutation(get);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === groupId
          ? {
              ...n,
              data: {
                ...n.data,
                groupColorToken: token ?? undefined,
              },
            }
          : n,
      ),
      statusText: token ? `已设置组色标：${token}` : "已清除组色标",
    }));
    if (get().projectPath) scheduleSave(get);
  };
}

export function convertGroupToStoryboardImpl(get: () => ProjectState, set: SetState) {
  return (groupId: string) => {
    const { nodes, edges } = get();
    const verdict = evaluateConvertGroupToStoryboard(nodes, edges, groupId);
    if (!verdict.ok) {
      get().setStatusText(verdict.message);
      return;
    }
    recordBeforeDiscreteMutation(get);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === groupId
          ? {
              ...n,
              data: {
                ...n.data,
                groupKind: "storyboard" as const,
                groupScriptNodeId: verdict.scriptNodeId,
                groupScriptBeatIds:
                  verdict.beatIds.length > 0 ? verdict.beatIds : undefined,
                label: groupKindLabel("storyboard", verdict.memberCount),
              },
            }
          : n,
      ),
      statusText: `已转为分镜组（${verdict.mediaCount} 个媒体节点，绑定脚本 ${verdict.scriptNodeId.slice(0, 8)}…）`,
    }));
    if (get().projectPath) scheduleSave(get);
  };
}

export function saveGroupToToolboxImpl(get: () => ProjectState, _set: SetState) {
  return async (groupId: string, name?: string) => {
    const { nodes, edges, projectPath } = get();
    const group = nodes.find((n) => n.id === groupId && n.type === "group");
    if (!group) {
      get().setStatusText("请先选中分组节点");
      return;
    }
    const defaultName =
      name?.trim() ||
      group.data.label?.trim() ||
      groupKindLabel(group.data.groupKind, countGroupMembers(nodes, groupId));
    const tpl = buildGroupTemplateSnapshot(nodes, edges, groupId, defaultName);
    if (!tpl) {
      get().setStatusText("无法生成分组模板");
      return;
    }
    const content = JSON.stringify(tpl, null, 2);
    try {
      if (projectPath && isTauri()) {
        const relPath = `${GROUP_TEMPLATE_REL_DIR}/${tpl.id}.json`;
        await writeProjectGroupTemplate(projectPath, relPath, content);
        get().setStatusText(`已保存到工具箱：${tpl.name}（工程 templates）`);
        return;
      }
      const local = loadLocalGroupTemplates();
      saveLocalGroupTemplates([tpl, ...local.filter((t) => t.id !== tpl.id)].slice(0, 40));
      get().setStatusText(`已保存到工具箱：${tpl.name}（本机缓存）`);
    } catch (e) {
      get().setStatusText(`保存模板失败：${formatUserError(e)}`);
    }
  };
}

async function loadTemplateById(
  projectPath: string | null,
  id: string,
  relPath?: string,
): Promise<CanvasGroupTemplateV1 | null> {
  if (projectPath && relPath && isTauri()) {
    try {
      const raw = await readProjectGroupTemplate(projectPath, relPath);
      return JSON.parse(raw) as CanvasGroupTemplateV1;
    } catch {
      return null;
    }
  }
  return loadLocalGroupTemplates().find((t) => t.id === id) ?? null;
}

export function insertGroupTemplateImpl(get: () => ProjectState, set: SetState) {
  return async (
    templateId: string,
    worldPosition: { x: number; y: number },
    relPath?: string,
  ) => {
    const { projectPath } = get();
    const tpl = await loadTemplateById(projectPath, templateId, relPath);
    if (!tpl || tpl.version !== 1) {
      get().setStatusText("模板不存在或格式无效");
      return;
    }
    recordBeforeDiscreteMutation(get);
    const { nextNodes, nextEdges } = buildNodesFromGroupTemplate(tpl, worldPosition);
    const groupId = nextNodes.find((n) => n.type === "group")?.id;
    set((s) => ({
      nodes: normalizeGroupNodesForCanvas([
        ...s.nodes.map((n) => ({ ...n, selected: n.id === groupId })),
        ...nextNodes,
      ]),
      edges: [...s.edges, ...nextEdges],
      selectedNodeIds: groupId ? [groupId] : [],
      selectedNodeId: groupId ?? null,
      statusText: `已从工具箱插入：${tpl.name}`,
    }));
    if (get().projectPath) scheduleSave(get);
  };
}

export function duplicateGroupImpl(get: () => ProjectState, set: SetState) {
  return (groupId: string) => {
    const { nodes, edges } = get();
    const built = buildGroupDuplicatePaste(nodes, edges, groupId);
    if (!built) {
      get().setStatusText("未找到要打副本的分组");
      return;
    }
    const { nextNodes, nextEdges, idMap } = built;
    const pastedGroupId = idMap.get(groupId);
    recordBeforeDiscreteMutation(get);
    const merged = normalizeGroupNodesForCanvas(
      fitGroupAfterMemberChange(
        [...nodes.map((n) => ({ ...n, selected: false })), ...nextNodes],
        pastedGroupId ?? nextNodes.find((n) => n.type === "group")?.id ?? "",
      ),
    );
    const memberCount = nextNodes.filter((n) => n.type !== "group").length;
    const edgeCount = nextEdges.length;
    set({
      nodes: merged.map((n) => ({
        ...n,
        selected: n.id === pastedGroupId,
      })),
      edges: [...edges, ...nextEdges],
      selectedNodeIds: pastedGroupId ? [pastedGroupId] : [],
      selectedNodeId: pastedGroupId ?? null,
      selectedEdgeIds: [],
      statusText: `已创建分组副本（${memberCount} 个节点${edgeCount ? `、${edgeCount} 条组内连线` : ""}）`,
    });
    if (get().projectPath) scheduleSave(get);
  };
}

export function runGroupHermesImagesImpl(get: () => ProjectState, set: SetState) {
  return async (groupId: string) => {
    if (!isTauri()) {
      get().setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    if (get().isGraphRunning) return;
    await runGroupHermesImages(groupId, {
      getNodes: () => get().nodes,
      getEdges: () => get().edges,
      getProjectPath: () => get().projectPath,
      setStatusText: (t) => get().setStatusText(t),
      updateNodeData: (id, patch) => get().updateNodeData(id, patch),
      addNodesWithEdges: (newNodes, newEdges) => get().addNodesWithEdges(newNodes, newEdges),
      fitGroupAfterMemberChange: (nodes, gid) => {
        const next = fitGroupAfterMemberChange(nodes, gid);
        set({ nodes: next });
        return next;
      },
    });
    if (get().projectPath) scheduleSave(get);
  };
}

export function fitGroupAfterMemberChange(
  nodes: Node[],
  groupId: string,
): Node[] {
  const members = nodes.filter((n) => n.parentId === groupId);
  const { width, height } = computeGroupSizeFromMembers(members);
  return nodes.map((n) =>
    n.id === groupId ? { ...n, style: { ...n.style, width, height } } : n,
  );
}
