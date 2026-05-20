import { useCallback, useMemo, useState } from "react";
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
} from "@/lib/imagePreviewToolbarActions";
import { IMAGE_GENERATION_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { MediaPromptReverseButton } from "@/components/nodes/MediaPromptReverseButton";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

export type ImagePreviewToolbarCallbacks = {
  onOpenGenPanel: () => void;
};

type Props = {
  nodeId: string;
  hasLocalImage: boolean;
} & ImagePreviewToolbarCallbacks;

export function ImagePreviewToolbar({ nodeId, hasLocalImage, onOpenGenPanel }: Props) {
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const setImageGenPanelExpandedNodeId = useCanvasUiStore((s) => s.setImageGenPanelExpandedNodeId);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
          setImageGenPanelExpandedNodeId(nodeId);
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
        onOpenGenPanel();
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
        onOpenGenPanel();
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
      onOpenGenPanel,
      projectPath,
      queryClient,
      setImageGenPanelExpandedNodeId,
      setStatusText,
      updateNodeData,
    ],
  );

  const editActive = getImageEditIntent(node?.data).active;

  return (
    <div
      className="imagePreviewToolbar"
      role="toolbar"
      aria-label="图片预览工具"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="imagePreviewToolbarScroll">
        <div className="imagePreviewToolbarGroup">
          <span className="imagePreviewToolbarGroupLabel">提示词</span>
          <MediaPromptReverseButton
            sourceNodeId={nodeId}
            mediaKind="image"
            mediaPath={mediaPath}
            mediaAssetId={mediaAssetId}
            hasLocalImage={hasLocalImage}
          />
        </div>
        {IMAGE_PREVIEW_TOOLBAR_GROUPS.map((group) => (
          <div key={group.id} className="imagePreviewToolbarGroup">
            <span className="imagePreviewToolbarGroupLabel">{group.label}</span>
            {group.actions.length <= 3 && group.id !== "grid" ? (
              group.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`imagePreviewToolbarBtn${editActive && action.kind === "edit" ? " active" : ""}`}
                  disabled={action.kind === "edit" && !hasLocalImage}
                  title={
                    action.kind === "edit" && !hasLocalImage
                      ? "请先有预览图"
                      : action.label
                  }
                  onClick={() => runAction(action)}
                >
                  {action.label}
                </button>
              ))
            ) : (
              <div className="imagePreviewToolbarMenu">
                <button
                  type="button"
                  className={`imagePreviewToolbarBtn imagePreviewToolbarMenuTrigger${openMenuId === group.id ? " open" : ""}`}
                  onClick={() =>
                    setOpenMenuId((id) => (id === group.id ? null : group.id))
                  }
                >
                  {group.label}
                  <span className="imagePreviewToolbarMenuCaret" aria-hidden>
                    ▾
                  </span>
                </button>
                {openMenuId === group.id ? (
                  <div className="imagePreviewToolbarMenuDrop">
                    {group.actions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="imagePreviewToolbarMenuItem"
                        disabled={action.kind === "edit" && !hasLocalImage}
                        onClick={() => {
                          runAction(action);
                          setOpenMenuId(null);
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
