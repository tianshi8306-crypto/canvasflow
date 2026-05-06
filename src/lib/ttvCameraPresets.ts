import type { CameraPresetId } from "@/lib/videoNodeTypes";

/** 内置运镜预设（与运镜弹层「预设」网格一致） */
export const CAMERA_PRESETS: { id: CameraPresetId; label: string }[] = [
  { id: "fixed", label: "固定镜头" },
  { id: "follow", label: "跟随拍摄" },
  { id: "spiral_up", label: "盘旋抬升" },
  { id: "spiral_down", label: "盘旋下降" },
  { id: "tilt_up", label: "镜头上摇" },
  { id: "tilt_down", label: "镜头下摇" },
  { id: "pan_left", label: "镜头左摇" },
  { id: "pan_right", label: "镜头右摇" },
  { id: "pedestal_up", label: "镜头上升" },
  { id: "pedestal_down", label: "镜头下降" },
  { id: "truck_left", label: "镜头左移" },
  { id: "truck_right", label: "镜头右移" },
];
