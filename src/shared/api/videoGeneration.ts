/** 视频生成：与 `src/lib/videoGeneration` 对齐，供 UI 与后续服务层统一 import */
export {
  startVideoGenerationViaBridge,
  getVideoJobViaBridge,
  cancelVideoJobViaBridge,
  getVideoGenerationClient,
  setVideoGenerationClient,
} from "@/lib/videoGeneration";
