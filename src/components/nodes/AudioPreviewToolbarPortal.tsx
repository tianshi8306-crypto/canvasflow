import { useCallback, type MutableRefObject, type RefObject } from "react";
import { AudioPreviewToolbar } from "@/components/nodes/AudioPreviewToolbar";
import { NODE_CHROME_TOP_CLASS, NodePreviewChromeMeta } from "@/components/nodes/nodeChrome";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { NodeChromePortalShell } from "@/components/nodes/nodeChrome/NodeChromePortalShell";
import {
  GEN_PANEL_CHROME_ABOVE_PREVIEW_GAP,
  useNodeGenerationChrome,
} from "@/hooks/useNodeGenerationChrome";

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  active: boolean;
  hasLocalAudio: boolean;
  mediaPath?: string;
  mediaAssetId?: string;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  toolbarRef?: RefObject<HTMLDivElement | null>;
  label?: string;
  defaultLabel?: string;
  onCommitLabel: (label: string | undefined) => void;
  generating?: boolean;
  progress?: number | null;
};

/** 有音频且单选：预览区上方 Portal（功能栏 → 元信息行 → 预览） */
export function AudioPreviewToolbarPortal({
  anchorRef,
  active,
  hasLocalAudio,
  mediaPath,
  mediaAssetId,
  playbackRate,
  onPlaybackRateChange,
  toolbarRef: externalToolbarRef,
  label,
  defaultLabel = "音频",
  onCommitLabel,
  generating = false,
  progress,
}: Props) {
  const chromeMount = useNodeChromeMount();
  const { pos, panelRef: innerToolbarRef } = useNodeGenerationChrome(anchorRef, {
    active,
    mountRef: chromeMount?.mountRef,
    placement: "above",
    aboveGap: GEN_PANEL_CHROME_ABOVE_PREVIEW_GAP,
    aboveExtra: 0,
  });

  const setToolbarRef = useCallback(
    (el: HTMLDivElement | null) => {
      (innerToolbarRef as MutableRefObject<HTMLDivElement | null>).current = el;
      if (externalToolbarRef) {
        (externalToolbarRef as MutableRefObject<HTMLDivElement | null>).current = el;
      }
    },
    [innerToolbarRef, externalToolbarRef],
  );

  return (
    <NodeChromePortalShell
      active={active}
      pos={pos}
      setPanelRef={setToolbarRef}
      className={`audioPreviewToolbarPortalRoot previewToolbarChrome--stack ${NODE_CHROME_TOP_CLASS}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="nodePreviewChromeStack">
        <div className="audioPreviewToolbarChrome">
          <AudioPreviewToolbar
            hasLocalAudio={hasLocalAudio}
            mediaPath={mediaPath}
            mediaAssetId={mediaAssetId}
            playbackRate={playbackRate}
            onPlaybackRateChange={onPlaybackRateChange}
          />
        </div>
        <NodePreviewChromeMeta
          label={label}
          defaultLabel={defaultLabel}
          onCommitLabel={onCommitLabel}
          generating={generating}
          progress={progress}
        />
      </div>
    </NodeChromePortalShell>
  );
}
