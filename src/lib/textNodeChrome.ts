/** 文本节点 Chrome 尺寸（对齐图片节点 500px 面板宽与壳层比例） */
export const TEXT_NODE_CHROME_WIDTH = 500;
export const TEXT_NODE_CHROME_HEIGHT_EMPTY = 220;
export const TEXT_NODE_CHROME_HEIGHT_BODY = 300;
export const TEXT_NODE_CHROME_HEIGHT_WRITE_SELF = 260;

export function computeTextNodeFrameSize(opts: {
  hasBody: boolean;
  writeSelfEmpty: boolean;
}): { width: number; height: number } {
  const width = TEXT_NODE_CHROME_WIDTH;
  let height = TEXT_NODE_CHROME_HEIGHT_EMPTY;
  if (opts.hasBody) height = TEXT_NODE_CHROME_HEIGHT_BODY;
  else if (opts.writeSelfEmpty) height = TEXT_NODE_CHROME_HEIGHT_WRITE_SELF;
  return { width, height };
}
