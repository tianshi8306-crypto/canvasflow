import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Node } from "@xyflow/react";
import { handleScriptNodeCompleted } from "@/lib/hermes/autoChain";
import type {
  HermesPlanStep,
  HermesToolId,
  HermesToolRunResult,
} from "@/lib/hermes/hermesDirectorTypes";
import {
  beatIdsForShotNumbers,
  findPrimaryScriptNode,
} from "@/lib/hermes/hermesCanvasContext";
import { resolveHermesShotNumbers } from "@/lib/hermes/hermesReferentResolution";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { extractJsonArray } from "@/lib/storyboardParse";
import { normalizeScriptBeat, normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { scriptStoryboardGenerateAgentRuntime } from "@/lib/nodeAgentRuntime/scriptStoryboardAgent";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import {
  preflightScriptNodeLlm,
  scriptNodeLlmInvokeParams,
} from "@/lib/scriptNodeLlmParams";
import { getAgentMaxConcurrentMedia } from "@/lib/hermes/agent/hermesAgentSettings";
import {
  captureScriptVersionBeforeChange,
  captureScriptVersionFromStore,
  SCRIPT_VERSION_SNAPSHOT_TOOLS,
} from "@/lib/hermes/agent/hermesScriptVersion";
import { formatScriptVersionSnapshotNote } from "@/lib/hermes/agent/hermesScriptVersionAgent";
import { recordStyleAnchorFromScriptBeat } from "@/lib/hermes/agent/hermesCanvasEventCache";
import { batchGenerateImagesForStoryboard } from "@/lib/storyboard/batchGenerateImages";
import { createBeatReferenceResolver } from "@/lib/projectBible/resolveBeatRefsForBatch";
import { applyShortDramaWorkflow } from "@/lib/hermes/film/filmWorkflowTopology";
import { runBatchSetVideoParams } from "@/lib/hermes/film/filmBatchSetVideoParams";
import { runShotToVideoPromptTool } from "@/lib/hermes/film/filmShotToVideoPrompt";
import {
  buildFilmWorkflowCheckReport,
  formatFilmWorkflowCheckMessage,
} from "@/lib/hermes/film/filmWorkflowCheck";
import { runComposeExportTool } from "@/lib/hermes/hermesTools/composeExportTool";
import { runVideoGenerateTool } from "@/lib/hermes/hermesTools/videoGenerateTool";
import { runBibleUpdateTool } from "@/lib/hermes/hermesTools/bibleUpdateTool";
import { runCanvasSummarizeTool } from "@/lib/hermes/hermesTools/summarizeCanvasTool";
import { runCanvasFocusTool } from "@/lib/hermes/hermesTools/focusCanvasShotTool";
import { enrichDirectorStepFromNlMessage } from "@/lib/hermes/hermesNlEdit";
import { enrichPatchStepFromMessage } from "@/lib/hermes/hermesNlPatch";
import { runAddTextNodeTool } from "@/lib/hermes/hermesTools/addTextNodeTool";
import { pulseHermesAgentHighlight } from "@/store/hermesCanvasHighlightStore";
import { runPatchStoryboardShotTool } from "@/lib/hermes/hermesTools/patchStoryboardShotTool";
import { runImageRetryFailedTool } from "@/lib/hermes/hermesTools/imageRetryTool";
import { runVideoRetryFailedTool } from "@/lib/hermes/hermesTools/videoRetryTool";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import {
  loadHermesAutoChainSettings,
  resolveHermesBatchSplitSettings,
} from "@/lib/hermes/hermesAutoChainPolicy";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import { shouldUseMotionTemplate } from "@/lib/hermes/film/filmCharacterMotionPrompt";
import { createHermesBatchProgressReporter } from "@/lib/hermes/hermesBatchTaskTrack";
import {
  formatSubagentResults,
  runHermesSubagents,
  type HermesSubagentTask,
} from "@/lib/hermes/agent/hermesSubagent";
import { useProjectStore } from "@/store/projectStore";

const OUTLINE_SYSTEM = `你是专业短视频编剧。根据用户创意输出 JSON 数组，每项字段：
shotNumber（字符串镜号）、scene、durationHint、description。
输出 3–8 条镜头，只输出 JSON 数组，不要 markdown 说明。`;

type OutlineRow = {
  shotNumber?: string;
  scene?: string;
  durationHint?: string;
  description?: string;
};

function resolveScriptNodeId(explicit?: string): string | null {
  if (explicit?.trim()) return explicit.trim();
  const state = useProjectStore.getState();
  return findPrimaryScriptNode(state.nodes)?.id ?? null;
}

function resolveBeatIds(
  scriptNodeId: string,
  args: Record<string, unknown> | undefined,
  sourceMessage: string,
): string[] | undefined {
  const fromArgs = args?.beatIds;
  if (Array.isArray(fromArgs) && fromArgs.every((x) => typeof x === "number")) {
    const beats = normalizeScriptBeats(
      useProjectStore.getState().nodes.find((n) => n.id === scriptNodeId)?.data
        .scriptBeats,
    );
    return beatIdsForShotNumbers(beats, fromArgs as number[]);
  }
  const nums = resolveHermesShotNumbers(sourceMessage);
  if (nums.length === 0) return undefined;
  const beats = normalizeScriptBeats(
    useProjectStore.getState().nodes.find((n) => n.id === scriptNodeId)?.data
      .scriptBeats,
  );
  const ids = beatIdsForShotNumbers(beats, nums);
  return ids.length > 0 ? ids : undefined;
}

function defaultScriptPosition(nodes: Node<FlowNodeData>[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 120, y: 120 };
  const maxX = Math.max(...nodes.map((n) => n.position.x));
  return { x: maxX + 480, y: 120 };
}

async function toolEnsureScript(): Promise<HermesToolRunResult> {
  const state = useProjectStore.getState();
  const existing = findPrimaryScriptNode(state.nodes);
  if (existing) {
    return { ok: true, message: "画布上已有脚本节点", scriptNodeId: existing.id };
  }
  const id = crypto.randomUUID();
  const node: Node<FlowNodeData> = {
    id,
    type: "scriptNode",
    position: defaultScriptPosition(state.nodes),
    data: newNodeDataByType.scriptNode(),
  };
  state.addNode(node);
  state.setSelectedNodeIds([id]);
  state.setStatusText("Hermes：已创建脚本节点");
  return { ok: true, message: "已创建脚本节点", scriptNodeId: id };
}

async function toolUpdateBrief(
  scriptNodeId: string,
  args: Record<string, unknown> | undefined,
): Promise<HermesToolRunResult> {
  const brief = String(args?.briefText ?? "").trim();
  if (!brief) {
    return { ok: false, message: "梗概内容为空" };
  }
  useProjectStore.getState().updateNodeData(scriptNodeId, { prompt: brief });
  return { ok: true, message: "已写入脚本梗概", scriptNodeId };
}

function refPathsFromOpts(
  step: HermesPlanStep,
  opts: { referenceRelPaths?: string[] },
): string[] {
  const fromStep = step.args?.referenceRelPaths;
  if (Array.isArray(fromStep)) {
    return (fromStep as string[]).map((p) => p.trim()).filter(Boolean);
  }
  return (opts.referenceRelPaths ?? []).map((p) => p.trim()).filter(Boolean);
}

async function toolGenerateOutline(
  scriptNodeId: string,
  sourceMessage: string,
  refPaths: string[],
): Promise<HermesToolRunResult> {
  if (!isTauri()) {
    return { ok: false, message: "镜头大纲生成需在桌面端运行" };
  }
  const state = useProjectStore.getState();
  const node = state.nodes.find((n) => n.id === scriptNodeId);
  const params =
    node?.data.params && typeof node.data.params === "object"
      ? (node.data.params as Record<string, unknown>)
      : undefined;
  if (!(await preflightScriptNodeLlm(params, state.setStatusText))) {
    return { ok: false, message: "未配置可用的对话模型" };
  }
  const theme = (node?.data.prompt ?? "").toString().trim() || sourceMessage;
  state.setStatusText("Hermes：正在生成镜头大纲…");
  const refBlock =
    refPaths.length > 0
      ? `\n\n参考素材路径（可在镜头 description 中体现风格）：\n${refPaths.join("\n")}`
      : "";
  const raw = await invoke<string>("llm_complete_text", {
    systemPrompt: OUTLINE_SYSTEM,
    userPrompt: `创意/梗概：\n${theme}\n\n用户补充：\n${sourceMessage}${refBlock}`,
    ...scriptNodeLlmInvokeParams(params),
  });
  const parsed = extractJsonArray<OutlineRow>(raw) ?? [];
  if (parsed.length === 0) {
    return { ok: false, message: "镜头大纲解析失败，请重试" };
  }
  const beats: ScriptBeat[] = parsed.map((row, i) =>
    normalizeScriptBeat({
      id: crypto.randomUUID(),
      shotNumber: String(row.shotNumber ?? i + 1),
      scene: String(row.scene ?? ""),
      durationHint: String(row.durationHint ?? ""),
      description: String(row.description ?? ""),
    }),
  );
  state.updateNodeData(scriptNodeId, { scriptBeats: beats });
  state.setStatusText(`Hermes：已生成 ${beats.length} 条镜头大纲`);
  return { ok: true, message: `已生成 ${beats.length} 条镜头`, scriptNodeId };
}

async function toolGenerateStoryboard(
  scriptNodeId: string,
  args: Record<string, unknown> | undefined,
  sourceMessage: string,
): Promise<HermesToolRunResult> {
  const state = useProjectStore.getState();
  if (!state.projectPath?.trim()) {
    return { ok: false, message: "请先打开工程" };
  }
  const node = state.nodes.find((n) => n.id === scriptNodeId);
  if (!node) return { ok: false, message: "未找到脚本节点" };

  const beatsNorm = normalizeScriptBeats(node.data.scriptBeats);
  if (beatsNorm.length === 0) {
    return { ok: false, message: "脚本尚无镜头，请先生成大纲或导入剧本" };
  }

  const beatIds = resolveBeatIds(scriptNodeId, args, sourceMessage);
  const targetBeats = beatIds?.length
    ? beatsNorm.filter((b) => beatIds.includes(b.id))
    : beatsNorm;
  if (targetBeats.length === 0) {
    return { ok: false, message: "没有匹配的镜头可生成分镜" };
  }

  const params =
    node.data.params && typeof node.data.params === "object"
      ? (node.data.params as Record<string, unknown>)
      : undefined;
  if (!(await preflightScriptNodeLlm(params, state.setStatusText))) {
    return { ok: false, message: "未配置可用的对话模型" };
  }

  const themePrompt = (node.data.prompt ?? "").toString();
  const prevShots = node.data.storyboardShots ?? [];
  const llmParams = scriptNodeLlmInvokeParams(params);

  await runNodeTaskAgent(
    scriptStoryboardGenerateAgentRuntime,
    { targetBeats, themePrompt, prevShots, llmParams },
    {
      nodeId: scriptNodeId,
      projectPath: state.projectPath.trim(),
      updateNodeData: state.updateNodeData,
      setStatusText: state.setStatusText,
    },
  );
  return {
    ok: true,
    message: `已为 ${targetBeats.length} 镜生成分镜文案`,
    scriptNodeId,
  };
}

function toolSpawnMedia(
  scriptNodeId: string,
  args: Record<string, unknown> | undefined,
  sourceMessage: string,
): HermesToolRunResult {
  const beatIds = resolveBeatIds(scriptNodeId, args, sourceMessage);
  const result = handleScriptNodeCompleted(scriptNodeId, {
    ...(beatIds ? { beatIds } : {}),
  });
  if (result.total === 0) {
    return {
      ok: false,
      message: "没有可建链的分镜（请先生成分镜并确保 visualPrompt 就绪）",
      scriptNodeId,
    };
  }
  return {
    ok: true,
    message: `已建链 ${result.succeeded}/${result.total} 镜（新建节点 ${result.groups.length} 组）`,
    scriptNodeId,
  };
}

async function toolGenerateImages(
  scriptNodeId: string,
  args: Record<string, unknown> | undefined,
  sourceMessage: string,
  refPaths: string[],
  track?: { directorStepId: string; label: string },
): Promise<HermesToolRunResult> {
  const batchTrack = createHermesBatchProgressReporter(
    track?.directorStepId,
    "image",
    track?.label ?? "批量出图",
  );
  const state = useProjectStore.getState();
  const projectPath = state.projectPath?.trim();
  if (!projectPath) {
    return { ok: false, message: "请先打开工程" };
  }

  const scriptNode = state.nodes.find((n) => n.id === scriptNodeId);
  if (!scriptNode) return { ok: false, message: "未找到脚本节点" };

  const beatIds = resolveBeatIds(scriptNodeId, args, sourceMessage);
  const chainResult = handleScriptNodeCompleted(scriptNodeId, {
    ...(beatIds ? { beatIds } : {}),
  });
  if (chainResult.total > 0 && chainResult.succeeded === 0) {
    return { ok: false, message: "建链失败，无法出图" };
  }

  const fresh = useProjectStore.getState();
  const nodeParams =
    scriptNode.data.params && typeof scriptNode.data.params === "object"
      ? (scriptNode.data.params as Record<string, unknown>)
      : undefined;
  const split = resolveHermesBatchSplitSettings(
    loadHermesAutoChainSettings(),
    nodeParams,
  );

  const bible = useProjectBibleStore.getState().bible;
  const resolveBeatReferencePaths = createBeatReferenceResolver(
    scriptNode.data.scriptBeats,
    bible,
  );

  const mediaConcurrency = getAgentMaxConcurrentMedia();

  const batch = await batchGenerateImagesForStoryboard({
    scriptNodeId,
    nodes: fresh.nodes,
    edges: fresh.edges,
    projectPath,
    updateNodeData: fresh.updateNodeData,
    setStatusText: fresh.setStatusText,
    beatIds,
    referenceImagePathsPrefix: refPaths,
    resolveBeatReferencePaths,
    onProgress: batchTrack.onProgress,
    maxConcurrent: mediaConcurrency,
    hermesBatch: {
      strategy: split.batchSplitStrategy,
      packImageCount: split.packImageCount,
      beats: scriptNode.data.scriptBeats ?? [],
      shots: scriptNode.data.storyboardShots,
    },
  });

  if (batch.started === 0 && batch.failed === 0) {
    batchTrack.finish(false, "没有可提交的图片任务");
    return {
      ok: false,
      message: "没有可提交的图片任务（请确认分镜已就绪且已建图片节点）",
      scriptNodeId,
    };
  }
  const ok = batch.failed === 0 || batch.started > 0;
  batchTrack.finish(ok);
  if (ok && beatIds?.[0]) {
    void recordStyleAnchorFromScriptBeat(projectPath, scriptNodeId, beatIds[0]!);
  }
  return {
    ok: true,
    message: `图片任务：已提交 ${batch.started}，跳过 ${batch.skipped}，失败 ${batch.failed}${
      mediaConcurrency > 1 ? `（并发 ${mediaConcurrency} 镜）` : ""
    }`,
    scriptNodeId,
  };
}

async function maybePreSnapshotScriptVersion(
  toolId: HermesToolId,
  scriptNodeId: string | null | undefined,
): Promise<void> {
  if (!SCRIPT_VERSION_SNAPSHOT_TOOLS.has(toolId)) return;
  const sid = scriptNodeId ?? undefined;
  const projectPath = useProjectStore.getState().projectPath;
  if (!sid || !projectPath) return;
  try {
    await captureScriptVersionBeforeChange({
      projectPath,
      scriptNodeId: sid,
      toolId,
    });
  } catch {
    /* 预快照失败不阻断 */
  }
}

async function withScriptVersionSnapshot(
  toolId: HermesToolId,
  scriptNodeId: string | null | undefined,
  result: HermesToolRunResult,
): Promise<HermesToolRunResult> {
  if (!result.ok || !SCRIPT_VERSION_SNAPSHOT_TOOLS.has(toolId)) return result;
  const sid = result.scriptNodeId ?? scriptNodeId ?? undefined;
  const projectPath = useProjectStore.getState().projectPath;
  if (!sid || !projectPath) return result;
  try {
    const entry = await captureScriptVersionFromStore({
      projectPath,
      scriptNodeId: sid,
      label: toolId,
    });
    if (entry) {
      const note = formatScriptVersionSnapshotNote(entry);
      return {
        ...result,
        scriptVersionId: entry.id,
        message: result.message.includes(note) ? result.message : `${result.message}\n${note}`,
      };
    }
  } catch {
    /* 存档失败不阻断工具结果 */
  }
  return result;
}

export async function runHermesTool(
  step: HermesPlanStep,
  opts: {
    sourceMessage: string;
    scriptNodeId?: string | null;
    referenceRelPaths?: string[];
    directorStepId?: string;
  },
): Promise<HermesToolRunResult> {
  const toolId: HermesToolId = step.toolId;
  const refPaths = refPathsFromOpts(step, opts);

  if (toolId === "canvas.summarize") {
    return runCanvasSummarizeTool(step, {
      sourceMessage: opts.sourceMessage,
      scriptNodeId: opts.scriptNodeId,
    });
  }

  let scriptNodeId = resolveScriptNodeId(opts.scriptNodeId ?? undefined);

  switch (toolId) {
    case "canvas.add_text_node": {
      const initial = String(step.args?.initialPrompt ?? "").trim() || undefined;
      const result = runAddTextNodeTool({ initialPrompt: initial });
      if (result.ok) {
        const createdId = useProjectStore.getState().selectedNodeIds[0];
        if (createdId) pulseHermesAgentHighlight([createdId], step.label);
      }
      return result;
    }
    case "canvas.ensure_script":
      return toolEnsureScript();
    case "script.update_brief": {
      if (!scriptNodeId) {
        const ensured = await toolEnsureScript();
        if (!ensured.ok || !ensured.scriptNodeId) return ensured;
        scriptNodeId = ensured.scriptNodeId;
      }
      await maybePreSnapshotScriptVersion(toolId, scriptNodeId);
      const briefStep = enrichDirectorStepFromNlMessage(step, opts.sourceMessage);
      return withScriptVersionSnapshot(
        toolId,
        scriptNodeId,
        await toolUpdateBrief(scriptNodeId, briefStep.args),
      );
    }
    case "script.generate_outline": {
      if (!scriptNodeId) {
        const ensured = await toolEnsureScript();
        if (!ensured.ok || !ensured.scriptNodeId) return ensured;
        scriptNodeId = ensured.scriptNodeId;
      }
      await maybePreSnapshotScriptVersion(toolId, scriptNodeId);
      return withScriptVersionSnapshot(
        toolId,
        scriptNodeId,
        await toolGenerateOutline(scriptNodeId, opts.sourceMessage, refPaths),
      );
    }
    case "script.generate_storyboard": {
      if (!scriptNodeId) {
        return { ok: false, message: "请先在画布上创建脚本节点" };
      }
      try {
        await maybePreSnapshotScriptVersion(toolId, scriptNodeId);
        return withScriptVersionSnapshot(
          toolId,
          scriptNodeId,
          await toolGenerateStoryboard(scriptNodeId, step.args, opts.sourceMessage),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg };
      }
    }
    case "storyboard.patch_shot": {
      if (!scriptNodeId) {
        return { ok: false, message: "请先在画布上创建脚本节点" };
      }
      try {
        const patchStep = enrichPatchStepFromMessage(step, opts.sourceMessage);
        await maybePreSnapshotScriptVersion(toolId, scriptNodeId);
        return withScriptVersionSnapshot(
          toolId,
          scriptNodeId,
          await runPatchStoryboardShotTool(patchStep, {
            sourceMessage: opts.sourceMessage,
            scriptNodeId,
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg, scriptNodeId };
      }
    }
    case "canvas.focus": {
      try {
        return runCanvasFocusTool(step, {
          sourceMessage: opts.sourceMessage,
          scriptNodeId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg, scriptNodeId: scriptNodeId ?? undefined };
      }
    }
    case "template.run": {
      const templateId = String(step.args?.templateId ?? "").trim();
      return {
        ok: false,
        message: templateId
          ? `模板 ${templateId} 应在生成计划时展开；请重新发送指令以获取完整步骤`
          : "缺少 templateId",
      };
    }
    case "bible.update": {
      try {
        const bibleStep = enrichDirectorStepFromNlMessage(step, opts.sourceMessage);
        return await runBibleUpdateTool(bibleStep, {
          sourceMessage: opts.sourceMessage,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg, scriptNodeId: scriptNodeId ?? undefined };
      }
    }
    case "chain.spawn_media_nodes": {
      if (!scriptNodeId) {
        return { ok: false, message: "请先在画布上创建脚本节点" };
      }
      return toolSpawnMedia(scriptNodeId, step.args, opts.sourceMessage);
    }
    case "image.generate_for_beats": {
      if (!scriptNodeId) {
        return { ok: false, message: "请先在画布上创建脚本节点" };
      }
      try {
        return await toolGenerateImages(scriptNodeId, step.args, opts.sourceMessage, refPaths, {
          directorStepId: opts.directorStepId ?? step.id,
          label: step.label,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg };
      }
    }
    case "video.generate_for_beats": {
      try {
        return await runVideoGenerateTool(step, {
          sourceMessage: opts.sourceMessage,
          scriptNodeId,
          directorStepId: opts.directorStepId ?? step.id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg, scriptNodeId: scriptNodeId ?? undefined };
      }
    }
    case "image.retry_failed": {
      try {
        return await runImageRetryFailedTool(step, {
          sourceMessage: opts.sourceMessage,
          scriptNodeId,
          directorStepId: opts.directorStepId ?? step.id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg, scriptNodeId: scriptNodeId ?? undefined };
      }
    }
    case "video.retry_failed": {
      try {
        return await runVideoRetryFailedTool(step, {
          sourceMessage: opts.sourceMessage,
          scriptNodeId,
          directorStepId: opts.directorStepId ?? step.id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg, scriptNodeId: scriptNodeId ?? undefined };
      }
    }
    case "compose.export_script": {
      try {
        return await runComposeExportTool(step, {
          sourceMessage: opts.sourceMessage,
          scriptNodeId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg, scriptNodeId: scriptNodeId ?? undefined };
      }
    }
    case "film.create_standard_workflow": {
      const brief = String(step.args?.brief ?? opts.sourceMessage).trim();
      const style = String(step.args?.style ?? "写实").trim();
      const shotCount =
        typeof step.args?.shotCount === "number"
          ? step.args.shotCount
          : parseInt(String(step.args?.shotCount ?? "0"), 10) || 0;
      const totalDurationSec =
        typeof step.args?.totalDurationSec === "number"
          ? step.args.totalDurationSec
          : parseInt(String(step.args?.totalDurationSec ?? "0"), 10) || undefined;
      const spawnMedia = step.args?.spawnMedia === true;

      const result = applyShortDramaWorkflow({
        brief,
        style,
        shotCount: shotCount > 0 ? shotCount : undefined,
        totalDurationSec,
      });
      if (totalDurationSec && totalDurationSec > 0) {
        useProjectBibleStore.getState().patchBible({ targetDurationSec: totalDurationSec });
      }

      const scriptId = result.scriptNodeId;
      if (spawnMedia && scriptId) {
        const chain = handleScriptNodeCompleted(scriptId, {});
        if (chain.succeeded === 0 && chain.total === 0) {
          return {
            ok: true,
            message: `已搭建大纲→脚本（${result.createdScript ? "新建脚本" : "沿用已有脚本"}）；分镜未就绪，暂未建链`,
            scriptNodeId: scriptId,
          };
        }
      }

      return {
        ok: true,
        message: `已搭建短剧标准流程：大纲节点 + 脚本节点${result.linkedTextToScript ? "（已连线）" : ""}`,
        scriptNodeId: scriptId,
      };
    }
    case "film.shot_to_video_prompt": {
      if (!scriptNodeId) {
        return { ok: false, message: "请先在画布上创建脚本节点" };
      }
      const beatIdsRaw = step.args?.beatIds;
      const beatIds = Array.isArray(beatIdsRaw)
        ? (beatIdsRaw as number[])
        : undefined;
      const style =
        typeof step.args?.style === "string" ? step.args.style : undefined;
      try {
        const r = await runShotToVideoPromptTool({
          scriptNodeId,
          beatIds,
          style,
          sourceMessage: opts.sourceMessage,
          useMotionTemplate: shouldUseMotionTemplate(
            opts.sourceMessage,
            step.args as Record<string, unknown> | undefined,
          ),
        });
        return {
          ok: r.updated > 0,
          message: r.message,
          scriptNodeId,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg, scriptNodeId };
      }
    }
    case "film.workflow_check": {
      const state = useProjectStore.getState();
      const bible = useProjectBibleStore.getState().bible;
      const report = buildFilmWorkflowCheckReport({
        nodes: state.nodes,
        edges: state.edges,
        projectPath: state.projectPath,
        bible,
      });
      const message = formatFilmWorkflowCheckMessage(report);
      state.setStatusText(`Hermes：${report.summary}`);
      return {
        ok: true,
        message,
        scriptNodeId: scriptNodeId ?? undefined,
      };
    }
    case "film.batch_set_video_params": {
      if (!scriptNodeId) {
        return { ok: false, message: "请先在画布上创建脚本节点" };
      }
      const beatIdsRaw = step.args?.beatIds;
      const beatIds = Array.isArray(beatIdsRaw)
        ? (beatIdsRaw as number[])
        : undefined;
      const durationSec =
        typeof step.args?.durationSec === "number"
          ? step.args.durationSec
          : parseInt(String(step.args?.durationSec ?? ""), 10) || undefined;
      const aspectRatio =
        typeof step.args?.aspectRatio === "string"
          ? step.args.aspectRatio
          : undefined;
      const resolution =
        step.args?.resolution === "1080P" || step.args?.resolution === "720P"
          ? step.args.resolution
          : undefined;
      const r = runBatchSetVideoParams({
        scriptNodeId,
        beatIds,
        sourceMessage: opts.sourceMessage,
        durationSec,
        aspectRatio,
        resolution,
      });
      return {
        ok: r.updated > 0,
        message: r.message,
        scriptNodeId,
      };
    }
    case "agent.delegate_parallel": {
      const tasksRaw = step.args?.tasks;
      if (!Array.isArray(tasksRaw) || tasksRaw.length === 0) {
        return { ok: false, message: "并行子 Agent 需要 tasks 数组" };
      }
      const tasks: HermesSubagentTask[] = [];
      for (const row of tasksRaw) {
        if (!row || typeof row !== "object") continue;
        const o = row as Record<string, unknown>;
        const tid = String(o.toolId ?? "").trim() as HermesPlanStep["toolId"];
        if (!tid) continue;
        tasks.push({
          id: String(o.id ?? crypto.randomUUID()),
          label: String(o.label ?? tid),
          toolId: tid,
          args:
            o.args && typeof o.args === "object"
              ? (o.args as Record<string, unknown>)
              : undefined,
        });
      }
      if (tasks.length === 0) {
        return { ok: false, message: "tasks 内无有效子任务" };
      }
      const results = await runHermesSubagents(tasks, {
        sourceMessage: opts.sourceMessage,
        scriptNodeId,
        referenceRelPaths: refPaths,
        maxConcurrent: getAgentMaxConcurrentMedia(),
      });
      const ok = results.every((r) => r.ok);
      return {
        ok,
        message: formatSubagentResults(results),
        scriptNodeId: scriptNodeId ?? undefined,
      };
    }
    default:
      return { ok: false, message: `未知工具：${toolId}` };
  }
}
