import type { NodeTypes } from "@xyflow/react";
import { FFmpegNode } from "@/components/nodes/FFmpegNode";
import { MinimalImageNode } from "@/components/nodes/MinimalImageNode";
import { LLMNode } from "@/components/nodes/LLMNode";
import { MediaImportNode } from "@/components/nodes/MediaImportNode";
import { TextNode } from "@/components/nodes/TextNode";
import { MinimalScriptNode } from "@/components/nodes/MinimalScriptNode";
import { MinimalVideoNode } from "@/components/nodes/MinimalVideoNode";
import { MinimalAudioNode } from "@/components/nodes/MinimalAudioNode";
import { GroupNode } from "@/components/nodes/GroupNode";

export const nodeTypes = {
  llm: LLMNode,
  mediaImport: MediaImportNode,
  imageNode: MinimalImageNode,
  ffmpegConcat: FFmpegNode,
  textNode: TextNode,
  scriptNode: MinimalScriptNode,
  videoNode: MinimalVideoNode,
  audioNode: MinimalAudioNode,
  group: GroupNode,
} satisfies NodeTypes;
