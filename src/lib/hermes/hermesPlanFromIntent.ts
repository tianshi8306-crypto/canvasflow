import type { HermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import { parseShotNumbersFromMessage } from "@/lib/hermes/hermesCanvasContext";
import {
  getActiveStyleAnchor,
  messageHasMotionReferent,
  messageHasStyleReferent,
  pickMotionCloneBatchShotNumbers,
  pickStyleCloneBatchShotNumbers,
  resolveStyleReferenceMotion,
  styleReferenceShotNumber,
} from "@/lib/hermes/agent/hermesStyleReferent";
import {
  getCachedVersionStyleReferent,
  isVersionStyleReferentFresh,
  messageHasVersionReferent,
  resolveVersionSnapshotForShot,
} from "@/lib/hermes/agent/hermesVersionReferent";
import {
  messageHasShotReferent,
  resolveHermesShotNumbers,
} from "@/lib/hermes/hermesReferentResolution";
import {
  bibleUpdateArgsFromMessage,
  buildNlBibleEditLabel,
  buildNlBriefEditLabel,
  extractNlBriefText,
  wantsNlBibleFieldEdit,
  wantsNlBriefEdit,
} from "@/lib/hermes/hermesNlEdit";
import {
  buildPatchShotLabel,
  parseHermesNlPatchIntent,
  patchArgsFromNlIntent,
  wantsNlPatchShot,
} from "@/lib/hermes/hermesNlPatch";
import { wantsWorkflowRepair } from "@/lib/hermes/hermesWorkflowRepair";
import {
  buildParallelImageSubagentTasks,
  splitBeatIdsForParallel,
} from "@/lib/hermes/agent/hermesSubagent";
import { userMessageRequestsFullAuto } from "@/lib/hermes/hermesAutoPipelinePrefs";
import {
  defaultTemplateIdForContext,
  HERMES_FULL_AUTO_TEMPLATE_ID,
  instantiateTemplatePlan,
  resolveTemplateIdFromMessage,
} from "@/lib/hermes/hermesPlanTemplates";
import { wantsCharacterMotionVideoPrompt } from "@/lib/hermes/film/filmCharacterMotionPrompt";
import { parseExportFormatFromMessage } from "@/lib/compose/timelineExportFormat";
import type { HermesDirectorPlan, HermesPlanStep, HermesToolId } from "@/lib/hermes/hermesDirectorTypes";
import {
  extractTextNodeInitialPrompt,
  wantsAddTextNode,
} from "@/lib/hermes/hermesCanvasStructureIntent";

function wantsBrief(text: string): boolean {
  return /大纲|梗概|剧本|创意|故事|短剧|短片|撰写|写一/.test(text);
}

function wantsOutlineBeats(text: string): boolean {
  return /镜头表|分镜表|拆镜|几条镜头|几个镜头/.test(text);
}

function wantsStoryboard(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(text.trim())) return false;
  return /分镜|storyboard/i.test(text);
}

function wantsChain(text: string): boolean {
  return /建链|下游|配对|媒体节点|图片节点|视频节点/.test(text);
}

function wantsImages(text: string): boolean {
  if (/出视频|生成视频|图生视频|批量视频|视频生成/.test(text)) return false;
  if (wantsRetryFailedKeyframe(text)) return false;
  if (/已出图|出过图|出好图|图已|关键帧已有|有图了/.test(text)) return false;
  return /出图|关键帧|生图|画图|渲染图|批量图|出.*镜/.test(text);
}

function wantsVideo(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(text.trim())) return false;
  if (wantsRetryFailedVideo(text)) return false;
  return /出视频|生成视频|图生视频|批量视频|视频生成|镜头.*视频|视频.*镜头/.test(text);
}

function wantsRetryFailedVideo(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(text.trim())) return false;
  return /重试.*视频|视频.*重试|失败.*视频|重新生成.*视频|再.*出.*视频/.test(text);
}

function wantsRetryFailedKeyframe(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(text.trim())) return false;
  if (wantsRetryFailedVideo(text)) return false;
  return /重试.*(关键帧|出图|分镜图)|失败.*(关键帧|出图)|关键帧.*重试|出图.*重试|重新生成.*(关键帧|分镜图)/.test(
    text,
  );
}

function wantsFullPipeline(text: string): boolean {
  return (
    userMessageRequestsFullAuto(text) ||
    /全流程|一键|从头|从创意|开始创作|帮我做/.test(text)
  );
}

function wantsFullAutoExportTemplate(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么)/.test(text.trim())) return false;
  return userMessageRequestsFullAuto(text) || /跑模板.*全自动|模板.*full-auto/.test(text);
}

function wantsStandardFilmWorkflow(text: string): boolean {
  return /搭.*流程|标准.*链路|短剧.*流程|拍摄流程|从零.*短剧|搭建.*画布|创建.*大纲.*脚本/.test(
    text,
  );
}

function wantsVideoPromptDraft(text: string): boolean {
  if (wantsCharacterMotionVideoPrompt(text)) return true;
  return /视频提示词|seedance.*提示|填.*视频.*prompt|写入.*draft|分镜.*视频.*词/.test(
    text,
  );
}

function motionTemplateArg(text: string): { useMotionTemplate: boolean } {
  return { useMotionTemplate: wantsCharacterMotionVideoPrompt(text) };
}

/** 只补视频提示词、不提交生成任务 */
function wantsVideoPromptFillOnly(text: string): boolean {
  if (wantsVideo(text) || wantsFullPipeline(text) || wantsTemplateRun(text)) {
    return false;
  }
  return wantsVideoPromptDraft(text);
}

function wantsWorkflowCheck(text: string): boolean {
  return /流程检查|检查流程|断链|缺什么|还缺|生产就绪|流程诊断|SOP.*检查/.test(text);
}

function wantsTemplateRun(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(text.trim())) return false;
  if (/有哪些模板|模板列表|列出模板/.test(text)) return true;
  return /模板|template/i.test(text) && /跑|用|执行|套用|应用|走/.test(text);
}

function wantsCanvasSummarize(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(text.trim())) return false;
  if (wantsWorkflowCheck(text)) return false;
  return /画布状态|当前进度|制片进度|进展如何|生产情况|什么情况|总结.*进度|看看进度|状态一览|制片摘要/.test(
    text,
  );
}

function wantsBatchVideoParams(text: string): boolean {
  return /批量.*参数|统一.*时长|全部.*\d+秒|竖屏|横屏.*视频|设置.*视频.*参数/.test(text);
}

function wantsParallelBatch(text: string): boolean {
  if (/^(什么是|怎么|如何)/.test(text.trim())) return false;
  return /并行.*(出图|生图|生成)|同时.*(出图|生成).*镜|多路.*出图/.test(text);
}

function wantsExport(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(text.trim())) return false;
  return /导出成片|成片导出|合成导出|渲染成片|导出视频|合成视频|时间线导出|剪辑导出|拼成.*视频|导出.*成片|准备.*时间线|填.*时间线/.test(
    text,
  );
}

function wantsExportTimelineOnly(text: string): boolean {
  return /不渲染|仅准备|只准备|先不导出|只填时间线|不导出|不自动渲染/.test(text);
}

function wantsFocusShot(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(text.trim())) return false;
  if (
    parseShotNumbersFromMessage(text).length === 0 &&
    !messageHasShotReferent(text)
  ) {
    return false;
  }
  return /定位|聚焦|跳转|跳到|找到|打开.*镜|看看.*镜|去.*镜|画布.*镜/.test(text);
}

function wantsBibleUpdate(text: string): boolean {
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(text.trim())) return false;
  if (wantsNlBriefEdit(text) || wantsNlBibleFieldEdit(text)) return false;
  return (
    /项目圣经|圣经/.test(text) ||
    (/视觉风格|整体风格|画风/.test(text) && /改|设|写|更新/.test(text)) ||
    /同步.*角色|角色.*同步/.test(text) ||
    (/logline/i.test(text) && /改|写|更新/.test(text))
  );
}

function step(toolId: HermesToolId, label: string, args?: Record<string, unknown>): HermesPlanStep {
  return { id: crypto.randomUUID(), toolId, label, args };
}

/**
 * 规则型计划：根据用户话术 + 画布状态组装步骤（无需二次 LLM）。
 * 无匹配动作时返回 null，走纯对话。
 */
export function buildDirectorPlan(
  userMessage: string,
  ctx: HermesCanvasContext,
  opts?: { referenceRelPaths?: string[] },
): HermesDirectorPlan | null {
  const text = userMessage.trim();
  if (!text) return null;

  const onlyAsk =
    /^(什么是|怎么|如何|为什么|介绍|解释)/.test(text) &&
    !wantsBrief(text) &&
    !wantsStoryboard(text) &&
    !wantsImages(text) &&
    !wantsFullPipeline(text) &&
    !wantsExport(text) &&
    !wantsVideo(text) &&
    !wantsStandardFilmWorkflow(text) &&
    !wantsWorkflowCheck(text);
  if (onlyAsk && !ctx.scriptNodeId) return null;

  if (wantsAddTextNode(text)) {
    const initial = extractTextNodeInitialPrompt(text);
    return {
      id: crypto.randomUUID(),
      title: "添加文本节点",
      sourceMessage: text,
      steps: [
        step("canvas.add_text_node", "在画布上创建文本节点", {
          ...(initial ? { initialPrompt: initial } : {}),
        }),
      ],
      plannerSource: "rules",
      ...(opts?.referenceRelPaths?.length
        ? { referenceRelPaths: opts.referenceRelPaths }
        : {}),
    };
  }

  const shotNums = resolveHermesShotNumbers(text);
  const beatIdsArg =
    shotNums.length > 0 ? { beatIds: shotNums } : undefined;
  const scopedImages = wantsImages(text) || (shotNums.length > 0 && !wantsVideo(text));
  const scopedVideos = wantsVideo(text) || (shotNums.length > 0 && /视频/.test(text));

  const brief = wantsBrief(text) || wantsFullPipeline(text);
  const storyboard = wantsStoryboard(text) || wantsFullPipeline(text);
  const chain =
    wantsChain(text) || scopedImages || scopedVideos || wantsFullPipeline(text);
  const images =
    scopedImages || /分镜.*出图|出图.*分镜/.test(text) || wantsFullPipeline(text);
  const videos =
    scopedVideos || wantsFullPipeline(text);
  const outline = wantsOutlineBeats(text) || (brief && ctx.beatCount === 0);
  const exportTimeline = wantsExport(text);

  const needsScript =
    !ctx.scriptNodeId &&
    (brief ||
      storyboard ||
      chain ||
      images ||
      videos ||
      outline ||
      wantsFullPipeline(text) ||
      exportTimeline);

  const steps: HermesPlanStep[] = [];

  if (messageHasVersionReferent(text) && ctx.scriptNodeId && !onlyAsk) {
    const versionRef = getCachedVersionStyleReferent();
    if (versionRef && isVersionStyleReferentFresh(versionRef)) {
      let targets = resolveHermesShotNumbers(text);
      if (targets.length === 0) {
        targets = versionRef.snapshots
          .map((s) => parseInt(s.shotNumber, 10))
          .filter((n) => n >= 1 && n < 200)
          .slice(0, 6);
      }
      const regenImage =
        wantsImages(text) || /出图|关键帧|生图|渲染图/.test(text);
      const regenVideo = wantsVideo(text) || /出视频|视频/.test(text);
      for (const shotNum of targets) {
        const snap = resolveVersionSnapshotForShot(versionRef, shotNum);
        if (!snap?.visualPrompt && !snap?.videoMotionPrompt) continue;
        steps.push(
          step(
            "storyboard.patch_shot",
            `镜 ${shotNum} 恢复上一版${regenImage ? "并出图" : ""}`,
            {
              beatIds: [shotNum],
              ...(snap.visualPrompt ? { visualPrompt: snap.visualPrompt } : {}),
              ...(snap.videoMotionPrompt
                ? { videoMotionPrompt: snap.videoMotionPrompt }
                : {}),
              regenerateImage: regenImage,
              regenerateVideo: regenVideo,
            },
          ),
        );
      }
      if (steps.length > 0) {
        return {
          id: crypto.randomUUID(),
          title: steps.length > 1 ? "批量恢复上一版" : "恢复上一版",
          sourceMessage: text,
          steps,
          plannerSource: "rules",
          ...(opts?.referenceRelPaths?.length
            ? { referenceRelPaths: opts.referenceRelPaths }
            : {}),
        };
      }
    }
  }

  if (messageHasMotionReferent(text) && ctx.scriptNodeId && !onlyAsk) {
    const anchor = getActiveStyleAnchor();
    const motion = resolveStyleReferenceMotion(anchor);
    if (motion) {
      let targets = resolveHermesShotNumbers(text);
      if (targets.length === 0) {
        targets = pickMotionCloneBatchShotNumbers(anchor!, text);
      }
      if (targets.length > 0) {
        const regenVideo =
          wantsVideo(text) || /出视频|视频|重出|成片/.test(text);
        steps.push(
          step(
            "storyboard.patch_shot",
            targets.length > 1
              ? `${targets.length} 镜套用参考运镜${regenVideo ? "并出视频" : ""}`
              : `镜 ${targets.join("、")} 套用参考运镜${regenVideo ? "并出视频" : ""}`,
            {
              beatIds: targets,
              videoMotionPrompt: motion,
              regenerateVideo: regenVideo,
            },
          ),
        );
        return {
          id: crypto.randomUUID(),
          title: targets.length > 1 ? "批量运镜套用" : "运镜套用",
          sourceMessage: text,
          steps,
          plannerSource: "rules",
          ...(opts?.referenceRelPaths?.length
            ? { referenceRelPaths: opts.referenceRelPaths }
            : {}),
        };
      }
    }
  }

  if (messageHasStyleReferent(text) && ctx.scriptNodeId && !onlyAsk) {
    const anchor = getActiveStyleAnchor();
    if (anchor) {
      let targets = resolveHermesShotNumbers(text);
      if (targets.length === 0) {
        targets = pickStyleCloneBatchShotNumbers(anchor, text);
      }
      if (targets.length > 0) {
        const refShot = styleReferenceShotNumber(anchor);
        const regen =
          wantsImages(text) || /出图|关键帧|生图|渲染图/.test(text);
        steps.push(
          step(
            "storyboard.patch_shot",
            targets.length > 1
              ? `${targets.length} 镜套用参考风格${regen ? "并出图" : ""}`
              : `镜 ${targets.join("、")} 套用参考风格${regen ? "并出图" : ""}`,
            {
              beatIds: targets,
              ...(refShot ? { styleReferenceShot: refShot } : {}),
              ...(!refShot && anchor.visualPromptSnippet
                ? { styleReferenceSnippet: anchor.visualPromptSnippet }
                : {}),
              regenerateImage: regen,
            },
          ),
        );
        return {
          id: crypto.randomUUID(),
          title: targets.length > 1 ? "批量风格套用" : "风格套用",
          sourceMessage: text,
          steps,
          plannerSource: "rules",
          ...(opts?.referenceRelPaths?.length
            ? { referenceRelPaths: opts.referenceRelPaths }
            : {}),
        };
      }
    }
  }

  if (wantsParallelBatch(text) && !onlyAsk && ctx.scriptNodeId) {
    const parallelShots = resolveHermesShotNumbers(text);
    const beatNums =
      parallelShots.length > 0
        ? parallelShots
        : Array.from({ length: Math.min(ctx.storyboardReadyCount || ctx.beatCount, 12) }, (_, i) => i + 1);
    if (beatNums.length >= 2) {
      const groups = splitBeatIdsForParallel(beatNums, 3);
      const tasks = buildParallelImageSubagentTasks(groups).map((t) => ({
        id: t.id,
        toolId: t.toolId,
        label: t.label,
        args: t.args,
      }));
      return {
        id: crypto.randomUUID(),
        title: "并行子 Agent 出图",
        sourceMessage: text,
        steps: [
          step("agent.delegate_parallel", "并行提交多路出图", { tasks }),
        ],
        plannerSource: "rules",
        ...(opts?.referenceRelPaths?.length
          ? { referenceRelPaths: opts.referenceRelPaths }
          : {}),
      };
    }
  }

  if (wantsFullAutoExportTemplate(text) && !onlyAsk) {
    const autoPlan = instantiateTemplatePlan(HERMES_FULL_AUTO_TEMPLATE_ID, text, {
      referenceRelPaths: opts?.referenceRelPaths,
    });
    if (autoPlan) return autoPlan;
  }

  if (wantsTemplateRun(text) && !onlyAsk) {
    if (/有哪些模板|模板列表|列出模板/.test(text)) {
      return {
        id: crypto.randomUUID(),
        title: "计划模板",
        sourceMessage: text,
        steps: [
          step("canvas.summarize", "列出可用计划模板", {
            catalogOnly: true,
          }),
        ],
        plannerSource: "rules",
      };
    }

    const templateId =
      resolveTemplateIdFromMessage(text) ??
      (wantsFullPipeline(text) ? HERMES_FULL_AUTO_TEMPLATE_ID : null) ??
      defaultTemplateIdForContext({
        hasScript: Boolean(ctx.scriptNodeId),
        storyboardReadyCount: ctx.storyboardReadyCount,
      });
    const plan = instantiateTemplatePlan(templateId, text, {
      referenceRelPaths: opts?.referenceRelPaths,
    });
    if (plan) return plan;

    return {
      id: crypto.randomUUID(),
      title: "计划模板",
      sourceMessage: text,
      steps: [step("canvas.summarize", "列出可用计划模板", { catalogOnly: true })],
      plannerSource: "rules",
    };
  }

  if (wantsStandardFilmWorkflow(text) && !onlyAsk) {
    const durationMatch = text.match(/(\d+)\s*秒/);
    const shotMatch = text.match(/(\d+)\s*镜/);
    steps.push(
      step("film.create_standard_workflow", "搭建短剧标准生产链路（大纲→脚本）", {
        brief: text,
        style: /古风/.test(text) ? "古风" : /动漫/.test(text) ? "动漫" : /赛博/.test(text) ? "赛博" : "写实",
        shotCount: shotMatch ? parseInt(shotMatch[1], 10) : 5,
        totalDurationSec: durationMatch ? parseInt(durationMatch[1], 10) : 30,
      }),
    );
    return {
      id: crypto.randomUUID(),
      title: "短剧标准流程",
      sourceMessage: text,
      steps,
      plannerSource: "rules",
      ...(opts?.referenceRelPaths?.length
        ? { referenceRelPaths: opts.referenceRelPaths }
        : {}),
    };
  }

  if (wantsNlBriefEdit(text) && ctx.scriptNodeId && !onlyAsk) {
    const briefText = extractNlBriefText(text);
    if (briefText) {
      steps.push(
        step("script.update_brief", buildNlBriefEditLabel(briefText), {
          briefText,
        }),
      );
      return {
        id: crypto.randomUUID(),
        title: "更新梗概",
        sourceMessage: text,
        steps,
        plannerSource: "rules",
      };
    }
  }

  if (wantsNlBibleFieldEdit(text) && ctx.projectPath && !onlyAsk) {
    const args = bibleUpdateArgsFromMessage(text);
    if (Object.keys(args).length > 0) {
      steps.push(step("bible.update", buildNlBibleEditLabel(args), args));
      return {
        id: crypto.randomUUID(),
        title: "更新圣经字段",
        sourceMessage: text,
        steps,
        plannerSource: "rules",
      };
    }
  }

  if (wantsBibleUpdate(text) && ctx.projectPath && !onlyAsk) {
    const durationMatch = text.match(/(\d+)\s*秒/);
    const syncCharacters = /同步.*角色|角色.*同步/.test(text);
    steps.push(
      step("bible.update", "更新项目圣经", {
        ...(durationMatch ? { targetDurationSec: parseInt(durationMatch[1]!, 10) } : {}),
        syncCharacters,
      }),
    );
    return {
      id: crypto.randomUUID(),
      title: "项目圣经",
      sourceMessage: text,
      steps,
      plannerSource: "rules",
    };
  }

  if (wantsFocusShot(text) && ctx.scriptNodeId && !onlyAsk) {
    const shotNums = resolveHermesShotNumbers(text);
    const target = /脚本|分镜表|全屏|表格/.test(text)
      ? "script"
      : /视频节点|出视频|视频/.test(text) && !/图片|出图/.test(text)
        ? "video"
        : /图片|出图|关键帧/.test(text)
          ? "image"
          : "auto";
    steps.push(
      step("canvas.focus", `定位第 ${shotNums.join("、")} 镜`, {
        beatIds: shotNums,
        target,
      }),
    );
    return {
      id: crypto.randomUUID(),
      title: "画布定位",
      sourceMessage: text,
      steps,
      plannerSource: "rules",
    };
  }

  if (wantsNlPatchShot(text) && ctx.scriptNodeId && !onlyAsk) {
    const patchIntent = parseHermesNlPatchIntent(text);
    if (patchIntent) {
      steps.push(
        step("storyboard.patch_shot", buildPatchShotLabel(patchIntent), {
          ...patchArgsFromNlIntent(patchIntent),
        }),
      );
    }
    if (steps.length > 0) {
      return {
        id: crypto.randomUUID(),
        title: "单镜调整",
        sourceMessage: text,
        steps,
        plannerSource: "rules",
        ...(opts?.referenceRelPaths?.length
          ? { referenceRelPaths: opts.referenceRelPaths }
          : {}),
      };
    }
  }

  if (wantsRetryFailedVideo(text) && ctx.scriptNodeId && !onlyAsk) {
    const label =
      shotNums.length > 0
        ? `重试第 ${shotNums.join("、")} 镜的失败视频`
        : "重试所有失败镜头的视频生成";
    steps.push(step("video.retry_failed", label, beatIdsArg));
    return {
      id: crypto.randomUUID(),
      title: "重试失败视频",
      sourceMessage: text,
      steps,
      plannerSource: "rules",
      ...(opts?.referenceRelPaths?.length
        ? { referenceRelPaths: opts.referenceRelPaths }
        : {}),
    };
  }

  if (wantsRetryFailedKeyframe(text) && ctx.scriptNodeId && !onlyAsk) {
    const label =
      shotNums.length > 0
        ? `重试第 ${shotNums.join("、")} 镜的失败关键帧`
        : "重试所有失败镜头的关键帧出图";
    steps.push(step("image.retry_failed", label, beatIdsArg));
    return {
      id: crypto.randomUUID(),
      title: "重试失败关键帧",
      sourceMessage: text,
      steps,
      plannerSource: "rules",
      ...(opts?.referenceRelPaths?.length
        ? { referenceRelPaths: opts.referenceRelPaths }
        : {}),
    };
  }

  if (wantsCanvasSummarize(text) && !onlyAsk) {
    const shotNums = resolveHermesShotNumbers(text);
    steps.push(
      step("canvas.summarize", "汇总当前工程制片状态", {
        ...(shotNums.length > 0 ? { beatIds: shotNums } : {}),
      }),
    );
    return {
      id: crypto.randomUUID(),
      title: "制片状态",
      sourceMessage: text,
      steps,
      plannerSource: "rules",
    };
  }

  if (wantsWorkflowCheck(text) && !onlyAsk) {
    const autoRepair = wantsWorkflowRepair(text);
    steps.push(
      step(
        "film.workflow_check",
        autoRepair
          ? "检查短剧流程并自动修复断链"
          : "按 SOP 检查短剧生产流程与断链",
        autoRepair ? { autoRepair: true } : undefined,
      ),
    );
    return {
      id: crypto.randomUUID(),
      title: autoRepair ? "流程检查与修复" : "流程检查",
      sourceMessage: text,
      steps,
      plannerSource: "rules",
    };
  }

  if (wantsBatchVideoParams(text) && ctx.scriptNodeId) {
    const durationMatch = text.match(/(\d+)\s*秒/);
    const aspectRatio = /竖屏|9:16|9比16/.test(text)
      ? "9:16"
      : /1:1|方形/.test(text)
        ? "1:1"
        : /16:9|横屏/.test(text)
          ? "16:9"
          : undefined;
    steps.push(
      step("film.batch_set_video_params", "批量写入视频节点 Seedance 参数", {
        ...beatIdsArg,
        durationSec: durationMatch ? parseInt(durationMatch[1], 10) : 5,
        aspectRatio,
      }),
    );
    return {
      id: crypto.randomUUID(),
      title: "批量视频参数",
      sourceMessage: text,
      steps,
      plannerSource: "rules",
    };
  }

  if (wantsVideoPromptFillOnly(text) && ctx.scriptNodeId) {
    const motion = motionTemplateArg(text);
    steps.push(
      step(
        "film.shot_to_video_prompt",
        motion.useMotionTemplate
          ? "按人物动作模板补全视频提示词（知识库+模型）"
          : "按分镜写入 Seedance 视频提示词",
        {
          ...beatIdsArg,
          style: /古风/.test(text) ? "古风" : undefined,
          ...motion,
        },
      ),
    );
    if (steps.length > 0) {
      return {
        id: crypto.randomUUID(),
        title: "视频提示词回填",
        sourceMessage: text,
        steps,
        plannerSource: "rules",
      };
    }
  }

  if (needsScript) {
    steps.push(step("canvas.ensure_script", "在画布上创建脚本节点"));
  }

  if (brief && !onlyAsk) {
    steps.push(
      step("script.update_brief", "将创意写入脚本梗概", {
        briefText: text,
      }),
    );
  }

  if (outline && ctx.beatCount === 0) {
    steps.push(step("script.generate_outline", "用模型生成镜头大纲（脚本表）"));
  }

  if (storyboard) {
    steps.push(
      step("script.generate_storyboard", "为脚本镜头生成分镜文案", {
        ...beatIdsArg,
      }),
    );
  }

  if (chain && (ctx.storyboardReadyCount > 0 || storyboard || videos)) {
    steps.push(
      step("chain.spawn_media_nodes", "为分镜创建图片/视频节点配对", {
        ...beatIdsArg,
      }),
    );
  }

  const refPaths =
    opts?.referenceRelPaths?.filter((p) => p.trim().length > 0) ?? [];
  const refArgs = refPaths.length > 0 ? { referenceRelPaths: refPaths } : {};

  if (images) {
    const refNote = refPaths.length > 0 ? `（参考 ${refPaths.length} 个素材）` : "";
    const label =
      shotNums.length > 0
        ? `为第 ${shotNums.join("、")} 镜提交图片生成${refNote}`
        : `为已就绪分镜批量提交图片生成${refNote}`;
    steps.push(
      step("image.generate_for_beats", label, {
        ...beatIdsArg,
        ...refArgs,
      }),
    );
  }

  if (videos && ctx.scriptNodeId && ctx.storyboardReadyCount > 0) {
    steps.push(
      step("film.shot_to_video_prompt", "出视频前按人物动作模板补全提示词", {
        ...beatIdsArg,
        style: /古风/.test(text) ? "古风" : undefined,
        useMotionTemplate: true,
      }),
    );
  }

  if (videos) {
    const videoLabel =
      shotNums.length > 0
        ? `为第 ${shotNums.join("、")} 镜提交视频生成（图生视频）`
        : "为已就绪分镜批量提交视频生成";
    steps.push(
      step("video.generate_for_beats", videoLabel, {
        ...beatIdsArg,
      }),
    );
  }

  if (exportTimeline) {
    const autoRender = !wantsExportTimelineOnly(text);
    const exportFormat = parseExportFormatFromMessage(text);
    const formatHint = exportFormat ? ` ${exportFormat.toUpperCase()}` : "";
    const exportLabel = autoRender
      ? shotNums.length > 0
        ? `导出第 ${shotNums.join("、")} 镜并合成成片${formatHint}（FFmpeg）`
        : `按脚本镜号合成时间线并导出成片${formatHint}`
      : shotNums.length > 0
        ? `为第 ${shotNums.join("、")} 镜准备合成时间线（不渲染）`
        : "准备合成时间线（填入片段，不自动渲染）";
    steps.push(
      step("compose.export_script", exportLabel, {
        autoRender,
        ...beatIdsArg,
        ...(exportFormat ? { exportFormat } : {}),
      }),
    );
  }

  if (steps.length === 0) {
    if (ctx.scriptNodeId && scopedImages) {
      steps.push(
        step("chain.spawn_media_nodes", "创建下游媒体节点", { ...beatIdsArg }),
        step("image.generate_for_beats", "提交图片生成", {
          ...beatIdsArg,
          ...refArgs,
        }),
      );
    } else if (ctx.scriptNodeId && scopedVideos) {
      steps.push(
        step("chain.spawn_media_nodes", "创建图片/视频节点", { ...beatIdsArg }),
        step("video.generate_for_beats", "提交视频生成", { ...beatIdsArg }),
      );
    } else {
      return null;
    }
  }

  if (!ctx.projectPath && steps.some((s) => s.toolId !== "canvas.summarize")) {
    return {
      id: crypto.randomUUID(),
      title: "无法执行",
      sourceMessage: text,
      steps: [
        step("canvas.summarize", "请先打开或新建工程后再执行生成类操作"),
      ],
    };
  }

  return {
    id: crypto.randomUUID(),
    title: "Hermes 执行计划",
    sourceMessage: text,
    steps,
    plannerSource: "rules",
    ...(refPaths.length > 0 ? { referenceRelPaths: refPaths } : {}),
  };
}

export { formatPlanStepsForChat } from "@/lib/hermes/hermesChatBrevity";
