import { useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { type Node, type NodeProps } from "@xyflow/react";
import { MagneticNodeAnchors } from "@/components/nodes/MagneticNodeAnchors";
import type { FlowNodeData } from "@/lib/types";
import { NodeFrame } from "@/components/nodes/NodeFrame";
import { useProjectStore } from "@/store/projectStore";
import { fileBasename } from "@/lib/paths";

function MediaImportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20V4a2 2 0 0 1 2-2h2l2 2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M12 10v6M9 13l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MediaImportGlyph() {
  return (
    <div className="mediaImportGlyph" aria-hidden>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 20V4a2 2 0 0 1 2-2h2l2 2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path d="M12 9v8M8 13l4-4 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="nodeEmptyHint">点击选择本地媒体文件</span>
    </div>
  );
}

export function MediaImportNode({ id, data, selected, type }: NodeProps<Node<FlowNodeData>>) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasPath = Boolean(data.path?.trim());
  const fileName = hasPath ? fileBasename(data.path!) : "";

  const handlePick = async () => {
    if (isTauri()) {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "媒体文件",
            extensions: [
              "mp4", "mov", "webm", "avi", "mkv",
              "png", "jpg", "jpeg", "webp", "gif", "bmp",
              "mp3", "wav", "m4a", "flac", "ogg",
            ],
          },
        ],
      });
      if (selected) {
        updateNodeData(id, { path: selected as string });
      }
    } else {
      fileRef.current?.click();
    }
  };

  const onPickFiles = (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    const paths = list.map((f) => (f as File & { path?: string }).path).filter(Boolean) as string[];
    if (paths.length > 0) {
      updateNodeData(id, { path: paths[0] });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <NodeFrame
      defaultTitle="媒体导入"
      label={data.label}
      nodeId={id}
      selected={selected}
      tone="mediaImport"
      icon={<MediaImportIcon />}
      rootClassName="mediaImportCard"
      subtitle={hasPath ? fileName : "未选择本地文件；点击上传"}
    >
      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/*,audio/*"
        className="srOnly"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onPickFiles(e.target.files)}
      />
      <div
        className="mediaImportBody"
        onClick={handlePick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handlePick(); }}
        role="button"
        tabIndex={0}
        aria-label="选择媒体文件"
      >
        {hasPath ? (
          <div className="mediaImportFileInfo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            <span className="mediaImportFileName">{fileName}</span>
          </div>
        ) : (
          <MediaImportGlyph />
        )}
      </div>
      <MagneticNodeAnchors nodeId={id} nodeType={type} />
    </NodeFrame>
  );
}
