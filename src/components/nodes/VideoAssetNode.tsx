import { isTauri } from "@tauri-apps/api/core";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type Node, type NodeProps } from "@xyflow/react";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { VideoMultimodalInputPanel } from "@/components/nodes/VideoMultimodalInputPanel";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { mediaAssetNodeSubtitle } from "@/lib/nodeUiStrings";
import { pickVideoPathsForImport } from "@/lib/tauriMediaPaths";
import type { FlowNodeData } from "@/lib/types";
import { defaultVideoGenerationDraft, defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useVideoIncomingReferenceItems } from "@/hooks/useVideoIncomingReferenceItems";

// ═══════════════════════════════════════════════════════════════
// 子组件：图标
// ═══════════════════════════════════════════════════════════════

function VideoTitleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11 9.5 15 12l-4 2.5V9.5Z" fill="currentColor" />
    </svg>
  );
}

function IconCut() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 6v4M6 18h4M9 12l-3 6h12l-3-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconQuality() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconParse() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 14l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconVoice() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3M8 22h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSeparate() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="8" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="4" width="8" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
      <span className="nodeEmptyHint">点击上传或拖入视频</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 子组件：工具栏
// ═══════════════════════════════════════════════════════════════

interface NodeToolbarAction {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface VideoNodeToolbarProps {
  hasVideo: boolean;
  onCut?: () => void;
  onQuality?: () => void;
  onParse?: () => void;
  onVoiceSeparate?: () => void;
  onSeparateAv?: () => void;
  onDownload?: () => void;
  onExpand?: () => void;
}

function VideoNodeToolbar({
  hasVideo,
  onCut,
  onQuality,
  onParse,
  onVoiceSeparate,
  onSeparateAv,
  onDownload,
  onExpand,
}: VideoNodeToolbarProps) {
  const actions: NodeToolbarAction[] = [
    { icon: <IconCut />, label: "剪辑", onClick: onCut },
    { icon: <IconQuality />, label: "高清", onClick: onQuality },
    { icon: <IconParse />, label: "解析", onClick: onParse },
    { icon: <IconVoice />, label: "人声分离", onClick: onVoiceSeparate },
    { icon: <IconSeparate />, label: "分离音视频", onClick: onSeparateAv },
    { icon: <IconDownload />, label: "下载", onClick: onDownload, disabled: !hasVideo },
    { icon: <IconExpand />, label: "全屏", onClick: onExpand, disabled: !hasVideo },
  ];

  return (
    <div className="videoNodeToolbar">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className={`videoNodeToolbarBtn${action.disabled ? " videoNodeToolbarBtn--disabled" : ""}`}
          disabled={action.disabled}
          onClick={action.onClick}
          title={action.label}
          aria-label={action.label}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {action.icon}
          <span className="videoNodeToolbarLabel">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 子组件：预览区 + 缩略图条
// ═══════════════════════════════════════════════════════════════

function VideoPreviewShell({
  hasPath,
  path,
  assetId,
  expanded,
  incomingThumbs,
  onUploadClick,
}: {
  hasPath: boolean;
  path: string | undefined;
  assetId: string | undefined;
  expanded: boolean;
  incomingThumbs: Array<{ path?: string; assetId?: string; kind: "image" | "video" | "audio" }>;
  onUploadClick?: () => void;
}) {
  const thumbCount = incomingThumbs.length;

  return (
    <div className={expanded ? "videoAssetPreviewShell videoAssetPreviewShell--expanded" : "videoAssetPreviewShell"}>
      {hasPath ? (
        <>
          <div className={`videoAssetPreviewMedia ${RF_NODE_INPUT_CLASS}`}>
            <NodeMediaPreview relPath={path} assetId={assetId} kind="video" />
          </div>
          {thumbCount > 0 && (
            <div className="videoAssetThumbStrip">
              {incomingThumbs.slice(0, 4).map((item, idx) => (
                <div key={item.assetId ?? item.path ?? idx} className="videoAssetThumbStripItem">
                  {item.kind === "image" ? (
                    <NodeMediaPreview relPath={item.path} assetId={item.assetId} kind="image" />
                  ) : item.kind === "video" ? (
                    <NodeMediaPreview relPath={item.path} assetId={item.assetId} kind="video" />
                  ) : null}
                  <div className="videoAssetThumbStripNum">{idx + 1}</div>
                </div>
              ))}
              {thumbCount > 4 && (
                <div className="videoAssetThumbStripMore">+{thumbCount - 4}</div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="videoAssetEmptyPreview" onClick={onUploadClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onUploadClick?.(); }}>
          <VideoPlayGlyph />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════

export function VideoAssetNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setMaximizedNodeId = useCanvasUiStore((s) => s.setMaximizedNodeId);

  const splitExpanded = selected;
  const hasPath = Boolean(data.path?.trim() || data.assetId?.trim());
  const path = data.path;
  const assetId = data.assetId;

  const incomingRefItems = useVideoIncomingReferenceItems(id);
  const imageThumbs = incomingRefItems.filter((item) => item.kind === "image").slice(0, 4);
  const thumbCount = imageThumbs.length;

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
      floatingTopOverlay={undefined}
      upperBody={
        splitExpanded ? (
          <>
            {fileInput}
            <VideoNodeToolbar
              hasVideo={hasPath}
              onExpand={() => setMaximizedNodeId(id)}
              onDownload={() => {
                if (path) {
                  const a = document.createElement("a");
                  a.href = path;
                  a.download = path.split("/").pop() ?? "video.mp4";
                  a.click();
                }
              }}
            />
            <VideoPreviewShell
              hasPath={hasPath}
              path={path}
              assetId={assetId}
              expanded
              incomingThumbs={imageThumbs}
              onUploadClick={onUploadClick}
            />
            {hasPath ? (
              <div className="videoAssetPathRow">
                <span className="mono videoAssetPath" style={{ fontSize: 10, color: "#64748b" }}>
                  {path}
                </span>
                <button
                  type="button"
                  className="videoAssetUploadBtnSm"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onUploadClick}
                >
                  替换
                </button>
              </div>
            ) : (
              <div className="videoAssetUploadHint">
                <button
                  type="button"
                  className="videoAssetUploadBtn"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onUploadClick}
                >
                  <span aria-hidden>↑</span> 上传视频
                </button>
              </div>
            )}
            {thumbCount > 0 && (
              <div className="videoAssetRefInfo">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M9 14l3-3 6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>图片引用: <strong>×{thumbCount}</strong></span>
              </div>
            )}
            <MagneticNodeAnchors nodeId={id} nodeType={type} />
          </>
        ) : undefined
      }
      floatingBottomOverlay={
        splitExpanded ? (
          <div className="nodeFloatingBottomPanel">
            <VideoMultimodalInputPanel videoNodeId={id} />
          </div>
        ) : undefined
      }
      lowerBody={undefined}
    >
      {!splitExpanded ? (
        <>
          {fileInput}
          <VideoPreviewShell hasPath={hasPath} path={path} assetId={assetId} expanded={false} incomingThumbs={[]} />
          <MagneticNodeAnchors nodeId={id} nodeType={type} />
        </>
      ) : null}
    </NodeFrame>
  );
}
