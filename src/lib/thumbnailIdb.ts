// ── IndexedDB 缩略图持久化 ──
// 将缩略图 data URL 转为 Blob 存储在 IndexedDB 中，
// 重启软件后无需重新解码原图/视频即可恢复缩略图。

const DB_NAME = "canvasflow-thumbnails";
const DB_VERSION = 1;
const STORE_NAME = "thumbnails";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 将 data URL 转为 Blob 存入 IndexedDB。
 * key 为原始资源 URL（asset://...）。
 */
export async function storeThumbnail(key: string, dataUrl: string): Promise<void> {
  try {
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB 写入失败不阻塞功能，静默忽略
  }
}

/**
 * 从 IndexedDB 读取缩略图 Blob 并转为 data URL。
 * 未命中返回 null。
 */
export async function loadThumbnail(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return new Promise<string | null>((resolve, _reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const blob = req.result as Blob | undefined;
        if (!blob) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      };
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}
