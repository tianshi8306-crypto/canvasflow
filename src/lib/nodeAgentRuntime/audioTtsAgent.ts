import { invoke } from "@tauri-apps/api/core";
import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";

type AudioTtsAgentInput = {
  text: string;
  model: string;
  audioModelId: string | null;
  voice: string;
};

type AudioTtsSensed = {
  text: string;
  model: string;
  audioModelId: string | null;
  voice: string;
};

type AudioTtsExecuted = {
  rel: string;
};

/**
 * 音频节点单任务 Agent：调用 TTS 并回写 path。
 */
export const audioTtsAgentRuntime: NodeTaskAgentRuntime<
  AudioTtsAgentInput,
  AudioTtsSensed,
  AudioTtsExecuted,
  AudioTtsExecuted
> = {
  agentName: "TTS Agent",
  sense: (input) => {
    const text = input.text.trim();
    if (!text) {
      throw new Error("请输入要合成的文本");
    }
    return {
      text,
      model: input.model,
      audioModelId: input.audioModelId,
      voice: input.voice,
    };
  },
  execute: async (sensed, ctx) => {
    ctx.setStatusText("正在请求 TTS 合成…");
    const rel = await invoke<string>("generate_tts_asset", {
      projectPath: ctx.projectPath,
      text: sensed.text,
      audioModelId: sensed.audioModelId,
      model: sensed.model,
      voice: sensed.voice,
    });
    return { rel };
  },
  validate: ({ rel }) => {
    const out = rel.trim();
    if (!out) throw new Error("TTS 返回为空路径");
    return { rel: out };
  },
  commit: ({ rel }, ctx) => {
    ctx.updateNodeData(ctx.nodeId, { path: rel });
    ctx.setStatusText(`TTS 已生成：${rel}`);
  },
};

