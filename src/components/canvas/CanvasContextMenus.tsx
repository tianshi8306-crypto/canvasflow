import { memo, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import type { AssetSummary } from "@/shared/api/assets";
import { useAssetIdVisibilityPreference } from "@/hooks/useAssetIdVisibilityPreference";
import { clampContextMenuPosition } from "@/lib/clampFloatingUi";
import { assetNodeKindForMediaType, type AssetGalleryGroup } from "@/lib/canvasAssets";
import { formatUserError } from "@/lib/errors";
import {
  edgeLocateNodeStatusText,
  edgeToggleActionLabel,
  isEdgeDisabled,
} from "@/lib/edgeState";
import type { FlowCanvasMenuState } from "@/components/canvas/flowCanvasMenuState";
import { FLOW_MENU, flowMenuWidth } from "@/components/canvas/menuConstants";
import { getUndoRedoAvailability } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import type { FlowNodeData } from "@/lib/types";
import { upsertMaterialLibraryItem, materialCategoryLabel, type MaterialCategory } from "@/lib/materialLibrary";
import {
  isPassiveTextContainer,
  TEXT_PASSIVE_CONTAINER_STATUS,
} from "@/lib/textNodeContainerMode";
import {
  IconMenuAudio,
  IconMenuFfmpeg,
  IconMenuImage,
  IconMenuScript,
  IconMenuText,
  IconMenuVideo,
} from "@/components/canvas/canvasMenuNodeIcons";

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

const IconText = IconMenuText;
const IconImage = IconMenuImage;
const IconVideo = IconMenuVideo;
const IconScissors = IconMenuFfmpeg;
const IconAudio = IconMenuAudio;
const IconScript = IconMenuScript;

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
      className="canvasPaneCtxMenu__row canvasPaneCtxMenu__row--l1 canvasFloatMenuRow"
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
      className="canvasPaneCtxMenu__row canvasPaneCtxMenu__row--l1 canvasFloatMenuRow"
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
      className="canvasPaneCtxMenu__row canvasPaneCtxMenu__row--l2 canvasFloatMenuRow"
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
    <div role="menu" className="canvasPaneCtxMenu__shell canvasFloatMenuBody">
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
  galleryAssetGroups: AssetGalleryGroup<AssetSummary>[] | undefined;
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
    galleryAssetGroups,
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
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const flowClipboardCount = useProjectStore((s) => s.flowClipboardCount);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setTextGenPanelPinnedNodeId = useCanvasUiStore((s) => s.setTextGenPanelPinnedNodeId);
  const selectedEdgeIds = useProjectStore((s) => s.selectedEdgeIds);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const alignSelectedNodes = useProjectStore((s) => s.alignSelectedNodes);
  const distributeSelectedNodes = useProjectStore((s) => s.distributeSelectedNodes);
  const toggleSelectedEdgesDisabled = useProjectStore((s) => s.toggleSelectedEdgesDisabled);
  const createForkDuplicateOfSelection = useProjectStore((s) => s.createForkDuplicateOfSelection);

  const topLevelSelectedCount = selectedNodeIds.filter((id) => {
    const nn = nodes.find((n) => n.id === id);
    return nn && !nn.parentId;
  }).length;
  const showMultiAlign = topLevelSelectedCount >= 2;
  const canDistribute = topLevelSelectedCount >= 3;

  const ctxNode =
    menuState.mode === "context-node" && menuState.nodeId
      ? nodes.find((n) => n.id === menuState.nodeId)
      : null;
  const isTextNodeCtx = ctxNode?.type === "textNode";
  const isImageNodeCtx = ctxNode?.type === "imageNode";
  const isMediaNodeCtx =
    ctxNode?.type === "imageNode" || ctxNode?.type === "videoNode" || ctxNode?.type === "audioNode";
  const ctxMediaType =
    ctxNode?.type === "imageNode" ? "image" : ctxNode?.type === "videoNode" ? "video" : ctxNode?.type === "audioNode" ? "audio" : null;
  const ctxMediaRef =
    isMediaNodeCtx && ctxNode ? { relPath: ctxNode.data.path?.trim() ?? "", assetId: ctxNode.data.assetId?.trim() ?? "" } : null;
  const ctxEdge =
    menuState.mode === "context-edge" && menuState.edgeId
      ? edges.find((e) => e.id === menuState.edgeId)
      : null;
  const selectedEdges = edges.filter((e) => selectedEdgeIds.includes(e.id));
  const selectedEdgeCount = selectedEdges.length;
  const allSelectedEdgesDisabled = selectedEdgeCount > 0 && selectedEdges.every((e) => isEdgeDisabled(e));
  const sk = canvasModHints();
  const [showAssetIds, setShowAssetIds] = useAssetIdVisibilityPreference();

  const saveCtxMediaToLibrary = (category: MaterialCategory) => {
    if (!ctxNode || !ctxMediaType || !ctxMediaRef?.relPath) {
      setStatusText("当前节点没有可保存的素材");
      onDismiss();
      return;
    }
    const fallbackName = ctxMediaRef.relPath.split(/[/\\]/).pop() || "素材";
    const name = (ctxNode.data.label?.trim() || fallbackName).slice(0, 80);
    upsertMaterialLibraryItem({
      name,
      category,
      mediaType: ctxMediaType,
      relPath: ctxMediaRef.relPath,
      assetId: ctxMediaRef.assetId || undefined,
      projectPath: projectPath ?? undefined,
    });
    setStatusText(`已保存到素材库：${name}（${materialCategoryLabel(category)}）`);
    onDismiss();
  };

  const menuRoot = (
    <div
      className="canvasPaneCtxMenuRoot canvasFloatMenuShell"
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
            className="canvasPaneCtxMenu__shell canvasFloatMenuBody"
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
            <div className="canvasPaneCtxMenu__sectionTitle canvasFloatMenuTitle">从图库选择</div>
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
            ) : !galleryAssetGroups?.length ? (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "0 14px 10px" }}>
                暂无素材。可先上传，或在设置 → 常规中同步素材索引。
              </div>
            ) : (
              <div
                style={{
                  overflowY: "auto",
                  maxHeight: FLOW_MENU.galleryListMaxHeight,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  paddingBottom: 6,
                }}
              >
                {galleryAssetGroups.map((group) => (
                  <div key={group.category} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div
                      className="canvasPaneCtxMenu__sectionTitle canvasFloatMenuTitle"
                      style={{ padding: "4px 14px 2px", fontSize: 11, opacity: 0.85 }}
                    >
                      {group.label}
                    </div>
                    {group.items.map((a) => {
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
                          className="canvasPaneCtxMenu__row canvasPaneCtxMenu__row--l2 canvasFloatMenuRow"
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
                ))}
              </div>
            )}
          </div>
        ) : (
          <div role="menu" className="canvasPaneCtxMenu__shell canvasFloatMenuBody">
            <div className="canvasPaneCtxMenu__sectionTitle canvasFloatMenuTitle">添加节点</div>
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
              label="剪辑"
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
            <div className="canvasPaneCtxMenu__sectionTitle canvasFloatMenuTitle">添加资源</div>
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
          <div className="canvasPaneCtxMenu__shell canvasFloatMenuBody" role="menu">
            <CtxRow
              onClick={() => {
                if (isPassiveTextContainer(ctxNode.id, nodes, edges)) {
                  setStatusText(TEXT_PASSIVE_CONTAINER_STATUS);
                } else {
                  setTextGenPanelPinnedNodeId(ctxNode.id);
                  setStatusText("已打开模型对话面板");
                }
                onDismiss();
              }}
            >
              打开模型对话
            </CtxRow>
            <PaneSep />
            <CtxRow shortcut={sk.copy} onClick={() => { copySelection(); onDismiss(); }}>
              复制
            </CtxRow>
            <CtxRow onClick={() => { copySelection(); pasteSelection(); onDismiss(); }}>
              复制节点
            </CtxRow>
            <CtxRow
              title="复制参数并保留上游连线，便于 A/B 试验"
              onClick={() => { createForkDuplicateOfSelection(); onDismiss(); }}
            >
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
              shortcut={sk.copy}
              onClick={() => {
                const raw = (ctxNode.data as FlowNodeData).prompt ?? "";
                void navigator.clipboard.writeText(raw).then(
                  () => { setStatusText("已复制正文到剪贴板"); onDismiss(); },
                  () => { setStatusText("复制失败，请手动选择文本"); onDismiss(); },
                );
              }}
            >
              复制正文
            </CtxRow>
            <CtxRow
              shortcut={sk.paste}
              onClick={() => {
                void (async () => {
                  try {
                    const clip = await navigator.clipboard.readText();
                    if (!clip.trim()) {
                      setStatusText("剪贴板为空");
                      onDismiss();
                      return;
                    }
                    const prev = (ctxNode.data as FlowNodeData).prompt ?? "";
                    const merged = `${prev}${prev ? "\n" : ""}${clip}`;
                    updateNodeData(ctxNode.id, { prompt: merged });
                    setStatusText("已粘贴到正文");
                  } catch {
                    setStatusText("粘贴失败，请检查剪贴板权限");
                  }
                  onDismiss();
                })();
              }}
            >
              粘贴到正文
            </CtxRow>
          </div>
        ) : isImageNodeCtx && ctxNode && menuState.nodeId ? (
          <div className="canvasPaneCtxMenu__shell canvasFloatMenuBody" role="menu">
            <CtxRow onClick={() => {
              onDismiss();
              onOpenSubjectCreation(menuState.nodeId!);
            }}>
              创建主体
            </CtxRow>
            {ctxMediaRef?.relPath ? (
              <>
                <PaneSep />
                <CtxRow onClick={() => saveCtxMediaToLibrary("role")}>保存到素材库：人物</CtxRow>
                <CtxRow onClick={() => saveCtxMediaToLibrary("scene")}>保存到素材库：场景</CtxRow>
                <CtxRow onClick={() => saveCtxMediaToLibrary("prop")}>保存到素材库：物品</CtxRow>
                {ctxMediaType === "image" ? (
                  <CtxRow onClick={() => saveCtxMediaToLibrary("style")}>保存到素材库：风格</CtxRow>
                ) : null}
              </>
            ) : null}
            <PaneSep />
            <CtxRow onClick={() => { copySelection(); onDismiss(); }}>复制</CtxRow>
            <CtxRow onClick={() => { copySelection(); pasteSelection(); onDismiss(); }}>复制节点</CtxRow>
            <CtxRow
              title="复制参数并保留上游连线，便于 A/B 试验"
              onClick={() => { createForkDuplicateOfSelection(); onDismiss(); }}
            >
              创建副本
            </CtxRow>
            <CtxRow onClick={() => { undo(); onDismiss(); }}>撤销</CtxRow>
            <CtxRow onClick={() => { redo(); onDismiss(); }}>重做</CtxRow>
            <CtxRow onClick={() => { deleteSelection(); onDismiss(); }}>删除</CtxRow>
          </div>
        ) : (
          <div className="canvasPaneCtxMenu__shell canvasFloatMenuBody" role="menu">
            {ctxMediaRef?.relPath ? (
              <>
                <CtxRow onClick={() => saveCtxMediaToLibrary("role")}>保存到素材库：人物</CtxRow>
                <CtxRow onClick={() => saveCtxMediaToLibrary("scene")}>保存到素材库：场景</CtxRow>
                <CtxRow onClick={() => saveCtxMediaToLibrary("prop")}>保存到素材库：物品</CtxRow>
                {ctxMediaType === "image" ? (
                  <CtxRow onClick={() => saveCtxMediaToLibrary("style")}>保存到素材库：风格</CtxRow>
                ) : null}
                <PaneSep />
              </>
            ) : null}
            {showMultiAlign ? (
              <>
                <div className="canvasPaneCtxMenu__sectionTitle canvasFloatMenuTitle">对齐</div>
                <CtxRow onClick={() => { alignSelectedNodes("left"); onDismiss(); }}>左对齐</CtxRow>
                <CtxRow onClick={() => { alignSelectedNodes("right"); onDismiss(); }}>右对齐</CtxRow>
                <CtxRow onClick={() => { alignSelectedNodes("top"); onDismiss(); }}>顶对齐</CtxRow>
                <CtxRow onClick={() => { alignSelectedNodes("bottom"); onDismiss(); }}>底对齐</CtxRow>
                <CtxRow onClick={() => { alignSelectedNodes("centerH"); onDismiss(); }}>水平居中</CtxRow>
                <CtxRow onClick={() => { alignSelectedNodes("centerV"); onDismiss(); }}>垂直居中</CtxRow>
                <CtxRow
                  disabled={!canDistribute}
                  title={canDistribute ? undefined : "至少选中 3 个未嵌套节点"}
                  onClick={() => { distributeSelectedNodes("horizontal"); onDismiss(); }}
                >
                  水平等距
                </CtxRow>
                <CtxRow
                  disabled={!canDistribute}
                  title={canDistribute ? undefined : "至少选中 3 个未嵌套节点"}
                  onClick={() => { distributeSelectedNodes("vertical"); onDismiss(); }}
                >
                  垂直等距
                </CtxRow>
                <PaneSep />
              </>
            ) : null}
            {selectedNodeIds.length >= 1 ? (
              <CtxRow
                onClick={() => {
                  useCanvasUiStore.getState().openSaveWorkflowDialog();
                  onDismiss();
                }}
              >
                保存为工作流…
              </CtxRow>
            ) : null}
            {selectedNodeIds.length >= 1 ? <PaneSep /> : null}
            <CtxRow onClick={() => { copySelection(); onDismiss(); }}>复制</CtxRow>
            <CtxRow onClick={() => { copySelection(); pasteSelection(); onDismiss(); }}>复制节点</CtxRow>
            <CtxRow
              title="复制参数并保留上游连线，便于 A/B 试验"
              onClick={() => { createForkDuplicateOfSelection(); onDismiss(); }}
            >
              创建副本
            </CtxRow>
            <CtxRow onClick={() => { undo(); onDismiss(); }}>撤销</CtxRow>
            <CtxRow onClick={() => { redo(); onDismiss(); }}>重做</CtxRow>
            <CtxRow onClick={() => { deleteSelection(); onDismiss(); }}>删除</CtxRow>
          </div>
        )
      ) : menuState.mode === "context-edge" ? (
        <div className="canvasPaneCtxMenu__shell canvasFloatMenuBody" role="menu">
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
          <div role="menu" className="canvasPaneCtxMenu__shell canvasFloatMenuBody">
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
            <div className="canvasPaneCtxMenu__sectionTitle canvasFloatMenuTitle">添加节点</div>
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
              label="剪辑"
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
            <div className="canvasPaneCtxMenu__sectionTitle canvasFloatMenuTitle">添加资源</div>
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
