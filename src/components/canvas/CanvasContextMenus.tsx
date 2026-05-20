import { memo, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import type { AssetSummary } from "@/shared/api/assets";
import { useAssetIdVisibilityPreference } from "@/hooks/useAssetIdVisibilityPreference";
import { clampContextMenuPosition } from "@/lib/clampFloatingUi";
import { assetNodeKindForMediaType } from "@/lib/canvasAssets";
import { formatUserError } from "@/lib/errors";
import {
  edgeLocateNodeStatusText,
  edgeToggleActionLabel,
  isEdgeDisabled,
} from "@/lib/edgeState";
import { addTextMaterial } from "@/lib/textMaterialStorage";
import type { FlowCanvasMenuState } from "@/components/canvas/flowCanvasMenuState";
import { FLOW_MENU, flowMenuWidth } from "@/components/canvas/menuConstants";
import { getUndoRedoAvailability } from "@/store/projectStore";
import { useProjectStore } from "@/store/projectStore";
import type { FlowNodeData } from "@/lib/types";

function canvasModHints(): { copy: string; paste: string; del: string; undo: string; redo: string } {
  const mac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform ?? "");
  return {
    copy: mac ? "⌘C" : "Ctrl+C",
    paste: mac ? "⌘V" : "Ctrl+V",
    del: mac ? "⌘⌫" : "Del",
    undo: mac ? "⌘Z" : "Ctrl+Z",
    redo: mac ? "⇧⌘Z" : "Ctrl+Shift+Z",
  };
}

function IconText() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 7h12M6 12h12M6 17h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 18V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="m8 14 2.5-3 2.5 3 3.5-4.5L20 15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.2 14.2 12l-3.7 1.8V10.2Z" fill="currentColor" />
    </svg>
  );
}

function IconScissors() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="17" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 9.5 14.5 14.5M14.5 9.5 9.5 14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconAudio() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 15V9l4-2v10l-4-2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M14 9v6M17 7v10M20 5v14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconScript() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 9h8M8 12h6M8 15h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v10m0 0 3.5-3.5M12 14 8.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconLibrary() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 9h16M8 5v4M16 5v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PaneSep({ loose }: { loose?: boolean }) {
  return <div className={loose ? "canvasPaneCtxMenu__sep canvasPaneCtxMenu__sep--loose" : "canvasPaneCtxMenu__sep"} />;
}

function PaneL1Row({
  children,
  shortcut,
  disabled,
  title,
  onClick,
}: {
  children: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="canvasPaneCtxMenu__row canvasPaneCtxMenu__row--l1"
    >
      <span>{children}</span>
      {shortcut ? <span className="canvasPaneCtxMenu__shortcut">{shortcut}</span> : null}
    </button>
  );
}

function CtxRow({
  children,
  shortcut,
  disabled,
  title,
  onClick,
}: {
  children: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="canvasPaneCtxMenu__row canvasPaneCtxMenu__row--l1"
    >
      <span style={{ flex: 1, textAlign: "left" }}>{children}</span>
      {shortcut ? <span className="canvasPaneCtxMenu__shortcut">{shortcut}</span> : null}
    </button>
  );
}

function PaneAddRow({
  label,
  icon,
  disabled,
  title,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="canvasPaneCtxMenu__row canvasPaneCtxMenu__row--l2"
    >
      <span className="canvasPaneCtxMenu__icon">{icon}</span>
      <span className="canvasPaneCtxMenu__label">{label}</span>
    </button>
  );
}

function CanvasPaneLevel1({
  flowClipboardCount,
  onRequestUploadFiles,
  sk,
  setMenuState,
  undo,
  redo,
  pasteSelection,
  onDismiss,
}: {
  flowClipboardCount: number;
  onRequestUploadFiles: () => void | Promise<void>;
  sk: ReturnType<typeof canvasModHints>;
  setMenuState: Dispatch<SetStateAction<FlowCanvasMenuState | null>>;
  undo: () => void;
  redo: () => void;
  pasteSelection: () => void;
  onDismiss: () => void;
}) {
  const { canUndo, canRedo } = getUndoRedoAvailability();

  return (
    <div role="menu" className="canvasPaneCtxMenu__shell">
      <PaneL1Row
        onClick={() => {
          void onRequestUploadFiles();
          onDismiss();
        }}
      >
        上传
      </PaneL1Row>
      <PaneL1Row disabled title="敬请期待">
        保存到我的素材
      </PaneL1Row>
      <PaneSep />
      <PaneL1Row
        onClick={() =>
          setMenuState((p) => {
            if (!p || p.mode !== "context-pane") return p;
            const pos = clampContextMenuPosition(
              p.x,
              p.y,
              FLOW_MENU.widths.contextPaneL2,
              FLOW_MENU.clampEstimatedHeight,
            );
            return { ...p, paneAddSubmenu: true, x: pos.x, y: pos.y };
          })
        }
      >
        添加节点
      </PaneL1Row>
      <PaneSep />
      <PaneL1Row
        shortcut={sk.undo}
        disabled={!canUndo}
        onClick={() => {
          undo();
          onDismiss();
        }}
      >
        撤销
      </PaneL1Row>
      <PaneL1Row
        shortcut={sk.redo}
        disabled={!canRedo}
        onClick={() => {
          redo();
          onDismiss();
        }}
      >
        重做
      </PaneL1Row>
      <PaneSep />
      <PaneL1Row
        shortcut={sk.paste}
        disabled={flowClipboardCount === 0}
        title={flowClipboardCount === 0 ? "请先在画布中复制节点" : undefined}
        onClick={() => {
          pasteSelection();
          onDismiss();
        }}
      >
        粘贴
      </PaneL1Row>
    </div>
  );
}

export type CanvasContextMenusProps = {
  menuState: FlowCanvasMenuState;
  projectPath: string | null;
  galleryAssets: AssetSummary[] | undefined;
  galleryLoading: boolean;
  galleryError: Error | null;
  onDismiss: () => void;
  onRequestUploadFiles: () => void | Promise<void>;
  openAddPanelAt: (x: number, y: number, nodeId?: string | null) => void;
  createNodeAtClientPoint: (
    type: "textNode" | "imageNode" | "videoNode" | "audioNode" | "scriptNode" | "ffmpegConcat",
    clientX: number,
    clientY: number,
  ) => void;
  pickAssetFromGallery: (asset: Pick<AssetSummary, "relPath" | "mediaType" | "assetId">) => void;
  syncMaterialsIndex: () => Promise<void>;
  copySelection: () => void;
  pasteSelection: () => void;
  deleteSelection: () => void;
  focusNodesByIds: (ids: string[]) => Promise<void>;
  undo: () => void;
  redo: () => void;
  setMenuState: Dispatch<SetStateAction<FlowCanvasMenuState | null>>;
  onOpenSubjectCreation: (nodeId: string) => void;
};

function CanvasContextMenusInner(props: CanvasContextMenusProps) {
  const {
    menuState,
    projectPath,
    galleryAssets,
    galleryLoading,
    galleryError,
    onDismiss,
    onRequestUploadFiles,
    createNodeAtClientPoint,
    pickAssetFromGallery,
    copySelection,
    pasteSelection,
    deleteSelection,
    focusNodesByIds,
    undo,
    redo,
    setMenuState,
    onOpenSubjectCreation,
  } = props;

  const w = flowMenuWidth(menuState);
  /** 左键双击「添加」与空白处右键菜单共用同一套 pane 浮层样式 */
  const usesPaneMenuChrome = menuState.mode === "context-pane" || menuState.mode === "add-panel";

  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const flowClipboardCount = useProjectStore((s) => s.flowClipboardCount);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const selectedEdgeIds = useProjectStore((s) => s.selectedEdgeIds);
  const toggleSelectedEdgesDisabled = useProjectStore((s) => s.toggleSelectedEdgesDisabled);

  const ctxNode =
    menuState.mode === "context-node" && menuState.nodeId
      ? nodes.find((n) => n.id === menuState.nodeId)
      : null;
  const isTextNodeCtx = ctxNode?.type === "textNode";
  const isImageNodeCtx = ctxNode?.type === "imageNode";
  const ctxEdge =
    menuState.mode === "context-edge" && menuState.edgeId
      ? edges.find((e) => e.id === menuState.edgeId)
      : null;
  const selectedEdges = edges.filter((e) => selectedEdgeIds.includes(e.id));
  const selectedEdgeCount = selectedEdges.length;
  const allSelectedEdgesDisabled = selectedEdgeCount > 0 && selectedEdges.every((e) => isEdgeDisabled(e));
  const textData = isTextNodeCtx && ctxNode ? (ctxNode.data as FlowNodeData) : null;
  const textBody = Boolean((textData?.prompt ?? "").trim().length);
  const textChromeOn = Boolean(
    textData?.params &&
      typeof textData.params === "object" &&
      (textData.params as { textChrome?: boolean }).textChrome,
  );
  const sk = canvasModHints();
  const [showAssetIds, setShowAssetIds] = useAssetIdVisibilityPreference();

  const menuRoot = (
    <div
      className={usesPaneMenuChrome ? "canvasPaneCtxMenuRoot" : "canvasFlowFloatingShell"}
      style={{
        position: "fixed",
        left: menuState.x,
        top: menuState.y,
        zIndex: FLOW_MENU.zIndex,
        width: w,
        overflow: "hidden",
      }}
      onMouseLeave={onDismiss}
      role="presentation"
    >
      {menuState.mode === "add-panel" ? (
        menuState.addPanelTab === "gallery" ? (
          <div
            role="menu"
            className="canvasPaneCtxMenu__shell"
            style={{ maxHeight: FLOW_MENU.galleryPanelMaxHeight, display: "flex", flexDirection: "column" }}
          >
            <button
              type="button"
              className="canvasPaneCtxMenu__back"
              onClick={() =>
                setMenuState((p) => (p && p.mode === "add-panel" ? { ...p, addPanelTab: "types" } : p))
              }
            >
              ← 返回
            </button>
            <div className="canvasPaneCtxMenu__sectionTitle">从图库选择</div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px 10px",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: 12,
                userSelect: "none",
              }}
            >
              <input type="checkbox" checked={showAssetIds} onChange={(e) => setShowAssetIds(e.target.checked)} />
              显示素材 ID
            </label>
            {!projectPath ? (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "0 14px 10px" }}>请先打开工程</div>
            ) : galleryLoading ? (
              <div style={{ color: "var(--muted)", padding: "0 14px 10px" }}>加载中…</div>
            ) : galleryError ? (
              <div style={{ color: "var(--accent-2)", fontSize: 13, padding: "0 14px 10px" }}>
                加载失败：{formatUserError(galleryError)}
              </div>
            ) : !galleryAssets?.length ? (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "0 14px 10px" }}>
                暂无素材。可先上传，或使用空白处右键「同步到素材索引」。
              </div>
            ) : (
              <div
                style={{
                  overflowY: "auto",
                  maxHeight: FLOW_MENU.galleryListMaxHeight,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  paddingBottom: 6,
                }}
              >
                {galleryAssets.map((a) => {
                  const canNode = assetNodeKindForMediaType(a.mediaType) !== null;
                  return (
                    <button
                      key={a.assetId}
                      type="button"
                      disabled={!canNode}
                      title={
                        canNode
                          ? `${a.relPath}${showAssetIds ? `\n${a.assetId}` : ""}`
                          : `${a.relPath}（仅支持从图片/视频/音频创建）`
                      }
                      className="canvasPaneCtxMenu__row canvasPaneCtxMenu__row--l2"
                      style={{
                        opacity: canNode ? 1 : 0.45,
                        cursor: canNode ? "pointer" : "not-allowed",
                        alignItems: "flex-start",
                      }}
                      onClick={() => pickAssetFromGallery(a)}
                    >
                      <span className="canvasPaneCtxMenu__icon" aria-hidden>
                        <IconLibrary />
                      </span>
                      <span className="canvasPaneCtxMenu__label">
                        <span className="mono" style={{ wordBreak: "break-all", fontSize: 12, display: "block" }}>
                          {a.relPath}
                        </span>
                        {showAssetIds ? (
                          <span
                            className="mono"
                            style={{
                              color: "var(--muted)",
                              fontSize: 10,
                              wordBreak: "break-all",
                              display: "block",
                              marginTop: 2,
                            }}
                            title={a.assetId}
                          >
                            {a.assetId}
                          </span>
                        ) : null}
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>{a.mediaType}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div role="menu" className="canvasPaneCtxMenu__shell">
            <div className="canvasPaneCtxMenu__sectionTitle">添加节点</div>
            <PaneAddRow
              label="文本"
              icon={<IconText />}
              onClick={() => {
                createNodeAtClientPoint("textNode", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneAddRow
              label="图片"
              icon={<IconImage />}
              onClick={() => {
                createNodeAtClientPoint("imageNode", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneAddRow
              label="视频"
              icon={<IconVideo />}
              onClick={() => {
                createNodeAtClientPoint("videoNode", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneAddRow
              label="视频合成"
              icon={<IconScissors />}
              onClick={() => {
                createNodeAtClientPoint("ffmpegConcat", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneAddRow
              label="音频"
              icon={<IconAudio />}
              onClick={() => {
                createNodeAtClientPoint("audioNode", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneAddRow
              label="脚本"
              icon={<IconScript />}
              onClick={() => {
                createNodeAtClientPoint("scriptNode", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneSep loose />
            <div className="canvasPaneCtxMenu__sectionTitle">添加资源</div>
            <PaneAddRow
              label="上传"
              icon={<IconUpload />}
              onClick={() => {
                void onRequestUploadFiles();
                onDismiss();
              }}
            />
            <PaneAddRow
              label="从图库选择"
              icon={<IconLibrary />}
              disabled={!projectPath}
              title={projectPath ? "从已索引的素材中选择" : "请先打开工程"}
              onClick={() =>
                setMenuState((p) =>
                  p && p.mode === "add-panel" && projectPath ? { ...p, addPanelTab: "gallery" } : p,
                )
              }
            />
          </div>
        )
      ) : menuState.mode === "context-node" ? (
        isTextNodeCtx && ctxNode && menuState.nodeId ? (
          <div className="canvasPaneCtxMenu__shell" role="menu">
            <CtxRow onClick={() => {
              const content = (ctxNode.data as FlowNodeData).prompt ?? "";
              if (content.trim()) {
                addTextMaterial(content);
                setStatusText("已保存到我的素材");
              } else {
                setStatusText("文本内容为空，无法保存");
              }
              onDismiss();
            }}>
              保存到我的素材
            </CtxRow>
            <CtxRow onClick={() => { setStatusText("优化工作流布局（敬请期待）"); onDismiss(); }}>
              优化工作流布局
            </CtxRow>
            {textBody ? (
              <CtxRow
                title="显示下载与缩放手柄"
                onClick={() => {
                  const base =
                    ctxNode.data.params && typeof ctxNode.data.params === "object"
                      ? { ...ctxNode.data.params }
                      : {};
                  updateNodeData(ctxNode.id, {
                    params: { ...base, textChrome: !textChromeOn },
                  });
                  setStatusText(textChromeOn ? "已隐藏文本工具" : "已显示文本工具与下载");
                  onDismiss();
                }}
              >
                {textChromeOn ? "隐藏文本工具与下载" : "文本工具与下载"}
              </CtxRow>
            ) : null}
            <PaneSep />
            <CtxRow shortcut={sk.copy} onClick={() => { copySelection(); onDismiss(); }}>
              复制节点
            </CtxRow>
            <CtxRow onClick={() => { copySelection(); pasteSelection(); onDismiss(); }}>
              创建副本
            </CtxRow>
            <CtxRow
              shortcut={sk.paste}
              disabled={flowClipboardCount === 0}
              title={flowClipboardCount === 0 ? "请先在画布中复制节点" : undefined}
              onClick={() => { pasteSelection(); onDismiss(); }}
            >
              粘贴
            </CtxRow>
            <CtxRow shortcut={sk.del} onClick={() => { deleteSelection(); onDismiss(); }}>
              删除
            </CtxRow>
            <PaneSep />
            <CtxRow
              onClick={() => {
                const raw = (ctxNode.data as FlowNodeData).prompt ?? "";
                void navigator.clipboard.writeText(raw).then(
                  () => { setStatusText("已复制正文到剪贴板"); onDismiss(); },
                  () => { setStatusText("复制失败，请手动选择文本"); onDismiss(); },
                );
              }}
            >
              复制到剪贴板
            </CtxRow>
          </div>
        ) : isImageNodeCtx && ctxNode && menuState.nodeId ? (
          <div className="canvasPaneCtxMenu__shell" role="menu">
            <CtxRow onClick={() => {
              onDismiss();
              onOpenSubjectCreation(menuState.nodeId!);
            }}>
              创建主体
            </CtxRow>
            <PaneSep />
            <CtxRow onClick={() => { copySelection(); onDismiss(); }}>复制</CtxRow>
            <CtxRow onClick={() => { copySelection(); pasteSelection(); onDismiss(); }}>复制副本</CtxRow>
            <CtxRow onClick={() => { undo(); onDismiss(); }}>撤销</CtxRow>
            <CtxRow onClick={() => { redo(); onDismiss(); }}>重做</CtxRow>
            <CtxRow onClick={() => { deleteSelection(); onDismiss(); }}>删除</CtxRow>
          </div>
        ) : (
          <div className="canvasPaneCtxMenu__shell" role="menu">
            <CtxRow onClick={() => { copySelection(); onDismiss(); }}>复制</CtxRow>
            <CtxRow onClick={() => { copySelection(); pasteSelection(); onDismiss(); }}>复制副本</CtxRow>
            <CtxRow onClick={() => { undo(); onDismiss(); }}>撤销</CtxRow>
            <CtxRow onClick={() => { redo(); onDismiss(); }}>重做</CtxRow>
            <CtxRow onClick={() => { deleteSelection(); onDismiss(); }}>删除</CtxRow>
          </div>
        )
      ) : menuState.mode === "context-edge" ? (
        <div className="canvasPaneCtxMenu__shell" role="menu">
          <CtxRow
            disabled={selectedEdgeCount === 0}
            onClick={() => { toggleSelectedEdgesDisabled(!allSelectedEdgesDisabled); onDismiss(); }}
          >
            {edgeToggleActionLabel(!allSelectedEdgesDisabled, selectedEdgeCount)}
          </CtxRow>
          <CtxRow onClick={() => { deleteSelection(); onDismiss(); }}>删除连线</CtxRow>
          <CtxRow
            disabled={!ctxEdge}
            onClick={() => {
              if (!ctxEdge) return;
              void focusNodesByIds([ctxEdge.source]).then(() => {
                setStatusText(edgeLocateNodeStatusText("upstream", ctxEdge.source));
              });
              onDismiss();
            }}
          >
            定位上游节点
          </CtxRow>
          <CtxRow
            disabled={!ctxEdge}
            onClick={() => {
              if (!ctxEdge) return;
              void focusNodesByIds([ctxEdge.target]).then(() => {
                setStatusText(edgeLocateNodeStatusText("downstream", ctxEdge.target));
              });
              onDismiss();
            }}
          >
            定位下游节点
          </CtxRow>
        </div>
      ) : menuState.mode === "context-pane" ? (
        menuState.paneAddSubmenu ? (
          <div role="menu" className="canvasPaneCtxMenu__shell">
            <button
              type="button"
              className="canvasPaneCtxMenu__back"
              onClick={() =>
                setMenuState((p) =>
                  p && p.mode === "context-pane" ? { ...p, paneAddSubmenu: false } : p,
                )
              }
            >
              ← 返回
            </button>
            <div className="canvasPaneCtxMenu__sectionTitle">添加节点</div>
            <PaneAddRow
              label="文本"
              icon={<IconText />}
              onClick={() => {
                createNodeAtClientPoint("textNode", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneAddRow
              label="图片"
              icon={<IconImage />}
              onClick={() => {
                createNodeAtClientPoint("imageNode", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneAddRow
              label="视频"
              icon={<IconVideo />}
              onClick={() => {
                createNodeAtClientPoint("videoNode", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneAddRow
              label="视频合成"
              icon={<IconScissors />}
              onClick={() => {
                createNodeAtClientPoint("ffmpegConcat", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneAddRow
              label="音频"
              icon={<IconAudio />}
              onClick={() => {
                createNodeAtClientPoint("audioNode", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneAddRow
              label="脚本"
              icon={<IconScript />}
              onClick={() => {
                createNodeAtClientPoint("scriptNode", menuState.x, menuState.y);
                onDismiss();
              }}
            />
            <PaneSep loose />
            <div className="canvasPaneCtxMenu__sectionTitle">添加资源</div>
            <PaneAddRow
              label="上传"
              icon={<IconUpload />}
              onClick={() => {
                void onRequestUploadFiles();
                onDismiss();
              }}
            />
            <PaneAddRow
              label="从图库选择"
              icon={<IconLibrary />}
              disabled={!projectPath}
              title={projectPath ? "从已索引的素材中选择" : "请先打开工程"}
              onClick={() => {
                if (!projectPath) return;
                const p = clampContextMenuPosition(
                  menuState.x,
                  menuState.y,
                  FLOW_MENU.widths.gallery,
                  FLOW_MENU.clampEstimatedHeight,
                );
                setMenuState({ x: p.x, y: p.y, mode: "add-panel", nodeId: null, addPanelTab: "gallery" });
              }}
            />
          </div>
        ) : (
          <CanvasPaneLevel1
            flowClipboardCount={flowClipboardCount}
            onRequestUploadFiles={onRequestUploadFiles}
            sk={sk}
            setMenuState={setMenuState}
            undo={undo}
            redo={redo}
            pasteSelection={pasteSelection}
            onDismiss={onDismiss}
          />
        )
      ) : null}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menuRoot, document.body);
}

export const CanvasContextMenus = memo(CanvasContextMenusInner);
