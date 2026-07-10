/** 脚本节点 Chrome 壳尺寸：与视频/图片节点默认预览壳一致（固定，不随镜头数或画幅变化） */



import { computeCanvasMediaNodeFrameSize } from "@/lib/canvasMediaNodeFrame";



/** 与视频节点默认 16:9 预览壳对齐（500×281） */

const SCRIPT_NODE_PREVIEW_FRAME = computeCanvasMediaNodeFrameSize(16 / 9);



export const SCRIPT_NODE_SHELL_WIDTH = SCRIPT_NODE_PREVIEW_FRAME.width;

export const SCRIPT_NODE_SHELL_HEIGHT = SCRIPT_NODE_PREVIEW_FRAME.height;



/**

 * 脚本表为纯文字列表，横竖屏内容相同；外壳尺寸固定，表体在壳内滚动。

 * `hasBeats` / `beatCount` 保留入参以兼容现有调用方，不影响尺寸。

 */

export function computeScriptNodeFrameSize(

  _hasBeats?: boolean,

  _beatCount?: number,

): { width: number; height: number } {

  void _hasBeats;

  void _beatCount;

  return { width: SCRIPT_NODE_SHELL_WIDTH, height: SCRIPT_NODE_SHELL_HEIGHT };

}

