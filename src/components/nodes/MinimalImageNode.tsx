/**
 * 极简图片节点 - 预览区随画布缩放；顶栏/生成面板 Portal 固定尺寸
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlowNodeData } from "@/lib/types";
import {
  computeImageNodeFrameSize,
  resolveImageNodeFrameRatio,
} from "@/lib/imageGeneration/imageAspectSize";
import { readImageOutputParams } from "@/lib/imageGeneration/imageOutputParams";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { NodeChromeShell, NodeMetaLabel, NodeMetaStatus } from "@/components/nodes/nodeChrome";
import { NodeAnchors } from "./anchors";
import { ImageGenerationPanelPortal } from "./ImageGenerationPanelPortal";
import { ImageNodeEmptyUpload } from "./ImageNodeEmptyUpload";
import { ImagePreviewToolbarPortal } from "./ImagePreviewToolbarPortal";
import "./MinimalImageNode.css";

interface MinimalImageNodeProps {
  id: string;
  data: FlowNodeData;
  selected: boolean;
}

export function MinimalImageNode({ id, data, selected = false }: MinimalImageNodeProps) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const { expandedChrome } = useNodeExpandedChrome(selected);

  const hasPath = Boolean(data.path?.trim() || data.assetId?.trim());
  const mediaPath = data.path;
  const mediaAssetId = data.assetId;

  const expandedGenPanelId = useCanvasUiStore((s) => s.imageGenPanelExpandedNodeId);
  const pinnedGenPanelId = useCanvasUiStore((s) => s.imageGenPanelPinnedNodeId);
  const setPinnedGenPanelId = useCanvasUiStore((s) => s.setImageGenPanelPinnedNodeId);

  const [genPanelPinned, setGenPanelPinned] = useState(false);
  const dockedBelow = genPanelPinned || pinnedGenPanelId === id;
  const showGenPanel =
    expandedChrome && (!hasPath || dockedBelow) && expandedGenPanelId !== id;
  const showPreviewToolbar = expandedChrome && hasPath;
  const showEmptyUpload = expandedChrome && !hasPath;

  useEffect(() => {
    if (!selected) {
      setGenPanelPinned(false);
      if (pinnedGenPanelId === id) setPinnedGenPanelId(null);
    }
  }, [id, pinnedGenPanelId, selected, setPinnedGenPanelId]);

  const openGenPanel = useCallback(() => setGenPanelPinned(true), []);

  const label = data.label ?? "";
  const commitLabel = useCallback(
    (next: string | undefined) => updateNodeData(id, { label: next }),
    [id, updateNodeData],
  );

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previewToolbarRef = useRef<HTMLDivElement>(null);

  const handleImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setImgSize({ w, h });
      if (w > 0 && h > 0) {
        updateNodeData(id, { imageWidth: w, imageHeight: h });
      }
    },
    [id, updateNodeData],
  );

  const outputParams = useMemo(() => readImageOutputParams(data.params), [data.params]);

  const frameRatio = useMemo(
    () =>
      resolveImageNodeFrameRatio({
        aspectId: outputParams.aspect,
        imageWidth: imgSize?.w ?? data.imageWidth,
        imageHeight: imgSize?.h ?? data.imageHeight,
      }),
    [data.imageHeight, data.imageWidth, imgSize, outputParams.aspect],
  );

  const frameSize = useMemo(
    () => computeImageNodeFrameSize(frameRatio),
    [frameRatio],
  );

  useEffect(() => {
    setImgSize(null);
  }, [mediaPath, mediaAssetId]);

  useEffect(() => {
    if (!selected) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inPanel = panelRef.current?.contains(target);
      const inToolbar = previewToolbarRef.current?.contains(target);
      if (!inPanel && !inToolbar) {
        document.getSelection()?.removeAllRanges();
        (document.activeElement as HTMLElement)?.blur?.();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.getSelection()?.removeAllRanges();
        (document.activeElement as HTMLElement)?.blur?.();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const t = e.target;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        deleteSelection();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selected, deleteSelection]);

  const nodeStatus = data.status;
  const isGenerating =
    nodeStatus?.status === "running" &&
    typeof nodeStatus.progress === "number" &&
    Number.isFinite(nodeStatus.progress);
  const genProgress = isGenerating ? Math.round(nodeStatus.progress!) : null;
  const dimW = imgSize?.w ?? data.imageWidth;
  const dimH = imgSize?.h ?? data.imageHeight;
  const showDims = Boolean(dimW && dimH && dimW > 0 && dimH > 0);
  const dimsText = showDims ? `${dimW}\u00d7${dimH}` : null;

  return (
    <>
      <NodeMetaLabel label={label} defaultLabel="图片" onCommit={commitLabel} />

      <NodeMetaStatus dimsText={dimsText} generating={isGenerating} progress={genProgress} />

      {showEmptyUpload ? <ImageNodeEmptyUpload nodeId={id} /> : null}

      <NodeChromeShell
        selected={selected}
        width={frameSize.width}
        height={frameSize.height}
        previewRef={previewRef}
        afterPreview={<NodeAnchors nodeId={id} nodeType="imageNode" variant="simple" />}
      >
        {hasPath ? (
          <NodeMediaPreview
            relPath={mediaPath}
            assetId={mediaAssetId}
            kind="image"
            imageClassName="minimal-image-content"
            onImageLoad={handleImgLoad}
          />
        ) : (
          <div className="nodeChrome-placeholder minimal-image-placeholder">
            <svg viewBox="0 0 24 24" fill="#616161" aria-hidden>
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
          </div>
        )}
      </NodeChromeShell>

      <ImagePreviewToolbarPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showPreviewToolbar}
        hasLocalImage={hasPath}
        onOpenGenPanel={openGenPanel}
        toolbarRef={previewToolbarRef}
      />

      <ImageGenerationPanelPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showGenPanel}
        layout={hasPath ? "default" : "empty"}
        panelRef={panelRef}
      />
    </>
  );
}
