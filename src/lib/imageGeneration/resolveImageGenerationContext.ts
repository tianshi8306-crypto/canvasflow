import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { orderedIncomingScriptNodeIds } from "@/lib/incomingScriptBinding";
import { resolveAssetRelPath } from "@/shared/api/assets";
import { aggregateImagePrompt } from "@/lib/imageGeneration/aggregateImagePrompt";
import { collectIncomingImagePanelItems, imagePanelItemsToIncomingRefs } from "@/lib/imageGeneration/collectIncomingImagePanelItems";
import {
  orderIncomingImagePanelRefs,
  readImageReferenceEdgeOrder,
} from "@/lib/imageGeneration/imageReferenceEdgeOrder";
import { detectImageTask } from "@/lib/imageGeneration/detectImageTask";
import {
  appendImageEditPromptSuffix,
  getImageEditIntent,
  resolveLocalNodeImagePath,
} from "@/lib/imageGeneration/imageEditIntent";
import type {
  ImageGenerationContext,
  IncomingImageRef,
  ResolvedIncomingImageRef,
} from "@/lib/imageGeneration/types";

/** 为 true 时允许多图融合 task 下发 API */
export const IMAGE_MULTI_REF_API_READY = true;

const BLOCK = {
  NEED_REF: "请连接已出图的图片节点作为参考，或先上传/生成参考图。",
  RESOLVE_FAILED: "无法解析参考图，请检查素材是否已导入工程。",
  MULTI_SCRIPT: "检测到多个脚本节点，请只保留一条脚本连线。",
  MULTI_REF_NOT_READY: "多图参考功能尚未就绪，请暂时只连接 1 张参考图。",
  NOT_IMAGE_NODE: "目标节点不是图片节点。",
  NO_LOCAL_IMAGE: "请先生成或上传图片后再编辑。",
} as const;

const WARN = {
  REF_TRUNCATED: "仅使用前 4 张参考图。",
  TEXT_TRUNCATED: "仅使用前 3 段上游文本。",
  EDIT_IGNORED_UPSTREAM: "已连接上游参考图，编辑模式未生效，将按连线推断模式。",
} as const;

async function resolveIncomingRefs(
  projectPath: string | null | undefined,
  refs: IncomingImageRef[],
): Promise<{ resolved: ResolvedIncomingImageRef[]; resolveFailed: boolean }> {
  const resolved: ResolvedIncomingImageRef[] = [];
  let resolveFailed = false;

  for (const ref of refs) {
    const resolvedPath = await resolveAssetRelPath(projectPath, ref.path, ref.assetId);
    if (!resolvedPath) {
      resolveFailed = true;
      continue;
    }
    resolved.push({ ...ref, resolvedPath });
  }

  return { resolved, resolveFailed };
}

/**
 * 图片节点生成统一上下文（规格 §2.0）。生成前与面板状态刷新应共用此函数。
 */
export async function resolveImageGenerationContext(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
  projectPath: string | null | undefined,
): Promise<ImageGenerationContext> {
  const empty: ImageGenerationContext = {
    incomingImageRefs: [],
    resolvedRefs: [],
    aggregatedPrompt: "",
    task: null,
    referenceImagePaths: [],
    blockReason: null,
    warnMessage: null,
  };

  const target = nodes.find((n) => n.id === targetNodeId);
  if (!target || (target.type !== "imageNode" && target.type !== "imageAsset")) {
    return { ...empty, blockReason: BLOCK.NOT_IMAGE_NODE };
  }

  const scriptUpstreams = orderedIncomingScriptNodeIds(nodes, edges, targetNodeId);
  if (scriptUpstreams.length >= 2) {
    return { ...empty, blockReason: BLOCK.MULTI_SCRIPT };
  }

  const { items: rawPanelItems, imagesTruncated: refsTruncated } = collectIncomingImagePanelItems(
    nodes,
    edges,
    targetNodeId,
  );
  const orderedPanelItems = orderIncomingImagePanelRefs(
    rawPanelItems,
    readImageReferenceEdgeOrder(target.data.params),
  );
  const incomingImageRefs = imagePanelItemsToIncomingRefs(orderedPanelItems).slice(0, 4);

  const editIntent = getImageEditIntent(target.data);
  const { prompt: aggregatedPrompt, textTruncated } = aggregateImagePrompt(nodes, edges, targetNodeId);

  const warnParts: string[] = [];
  if (refsTruncated) warnParts.push(WARN.REF_TRUNCATED);
  if (textTruncated) warnParts.push(WARN.TEXT_TRUNCATED);

  if (editIntent.active) {
    const localPath = await resolveLocalNodeImagePath(projectPath, target);
    if (!localPath) {
      return {
        ...empty,
        incomingImageRefs,
        aggregatedPrompt,
        warnMessage: warnParts.length > 0 ? warnParts.join(" ") : null,
        blockReason: BLOCK.NO_LOCAL_IMAGE,
      };
    }
    if (incomingImageRefs.length === 0) {
      if (!aggregatedPrompt) {
        return {
          ...empty,
          incomingImageRefs,
          warnMessage: warnParts.length > 0 ? warnParts.join(" ") : null,
        };
      }
      const withSuffix = appendImageEditPromptSuffix(aggregatedPrompt, editIntent.subAction);
      return {
        incomingImageRefs,
        resolvedRefs: [],
        aggregatedPrompt: withSuffix,
        task: "image_edit",
        referenceImagePaths: [localPath],
        blockReason: null,
        warnMessage: warnParts.length > 0 ? warnParts.join(" ") : null,
      };
    }
    warnParts.push(WARN.EDIT_IGNORED_UPSTREAM);
  }

  const warnMessage = warnParts.length > 0 ? warnParts.join(" ") : null;

  const { resolved, resolveFailed } = await resolveIncomingRefs(projectPath, incomingImageRefs);
  const referenceImagePaths = resolved.map((r) => r.resolvedPath);
  const { task, referenceImagePaths: taskPaths } = detectImageTask(referenceImagePaths);

  if (!aggregatedPrompt) {
    if (incomingImageRefs.length === 0) {
      return {
        ...empty,
        incomingImageRefs,
        aggregatedPrompt,
        warnMessage,
      };
    }

    if (resolveFailed && referenceImagePaths.length === 0) {
      return {
        incomingImageRefs,
        resolvedRefs: resolved,
        aggregatedPrompt: "",
        task: null,
        referenceImagePaths: [],
        blockReason: BLOCK.RESOLVE_FAILED,
        warnMessage,
      };
    }

    return {
      incomingImageRefs,
      resolvedRefs: resolved,
      aggregatedPrompt: "",
      task: referenceImagePaths.length > 0 ? task : null,
      referenceImagePaths: taskPaths,
      blockReason: null,
      warnMessage,
    };
  }

  if (resolveFailed && referenceImagePaths.length === 0 && incomingImageRefs.length > 0) {
    return {
      incomingImageRefs,
      resolvedRefs: resolved,
      aggregatedPrompt,
      task: null,
      referenceImagePaths: [],
      blockReason: BLOCK.RESOLVE_FAILED,
      warnMessage,
    };
  }

  if (task !== "text_to_image" && referenceImagePaths.length === 0) {
    return {
      incomingImageRefs,
      resolvedRefs: resolved,
      aggregatedPrompt,
      task: null,
      referenceImagePaths: [],
      blockReason: BLOCK.NEED_REF,
      warnMessage,
    };
  }

  if (task === "multi_ref_fusion" && !IMAGE_MULTI_REF_API_READY) {
    return {
      incomingImageRefs,
      resolvedRefs: resolved,
      aggregatedPrompt,
      task,
      referenceImagePaths: taskPaths,
      blockReason: BLOCK.MULTI_REF_NOT_READY,
      warnMessage,
    };
  }

  return {
    incomingImageRefs,
    resolvedRefs: resolved,
    aggregatedPrompt,
    task,
    referenceImagePaths: taskPaths,
    blockReason: null,
    warnMessage,
  };
}
