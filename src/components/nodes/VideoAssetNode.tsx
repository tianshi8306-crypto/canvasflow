import { isTauri } from "@tauri-apps/api/core";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type Node, type NodeProps } from "@xyflow/react";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { TextNodeTextToVideoPanel } from "@/components/nodes/TextNodeWorkflowPanels";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { mediaAssetNodeSubtitle } from "@/lib/nodeUiStrings";
import { pickVideoPathsForImport } from "@/lib/tauriMediaPaths";
import type { FlowNodeData } from "@/lib/types";
import { defaultVideoGenerationDraft, defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";

function VideoTitleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11 9.5 15 12l-4 2.5V9.5Z" fill="currentColor" />
    </svg>
  );
}

function VideoPlayGlyph() {
  return (
    <div className="videoAssetPlayGlyph" aria-hidden>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <path
          d="M10 8.5v7l6-3.5-6-3.5Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function VideoPreviewShell({
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
    <div className={expanded ? "videoAssetPreviewShell videoAssetPreviewShell--expanded" : "videoAssetPreviewShell"}>
      {hasPath ? (
        <div className={`videoAssetPreviewMedia ${RF_NODE_INPUT_CLASS}`}>
          <NodeMediaPreview relPath={path} assetId={assetId} kind="video" />
        </div>
      ) : (
        <VideoPlayGlyph />
      )}
    </div>
  );
}

export function VideoAssetNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const splitExpanded = selected;
  const hasPath = Boolean(data.path?.trim() || data.assetId?.trim());
  const path = data.path;
  const assetId = data.assetId;

  const afterVideoImport = async () => {
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
    updateNodeData(id, {
      video: {
        ...defaultVideoNodePersisted(),
        ...data.video,
        source: "upload",
        draft: data.video?.draft ?? defaultVideoGenerationDraft(),
      },
    });
    await afterVideoImport();
    if (fileRef.current) fileRef.current.value = "";
  };

  const onUploadClick = () => {
    void (async () => {
      if (isTauri()) {
        const paths = await pickVideoPathsForImport(false);
        if (paths?.length) {
          await assignImportedMediaToNode(id, paths);
          updateNodeData(id, {
            video: {
              ...defaultVideoNodePersisted(),
              ...data.video,
              source: "upload",
              draft: data.video?.draft ?? defaultVideoGenerationDraft(),
            },
          });
          await afterVideoImport();
        }
      } else {
        fileRef.current?.click();
      }
    })();
  };

  const rootClass = ["videoAssetCard", splitExpanded ? "videoAssetCard--expanded" : ""].filter(Boolean).join(" ");

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm,.mkv,.avi"
      className="srOnly"
      aria-hidden
      tabIndex={-1}
      onChange={(e) => void onPickFiles(e.target.files)}
    />
  );

  return (
    <NodeFrame
      defaultTitle="视频"
      label={data.label}
      nodeId={id}
      selected={selected}
      tone="video"
      icon={<VideoTitleIcon />}
      rootClassName={rootClass}
      subtitle={mediaAssetNodeSubtitle(hasPath, path, assetId)}
      expandedSplit={splitExpanded}
      upperBody={
        splitExpanded ? (
          <>
            {fileInput}
            <div className="videoAssetUploadBar">
              <button
                type="button"
                className="videoAssetUploadBtn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onUploadClick}
              >
                <span aria-hidden>↑</span> 上传
              </button>
            </div>
            <VideoPreviewShell hasPath={hasPath} path={path} assetId={assetId} expanded />
            {hasPath ? (
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
            <TextNodeTextToVideoPanel videoNodeId={id} />
          </div>
        ) : undefined
      }
      lowerBody={undefined}
    >
      {!splitExpanded ? (
        <>
          {fileInput}
          <VideoPreviewShell hasPath={hasPath} path={path} assetId={assetId} expanded={false} />
          <MagneticNodeAnchors nodeId={id} nodeType={type} />
        </>
      ) : null}
    </NodeFrame>
  );
}
