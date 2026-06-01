import { useEffect, useMemo, useRef, useState } from "react";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import {
  scriptDraftFromThemeAgentRuntime,
  scriptEnterStoryboardAgentRuntime,
  scriptPersistBeatsAgentRuntime,
} from "@/lib/nodeAgentRuntime/scriptWorkbenchAgent";
import type { ScriptBeat } from "@/lib/types";
import { normalizeScriptBeat, normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { useProjectStore } from "@/store/projectStore";
import { loadBatchPresetsV1, saveBatchPresetsV1 } from "@/lib/scriptWorkbenchBatchStorage";
import {
  BATCH_FAV_MAX,
  PRESET_TEMPLATE_GUIDE,
  PRESET_TEMPLATE_PACK,
  SCRIPT_TEMPLATE_MAX,
  TEMPLATE_STYLE_OPTIONS,
} from "@/lib/scriptWorkbenchConstants";
import {
  extractCameraMove,
  parseLeadingNumber,
  parseShotNumberRank,
  toSceneTags,
} from "@/lib/scriptWorkbenchSceneTags";
import { loadScriptTemplatesV1, saveScriptTemplatesV1 } from "@/lib/scriptWorkbenchTemplateStorage";
import type {
  BatchLogEntry,
  BatchLogReplay,
  BatchPresetsStored,
  ScriptTemplateExchangeV1,
  ScriptTemplateItem,
} from "@/lib/scriptWorkbenchTypes";
import { ScriptWorkbenchPrimaryActions } from "@/components/ScriptWorkbenchPrimaryActions";
import { ScriptWorkbenchTemplateGuideCard } from "@/components/ScriptWorkbenchTemplateGuideCard";
import { ScriptWorkbenchCardView } from "@/components/ScriptWorkbenchCardView";
import { ScriptWorkbenchCardToolbar } from "@/components/ScriptWorkbenchCardToolbar";
import { scriptStoryboardGenerateAgentRuntime } from "@/lib/nodeAgentRuntime/scriptStoryboardAgent";
import { resolveStoryboardBeatScope } from "@/lib/scriptStoryboardScope";
import { preflightScriptNodeLlm, scriptNodeLlmInvokeParams } from "@/lib/scriptNodeLlmParams";
import { ScriptWorkbenchActionConfirmDialog } from "@/components/ScriptWorkbenchActionConfirmDialog";
import { ScriptWorkbenchBatchLogPanel } from "@/components/ScriptWorkbenchBatchLogPanel";
import { ScriptWorkbenchTableView } from "@/components/ScriptWorkbenchTableView";
import { ScriptWorkbenchToolbarCluster } from "@/components/ScriptWorkbenchToolbarCluster";
import { useReplayArmCountdown } from "@/hooks/useReplayArmCountdown";

type Props = {
  nodeId: string;
  beats: ScriptBeat[];
  /** 与工程 JSON 同步，重开可恢复勾选 */
  storedSelection: string[] | undefined;
  themePrompt: string;
};

export function ScriptNodeWorkbench({ nodeId, beats, storedSelection, themePrompt }: Props) {
  const nodes = useProjectStore((s) => s.nodes);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const projectPath = useProjectStore((s) => s.projectPath);
  const [view, setView] = useState<"table" | "card">("table");
  const [storyboardGenBusy, setStoryboardGenBusy] = useState(false);
  const [hasBatchUndo, setHasBatchUndo] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [batchFillOpen, setBatchFillOpen] = useState(false);
  const [batchField, setBatchField] = useState<"shotSize" | "cameraMove">("shotSize");
  const [batchValue, setBatchValue] = useState("");
  const [batchFavorites, setBatchFavorites] = useState<BatchPresetsStored>(() => loadBatchPresetsV1());
  const [batchLogOpen, setBatchLogOpen] = useState(false);
  const [recentBatchLogs, setRecentBatchLogs] = useState<BatchLogEntry[]>([]);
  const [replayArm, setReplayArm] = useState<{ id: string; left: number } | null>(null);
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; lines: string[] }>({
    open: false,
    title: "",
    lines: [],
  });
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const templateImportInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ScriptTemplateItem[]>(() => loadScriptTemplatesV1());
  const [templateId, setTemplateId] = useState("");
  const [templateStyleFilter, setTemplateStyleFilter] = useState<(typeof TEMPLATE_STYLE_OPTIONS)[number]["value"]>("all");
  const [templateQuery, setTemplateQuery] = useState("");
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const cardWrapRef = useRef<HTMLDivElement | null>(null);
  const tableScrollTopRef = useRef(0);
  const cardScrollTopRef = useRef(0);
  const confirmActionRef = useRef<(() => void) | null>(null);
  const openScriptFullscreen = useProjectStore((s) => s.openScriptFullscreen);
  const lastBatchSnapshotRef = useRef<{
    rows: ScriptBeat[];
    selection: string[];
    actionLabel: string;
  } | null>(null);

  const rows = useMemo(() => normalizeScriptBeats(beats.length ? beats : []), [beats]);
  const selectedIds = useMemo(
    () => (storedSelection ?? []).filter((id) => rows.some((r) => r.id === id)),
    [storedSelection, rows],
  );

  const persistBeats = (next: ScriptBeat[]) => {
    void (async () => {
      try {
        await runNodeTaskAgent(
          scriptPersistBeatsAgentRuntime,
          { next, storedSelection },
          {
            nodeId,
            projectPath: projectPath ?? "__memory__",
            updateNodeData,
            setStatusText,
          },
        );
      } catch {
        // scriptPersistBeatsAgentRuntime 正常不抛错；保留兜底避免未处理 Promise。
      }
    })();
  };

  const cloneRows = (input: ScriptBeat[]) => JSON.parse(JSON.stringify(input)) as ScriptBeat[];

  const markBatchSnapshot = (actionLabel: string) => {
    lastBatchSnapshotRef.current = {
      rows: cloneRows(rows),
      selection: [...selectedIds],
      actionLabel,
    };
    setHasBatchUndo(true);
  };

  const pushBatchLog = (message: string, replay?: BatchLogReplay) => {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const line = `${ts} · ${message}`;
    const entry: BatchLogEntry = { id: crypto.randomUUID(), line, replay };
    setRecentBatchLogs((prev) => [entry, ...prev].slice(0, 3));
  };

  const openActionConfirm = (title: string, lines: string[], onConfirm: () => void) => {
    confirmActionRef.current = onConfirm;
    setConfirmState({ open: true, title, lines });
  };

  const closeActionConfirm = () => {
    setConfirmState((s) => ({ ...s, open: false }));
    confirmActionRef.current = null;
  };

  const runConfirmedAction = () => {
    const fn = confirmActionRef.current;
    closeActionConfirm();
    if (fn) fn();
  };

  const replayBatchLog = (entry: BatchLogEntry) => {
    const replay = entry.replay;
    if (!replay) return;

    if (replay.kind === "sortShotNumber") {
      openActionConfirm("复用按镜号排序", ["将按镜号规则对全部条目重新排序。"], () => {
        const sorted = [...rows].sort((a, b) => {
          const ra = parseShotNumberRank(a.shotNumber);
          const rb = parseShotNumberRank(b.shotNumber);
          if (ra !== rb) return ra - rb;
          const sa = (a.shotNumber ?? "").trim();
          const sb = (b.shotNumber ?? "").trim();
          return sa.localeCompare(sb, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
        });
        const changed = sorted.some((r, i) => r.id !== rows[i]?.id);
        if (!changed) {
          setStatusText("镜号顺序已是最新，无需排序");
          return;
        }
        markBatchSnapshot("复用按镜号排序");
        persistBeats(sorted);
        setStatusText("已复用按镜号排序");
        pushBatchLog("复用按镜号排序", replay);
      });
      return;
    }

    if (selectedIds.length === 0) {
      setStatusText("请先勾选镜头后再复用该操作");
      return;
    }
    const selectedSet = new Set(selectedIds);
    const previewRows = rows.filter((r) => selectedSet.has(r.id)).slice(0, 5);

    if (replay.kind === "fill") {
      const fieldLabel = replay.field === "shotSize" ? "景别" : "运镜";
      const value = replay.value;
      const preview = previewRows
        .map((r) => {
          const key = (r.shotNumber || "未标镜号").trim() || "未标镜号";
          const before = replay.field === "shotSize" ? r.shotSize?.trim() || "空" : extractCameraMove(r.sceneTags) || "空";
          return `${key}: ${before}→${value}`;
        })
        .join("\n");
      openActionConfirm(
        `复用批量填写${fieldLabel}`,
        [
          `将复用历史操作到 ${selectedIds.length} 条。`,
          ...(previewRows.length > 0 ? preview.split("\n") : []),
          ...(selectedIds.length > previewRows.length ? ["（仅展示前 5 条）"] : []),
        ],
        () => {
          markBatchSnapshot(`复用填写${fieldLabel}`);
          const next = rows.map((r) => {
            if (!selectedSet.has(r.id)) return r;
            if (replay.field === "shotSize") return { ...r, shotSize: value };
            return { ...r, sceneTags: toSceneTags(value) };
          });
          persistBeats(next);
          setStatusText(`已复用批量填写${fieldLabel}：${selectedIds.length} 条`);
          pushBatchLog(`复用填写${fieldLabel}：${selectedIds.length} 条 -> ${value}`, replay);
        },
      );
      return;
    }

    if (replay.kind === "clear") {
      const fieldLabel = replay.field === "shotSize" ? "景别" : "运镜";
      const preview = previewRows
        .map((r) => {
          const key = (r.shotNumber || "未标镜号").trim() || "未标镜号";
          const before = replay.field === "shotSize" ? r.shotSize?.trim() || "空" : extractCameraMove(r.sceneTags) || "空";
          return `${key}: ${before}→空`;
        })
        .join("\n");
      openActionConfirm(
        `复用批量清空${fieldLabel}`,
        [
          `将复用历史操作到 ${selectedIds.length} 条。`,
          ...(previewRows.length > 0 ? preview.split("\n") : []),
          ...(selectedIds.length > previewRows.length ? ["（仅展示前 5 条）"] : []),
        ],
        () => {
          markBatchSnapshot(`复用清空${fieldLabel}`);
          const next = rows.map((r) => {
            if (!selectedSet.has(r.id)) return r;
            if (replay.field === "shotSize") return { ...r, shotSize: "" };
            return { ...r, sceneTags: "" };
          });
          persistBeats(next);
          setStatusText(`已复用批量清空${fieldLabel}：${selectedIds.length} 条`);
          pushBatchLog(`复用清空${fieldLabel}：${selectedIds.length} 条`, replay);
        },
      );
      return;
    }

    if (replay.kind === "renumberSelected") {
      const picked = rows.filter((r) => selectedSet.has(r.id));
      if (picked.length === 0) {
        setStatusText("当前勾选条目无效，请重新勾选");
        return;
      }
      const sortedPicked = [...picked].sort((a, b) => {
        const ra = parseShotNumberRank(a.shotNumber);
        const rb = parseShotNumberRank(b.shotNumber);
        if (ra !== rb) return ra - rb;
        return (a.shotNumber ?? "").localeCompare(b.shotNumber ?? "", "zh-Hans-CN", {
          numeric: true,
          sensitivity: "base",
        });
      });
      openActionConfirm("复用勾选重排镜号", [`将把 ${sortedPicked.length} 条勾选镜号重排为 1~${sortedPicked.length}。`], () => {
        markBatchSnapshot("复用勾选重排镜号");
        const renumberMap = new Map<string, string>();
        sortedPicked.forEach((r, i) => renumberMap.set(r.id, String(i + 1)));
        const next = rows.map((r) => (renumberMap.has(r.id) ? { ...r, shotNumber: renumberMap.get(r.id)! } : r));
        persistBeats(next);
        setStatusText(`已复用勾选重排镜号：1~${sortedPicked.length}`);
        pushBatchLog(`复用勾选重排镜号：${sortedPicked.length} 条`, replay);
      });
      return;
    }

    if (replay.kind === "padSelected") {
      const targetRows = rows.filter((r) => selectedSet.has(r.id));
      const parsed = targetRows
        .map((r) => ({ id: r.id, num: parseLeadingNumber(r.shotNumber) }))
        .filter((x): x is { id: string; num: number } => x.num !== null);
      if (parsed.length === 0) {
        setStatusText("勾选项里没有可识别的数字镜号");
        return;
      }
      const maxNum = Math.max(...parsed.map((p) => p.num), 0);
      const width = Math.max(2, String(maxNum).length);
      openActionConfirm("复用勾选镜号补零", [`将把 ${targetRows.length} 条勾选镜号补零到 ${width} 位。`], () => {
        markBatchSnapshot("复用勾选镜号补零");
        const next = rows.map((r) => {
          if (!selectedSet.has(r.id)) return r;
          const num = parseLeadingNumber(r.shotNumber);
          if (num === null) return r;
          return { ...r, shotNumber: String(num).padStart(width, "0") };
        });
        persistBeats(next);
        setStatusText(`已复用勾选镜号补零（${width} 位）`);
        pushBatchLog(`复用勾选镜号补零：${targetRows.length} 条 -> ${width} 位`, replay);
      });
    }
  };

  const setSelection = (next: string[]) => {
    const allowed = new Set(rows.map((r) => r.id));
    const filtered = next.filter((id) => allowed.has(id));
    updateNodeData(nodeId, { scriptBeatSelection: filtered });
  };

  const toggleSelect = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    setSelection(next);
  };

  const selectAll = () => {
    if (rows.length === 0) return;
    setSelection(rows.map((r) => r.id));
  };

  const clearSelection = () => setSelection([]);

  const invertSelection = () => {
    if (rows.length === 0) return;
    const selected = new Set(selectedIds);
    const next = rows.map((r) => r.id).filter((id) => !selected.has(id));
    setSelection(next);
  };

  const keepSelectedOnly = () => {
    if (rows.length === 0) return;
    if (selectedIds.length === 0) {
      setStatusText("请先勾选要保留的镜头");
      return;
    }
    if (selectedIds.length === rows.length) {
      setStatusText("当前已全选，无需清理");
      return;
    }
    const removeCount = rows.length - selectedIds.length;
    openActionConfirm("仅保留勾选", [`将删除未勾选的 ${removeCount} 条镜头。`, "此操作可通过“撤销批量镜号操作”回退。"], () => {
      setMoreOpen(false);
      markBatchSnapshot("仅保留勾选");
      const selectedSet = new Set(selectedIds);
      const kept = rows.filter((r) => selectedSet.has(r.id));
      persistBeats(kept);
      setStatusText(`已仅保留 ${kept.length} 条勾选镜头`);
      pushBatchLog(`仅保留勾选：保留 ${kept.length} 条`);
    });
  };

  const deleteSelectedRows = () => {
    if (rows.length === 0) return;
    if (selectedIds.length === 0) {
      setStatusText("请先勾选要删除的镜头");
      return;
    }
    const selectedSet = new Set(selectedIds);
    const removeCount = rows.filter((r) => selectedSet.has(r.id)).length;
    if (removeCount <= 0) {
      setStatusText("当前勾选条目无效，请重新勾选");
      return;
    }
    openActionConfirm("删除勾选", [`将删除已勾选的 ${removeCount} 条镜头。`, "此操作可通过“撤销批量镜号操作”回退。"], () => {
      setMoreOpen(false);
      markBatchSnapshot("删除勾选");
      const kept = rows.filter((r) => !selectedSet.has(r.id));
      persistBeats(kept);
      setStatusText(`已删除 ${removeCount} 条勾选镜头`);
      pushBatchLog(`删除勾选：删除 ${removeCount} 条`);
    });
  };

  const applyBatchFill = () => {
    if (rows.length === 0) return;
    if (selectedIds.length === 0) {
      setStatusText("请先勾选要批量填写的镜头");
      return;
    }
    const val = batchValue.trim();
    if (!val) {
      setStatusText("请先填写批量值");
      return;
    }
    const selectedSet = new Set(selectedIds);
    const previewRows = rows.filter((r) => selectedSet.has(r.id)).slice(0, 5);
    const fieldLabel = batchField === "shotSize" ? "景别" : "运镜";
    const preview = previewRows
      .map((r) => {
        const key = (r.shotNumber || "未标镜号").trim() || "未标镜号";
        const before = batchField === "shotSize" ? r.shotSize?.trim() || "空" : extractCameraMove(r.sceneTags) || "空";
        return `${key}: ${before}→${val}`;
      })
      .join("\n");
    openActionConfirm(
      `批量填写${fieldLabel}`,
      [
        `将批量填写 ${selectedIds.length} 条。`,
        ...(previewRows.length > 0 ? preview.split("\n") : []),
        ...(selectedIds.length > previewRows.length ? ["（仅展示前 5 条）"] : []),
      ],
      () => {
        markBatchSnapshot(`批量填写${batchField === "shotSize" ? "景别" : "运镜"}`);
        const next = rows.map((r) => {
          if (!selectedSet.has(r.id)) return r;
          if (batchField === "shotSize") return { ...r, shotSize: val };
          return { ...r, sceneTags: toSceneTags(val) };
        });
        persistBeats(next);
        setMoreOpen(false);
        setBatchFillOpen(false);
        setStatusText(`已批量填写 ${selectedIds.length} 条${batchField === "shotSize" ? "景别" : "运镜"}`);
        pushBatchLog(`批量填写${fieldLabel}：${selectedIds.length} 条 -> ${val}`, {
          kind: "fill",
          field: batchField,
          value: val,
        });
      },
    );
  };

  const clearBatchField = () => {
    if (rows.length === 0) return;
    if (selectedIds.length === 0) {
      setStatusText("请先勾选要清空字段的镜头");
      return;
    }
    const fieldLabel = batchField === "shotSize" ? "景别" : "运镜";
    const selectedSet = new Set(selectedIds);
    const previewRows = rows.filter((r) => selectedSet.has(r.id)).slice(0, 5);
    const preview = previewRows
      .map((r) => {
        const key = (r.shotNumber || "未标镜号").trim() || "未标镜号";
        const before = batchField === "shotSize" ? r.shotSize?.trim() || "空" : extractCameraMove(r.sceneTags) || "空";
        return `${key}: ${before}→空`;
      })
      .join("\n");
    openActionConfirm(
      `批量清空${fieldLabel}`,
      [
        `将清空 ${selectedIds.length} 条。`,
        ...(previewRows.length > 0 ? preview.split("\n") : []),
        ...(selectedIds.length > previewRows.length ? ["（仅展示前 5 条）"] : []),
      ],
      () => {
        markBatchSnapshot(`批量清空${fieldLabel}`);
        const next = rows.map((r) => {
          if (!selectedSet.has(r.id)) return r;
          if (batchField === "shotSize") return { ...r, shotSize: "" };
          return { ...r, sceneTags: "" };
        });
        persistBeats(next);
        setMoreOpen(false);
        setBatchFillOpen(false);
        setStatusText(`已清空 ${selectedIds.length} 条${fieldLabel}`);
        pushBatchLog(`批量清空${fieldLabel}：${selectedIds.length} 条`, {
          kind: "clear",
          field: batchField,
        });
      },
    );
  };

  const sortByShotNumber = () => {
    if (rows.length <= 1) return;
    const sorted = [...rows].sort((a, b) => {
      const ra = parseShotNumberRank(a.shotNumber);
      const rb = parseShotNumberRank(b.shotNumber);
      if (ra !== rb) return ra - rb;
      const sa = (a.shotNumber ?? "").trim();
      const sb = (b.shotNumber ?? "").trim();
      return sa.localeCompare(sb, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
    });
    const changed = sorted.some((r, i) => r.id !== rows[i]?.id);
    if (!changed) {
      setStatusText("镜号顺序已是最新，无需排序");
      return;
    }
    setMoreOpen(false);
    markBatchSnapshot("按镜号排序");
    persistBeats(sorted);
    setStatusText("已按镜号自动排序");
    pushBatchLog("按镜号排序", { kind: "sortShotNumber" });
  };

  const renumberSelectedShotNumbers = () => {
    if (rows.length === 0) return;
    if (selectedIds.length === 0) {
      setStatusText("请先勾选要重排镜号的条目");
      return;
    }
    const selectedSet = new Set(selectedIds);
    const picked = rows.filter((r) => selectedSet.has(r.id));
    if (picked.length === 0) {
      setStatusText("当前勾选条目无效，请重新勾选");
      return;
    }
    const sortedPicked = [...picked].sort((a, b) => {
      const ra = parseShotNumberRank(a.shotNumber);
      const rb = parseShotNumberRank(b.shotNumber);
      if (ra !== rb) return ra - rb;
      return (a.shotNumber ?? "").localeCompare(b.shotNumber ?? "", "zh-Hans-CN", {
        numeric: true,
        sensitivity: "base",
      });
    });
    const preview = sortedPicked
      .slice(0, 5)
      .map((r, i) => `${(r.shotNumber || "空").trim() || "空"}→${i + 1}`)
      .join("，");
    openActionConfirm(
      "勾选重排镜号",
      [
        `将把已勾选的 ${sortedPicked.length} 条镜号连续重排为 1~${sortedPicked.length}。`,
        `示例：${preview}${sortedPicked.length > 5 ? "…" : ""}`,
      ],
      () => {
        setMoreOpen(false);
        markBatchSnapshot("勾选重排镜号");
        const renumberMap = new Map<string, string>();
        sortedPicked.forEach((r, i) => renumberMap.set(r.id, String(i + 1)));
        const next = rows.map((r) => (renumberMap.has(r.id) ? { ...r, shotNumber: renumberMap.get(r.id)! } : r));
        persistBeats(next);
        setStatusText(`已将勾选镜号连续重排为 1~${sortedPicked.length}`);
        pushBatchLog(`勾选重排镜号：${sortedPicked.length} 条 -> 1~${sortedPicked.length}`, {
          kind: "renumberSelected",
        });
      },
    );
  };

  const padSelectedShotNumbers = () => {
    if (rows.length === 0) return;
    if (selectedIds.length === 0) {
      setStatusText("请先勾选要补零的镜号条目");
      return;
    }
    const selectedSet = new Set(selectedIds);
    const targetRows = rows.filter((r) => selectedSet.has(r.id));
    const parsed = targetRows
      .map((r) => ({ id: r.id, num: parseLeadingNumber(r.shotNumber) }))
      .filter((x): x is { id: string; num: number } => x.num !== null);
    if (parsed.length === 0) {
      setStatusText("勾选项里没有可识别的数字镜号");
      return;
    }
    const maxNum = Math.max(...parsed.map((p) => p.num), 0);
    const width = Math.max(2, String(maxNum).length);
    const sampleMap = new Map(parsed.map((p) => [p.id, String(p.num).padStart(width, "0")]));
    const preview = targetRows
      .slice(0, 5)
      .map((r) => `${(r.shotNumber || "空").trim() || "空"}→${sampleMap.get(r.id) ?? "不变"}`)
      .join("，");
    openActionConfirm(
      "勾选镜号补零",
      [`将把数字镜号补零到 ${width} 位。`, `示例：${preview}${targetRows.length > 5 ? "…" : ""}`],
      () => {
        setMoreOpen(false);
        markBatchSnapshot("勾选镜号补零");
        const next = rows.map((r) => {
          if (!selectedSet.has(r.id)) return r;
          const num = parseLeadingNumber(r.shotNumber);
          if (num === null) return r;
          return { ...r, shotNumber: String(num).padStart(width, "0") };
        });
        persistBeats(next);
        setStatusText(`已完成勾选镜号补零（${width} 位）`);
        pushBatchLog(`勾选镜号补零：${targetRows.length} 条 -> ${width} 位`, {
          kind: "padSelected",
        });
      },
    );
  };

  const undoLastBatchOperation = () => {
    const snapshot = lastBatchSnapshotRef.current;
    if (!snapshot) {
      setStatusText("没有可撤销的批量镜号操作");
      return;
    }
    persistBeats(snapshot.rows);
    const allowed = new Set(snapshot.rows.map((r) => r.id));
    updateNodeData(nodeId, { scriptBeatSelection: snapshot.selection.filter((id) => allowed.has(id)) });
    setStatusText(`已撤销「${snapshot.actionLabel}」`);
    pushBatchLog(`撤销批量操作：${snapshot.actionLabel}`);
    lastBatchSnapshotRef.current = null;
    setHasBatchUndo(false);
    setMoreOpen(false);
  };

  const draftFromTheme = () => {
    void runNodeTaskAgent(
      scriptDraftFromThemeAgentRuntime,
      { themePrompt },
      {
        nodeId,
        projectPath: projectPath ?? "__memory__",
        updateNodeData,
        setStatusText,
      },
    );
  };

  /** 同步勾选、滚动到侧栏「分镜」区，供生成分镜文案或创建链路。 */
  const sendToStoryboardSection = () => {
    void (async () => {
      try {
        const committed = await runNodeTaskAgent(
          scriptEnterStoryboardAgentRuntime,
          {
            rows,
            storedSelection,
          },
          {
            nodeId,
            projectPath: projectPath ?? "__memory__",
            updateNodeData,
            setStatusText,
          },
        );
        if (committed.pickedIds.length > 0) {
          const anchor = document.getElementById(`script-storyboard-anchor-${nodeId}`);
          anchor?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      } catch {
        // runNodeTaskAgent 已统一写入失败状态
      }
    })();
  };

  const scriptNode = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const nodeParams =
    scriptNode?.data.params && typeof scriptNode.data.params === "object"
      ? (scriptNode.data.params as Record<string, unknown>)
      : undefined;
  const llmParams = useMemo(() => scriptNodeLlmInvokeParams(nodeParams), [nodeParams]);

  const generateStoryboardFromCard = () => {
    if (!projectPath?.trim()) {
      setStatusText("请先打开工程后再生成分镜");
      return;
    }
    if (rows.length === 0) {
      setStatusText("请先添加或生成脚本镜头");
      return;
    }
    const scopeResult = resolveStoryboardBeatScope(rows, storedSelection);
    if (!scopeResult.ok) {
      setStatusText(scopeResult.message);
      return;
    }
    void (async () => {
      setStoryboardGenBusy(true);
      try {
        if (!(await preflightScriptNodeLlm(nodeParams, setStatusText))) return;
        await runNodeTaskAgent(
          scriptStoryboardGenerateAgentRuntime,
          {
            targetBeats: scopeResult.scope.beats,
            themePrompt,
            prevShots: scriptNode?.data.storyboardShots,
            llmParams,
          },
          { nodeId, projectPath, updateNodeData, setStatusText },
        );
      } catch {
        /* runNodeTaskAgent 已写入状态 */
      } finally {
        setStoryboardGenBusy(false);
      }
    })();
  };

  useEffect(() => {
    const onPointerDown = (ev: PointerEvent) => {
      if (!dangerOpen && !moreOpen) return;
      const root = toolbarRef.current;
      const t = ev.target as Node | null;
      if (root && t && root.contains(t)) return;
      if (dangerOpen) setDangerOpen(false);
      if (moreOpen) setMoreOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [dangerOpen, moreOpen]);

  useReplayArmCountdown(replayArm, setReplayArm);

  const currentFavorites = batchFavorites[batchField];

  const addBatchFavorite = () => {
    const v = batchValue.trim();
    if (!v) {
      setStatusText("请先在「值」中选择后再加入收藏");
      return;
    }
    const cur = batchFavorites[batchField];
    if (cur.includes(v)) {
      setStatusText("该值已在收藏中");
      return;
    }
    if (cur.length >= BATCH_FAV_MAX) {
      setStatusText(`每种字段最多收藏 ${BATCH_FAV_MAX} 条，请先移除一条`);
      return;
    }
    const next = [...cur, v];
    const merged: BatchPresetsStored = { ...batchFavorites, [batchField]: next };
    setBatchFavorites(merged);
    saveBatchPresetsV1(merged);
    setStatusText(`已加入收藏：${v}`);
  };

  const removeBatchFavorite = (value: string) => {
    const next = batchFavorites[batchField].filter((x) => x !== value);
    const merged: BatchPresetsStored = { ...batchFavorites, [batchField]: next };
    setBatchFavorites(merged);
    saveBatchPresetsV1(merged);
    if (batchValue === value) setBatchValue("");
    setStatusText(`已移除收藏：${value}`);
  };

  useEffect(() => {
    if (view === "table" && tableWrapRef.current) {
      tableWrapRef.current.scrollTop = tableScrollTopRef.current;
    }
    if (view === "card" && cardWrapRef.current) {
      cardWrapRef.current.scrollTop = cardScrollTopRef.current;
    }
  }, [view, rows.length]);

  const persistTemplates = (next: ScriptTemplateItem[]) => {
    setTemplates(next);
    saveScriptTemplatesV1(next);
  };

  const saveCurrentAsTemplate = () => {
    if (rows.length === 0) {
      setStatusText("当前没有镜头数据，无法保存模板");
      return;
    }
    const rawName = window.prompt("请输入模板名称", `模板-${new Date().toLocaleDateString()}`) ?? "";
    const name = rawName.trim();
    if (!name) {
      setStatusText("已取消保存模板");
      return;
    }
    const rawStyle =
      window.prompt("请输入模板风格（短剧/电影/动漫/广告/通用）", "通用")?.trim().toLowerCase() ?? "";
    const styleTag =
      rawStyle.includes("短剧")
        ? "shortDrama"
        : rawStyle.includes("电影")
          ? "film"
          : rawStyle.includes("动漫")
            ? "anime"
            : rawStyle.includes("广告")
              ? "ad"
              : "general";
    const nextItem: ScriptTemplateItem = {
      id: crypto.randomUUID(),
      name,
      styleTag,
      createdAt: Date.now(),
      beats: cloneRows(rows),
    };
    const dedup = [nextItem, ...templates.filter((t) => t.name !== name)].slice(0, SCRIPT_TEMPLATE_MAX);
    persistTemplates(dedup);
    setTemplateId(nextItem.id);
    setStatusText(`模板已保存：${name}`);
  };

  const applyTemplate = () => {
    const picked = templates.find((t) => t.id === templateId);
    if (!picked) {
      setStatusText("请先选择一个模板");
      return;
    }
    openActionConfirm(
      "应用模板",
      [`将用模板「${picked.name}」覆盖当前镜头，共 ${picked.beats.length} 条。`, "此操作可继续编辑并再次保存。"],
      () => {
        persistBeats(cloneRows(picked.beats));
        setSelection([]);
        setStatusText(`已应用模板：${picked.name}`);
      },
    );
  };

  const deleteTemplate = () => {
    const picked = templates.find((t) => t.id === templateId);
    if (!picked) {
      setStatusText("请先选择要删除的模板");
      return;
    }
    openActionConfirm("删除模板", [`确认删除模板「${picked.name}」？`, "删除后不可恢复。"], () => {
      const next = templates.filter((t) => t.id !== picked.id);
      persistTemplates(next);
      setTemplateId("");
      setStatusText(`已删除模板：${picked.name}`);
    });
  };

  const exportTemplates = () => {
    if (templates.length === 0) {
      setStatusText("当前没有可导出的模板");
      return;
    }
    try {
      const payload: ScriptTemplateExchangeV1 = {
        version: 1,
        exportedAt: Date.now(),
        templates: templates.map((t) => ({
          ...t,
          styleTag: t.styleTag ?? "general",
          beats: normalizeScriptBeats(t.beats),
        })),
      };
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `script-templates-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusText(`已导出模板：${templates.length} 条`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatusText(`导出模板失败：${msg}`);
    }
  };

  const importTemplatesFromFile = (file: File) => {
    void (async () => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<ScriptTemplateExchangeV1> | ScriptTemplateItem[];
        const incomingRaw = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.templates)
            ? parsed.templates
            : [];
        const incoming = incomingRaw
          .filter((x): x is ScriptTemplateItem => Boolean(x && typeof x === "object"))
          .map((x) => ({
            id: typeof x.id === "string" && x.id.trim() ? x.id : crypto.randomUUID(),
            name: typeof x.name === "string" && x.name.trim() ? x.name.trim() : "未命名模板",
            styleTag:
              x.styleTag === "shortDrama" ||
              x.styleTag === "film" ||
              x.styleTag === "anime" ||
              x.styleTag === "ad" ||
              x.styleTag === "general"
                ? x.styleTag
                : "general",
            createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now(),
            beats: normalizeScriptBeats(Array.isArray(x.beats) ? x.beats : []),
          }))
          .filter((x) => x.beats.length > 0);
        if (incoming.length === 0) {
          setStatusText("导入失败：文件中没有可用模板");
          return;
        }
        const mergedMap = new Map<string, ScriptTemplateItem>();
        for (const t of [...incoming, ...templates]) {
          if (!mergedMap.has(t.name)) mergedMap.set(t.name, t);
        }
        const merged = Array.from(mergedMap.values()).slice(0, SCRIPT_TEMPLATE_MAX);
        persistTemplates(merged);
        setStatusText(`已导入模板：${incoming.length} 条（当前共 ${merged.length} 条）`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatusText(`导入模板失败：${msg}`);
      } finally {
        if (templateImportInputRef.current) templateImportInputRef.current.value = "";
      }
    })();
  };

  const importPresetTemplatePack = () => {
    const incoming: ScriptTemplateItem[] = PRESET_TEMPLATE_PACK.map((tpl) => ({
      id: crypto.randomUUID(),
      name: tpl.name,
      styleTag: tpl.styleTag ?? "general",
      createdAt: Date.now(),
      beats: normalizeScriptBeats(
        tpl.beats.map((b) =>
          normalizeScriptBeat({
            id: crypto.randomUUID(),
            ...b,
          }),
        ),
      ),
    }));
    const mergedMap = new Map<string, ScriptTemplateItem>();
    for (const t of [...incoming, ...templates]) {
      if (!mergedMap.has(t.name)) mergedMap.set(t.name, t);
    }
    const merged = Array.from(mergedMap.values()).slice(0, SCRIPT_TEMPLATE_MAX);
    persistTemplates(merged);
    setStatusText(`已导入预置模板包：${incoming.length} 条（当前共 ${merged.length} 条）`);
  };

  const filteredTemplates = useMemo(
    () =>
      (templateStyleFilter === "all"
        ? templates
        : templates.filter((t) => (t.styleTag ?? "general") === templateStyleFilter)).filter((t) =>
        templateQuery.trim()
          ? t.name.toLowerCase().includes(templateQuery.trim().toLowerCase())
          : true,
      ),
    [templateQuery, templateStyleFilter, templates],
  );
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templateId, templates],
  );
  const selectedTemplateGuide = selectedTemplate ? PRESET_TEMPLATE_GUIDE[selectedTemplate.name] ?? null : null;

  return (
    <div className="scriptWorkbench">
      <div ref={toolbarRef} className="scriptToolbar">
        <ScriptWorkbenchPrimaryActions
          view={view}
          setView={setView}
          onOpenFullscreen={() => openScriptFullscreen(nodeId)}
          onDraftFromTheme={draftFromTheme}
          onSendToStoryboard={sendToStoryboardSection}
        />
        <ScriptWorkbenchToolbarCluster
          templateStyleFilter={templateStyleFilter}
          setTemplateStyleFilter={(value) =>
            setTemplateStyleFilter(value as (typeof TEMPLATE_STYLE_OPTIONS)[number]["value"])
          }
          templateQuery={templateQuery}
          setTemplateQuery={setTemplateQuery}
          templateId={templateId}
          setTemplateId={setTemplateId}
          filteredTemplates={filteredTemplates}
          templatesCount={templates.length}
          saveCurrentAsTemplate={saveCurrentAsTemplate}
          applyTemplate={applyTemplate}
          deleteTemplate={deleteTemplate}
          exportTemplates={exportTemplates}
          importPresetTemplatePack={importPresetTemplatePack}
          templateImportInputRef={templateImportInputRef}
          importTemplatesFromFile={importTemplatesFromFile}
          selectAll={selectAll}
          invertSelection={invertSelection}
          clearSelection={clearSelection}
          rowsLength={rows.length}
          selectedIdsLength={selectedIds.length}
          moreOpen={moreOpen}
          setMoreOpen={setMoreOpen}
          sortByShotNumber={sortByShotNumber}
          renumberSelectedShotNumbers={renumberSelectedShotNumbers}
          padSelectedShotNumbers={padSelectedShotNumbers}
          batchFillOpen={batchFillOpen}
          setBatchFillOpen={setBatchFillOpen}
          batchField={batchField}
          setBatchField={setBatchField}
          batchValue={batchValue}
          setBatchValue={setBatchValue}
          applyBatchFill={applyBatchFill}
          currentFavorites={currentFavorites}
          removeBatchFavorite={removeBatchFavorite}
          addBatchFavorite={addBatchFavorite}
          clearBatchField={clearBatchField}
          dangerOpen={dangerOpen}
          setDangerOpen={setDangerOpen}
          deleteSelectedRows={deleteSelectedRows}
          keepSelectedOnly={keepSelectedOnly}
          undoLastBatchOperation={undoLastBatchOperation}
          hasBatchUndo={hasBatchUndo}
          batchLogOpen={batchLogOpen}
          setBatchLogOpen={setBatchLogOpen}
          recentBatchLogsLength={recentBatchLogs.length}
        />
      </div>
      {selectedTemplateGuide && selectedTemplate ? (
        <ScriptWorkbenchTemplateGuideCard
          templateName={selectedTemplate.name}
          scene={selectedTemplateGuide.scene}
          tips={selectedTemplateGuide.tips}
        />
      ) : null}

      {view === "table" ? (
        <ScriptWorkbenchTableView
          containerRef={tableWrapRef}
          rows={rows}
          selectedIds={selectedIds}
          projectPath={projectPath}
          onToggleSelect={toggleSelect}
          onPersistRows={persistBeats}
          onStatusText={setStatusText}
          onScrollTopChange={(top) => {
            tableScrollTopRef.current = top;
          }}
        />
      ) : (
        <div ref={cardWrapRef}>
          <ScriptWorkbenchCardToolbar
            selectedCount={selectedIds.length}
            totalCount={rows.length}
            storyboardBusy={storyboardGenBusy}
            onGenerateStoryboard={generateStoryboardFromCard}
            onSendToStoryboard={sendToStoryboardSection}
          />
          <ScriptWorkbenchCardView
            rows={rows}
            selectedIds={selectedIds}
            projectPath={projectPath}
            onToggleSelect={toggleSelect}
            onPersistRows={persistBeats}
            onStatusText={setStatusText}
            onScrollTopChange={(top) => {
              cardScrollTopRef.current = top;
            }}
          />
        </div>
      )}

      <ScriptWorkbenchActionConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        lines={confirmState.lines}
        onClose={closeActionConfirm}
        onConfirm={runConfirmedAction}
      />

      <ScriptWorkbenchBatchLogPanel
        open={batchLogOpen}
        entries={recentBatchLogs}
        replayArm={replayArm}
        onSetReplayArm={setReplayArm}
        onReplayEntry={replayBatchLog}
      />

    </div>
  );
}
