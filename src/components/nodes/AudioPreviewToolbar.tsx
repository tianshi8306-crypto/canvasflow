import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { pickAudioPathsForImport } from "@/lib/tauriMediaPaths";
import { useFocusLinkedPartnerNode } from "@/hooks/canvas/useFocusLinkedPartnerNode";
import {
  AUDIO_PASSIVE_REFERENCE_STATUS,
  findIncomingTextNodeId,
  findOutgoingVideoNodeId,
  isPassiveAudioAsset,
} from "@/lib/audioNodeContainerMode";
import { queryKeys } from "@/shared/queryKeys";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

export type AudioPreviewToolbarCallbacks = {
  onOpenAtp: () => void;
};

type Props = {
  nodeId: string;
  hasLocalAudio: boolean;
} & AudioPreviewToolbarCallbacks;

export function AudioPreviewToolbar({ nodeId, hasLocalAudio, onOpenAtp }: Props) {
  const queryClient = useQueryClient();
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const projectPath = useProjectStore((s) => s.projectPath);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const setAudioTtsPanelPinnedNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelPinnedNodeId);
  const { focusPartnerNode } = useFocusLinkedPartnerNode();

  const videoId = useMemo(
    () => findOutgoingVideoNodeId(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );
  const textId = useMemo(
    () => findIncomingTextNodeId(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );
  const passiveRef = useMemo(
    () => isPassiveAudioAsset(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const videoLabel = useMemo(() => {
    if (!videoId) return "";
    const n = nodes.find((x) => x.id === videoId);
    return (n?.data.label ?? "视频节点").toString();
  }, [nodes, videoId]);

  const textLabel = useMemo(() => {
    if (!textId) return "";
    const n = nodes.find((x) => x.id === textId);
    return (n?.data.label ?? "文本节点").toString();
  }, [nodes, textId]);

  const onReplace = useCallback(async () => {
    if (!isTauri()) return;
    const paths = await pickAudioPathsForImport(false);
    if (paths?.length) {
      await assignImportedMediaToNode(nodeId, paths);
      if (projectPath) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.assets.list(projectPath) });
      }
    }
  }, [assignImportedMediaToNode, nodeId, projectPath, queryClient]);

  const onFocusVideo = useCallback(() => {
    if (!videoId) return;
    void focusPartnerNode(videoId, { kind: "video", label: videoLabel || undefined });
  }, [focusPartnerNode, videoId, videoLabel]);

  const onFocusText = useCallback(() => {
    if (!textId) return;
    void focusPartnerNode(textId, { kind: "default", label: textLabel || undefined });
  }, [focusPartnerNode, textId, textLabel]);

  const onPinAtp = useCallback(() => {
    setAudioTtsPanelPinnedNodeId(nodeId);
    onOpenAtp();
    setStatusText("已钉住文字转语音面板");
  }, [nodeId, onOpenAtp, setAudioTtsPanelPinnedNodeId, setStatusText]);

  if (!hasLocalAudio) return null;

  return (
    <div
      className="imagePreviewToolbar audioPreviewToolbar"
      role="toolbar"
      aria-label="音频工具"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="audioPreviewToolbarScroll">
        {passiveRef ? (
          <span className="audioPreviewToolbar-hint" title={AUDIO_PASSIVE_REFERENCE_STATUS}>
            声音参考
          </span>
        ) : null}
        {videoId ? (
          <button
            type="button"
            className="tgp-partner-focusBtn audioPreviewToolbar-focusBtn"
            onClick={onFocusVideo}
          >
            定位视频节点
          </button>
        ) : null}
        {textId ? (
          <button
            type="button"
            className="tgp-partner-focusBtn audioPreviewToolbar-focusBtn"
            onClick={onFocusText}
          >
            定位文本节点
          </button>
        ) : null}
        <button
          type="button"
          className="mmChromeIconBtn audioPreviewToolbar-iconBtn"
          title="替换音频"
          onClick={() => void onReplace()}
        >
          替换
        </button>
        <button
          type="button"
          className="mmChromeIconBtn audioPreviewToolbar-iconBtn"
          title="打开文字转语音面板"
          onClick={onOpenAtp}
        >
          TTS
        </button>
        <button
          type="button"
          className="mmChromeIconBtn audioPreviewToolbar-iconBtn"
          title="钉住文字转语音面板"
          onClick={onPinAtp}
        >
          钉住
        </button>
      </div>
    </div>
  );
}
