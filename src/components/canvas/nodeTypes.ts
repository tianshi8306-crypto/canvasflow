import type { NodeTypes } from "@xyflow/react";
import { FFmpegNode } from "@/components/nodes/FFmpegNode";
import { MinimalImageNode } from "@/components/nodes/MinimalImageNode";
import { LLMNode } from "@/components/nodes/LLMNode";
import { MediaImportNode } from "@/components/nodes/MediaImportNode";
import { TextNode } from "@/components/nodes/TextNode";
import { ScriptNode } from "@/components/nodes/ScriptNode";
import { VideoAssetNode } from "@/components/nodes/VideoAssetNode";
import { AudioAssetNode } from "@/components/nodes/AudioAssetNode";
import { GroupNode } from "@/components/nodes/GroupNode";

export const nodeTypes = {
  llm: LLMNode,
  mediaImport: MediaImportNode,
  imageNode: MinimalImageNode,
  ffmpegConcat: FFmpegNode,
  textNode: TextNode,
  scriptNode: ScriptNode,
  videoNode: VideoAssetNode,
  audioNode: AudioAssetNode,
  group: GroupNode,
} satisfies NodeTypes;
