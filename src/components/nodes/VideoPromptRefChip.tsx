import "@/components/nodes/MentionInput.css";
import { useMemo } from "react";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { SeedanceComplianceBadge } from "@/components/nodes/SeedanceComplianceBadge";
import type { SeedanceImageComplianceResult } from "@/lib/seedance/seedanceImageCompliance";
import {
  resolveVideoPromptPillLayout,
  type VideoPromptPillDensity,
} from "@/lib/videoPromptPillLayout";

const DEFAULT_MIRROR_FONT = "400 13px sans-serif";

export type VideoPromptRefChipProps = {
  token: string;
  label: string;
  path?: string;
  assetId?: string;
  mediaKind?: "image" | "video" | "audio";
  pillVariant?: "video-ref" | "video-named";
  active?: boolean;
  compliance?: SeedanceImageComplianceResult;
  mirrorFont?: string;
  onActivate?: () => void;
  /** prompt 镜像层：带隐藏 measure 占位 */
  overlay?: boolean;
  className?: string;
};

/** 与 prompt inline chip 同款的参考 pill（可独立用于预览条 / 悬停浮层） */
export function VideoPromptRefChip({
  token,
  label,
  path,
  assetId,
  mediaKind = "image",
  pillVariant = "video-ref",
  active = false,
  compliance,
  mirrorFont = DEFAULT_MIRROR_FONT,
  onActivate,
  overlay = false,
  className = "",
}: VideoPromptRefChipProps) {
  const hasMedia = Boolean(path || assetId);
  const kind = mediaKind;
  const showCompliance = kind !== "audio" && compliance != null;

  const layout = useMemo(
    () =>
      resolveVideoPromptPillLayout(token, label, mirrorFont, {
        hasBadge: showCompliance,
        hasThumb: hasMedia,
      }),
    [token, label, mirrorFont, showCompliance, hasMedia],
  );

  const density: VideoPromptPillDensity = layout.density;
  const displayLabel = layout.displayLabel;
  const showLabel = density !== "icon";
  const showBadge = showCompliance && layout.showBadge;
  const showThumb = hasMedia;

  const pill = (
    <span
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? -1 : undefined}
      className={`mention-pill mention-pill--with-media mention-pill--${pillVariant} mention-pill--density-${density}${active ? " mention-pill--ref-active" : ""}${onActivate ? " mention-pill--clickable" : ""}${className ? ` ${className}` : ""}`}
      title={onActivate ? `查看参考：${label}` : label}
      onMouseDown={
        onActivate
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onActivate();
            }
          : undefined
      }
    >
      {showThumb && kind !== "audio" ? (
        <span className="mention-pill-thumb" aria-hidden>
          <NodeMediaPreview
            relPath={path}
            assetId={assetId}
            kind={kind === "video" ? "video" : "image"}
            videoControls={false}
            imageClassName="mention-pill-thumb-media"
            videoClassName="mention-pill-thumb-media"
          />
        </span>
      ) : showThumb && kind === "audio" ? (
        <span className="mention-pill-thumb mention-pill-thumb--audio" aria-hidden>
          ♪
        </span>
      ) : null}
      {showLabel ? <span className="mention-pill-label">{displayLabel}</span> : null}
      {showBadge ? <SeedanceComplianceBadge compliance={compliance} variant="pill" /> : null}
    </span>
  );

  if (!overlay) return pill;

  return (
    <span className="mention-token-slot mention-token-slot--media">
      <span className="mention-token-measure" aria-hidden>
        {token}
      </span>
      {pill}
    </span>
  );
}

export function readMentionMirrorFont(el: HTMLElement | null): string {
  if (!el || typeof getComputedStyle === "undefined") return DEFAULT_MIRROR_FONT;
  const cs = getComputedStyle(el);
  return `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
}
