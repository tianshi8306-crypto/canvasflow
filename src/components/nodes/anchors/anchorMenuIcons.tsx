import type { ReactNode } from "react";
import type { AnchorMenuRow } from "@/lib/nodeAnchorMenus";

export function defaultAnchorMenuIcon(row: AnchorMenuRow): ReactNode {
  const k = row.key;
  if (k === "videoFirstLastSetup" || k === "audioTts" || k === "videoFirstFrameSetup") {
    return (
      <span className="nodeAnchorMenuIcon nodeAnchorMenuIcon--sm" aria-hidden>
        ⚙
      </span>
    );
  }
  if (k === "imageI2iImport") {
    return (
      <span className="nodeAnchorMenuIcon mono" aria-hidden>
        参
      </span>
    );
  }
  return (
    <span className="nodeAnchorMenuIcon mono" aria-hidden>
      {k === "textNode" && "文"}
      {k === "imageNode" && "图"}
      {k === "videoNode" && "视"}
      {k === "ffmpegConcat" && "剪"}
      {k === "audioNode" && "音"}
      {k === "scriptNode" && "剧"}
    </span>
  );
}

export function simpleAnchorMenuIcon(row: AnchorMenuRow): ReactNode {
  return (
    <span className="nodeAnchorMenuIcon mono" aria-hidden>
      {row.key === "textNode" && "文"}
      {row.key === "imageNode" && "图"}
      {row.key === "videoNode" && "视"}
    </span>
  );
}
