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
import {
  getImageGenerationProgressPercent,
  isImageGenerationInProgress,
} from "@/lib/imageGeneration/imageGenerationProgressDisplay";
import { useImageI2iAnchorImport } from "@/hooks/canvas/useImageI2iAnchorImport";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import {
  NodeChromeProvider,
  NodeChromeShell,
  NodeMetaLabel,
  NodeMetaStatus,
  NodePanelPlaceholder,
} from "@/components/nodes/nodeChrome";
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
  const { i2iFileInput } = useImageI2iAnchorImport(id);

  const hasPath = Boolean(data.path?.trim() || data.assetId?.trim());
  const mediaPath = data.path;
  const mediaAssetId = data.assetId;

  const expandedGenPanelId = useCanvasUiStore((s) => s.imageGenPanelExpandedNodeId);

  /** 与视频节点一致：选中即显示底栏参数面板（出图后仍可二次生成/编辑） */
  const showGenPanel = expandedChrome && expandedGenPanelId !== id;
  const showPreviewToolbar = expandedChrome && hasPath;
  const showEmptyUpload = expandedChrome && !hasPath;

  const label = data.label ?? "";
  const commitLabel = useCallback(
    (next: string | undefined) => updateNodeData(id, { label: next }),
    [id, updateNodeData],
  );

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [previewOverlayEl, setPreviewOverlayEl] = useState<HTMLDivElement | null>(null);
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
      const target = e.target;
      if (!(target instanceof Element)) return;
      const inPanel = panelRef.current?.contains(target);
      const inToolbar = previewToolbarRef.current?.contains(target);
      const inExpandedGenPanel =
        expandedGenPanelId === id && Boolean(target.closest(".igp-expanded-overlay"));
      if (!inPanel && !inToolbar && !inExpandedGenPanel) {
        document.getSelection()?.removeAllRanges();
        (document.activeElement as HTMLElement)?.blur?.();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      const inExpandedGenPanel =
        expandedGenPanelId === id &&
        (target instanceof Element
          ? Boolean(target.closest(".igp-expanded-overlay"))
          : false);
      if (inExpandedGenPanel) return;
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
  }, [selected, deleteSelection, expandedGenPanelId, id]);

  const nodeStatus = data.status;
  const genProgressInput = {
    status: nodeStatus?.status,
    progress: nodeStatus?.progress,
  };
  const isGenerating = isImageGenerationInProgress(genProgressInput);
  const genProgress = isGenerating
    ? (getImageGenerationProgressPercent(genProgressInput) ?? null)
    : null;
  const dimW = imgSize?.w ?? data.imageWidth;
  const dimH = imgSize?.h ?? data.imageHeight;
  const showDims = Boolean(dimW && dimH && dimW > 0 && dimH > 0);
  const dimsText = showDims ? `${dimW}\u00d7${dimH}` : null;

  return (
    <NodeChromeProvider>
      {i2iFileInput}
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
            <NodePanelPlaceholder kind="imageNode" />
          </div>
        )}
        <div className="nodeChrome-previewGenOverlay" ref={setPreviewOverlayEl} />
      </NodeChromeShell>

      <ImagePreviewToolbarPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showPreviewToolbar}
        hasLocalImage={hasPath}
        toolbarRef={previewToolbarRef}
      />

      <ImageGenerationPanelPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showGenPanel}
        panelRef={panelRef}
        previewOverlayEl={previewOverlayEl}
      />
    </NodeChromeProvider>
  );
}
