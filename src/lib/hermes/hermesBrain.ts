import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { serializeCanvasGraphForHermes } from "@/lib/hermes/hermesGraph";
import type { HermesMessageMode } from "@/lib/hermes/hermesMessageIntent";
import {
  inferHermesReplyStyle,
  type HermesReplyStyle,
} from "@/lib/hermes/hermesReplyStyle";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

export type HermesStreamHandlers = {
  onToken: (token: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: string) => void;
};

export async function streamHermesChat(opts: {
  requestId: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  focusNodeId: string | null;
  userMessage: string;
  situationSummary?: string;
  chatHistory: Array<{ role: string; content: string }>;
  providerId: string;
  model: string;
  /** 顾问模式：电影/泛知识咨询，专用 system prompt */
  advisorMode?: boolean;
  messageMode?: HermesMessageMode;
  /** 不传则由灵体根据 userMessage 推断 */
  replyStyle?: HermesReplyStyle;
  handlers: HermesStreamHandlers;
}): Promise<string> {
  const { requestId, handlers } = opts;
  const unlisteners: UnlistenFn[] = [];

  const matchRequest = (payload: { requestId?: string }) =>
    payload.requestId === requestId;

  unlisteners.push(
    await listen<{ requestId: string; token: string }>("hermes-chat-chunk", (ev) => {
      if (!matchRequest(ev.payload)) return;
      if (ev.payload.token) handlers.onToken(ev.payload.token);
    }),
  );
  unlisteners.push(
    await listen<{ requestId: string; fullContent: string }>("hermes-chat-done", (ev) => {
      if (!matchRequest(ev.payload)) return;
      handlers.onDone(ev.payload.fullContent ?? "");
    }),
  );
  unlisteners.push(
    await listen<{ requestId: string; error: string }>("hermes-chat-error", (ev) => {
      if (!matchRequest(ev.payload)) return;
      handlers.onError(ev.payload.error ?? "未知错误");
    }),
  );

  try {
    const graphJson = serializeCanvasGraphForHermes(opts.nodes, opts.edges);
    const replyStyle =
      opts.replyStyle ??
      inferHermesReplyStyle({
        userMessage: opts.userMessage,
        messageMode: opts.messageMode,
        advisorMode: opts.advisorMode,
      });
    return await invoke<string>("hermes_chat_stream", {
      requestId,
      graphJson,
      focusNodeId: opts.focusNodeId,
      userMessage: opts.userMessage,
      situationSummary: opts.situationSummary?.trim() ?? "",
      chatHistory: opts.chatHistory,
      providerId: opts.providerId,
      model: opts.model,
      advisorMode: opts.advisorMode ?? false,
      replyStyle,
      messageMode: opts.messageMode ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    handlers.onError(msg);
    throw err;
  } finally {
    for (const u of unlisteners) u();
  }
}

export async function enhanceNodePrompt(opts: {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  nodeId: string;
  currentPrompt: string;
  providerId: string;
  model: string;
}): Promise<string> {
  const graphJson = serializeCanvasGraphForHermes(opts.nodes, opts.edges);
  return invoke<string>("hermes_enhance", {
    graphJson,
    nodeId: opts.nodeId,
    currentPrompt: opts.currentPrompt,
    providerId: opts.providerId,
    model: opts.model,
  });
}
