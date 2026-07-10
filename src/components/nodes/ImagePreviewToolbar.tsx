import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { queryKeys } from "@/shared/queryKeys";
import {
  getImageEditIntent,
  imageEditIntentParams,
} from "@/lib/imageGeneration/imageEditIntent";
import {
  downloadProjectImage,
  IMAGE_PREVIEW_TOOLBAR_GROUPS,
  resolvePresetPrompt,
  type ImagePreviewToolbarAction,
  type ImagePreviewToolbarGroup,
} from "@/lib/imagePreviewToolbarActions";
import { runImageToolbarSpawnGenerate } from "@/lib/imageGeneration/imageToolbarSpawnGenerate";
import { IMAGE_GENERATION_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { MediaPromptReverseButton } from "@/components/nodes/MediaPromptReverseButton";
import { PreviewToolbarMenuPortal } from "@/components/nodes/nodeChrome";
import {
  isPreviewToolbarActionPending,
  previewToolbarPendingTitle,
} from "@/lib/previewToolbarPending";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  nodeId: string;
  hasLocalImage: boolean;
};

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

function ImagePreviewToolbarMenuGroup({
  group,
  open,
  onToggle,
  triggerRef,
  menuRef,
  hasLocalImage,
  editActive,
  spawnBusy,
  onRunAction,
}: {
  group: ImagePreviewToolbarGroup;
  open: boolean;
  onToggle: (trigger: HTMLButtonElement) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  menuRef: React.RefObject<HTMLDivElement>;
  hasLocalImage: boolean;
  editActive: boolean;
  spawnBusy: boolean;
  onRunAction: (action: ImagePreviewToolbarAction) => void;
}) {
  const useMenu = group.actions.length > 3 || group.id === "grid";

  const actionNeedsImage = (action: ImagePreviewToolbarAction) =>
    action.kind === "edit" || action.kind === "spawnGenerate";

  if (!useMenu) {
    return (
      <>
        {group.actions.map((action) => {
          const pending = isPreviewToolbarActionPending(action.kind);
          const disabled =
            pending ||
            spawnBusy ||
            (actionNeedsImage(action) && !hasLocalImage);
          const title = pending
            ? previewToolbarPendingTitle(action.stubMessage)
            : actionNeedsImage(action) && !hasLocalImage
              ? "请先有预览图"
              : spawnBusy
                ? "正在生成…"
                : action.label;
          return (
          <button
            key={action.id}
            type="button"
            className={`imagePreviewToolbarBtn${pending ? " imagePreviewToolbarBtn--pending" : ""}${editActive && action.kind === "edit" ? " active" : ""}`}
            disabled={disabled}
            title={title}
            aria-disabled={disabled}
            onClick={pending ? undefined : () => onRunAction(action)}
          >
            {action.label}
          </button>
          );
        })}
      </>
    );
  }

  return (
    <div className="imagePreviewToolbarMenu">
      <button
        ref={open ? triggerRef : undefined}
        type="button"
        className={`imagePreviewToolbarBtn imagePreviewToolbarMenuTrigger${open ? " open" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => onToggle(e.currentTarget)}
      >
        {group.label}
        <span className="imagePreviewToolbarMenuCaret" aria-hidden>
          ▾
        </span>
      </button>
      <PreviewToolbarMenuPortal
        open={open}
        triggerRef={triggerRef}
        menuRef={menuRef}
        className="imagePreviewToolbarMenuDrop imagePreviewToolbarMenuDrop--portal"
      >
        {group.actions.map((action) => {
          const pending = isPreviewToolbarActionPending(action.kind);
          const disabled =
            pending ||
            spawnBusy ||
            (actionNeedsImage(action) && !hasLocalImage);
          const title = pending
            ? previewToolbarPendingTitle(action.stubMessage)
            : actionNeedsImage(action) && !hasLocalImage
              ? "请先有预览图"
              : spawnBusy
                ? "正在生成…"
                : action.label;
          return (
          <button
            key={action.id}
            type="button"
            className={`imagePreviewToolbarMenuItem${pending ? " imagePreviewToolbarMenuItem--pending" : ""}`}
            disabled={disabled}
            title={title}
            aria-disabled={disabled}
            onClick={pending ? undefined : () => onRunAction(action)}
          >
            {action.label}
          </button>
          );
        })}
      </PreviewToolbarMenuPortal>
    </div>
  );
}

export function ImagePreviewToolbar({ nodeId, hasLocalImage }: Props) {
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const setImagePreviewExpandedNodeId = useCanvasUiStore((s) => s.setImagePreviewExpandedNodeId);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [spawnBusy, setSpawnBusy] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuDropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (menuTriggerRef.current?.contains(target)) return;
      if (menuDropRef.current?.contains(target)) return;
      setOpenMenuId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openMenuId]);

  const toggleMenu = useCallback((groupId: string, trigger: HTMLButtonElement) => {
    setOpenMenuId((current) => {
      if (current === groupId) {
        menuTriggerRef.current = null;
        return null;
      }
      menuTriggerRef.current = trigger;
      return groupId;
    });
  }, []);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);
  const localPrompt = (node?.data.prompt ?? "").trim();
  const mediaPath = node?.data.path?.trim();
  const mediaAssetId = node?.data.assetId?.trim();

  const mergeParams = useCallback(
    (patch: Record<string, unknown>) => {
      const prev = node?.data.params;
      const base =
        prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev } : {};
      updateNodeData(nodeId, { params: { ...base, ...patch } });
    },
    [node?.data.params, nodeId, updateNodeData],
  );

  const clearEditIntent = useCallback(() => {
    mergeParams(imageEditIntentParams({ active: false }));
  }, [mergeParams]);

  const runAction = useCallback(
    (action: ImagePreviewToolbarAction) => {
      setOpenMenuId(null);
      if (action.kind === "stub") {
        setStatusText(action.stubMessage ?? "即将支持");
        return;
      }
      if (action.kind === "utility") {
        if (action.id === "upload") {
          if (!isTauri()) return;
          void (async () => {
            const paths = await pickImagePathsForImport(false);
            if (paths?.length) {
              await assignImportedMediaToNode(nodeId, paths);
              if (projectPath) {
                await queryClient.invalidateQueries({
                  queryKey: queryKeys.assets.list(projectPath),
                });
              }
            }
          })();
          return;
        }
        if (action.id === "maximize") {
          if (!hasLocalImage) {
            setStatusText("请先有预览图");
            return;
          }
          setImagePreviewExpandedNodeId(nodeId);
          return;
        }
        if (action.id === "download") {
          if (!isTauri() || !projectPath?.trim() || !mediaPath) {
            setStatusText("请先打开工程并确保节点已有图片");
            return;
          }
          void downloadProjectImage(
            projectPath,
            mediaPath,
            mediaPath.split(/[/\\]/).pop() ?? "image.png",
          ).catch(() => setStatusText("下载失败"));
          return;
        }
      }
      if (action.kind === "edit") {
        if (!hasLocalImage) {
          setStatusText("请先生成或上传图片后再编辑");
          return;
        }
        mergeParams(
          imageEditIntentParams({ active: true, subAction: action.subAction }),
        );
        return;
      }
      if (action.kind === "preset") {
        if (!action.presetId) return;
        const nextPrompt = resolvePresetPrompt(action.presetId, localPrompt);
        if (!nextPrompt) {
          setStatusText("未找到对应预设");
          return;
        }
        clearEditIntent();
        updateNodeData(nodeId, {
          prompt: nextPrompt.slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS),
        });
        return;
      }
      if (action.kind === "spawnGenerate") {
        if (!action.spawnId) return;
        if (!hasLocalImage) {
          setStatusText("请先有预览图再生成三视图");
          return;
        }
        if (spawnBusy) return;
        clearEditIntent();
        setSpawnBusy(true);
        void runImageToolbarSpawnGenerate({
          sourceNodeId: nodeId,
          spawnId: action.spawnId,
        }).finally(() => setSpawnBusy(false));
      }
    },
    [
      assignImportedMediaToNode,
      clearEditIntent,
      hasLocalImage,
      localPrompt,
      mediaPath,
      mergeParams,
      nodeId,
      projectPath,
      queryClient,
      setImagePreviewExpandedNodeId,
      setStatusText,
      spawnBusy,
      updateNodeData,
    ],
  );

  const editActive = getImageEditIntent(node?.data).active;

  const openPreviewExpand = useCallback(() => {
    if (!hasLocalImage) {
      setStatusText("请先有预览图");
      return;
    }
    setImagePreviewExpandedNodeId(nodeId);
  }, [hasLocalImage, nodeId, setImagePreviewExpandedNodeId, setStatusText]);

  return (
    <div
      className="imagePreviewToolbar"
      role="toolbar"
      aria-label="图片预览工具"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="imagePreviewToolbarScroll">
        <div className="imagePreviewToolbarGroup">
          <MediaPromptReverseButton
            sourceNodeId={nodeId}
            mediaKind="image"
            mediaPath={mediaPath}
            mediaAssetId={mediaAssetId}
            hasMedia={hasLocalImage}
          />
        </div>
        {IMAGE_PREVIEW_TOOLBAR_GROUPS.map((group) => (
          <div key={group.id} className="imagePreviewToolbarGroup">
            <ImagePreviewToolbarMenuGroup
              group={group}
              open={openMenuId === group.id}
              onToggle={(trigger) => toggleMenu(group.id, trigger)}
              triggerRef={menuTriggerRef}
              menuRef={menuDropRef}
              hasLocalImage={hasLocalImage}
              editActive={editActive}
              spawnBusy={spawnBusy}
              onRunAction={runAction}
            />
          </div>
        ))}
      </div>
      <div className="imagePreviewToolbar-divider" aria-hidden />
      <button
        type="button"
        className="imagePreviewToolbar-iconBtn"
        title="放大预览"
        aria-label="放大预览"
        disabled={!hasLocalImage}
        onClick={openPreviewExpand}
      >
        <IconExpand />
      </button>
    </div>
  );
}
