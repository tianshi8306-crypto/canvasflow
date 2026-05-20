import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  downloadProjectVideoWithDialog,
  VIDEO_PREVIEW_TOOLBAR_PRIMARY,
  VIDEO_PREVIEW_TOOLBAR_UTILITY,
  type VideoPreviewToolbarItem,
  type VideoPreviewToolbarMenuOption,
} from "@/lib/videoPreviewToolbarActions";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  nodeId: string;
};

function ToolbarChevron() {
  return (
    <svg className="videoPreviewToolbar-chevron" viewBox="0 0 12 12" aria-hidden>
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconClip() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M4.2 11.8 2.4 10l6.4-6.4 1.8 1.8-6.4 6.4Zm7.2-7.2 1.8 1.8-1.4 1.4-1.8-1.8 1.4-1.4ZM5.6 5.6l4.8 4.8-1.4 1.4L4.2 7 5.6 5.6Z"
      />
    </svg>
  );
}

function IconHd() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <rect
        x="2"
        y="3"
        width="12"
        height="10"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <text x="8" y="10.5" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="currentColor">
        HD
      </text>
    </svg>
  );
}

function IconParse() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <rect
        x="2.5"
        y="3.5"
        width="11"
        height="9"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path d="M8 3.5v9" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function IconSubtitle() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M3 4h10v1.2H3V4Zm0 3.4h7v1.2H3V7.4Zm8.2 4.2-.9 1.6 1.4.8 1.6-2.8-2.1-1.2Z"
      />
      <path fill="currentColor" d="M11.5 3.2 10 5.8l1.2.7 1.5-2.6-1.2-.7Z" opacity="0.9" />
    </svg>
  );
}

function IconAudioSplit() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 1.5"
      />
      <path
        fill="currentColor"
        d="M8 4.5c-.8 0-1.5.7-1.5 1.5v2.5l1.5.9 1.5-.9V6c0-.8-.7-1.5-1.5-1.5Zm0 6.8a2.2 2.2 0 0 0 2.2-2.2H10a1.2 1.2 0 1 1-2.4 0H5.8a2.2 2.2 0 0 0 2.2 2.2Z"
      />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        d="M8 3v7m0 0 2.5-2.5M8 10 5.5 7.5M4 12.5h8"
      />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        d="M9.5 3.5 12.5 3.5 12.5 6.5M6.5 12.5 3.5 12.5 3.5 9.5M12.5 6.5 12.5 3.5 9.5 3.5M3.5 9.5 3.5 12.5 6.5 12.5"
      />
    </svg>
  );
}

const PRIMARY_ICONS: Record<string, () => JSX.Element> = {
  clip: IconClip,
  hd: IconHd,
  parse: IconParse,
  subtitle: IconSubtitle,
  audioSplit: IconAudioSplit,
};

export function VideoPreviewToolbar({ nodeId }: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const setVideoGenPanelExpandedNodeId = useCanvasUiStore((s) => s.setVideoGenPanelExpandedNodeId);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const mediaPath = useMemo(
    () => nodes.find((n) => n.id === nodeId)?.data.path?.trim(),
    [nodes, nodeId],
  );

  useEffect(() => {
    if (!openMenuId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !toolbarRef.current?.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [openMenuId]);

  const extractVideoAudioLeftOfNode = useProjectStore((s) => s.extractVideoAudioLeftOfNode);
  const openVideoClipConcat = useProjectStore((s) => s.openVideoClipConcat);
  const openVideoToolbarWorkflow = useProjectStore((s) => s.openVideoToolbarWorkflow);
  const enterVideoTrimMode = useProjectStore((s) => s.enterVideoTrimMode);
  const enterVideoSubtitleRegionMode = useProjectStore((s) => s.enterVideoSubtitleRegionMode);
  const setVideoGenPanelPinnedNodeId = useCanvasUiStore((s) => s.setVideoGenPanelPinnedNodeId);
  const setVideoTrimEditingNodeId = useCanvasUiStore((s) => s.setVideoTrimEditingNodeId);
  const setVideoSubtitleRegionEditingNodeId = useCanvasUiStore(
    (s) => s.setVideoSubtitleRegionEditingNodeId,
  );

  const runMenuOption = useCallback(
    (opt: VideoPreviewToolbarMenuOption) => {
      setOpenMenuId(null);
      if (opt.mode === "vocal" || opt.mode === "bgm") {
        void extractVideoAudioLeftOfNode(nodeId, opt.mode);
        return;
      }
      if (opt.mode === "trim") {
        enterVideoTrimMode(nodeId);
        setVideoTrimEditingNodeId(nodeId);
        setVideoSubtitleRegionEditingNodeId(null);
        return;
      }
      if (opt.mode === "concat") {
        openVideoClipConcat(nodeId);
        return;
      }
      if (opt.mode === "subtitle-auto") {
        openVideoToolbarWorkflow(nodeId, "subtitle-auto");
        setVideoGenPanelPinnedNodeId(nodeId);
        return;
      }
      if (opt.mode === "subtitle-region") {
        enterVideoSubtitleRegionMode(nodeId);
        setVideoSubtitleRegionEditingNodeId(nodeId);
        setVideoTrimEditingNodeId(null);
        return;
      }
      setStatusText(opt.stubMessage ?? "即将支持");
    },
    [
      enterVideoSubtitleRegionMode,
      enterVideoTrimMode,
      extractVideoAudioLeftOfNode,
      nodeId,
      openVideoClipConcat,
      openVideoToolbarWorkflow,
      setStatusText,
      setVideoGenPanelPinnedNodeId,
      setVideoSubtitleRegionEditingNodeId,
      setVideoTrimEditingNodeId,
    ],
  );

  const runItem = useCallback(
    (item: VideoPreviewToolbarItem) => {
      if (item.kind === "workflow") {
        if (item.id === "parse" || item.id === "hd") {
          openVideoToolbarWorkflow(nodeId, item.id);
          setVideoGenPanelPinnedNodeId(nodeId);
          return;
        }
      }
      if (item.kind === "stub") {
        setStatusText(item.stubMessage ?? "即将支持");
        return;
      }
      if (item.kind === "menu") {
        setOpenMenuId((id) => (id === item.id ? null : item.id));
        return;
      }
      if (item.id === "download") {
        if (!isTauri() || !projectPath?.trim() || !mediaPath) {
          setStatusText("请先打开工程并确保节点已有视频");
          return;
        }
        const fileName = mediaPath.split(/[/\\]/).pop() ?? "video.mp4";
        void downloadProjectVideoWithDialog(projectPath, mediaPath, fileName)
          .then((ok) => setStatusText(ok ? `已下载：${fileName}` : "已取消下载"))
          .catch(() => setStatusText("下载失败"));
        return;
      }
      if (item.id === "maximize") {
        setVideoGenPanelExpandedNodeId(nodeId);
      }
    },
    [
      mediaPath,
      nodeId,
      openVideoClipConcat,
      openVideoToolbarWorkflow,
      projectPath,
      setStatusText,
      setVideoGenPanelExpandedNodeId,
      setVideoGenPanelPinnedNodeId,
    ],
  );

  return (
    <div
      ref={toolbarRef}
      className="videoPreviewToolbar"
      role="toolbar"
      aria-label="视频预览工具"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="videoPreviewToolbar-main">
        {VIDEO_PREVIEW_TOOLBAR_PRIMARY.map((item) => {
          const Icon = PRIMARY_ICONS[item.id];
          const isMenu = item.kind === "menu" && item.menuOptions?.length;
          return (
            <div key={item.id} className="videoPreviewToolbar-itemWrap">
              <button
                type="button"
                className={`videoPreviewToolbar-item${isMenu ? " videoPreviewToolbar-item--menu" : ""}${openMenuId === item.id ? " is-open" : ""}`}
                title={item.label}
                aria-expanded={isMenu ? openMenuId === item.id : undefined}
                onClick={() => runItem(item)}
              >
                {Icon ? (
                  <span className="videoPreviewToolbar-icon" aria-hidden>
                    <Icon />
                  </span>
                ) : null}
                <span className="videoPreviewToolbar-label">{item.label}</span>
                {isMenu ? <ToolbarChevron /> : null}
              </button>
              {isMenu && openMenuId === item.id ? (
                <div className="videoPreviewToolbar-menuDrop" role="menu">
                  {item.menuOptions!.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="videoPreviewToolbar-menuItem"
                      role="menuitem"
                      onClick={() => runMenuOption(opt)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="videoPreviewToolbar-divider" aria-hidden />
      <div className="videoPreviewToolbar-utils">
        {VIDEO_PREVIEW_TOOLBAR_UTILITY.map((item) => (
          <button
            key={item.id}
            type="button"
            className="videoPreviewToolbar-iconBtn"
            title={item.label}
            aria-label={item.label}
            onClick={() => runItem(item)}
          >
            {item.id === "download" ? <IconDownload /> : <IconExpand />}
          </button>
        ))}
      </div>
    </div>
  );
}
