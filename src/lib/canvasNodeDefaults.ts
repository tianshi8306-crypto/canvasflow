import { defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import type { FlowNodeData } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";

/**
 * 所有入口新建的节点统一使用此处初始 data，保证首次出现即为各类型空态（无示例文案、无占位素材路径）。
 */
export const newNodeDataByType = {
  textNode: (): FlowNodeData => ({
    label: useProjectStore.getState().nextTextNodeLabel(),
    prompt: "",
    params: {},
  }),
  imageNode: (): FlowNodeData => ({
    label: useProjectStore.getState().nextImageNodeLabel(),
    path: "",
    prompt: "",
    params: {},
  }),
  videoNode: (): FlowNodeData => ({
    label: useProjectStore.getState().nextVideoNodeLabel(),
    path: "",
    params: {},
    video: defaultVideoNodePersisted(),
  }),
  audioNode: (): FlowNodeData => ({
    label: useProjectStore.getState().nextAudioNodeLabel(),
    path: "",
    params: {},
    prompt: "",
  }),
  scriptNode: (): FlowNodeData => ({
    label: useProjectStore.getState().nextScriptNodeLabel(),
    prompt: "",
  }),
  ffmpegConcat: (): FlowNodeData => ({
    label: "剪辑",
    timelineClips: [],
    inputs: [],
    output: "assets/exports/final.mp4",
  }),
  llm: (): FlowNodeData => ({
    label: "LLM",
    prompt: "",
    params: {},
  }),
} as const;
