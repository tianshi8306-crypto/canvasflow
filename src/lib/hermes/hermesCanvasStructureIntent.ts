/** 画布结构类指令（建节点等），需走 Director 而非纯聊天 */

export function wantsAddTextNode(text: string): boolean {
  const t = text.trim();
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(t)) return false;
  return (
    /文本节点|text\s*node|文案节点/i.test(t) &&
    /添加|创建|新建|放一个|加一个|在画布|画布上/.test(t)
  );
}

export function hasHermesCanvasStructureIntent(text: string): boolean {
  return wantsAddTextNode(text);
}

/** 从「添加文本节点，内容：…」提取初始文案 */
export function extractTextNodeInitialPrompt(text: string): string | undefined {
  const m = text.match(/(?:内容|写上|填入|文本|写)[:：]\s*([\s\S]+)$/i);
  const body = m?.[1]?.trim();
  return body ? body.slice(0, 2000) : undefined;
}
