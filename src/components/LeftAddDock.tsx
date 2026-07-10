import { useCallback, useRef, useState, type ReactNode } from "react";
import type { Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { spawnNodeInView } from "@/lib/canvasSpawnNode";
import type { FlowNodeData } from "@/lib/types";
import {
  IconMenuAudio,
  IconMenuFfmpeg,
  IconMenuImage,
  IconMenuScript,
  IconMenuText,
  IconMenuVideo,
} from "@/components/canvas/canvasMenuNodeIcons";
import {
  IconHeadsetSupport,
  LeftAddDockSupportPopover,
} from "@/components/LeftAddDockSupportPopover";
import { MaterialLibraryModal } from "@/components/MaterialLibraryModal";

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

const IconText = () => <IconMenuText size={18} />;
const IconImage = () => <IconMenuImage size={18} />;
const IconVideo = () => <IconMenuVideo size={18} />;
const IconAudio = () => <IconMenuAudio size={18} />;
const IconScript = () => <IconMenuScript size={18} />;
const IconCut = () => <IconMenuFfmpeg size={18} />;
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

function IconMaterialLibrary() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3.5h8M9.5 12h5M9.5 15.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
  const { screenToFlowPosition } = useReactFlow();
  const supportBtnRef = useRef<HTMLButtonElement>(null);
  const materialLibraryBtnRef = useRef<HTMLButtonElement>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [materialLibraryOpen, setMaterialLibraryOpen] = useState(false);

  const handleClosePanels = useCallback(() => {
    setMaterialLibraryOpen(false);
    onClose();
  }, [onClose]);

  const doAdd = useCallback(
    (factory: () => Node<FlowNodeData>) => {
      spawnNodeInView(factory, {
        screenToFlowPosition,
        addNode,
        getExistingNodes: () => useProjectStore.getState().nodes,
        yRatio: 0.52,
      });
      handleClosePanels();
    },
    [addNode, handleClosePanels, screenToFlowPosition],
  );

  const toggleSupport = useCallback(() => {
    setMaterialLibraryOpen(false);
    setSupportOpen((prev) => !prev);
  }, []);

  const toggleMaterialLibrary = useCallback(() => {
    setSupportOpen(false);
    setMaterialLibraryOpen((prev) => {
      const next = !prev;
      if (next) onClose();
      return next;
    });
  }, [onClose]);

  const handleOpenAdd = useCallback(() => {
    setMaterialLibraryOpen(false);
    onOpen();
  }, [onOpen]);

  return (
    <div className={`leftAddDock${open ? " leftAddDock--open" : ""}`}>
      <div className="leftAddDockRail" role="toolbar" aria-label="画布工具">
        <button
          type="button"
          className={open ? "leftAddDockFab leftAddDockFab--close" : "leftAddDockFab"}
          onClick={open ? handleClosePanels : handleOpenAdd}
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
          ref={materialLibraryBtnRef}
          type="button"
          className={`leftAddDockFab${materialLibraryOpen ? " leftAddDockFab--active" : ""}`}
          onClick={toggleMaterialLibrary}
          title="素材库"
          aria-expanded={materialLibraryOpen}
          aria-haspopup="dialog"
        >
          <IconMaterialLibrary />
        </button>

        <button
          type="button"
          className="leftAddDockFab"
          onClick={() => window.dispatchEvent(new CustomEvent("r3-open-settings"))}
          title="设置"
        >
          <IconSettings />
        </button>

        <button
          ref={supportBtnRef}
          type="button"
          className={`leftAddDockFab${supportOpen ? " leftAddDockFab--active" : ""}`}
          onClick={toggleSupport}
          title="技术支持"
          aria-expanded={supportOpen}
          aria-haspopup="dialog"
        >
          <IconHeadsetSupport />
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
              label="剪辑"
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
                handleClosePanels();
              }}
            />
            <DockRow
              icon={<IconGallery />}
              label="从图库选择"
              disabled={!projectPath}
              onClick={() => {
                onOpenGallery();
                handleClosePanels();
              }}
            />
          </div>
          {!projectPath ? (
            <p className="leftAddDockFootNote">请从顶栏打开或新建工程后使用图库</p>
          ) : null}
        </div>
      ) : null}

      <MaterialLibraryModal
        open={materialLibraryOpen}
        anchorRef={materialLibraryBtnRef}
        onClose={() => setMaterialLibraryOpen(false)}
      />

      <LeftAddDockSupportPopover
        open={supportOpen}
        anchorRef={supportBtnRef}
        onClose={() => setSupportOpen(false)}
      />
    </div>
  );
}