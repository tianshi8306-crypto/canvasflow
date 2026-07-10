import { SCRIPT_DRAFT_STATUS_DONE } from "@/lib/scriptNodeActionLabels";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import { assembleStoryboardDraftFromBeats, patchFromScriptBeatsEdit } from "@/lib/storyboardDraftSync";
import type { ScriptBeat } from "@/lib/types";
import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";

type DraftFromThemeInput = {
  themePrompt: string;
};

type DraftFromThemeSensed = {
  theme: string;
};

type DraftFromThemeExecuted = {
  seed: ScriptBeat[];
};

type DraftFromThemeCommitted = {
  seed: ScriptBeat[];
};

/**
 * 脚本工作台 Agent：基于主题生成可编辑镜头草案。
 */
export const scriptDraftFromThemeAgentRuntime: NodeTaskAgentRuntime<
  DraftFromThemeInput,
  DraftFromThemeSensed,
  DraftFromThemeExecuted,
  DraftFromThemeCommitted
> = {
  agentName: "脚本草案 Agent",
  sense: ({ themePrompt }) => ({
    theme: themePrompt.trim() || "未命名主题",
  }),
  execute: ({ theme }) => {
    const seed: ScriptBeat[] = [
      normalizeScriptBeat({
        id: crypto.randomUUID(),
        shotNumber: "1",
        durationHint: "4–6s",
        description: `${theme}：开场环境 Establish，交代空间与氛围`,
      }),
      normalizeScriptBeat({
        id: crypto.randomUUID(),
        shotNumber: "2",
        scene: "1-2",
        durationHint: "5–8s",
        description: `${theme}：人物关系与冲突初现`,
      }),
      normalizeScriptBeat({
        id: crypto.randomUUID(),
        shotNumber: "3",
        durationHint: "3–5s",
        description: `${theme}：情感或转折钩子，为下一阶段埋笔`,
      }),
    ];
    return { seed };
  },
  validate: ({ seed }) => {
    if (!seed.length) throw new Error("脚本草案生成为空");
    return { seed };
  },
  commit: ({ seed }, ctx) => {
    ctx.updateNodeData(ctx.nodeId, {
      scriptBeats: seed,
      scriptBeatSelection: seed.map((s) => s.id),
      storyboardDraft: assembleStoryboardDraftFromBeats(seed),
      scriptShotCount: seed.length,
    });
    ctx.setStatusText(SCRIPT_DRAFT_STATUS_DONE);
  },
};

type EnterStoryboardInput = {
  rows: ScriptBeat[];
  storedSelection: string[] | undefined;
};

type EnterStoryboardSensed = {
  rows: ScriptBeat[];
  storedSelection: string[];
};

type EnterStoryboardExecuted = {
  pickedIds: string[];
  hadStoredSelection: boolean;
  hadValidSelection: boolean;
};

type EnterStoryboardCommitted = {
  pickedIds: string[];
  hadStoredSelection: boolean;
  hadValidSelection: boolean;
};

/**
 * 脚本工作台 Agent：勾选归一化并将执行焦点移交分镜区（组件层负责滚动）。
 */
export const scriptEnterStoryboardAgentRuntime: NodeTaskAgentRuntime<
  EnterStoryboardInput,
  EnterStoryboardSensed,
  EnterStoryboardExecuted,
  EnterStoryboardCommitted
> = {
  agentName: "脚本分镜入口 Agent",
  sense: ({ rows, storedSelection }) => {
    if (rows.length === 0) {
      throw new Error("请先在表格中添加或生成脚本条目");
    }
    return { rows, storedSelection: storedSelection ?? [] };
  },
  execute: ({ rows, storedSelection }) => {
    const allowed = new Set(rows.map((r) => r.id));
    const validSelected = storedSelection.filter((id) => allowed.has(id));
    const hadStoredSelection = storedSelection.length > 0;
    const hadValidSelection = validSelected.length > 0;
    if (hadStoredSelection && !hadValidSelection) {
      throw new Error("所选条目已不存在，请重新勾选");
    }
    const pickedIds = hadValidSelection ? validSelected : rows.map((r) => r.id);
    return { pickedIds, hadStoredSelection, hadValidSelection };
  },
  validate: ({ pickedIds, hadStoredSelection, hadValidSelection }) => {
    if (pickedIds.length === 0) {
      throw new Error("没有可用于分镜处理的脚本镜头");
    }
    return { pickedIds, hadStoredSelection, hadValidSelection };
  },
  commit: ({ pickedIds, hadStoredSelection, hadValidSelection }, ctx) => {
    if (!hadValidSelection) {
      ctx.updateNodeData(ctx.nodeId, { scriptBeatSelection: pickedIds });
    }
    const n = pickedIds.length;
    ctx.setStatusText(
      !hadStoredSelection || !hadValidSelection
        ? `已全选 ${n} 条镜头并定位到下方「分镜」区，可生成分镜文案或创建图片/视频链路。`
        : `已准备 ${n} 条勾选镜头，已定位到「分镜」区。`,
    );
  },
};

type PersistBeatsInput = {
  next: ScriptBeat[];
  storedSelection: string[] | undefined;
};

type PersistBeatsSensed = {
  normalized: ScriptBeat[];
  storedSelection: string[];
};

type PersistBeatsExecuted = {
  normalized: ScriptBeat[];
  prunedSelection: string[];
};

type PersistBeatsCommitted = PersistBeatsExecuted;

/**
 * 脚本工作台 Agent：镜头表持久化（归一化 + 勾选修剪 + 回写）。
 */
export const scriptPersistBeatsAgentRuntime: NodeTaskAgentRuntime<
  PersistBeatsInput,
  PersistBeatsSensed,
  PersistBeatsExecuted,
  PersistBeatsCommitted
> = {
  agentName: "脚本持久化 Agent",
  sense: ({ next, storedSelection }) => {
    const normalized = next.map((b) => normalizeScriptBeat(b));
    return { normalized, storedSelection: storedSelection ?? [] };
  },
  execute: ({ normalized, storedSelection }) => {
    const valid = new Set(normalized.map((b) => b.id));
    const prunedSelection = storedSelection.filter((id) => valid.has(id));
    return { normalized, prunedSelection };
  },
  validate: ({ normalized, prunedSelection }) => ({ normalized, prunedSelection }),
  commit: ({ normalized, prunedSelection }, ctx) => {
    ctx.updateNodeData(
      ctx.nodeId,
      patchFromScriptBeatsEdit(normalized, prunedSelection),
    );
  },
};

