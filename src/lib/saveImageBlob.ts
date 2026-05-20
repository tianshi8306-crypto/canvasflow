import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        reject(new Error("读取截图数据失败"));
        return;
      }
      const comma = dataUrl.indexOf(",");
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error ?? new Error("读取截图数据失败"));
    reader.readAsDataURL(blob);
  });
}

/** Tauri：先弹出系统另存为（可选路径/文件名），返回 null 表示取消 */
export async function promptSaveImagePath(defaultName: string): Promise<string | null> {
  if (!isTauri()) return null;
  const path = await save({
    title: "保存截图",
    defaultPath: defaultName,
    filters: [{ name: "PNG 图片", extensions: ["png"] }],
  });
  return path ?? null;
}

export async function writeBlobToPath(blob: Blob, path: string): Promise<void> {
  const dataBase64 = await blobToBase64(blob);
  await invoke("write_file_base64", { path, dataBase64 });
}

/** 浏览器：触发下载；Tauri 请先用 promptSaveImagePath + writeBlobToPath */
export async function saveImageBlobAs(blob: Blob, defaultName: string): Promise<boolean> {
  if (isTauri()) {
    const path = await promptSaveImagePath(defaultName);
    if (!path) return false;
    await writeBlobToPath(blob, path);
    return true;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
