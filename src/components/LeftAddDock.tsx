import { useCallback, type ReactNode } from "react";
import type { Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import type { FlowNodeData } from "@/lib/types";
import { CanvasProjectPanel } from "./CanvasProjectPanel";

function makeNode(type: string, data: FlowNodeData): Node<FlowNodeData> {
  return {
    id: crypto.randomUUID(),
    position: { x: 140 + Math.random() * 40, y: 140 + Math.random() * 40 },
    type,
    data,
  };
}

type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  projectPath: string | null;
  onRequestUploadFiles: () => void | Promise<void>;
  onOpenGallery: () => void;
};

function IconLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconText() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m8 14 3-3 4 5 3-4 4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}
function IconVideo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9.5v5l4-2.5-4-2.5z" fill="currentColor" />
    </svg>
  );
}
function IconAudio() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v16M8 8v8M16 8v8M4 10v4M20 10v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconScript() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function IconCut() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v12M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconGallery() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 18h12l-3-5-2 3-2-2-3 4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function DockRow({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="leftAddDockRow" disabled={disabled} onClick={onClick}>
      <span className="leftAddDockRowIcon">{icon}</span>
      <span className="leftAddDockRowLabel">{label}</span>
    </button>
  );
}

/** 画布左侧：折叠栏 + 展开「添加」面板（文案不含「节点」） */
export function LeftAddDock({ open, onOpen, onClose, projectPath, onRequestUploadFiles, onOpenGallery }: Props) {
  const addNode = useProjectStore((s) => s.addNode);
  const { getViewport } = useReactFlow();
  const projectPanelOpen = useCanvasUiStore((s) => s.projectPanelOpen);
  const setProjectPanelOpen = useCanvasUiStore((s) => s.setProjectPanelOpen);

  const addAtCenter = useCallback(() => {
    const vp = getViewport();
    const cx = (window.innerWidth / 2) / vp.zoom;
    const cy = (window.innerHeight * 0.65) / vp.zoom;
    return { x: vp.x + cx, y: vp.y + cy };
  }, [getViewport]);

  const doAdd = useCallback(
    (factory: () => Node<FlowNodeData>) => {
      const n = factory();
      n.position = addAtCenter();
      addNode(n);
      onClose();
    },
    [addAtCenter, addNode, onClose],
  );

  return (
    <div className={`leftAddDock${open ? " leftAddDock--open" : ""}`}>
      <div className="leftAddDockRail" role="toolbar" aria-label="画布工具">
        {/* Logo 按钮 */}
        <button
          type="button"
          className="leftAddDockFab leftAddDockLogoBtn"
          onClick={() => setProjectPanelOpen(!projectPanelOpen)}
          title="画布项目"
        >
          <IconLogo />
        </button>

        <button
          type="button"
          className={open ? "leftAddDockFab leftAddDockFab--close" : "leftAddDockFab"}
          onClick={open ? onClose : onOpen}
          title={open ? "收起" : "添加"}
          aria-expanded={open}
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="leftAddDockFab"
          onClick={() => window.dispatchEvent(new CustomEvent("r3-open-settings"))}
          title="设置"
        >
          <IconSettings />
        </button>
      </div>

      {open ? (
        <div className="leftAddDockPanel" role="dialog" aria-label="添加">
          <div className="leftAddDockPanelHead">
            <span className="leftAddDockPanelTitle">添加</span>
            <p className="leftAddDockPanelHint">基础创作与资源</p>
          </div>

          <div className="leftAddDockSectionLabel">创作</div>
          <div className="leftAddDockRows">
            <DockRow
              icon={<IconText />}
              label="文本"
              onClick={() => doAdd(() => makeNode("textNode", newNodeDataByType.textNode()))}
            />
            <DockRow
              icon={<IconImage />}
              label="图片"
              onClick={() => doAdd(() => makeNode("imageNode", newNodeDataByType.imageNode()))}
            />
            <DockRow
              icon={<IconVideo />}
              label="视频"
              onClick={() => doAdd(() => makeNode("videoNode", newNodeDataByType.videoNode()))}
            />
            <DockRow
              icon={<IconCut />}
              label="视频合成"
              onClick={() => doAdd(() => makeNode("ffmpegConcat", newNodeDataByType.ffmpegConcat()))}
            />
            <DockRow
              icon={<IconAudio />}
              label="音频"
              onClick={() => doAdd(() => makeNode("audioNode", newNodeDataByType.audioNode()))}
            />
            <DockRow
              icon={<IconScript />}
              label="脚本"
              onClick={() => doAdd(() => makeNode("scriptNode", newNodeDataByType.scriptNode()))}
            />
          </div>

          <div className="leftAddDockSectionLabel">资源</div>
          <div className="leftAddDockRows">
            <DockRow
              icon={<IconUpload />}
              label="上传"
              onClick={() => {
                void onRequestUploadFiles();
                onClose();
              }}
            />
            <DockRow
              icon={<IconGallery />}
              label="从图库选择"
              disabled={!projectPath}
              onClick={() => {
                onOpenGallery();
                onClose();
              }}
            />
          </div>
          {!projectPath ? <p className="leftAddDockFootNote">打开工程后可从图库选择素材</p> : null}
        </div>
      ) : null}

      {/* 画布项目面板 */}
      <CanvasProjectPanel />
    </div>
  );
}