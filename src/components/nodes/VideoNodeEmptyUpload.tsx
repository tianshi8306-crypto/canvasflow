import { useVideoNodeUpload } from "@/hooks/useVideoNodeUpload";

type Props = {
  nodeId: string;
};

/** 无视频态：节点上方居中上传 */
export function VideoNodeEmptyUpload({ nodeId }: Props) {
  const { uploadVideo } = useVideoNodeUpload(nodeId);

  return (
    <button
      type="button"
      className="nodeChrome-upload-float minimal-image-upload-float"
      title="上传视频"
      onClick={() => void uploadVideo()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      上传
    </button>
  );
}
