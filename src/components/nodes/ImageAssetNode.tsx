import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type Node, type NodeProps } from "@xyflow/react";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";
import type { FlowNodeData } from "@/lib/types";
import { mediaAssetNodeSubtitle } from "@/lib/nodeUiStrings";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { queryKeys } from "@/shared/queryKeys";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { ImageGenerationPanel } from "@/components/nodes/ImageGenerationPanel";
import { ImageGenerationPanelPortal } from "@/components/nodes/ImageGenerationPanelPortal";

function ImageTitleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M9 14l3-3 6 6v6H5v-4.5l4-4.5z"
        fill="currentColor"
        fillOpacity="0.35"
        stroke="none"
      />
      <circle cx="8.5" cy="9.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function ImageImageGlyph() {
  return (
    <div className="imageAssetImageGlyph" aria-hidden>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M9 14l3-3 6 6v6H5v-4.5l4-4.5z"
          fill="currentColor"
          fillOpacity="0.35"
          stroke="none"
        />
        <circle cx="8.5" cy="9.5" r="1.2" fill="currentColor" />
      </svg>
      <span className="nodeEmptyHint">点击上传或拖入图片</span>
    </div>
  );
}

function ImagePreviewShell({
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
    <div className={expanded ? "imageAssetPreviewShell imageAssetPreviewShell--expanded" : "imageAssetPreviewShell"}>
      {hasPath ? (
        <div className={`imageAssetPreviewMedia ${RF_NODE_INPUT_CLASS}`}>
          <NodeMediaPreview relPath={path} assetId={assetId} kind="image" />
        </div>
      ) : (
        <ImageImageGlyph />
      )}
    </div>
  );
}

export function ImageAssetNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const i2iFileRef = useRef<HTMLInputElement>(null);
  const previewAnchorRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);
  const addReferenceImageNodeLeftOf = useProjectStore((s) => s.addReferenceImageNodeLeftOf);
  const imageI2iTargetNodeId = useCanvasUiStore((s) => s.imageI2iTargetNodeId);
  const setImageI2iTargetNodeId = useCanvasUiStore((s) => s.setImageI2iTargetNodeId);
  const hasPath = Boolean(data.path?.trim() || data.assetId?.trim());
  const path = data.path;
  const assetId = data.assetId;
  // 有图：NodeFrame 分栏 + 底部浮层；无图且选中：与 MinimalImageNode 一致的 Portal
  const splitExpanded = hasPath;
  const showGenPortal = selected && !hasPath;

  const afterRefImport = useCallback(async () => {
    if (projectPath) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assets.list(projectPath) });
    }
  }, [projectPath, queryClient]);

  useEffect(() => {
    if (imageI2iTargetNodeId !== id) return;
    setImageI2iTargetNodeId(null);
    void (async () => {
      if (isTauri()) {
        const paths = await pickImagePathsForImport(true);
        if (paths?.length) {
          await addReferenceImageNodeLeftOf(id, paths);
          await afterRefImport();
        }
      } else {
        i2iFileRef.current?.click();
      }
    })();
  }, [addReferenceImageNodeLeftOf, afterRefImport, id, imageI2iTargetNodeId, setImageI2iTargetNodeId]);

  const onPickI2IFiles = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    const paths = list.map((f) => (f as File & { path?: string }).path).filter(Boolean) as string[];
    if (paths.length === 0) {
      if (i2iFileRef.current) i2iFileRef.current.value = "";
      return;
    }
    await addReferenceImageNodeLeftOf(id, paths);
    await afterRefImport();
    if (i2iFileRef.current) i2iFileRef.current.value = "";
  };

  const onPickFiles = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    const paths = list.map((f) => (f as File & { path?: string }).path).filter(Boolean) as string[];
    if (paths.length === 0) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    await assignImportedMediaToNode(id, paths);
    await afterRefImport();
    if (fileRef.current) fileRef.current.value = "";
  };

  const rootClass = ["imageAssetCard", splitExpanded ? "imageAssetCard--expanded imageAssetCard--v2" : ""]
    .filter(Boolean)
    .join(" ");

  const fileInputs = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
        className="srOnly"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onPickFiles(e.target.files)}
      />
      <input
        ref={i2iFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
        className="srOnly"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onPickI2IFiles(e.target.files)}
      />
    </>
  );

  return (
    <>
    <NodeFrame
      defaultTitle="图片"
      label={data.label}
      nodeId={id}
      selected={selected}
      tone="image"
      icon={<ImageTitleIcon />}
      rootClassName={rootClass}
      subtitle={splitExpanded ? undefined : mediaAssetNodeSubtitle(hasPath, path, assetId)}
      expandedSplit={splitExpanded}
      upperBody={
        splitExpanded ? (
          <>
            {fileInputs}
            <div ref={previewAnchorRef}>
              <ImagePreviewShell hasPath={hasPath} path={path} assetId={assetId} expanded />
            </div>
            <MagneticNodeAnchors nodeId={id} nodeType={type} />
          </>
        ) : undefined
      }
      floatingBottomOverlay={
        selected && hasPath ? (
          <div className="nodeFloatingBottomPanel">
            <ImageGenerationPanel nodeId={id} />
          </div>
        ) : (
          // 无图选中时用 Portal，与 MinimalImageNode 一致
          <div style={{ display: "none" }} aria-hidden />
        )
      }
      lowerBody={undefined}
    >
      {!splitExpanded ? (
        <>
          {fileInputs}
          <div ref={previewAnchorRef}>
            <ImagePreviewShell hasPath={hasPath} path={path} assetId={assetId} expanded={false} />
          </div>
          <MagneticNodeAnchors nodeId={id} nodeType={type} />
        </>
      ) : null}
    </NodeFrame>
    <ImageGenerationPanelPortal
      nodeId={id}
      anchorRef={previewAnchorRef}
      active={showGenPortal}
      layout="empty"
    />
    </>
  );
}
