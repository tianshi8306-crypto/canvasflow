/**
 * 在当前操作系统上打包 CanvasFlow 桌面安装包（含内置 FFmpeg），并复制到 release-packages/
 *
 * 用法：
 *   node scripts/package-desktop-release.mjs
 *   node scripts/package-desktop-release.mjs --skip-build   # 仅收集已有 bundle
 *
 * 跨平台说明：
 *   - Windows：本机直接运行（产出 NSIS 安装包）
 *   - macOS：须在 macOS 上运行（产出 DMG 等）
 *   - Linux：须在 Linux 上运行（产出 deb / AppImage 等）
 *   或使用 GitHub Actions：.github/workflows/release.yml（workflow_dispatch）
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const TAURI_CONF = path.join(ROOT, "src-tauri", "tauri.conf.json");
const BUNDLE_ROOT = path.join(ROOT, "src-tauri", "target", "release", "bundle");

function readVersion() {
  const conf = JSON.parse(fs.readFileSync(TAURI_CONF, "utf8"));
  return conf.version ?? "0.0.0";
}

function resolveCmd(cmd) {
  if (process.platform === "win32") {
    if (cmd === "npm") return "npm.cmd";
    if (cmd === "node") return process.execPath;
  }
  return cmd;
}

function run(cmd, args, opts = {}) {
  const resolved = resolveCmd(cmd);
  const useShell = process.platform === "win32" && String(resolved).endsWith(".cmd");
  const r = spawnSync(resolved, args, {
    stdio: "inherit",
    shell: useShell,
    ...opts,
  });
  if (r.error) throw r.error;
  if (typeof r.status === "number" && r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with ${r.status}`);
  }
}

function platformLabel() {
  const p = os.platform();
  if (p === "win32") return "windows-x64";
  if (p === "darwin") return os.arch() === "arm64" ? "macos-aarch64" : "macos-x64";
  if (p === "linux") return "linux-x64";
  return `${p}-${os.arch()}`;
}

function collectBundleFiles() {
  if (!fs.existsSync(BUNDLE_ROOT)) {
    throw new Error(`未找到构建输出目录：${BUNDLE_ROOT}。请先完成 tauri build。`);
  }

  const found = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, name.name);
      if (name.isDirectory()) walk(p);
      else {
        const lower = name.name.toLowerCase();
        if (
          lower.endsWith(".exe") ||
          lower.endsWith(".msi") ||
          lower.endsWith(".dmg") ||
          lower.endsWith(".deb") ||
          lower.endsWith(".rpm") ||
          lower.endsWith(".appimage") ||
          lower.endsWith(".zip") ||
          lower.endsWith(".tar.gz")
        ) {
          found.push(p);
        }
      }
    }
  };
  walk(BUNDLE_ROOT);
  return found;
}

function copyArtifacts(files, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const manifest = [];
  for (const src of files) {
    const base = path.basename(src);
    const dest = path.join(destDir, base);
    fs.copyFileSync(src, dest);
    const stat = fs.statSync(dest);
    manifest.push({
      file: base,
      bytes: stat.size,
      source: path.relative(ROOT, src),
    });
    console.log(`  → ${path.relative(ROOT, dest)} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  }
  fs.writeFileSync(
    path.join(destDir, "MANIFEST.json"),
    JSON.stringify(
      {
        product: "CanvasFlow AI Studio",
        version: readVersion(),
        platform: platformLabel(),
        builtAt: new Date().toISOString(),
        host: { platform: os.platform(), arch: os.arch() },
        artifacts: manifest,
      },
      null,
      2,
    ) + "\n",
  );
}

function main() {
  const args = new Set(process.argv.slice(2));
  const version = readVersion();
  const label = platformLabel();
  const outDir = path.join(ROOT, "release-packages", `v${version}`, label);

  console.log(`\nCanvasFlow AI Studio 本地打包`);
  console.log(`  版本: v${version}`);
  console.log(`  平台: ${label}`);
  console.log(`  输出: ${path.relative(ROOT, outDir)}\n`);

  if (!args.has("--skip-build")) {
    console.log("[1/2] 构建（含 FFmpeg sidecar）…\n");
    run("node", ["scripts/tauri-build-with-ffmpeg.mjs"]);
  } else {
    console.log("[1/2] 跳过构建（--skip-build）\n");
  }

  console.log("\n[2/2] 收集安装包…\n");
  const files = collectBundleFiles();
  if (files.length === 0) {
    throw new Error("bundle 目录下未找到安装包文件。");
  }
  copyArtifacts(files, outDir);

  console.log(`\n✓ 完成。安装包已复制到：\n  ${outDir}\n`);
  console.log(
    "其他平台请在对应系统上运行本脚本，或触发 GitHub Release workflow。\n" +
      "详见 docs/release/DESKTOP_PACKAGING.md\n",
  );
}

main();
