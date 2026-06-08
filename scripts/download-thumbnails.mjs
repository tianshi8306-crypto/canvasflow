/**
 * 下载 Seedance 示例视频并提取封面缩略图
 * 用法：node scripts/download-thumbnails.mjs
 */
import { execSync } from "child_process";
import { createWriteStream, existsSync } from "fs";
import { mkdir } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const THUMBS_DIR = resolve(ROOT, "public", "style-thumbnails");

// ffmpeg 路径（Windows 优先用项目内置的）
const FFMPEG =
  process.platform === "win32"
    ? resolve(ROOT, "src-tauri", "bin", "ffmpeg.exe")
    : "ffmpeg";

// GitHub Releases 中的 5 个视频
const VIDEO_IDS = ["1402", "594", "288", "189", "1403"];
const BASE = "https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts/releases/download/videos";

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "Node.js" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // 跟随重定向
          file.close();
          downloadFile(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            process.stdout.write(`\r  下载中... ${Math.round((downloaded / total) * 100)}%`);
          }
        });
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          process.stdout.write("\r  完成 ✅\n");
          resolve();
        });
        file.on("error", (err) => {
          file.close();
          reject(err);
        });
      })
      .on("error", reject);
  });
}

async function main() {
  await mkdir(THUMBS_DIR, { recursive: true });

  for (const id of VIDEO_IDS) {
    const videoPath = resolve(THUMBS_DIR, `${id}.mp4`);
    const posterPath = resolve(THUMBS_DIR, `${id}.jpg`);
    const url = `${BASE}/${id}.mp4`;

    console.log(`[${id}] 开始处理...`);

    // 1. 下载视频（如果还没下载）
    if (!existsSync(videoPath)) {
      console.log(`[${id}] 下载视频: ${url}`);
      try {
        await downloadFile(url, videoPath);
      } catch (e) {
        console.error(`[${id}] 下载失败: ${e.message}`);
        continue;
      }
    } else {
      console.log(`[${id}] 视频已存在，跳过下载`);
    }

    // 2. 用 ffmpeg 提取第一帧作为封面（320px 宽度，自动等比缩放）
    if (!existsSync(posterPath)) {
      console.log(`[${id}] 提取封面帧...`);
      try {
        execSync(
          `"${FFMPEG}" -y -i "${videoPath}" -vframes 1 -vf "scale=320:-1" -q:v 3 "${posterPath}"`,
          { stdio: "pipe", timeout: 30000 }
        );
        console.log(`[${id}] 封面提取完成: ${posterPath}`);
      } catch (e) {
        console.error(`[${id}] ffmpeg 失败: ${e.message}`);
      }
    } else {
      console.log(`[${id}] 封面已存在，跳过`);
    }
  }

  console.log("\n全部完成！");
}

main().catch(console.error);
