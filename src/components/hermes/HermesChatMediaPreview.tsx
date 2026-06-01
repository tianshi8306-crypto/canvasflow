import { useCallback, useState } from "react";
import {
  hermesChatMediaPreviewLabel,
  type HermesChatMediaPreview as Preview,
} from "@/lib/hermes/hermesChatMediaPreview";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  preview: Preview;
};

export function HermesChatMediaPreview({ preview }: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const setSelectedNodeIds = useProjectStore((s) => s.setSelectedNodeIds);
  const [open, setOpen] = useState(true);
  const src = resolveProjectAssetSrc(projectPath, preview.assetRelPath);
  const label = hermesChatMediaPreviewLabel(preview);

  const focusNode = useCallback(() => {
    if (!preview.nodeId) return;
    setSelectedNodeIds([preview.nodeId]);
  }, [preview.nodeId, setSelectedNodeIds]);

  if (!src) return null;

  return (
    <details
      className="hermesChatMediaPreview"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="hermesChatMediaPreviewSummary">{label}</summary>
      <div className="hermesChatMediaPreviewBody">
        {preview.kind === "video" ? (
          <video className="hermesChatMediaPreviewMedia" src={src} controls preload="metadata" />
        ) : preview.kind === "audio" ? (
          <audio className="hermesChatMediaPreviewAudio" src={src} controls preload="metadata" />
        ) : (
          <img className="hermesChatMediaPreviewMedia" src={src} alt={label} loading="lazy" />
        )}
        {preview.nodeId ? (
          <button type="button" className="hermesChatMediaPreviewAction" onClick={focusNode}>
            在画布查看
          </button>
        ) : null}
      </div>
    </details>
  );
}
