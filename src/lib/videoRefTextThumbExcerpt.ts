/** 参考条文字节点：缩略图内微缩正文 + 悬停预览共用裁剪 */
export function videoRefTextThumbExcerpt(raw: string | undefined, maxLen = 420): string {
  const t = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!t) return "";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}
