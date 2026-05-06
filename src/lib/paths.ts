/** 取路径最后一段文件名（兼容 / 与 \） */
export function fileBasename(path: string | undefined): string {
  if (!path?.trim()) return "";
  const norm = path.replace(/\\/g, "/");
  const seg = norm.split("/").filter(Boolean);
  return seg[seg.length - 1] ?? "";
}

/** 将工程根目录与相对路径拼成绝对路径字符串（Windows 使用 \） */
export function joinProjectRelativePath(projectRoot: string, relativePath: string): string {
  const parts = relativePath
    .replace(/\\/g, "/")
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean);
  const relJoined = parts.join("/");
  const base = projectRoot.replace(/[/\\]+$/, "");
  if (base.includes("\\") || /^[a-zA-Z]:/.test(base)) {
    return `${base}\\${relJoined.replace(/\//g, "\\")}`;
  }
  return `${base}/${relJoined}`;
}
