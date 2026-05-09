import { isTauri } from "@tauri-apps/api/core";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type Node, type NodeProps } from "@xyflow/react";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";
import type { FlowNodeData } from "@/lib/types";
import { mediaAssetNodeSubtitle } from "@/lib/nodeUiStrings";
import { pickAudioPathsForImport } from "@/lib/tauriMediaPaths";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import { AudioTtsPanel } from "@/components/nodes/AudioTtsPanel";

function AudioTitleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18V5l12-3v13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 16a3 3 0 0 0 3 3h.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AudioMusicGlyph() {
  return (
    <div className="audioAssetMusicGlyph" aria-hidden>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 17V6.5l10-2.2V13"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 17.5a2.5 2.5 0 0 0 5 0v-1.5a2.5 2.5 0 0 0-5 0v1.5Z"
          fill="currentColor"
          fillOpacity="0.25"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M15 14.5a2.5 2.5 0 0 0 5 0v-1.5a2.5 2.5 0 0 0-5 0v1.5Z"
          fill="currentColor"
          fillOpacity="0.25"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
      <span className="nodeEmptyHint">点击上传或拖入音频</span>
    </div>
  );
}

function AudioPreviewShell({
  hasPath,
  path,
  assetId,
  expanded,
}: {
  hasPath: boolean;
  path: string | undefined;
  assetId: string | undefined;
  expanded: boolean;
}) {
  return (
    <div className={expanded ? "audioAssetPreviewShell audioAssetPreviewShell--expanded" : "audioAssetPreviewShell"}>
      {hasPath ? (
        <div className={`audioAssetPreviewMedia ${RF_NODE_INPUT_CLASS}`}>
          <NodeMediaPreview relPath={path} assetId={assetId} kind="audio" />
        </div>
      ) : (
        <AudioMusicGlyph />
      )}
    </div>
  );
}

export function AudioAssetNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);
  const nodeDragSuppressUi = useCanvasUiStore((s) => s.nodeDragSuppressUi);
  const audioTtsPanelNodeId = useCanvasUiStore((s) => s.audioTtsPanelNodeId);
  const { multiSelect } = useNodeExpandedChrome(selected);
  const stableExpanded = selected;

  const showTtsPanel = audioTtsPanelNodeId === id && !nodeDragSuppressUi && !multiSelect;
  const showUpload = (stableExpanded || showTtsPanel) && !nodeDragSuppressUi;

  const hasPath = Boolean(data.path?.trim() || data.assetId?.trim());
  const path = data.path;
  const assetId = data.assetId;

  const afterAudioImport = async () => {
    if (projectPath) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assets.list(projectPath) });
    }
  };

  const onPickFiles = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    const paths = list.map((f) => (f as File & { path?: string }).path).filter(Boolean) as string[];
    if (paths.length === 0) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    await assignImportedMediaToNode(id, paths);
    await afterAudioImport();
    if (fileRef.current) fileRef.current.value = "";
  };

  const onUploadClick = () => {
    void (async () => {
      if (isTauri()) {
        const paths = await pickAudioPathsForImport(false);
        if (paths?.length) {
          await assignImportedMediaToNode(id, paths);
          await afterAudioImport();
        }
      } else {
        fileRef.current?.click();
      }
    })();
  };

  const rootClass = ["audioAssetCard", stableExpanded || showTtsPanel ? "audioAssetCard--expanded" : ""]
    .filter(Boolean)
    .join(" ");

  const splitExpanded = Boolean(showTtsPanel);
  const audioHint = hasPath ? "可直接试听或在下方做 TTS 合成" : "上传本地音频，或在下方 TTS 生成后回填";

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="audio/mpeg,audio/wav,audio/flac,audio/mp4,.mp3,.wav,.flac,.m4a,.aac,.ogg"
      className="srOnly"
      aria-hidden
      tabIndex={-1}
      onChange={(e) => void onPickFiles(e.target.files)}
    />
  );

  return (
    <NodeFrame
      defaultTitle="音频"
      label={data.label}
      nodeId={id}
      selected={selected}
      tone="audio"
      icon={<AudioTitleIcon />}
      rootClassName={rootClass}
      subtitle={mediaAssetNodeSubtitle(hasPath, path, assetId)}
      expandedSplit={splitExpanded}
      upperBody={
        splitExpanded ? (
          <>
            {fileInput}
            {showUpload ? (
              <div className="audioAssetUploadBar">
                <button
                  type="button"
                  className="audioAssetUploadBtn"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onUploadClick}
                >
                  <span aria-hidden>↑</span> 上传
                </button>
              </div>
            ) : null}
            <AudioPreviewShell hasPath={hasPath} path={path} assetId={assetId} expanded={Boolean(showUpload)} />
            {showUpload ? <div className="audioAssetHint">{audioHint}</div> : null}
            {showUpload && hasPath ? (
              <div className="nodePath mono" style={{ marginTop: 8 }}>
                {path}
              </div>
            ) : null}
            <MagneticNodeAnchors nodeId={id} nodeType={type} />
          </>
        ) : undefined
      }
      floatingBottomOverlay={
        splitExpanded ? (
          <div className="nodeFloatingBottomPanel">
            <AudioTtsPanel nodeId={id} />
          </div>
        ) : undefined
      }
      lowerBody={undefined}
    >
      {!splitExpanded ? (
        <>
          {fileInput}
          {showUpload ? (
            <div className="audioAssetUploadBar">
              <button
                type="button"
                className="audioAssetUploadBtn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onUploadClick}
              >
                <span aria-hidden>↑</span> 上传
              </button>
            </div>
          ) : null}
          <AudioPreviewShell hasPath={hasPath} path={path} assetId={assetId} expanded={Boolean(showUpload)} />
          {showUpload ? <div className="audioAssetHint">{audioHint}</div> : null}
          {showTtsPanel ? <AudioTtsPanel nodeId={id} /> : null}
          {showUpload && hasPath ? (
            <div className="nodePath mono" style={{ marginTop: 8 }}>
              {path}
            </div>
          ) : null}
          <MagneticNodeAnchors nodeId={id} nodeType={type} />
        </>
      ) : null}
    </NodeFrame>
  );
}
