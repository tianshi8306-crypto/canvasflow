/**
 * 统一图片节点 - Liblib.tv 风格一体化设计
 *
 * 核心设计理念：一个节点完成所有操作
 * - 顶部功能按钮：上传、预览
 * - 图片预览区：核心展示区域
 * - 参数控制区：提示词输入 + 参数工具栏
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import type { FlowNodeData } from "@/lib/types";
import { joinProjectRelativePath } from "@/lib/paths";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { useProjectStore } from "@/store/projectStore";

interface UnifiedImageNodeProps {
  id: string;
  data: FlowNodeData;
  selected?: boolean;
}

function resolveSrc(projectPath: string | null | undefined, relPath: string | undefined): string | null {
  if (!projectPath?.trim() || !relPath?.trim()) return null;
  try {
    const abs = joinProjectRelativePath(projectPath.trim(), relPath.trim());
    return convertFileSrc(abs);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// 图标组件
// ═══════════════════════════════════════════════════════

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════

export function UnifiedImageNode({ id, data }: UnifiedImageNodeProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);

  const fileRef = useRef<HTMLInputElement>(null);

  const hasPath = Boolean(data.path?.trim() || data.assetId?.trim());
  const src = resolveSrc(projectPath, data.path);

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [prompt, setPrompt] = useState(data.prompt ?? "");
  const [model, setModel] = useState("omnigen-v2");
  const [aspect, setAspect] = useState("16:9");
  const [generating] = useState(false);

  // 同步 prompt 到 store
  useEffect(() => {
    if (prompt !== data.prompt) {
      updateNodeData(id, { prompt });
    }
  }, [prompt, id, data.prompt, updateNodeData]);

  // 上传图片
  const handleUpload = useCallback(async () => {
    if (isTauri()) {
      const paths = await pickImagePathsForImport(false);
      if (paths?.length) {
        await assignImportedMediaToNode(id, paths);
      }
    } else {
      fileRef.current?.click();
    }
  }, [id, assignImportedMediaToNode]);

  // Web 环境文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const paths = Array.from(files)
      .map((f) => (f as File & { path?: string }).path)
      .filter(Boolean) as string[];
    if (paths.length) {
      await assignImportedMediaToNode(id, paths);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  // 图片加载完成获取分辨率
  const handleImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  const label = data.label ?? "图片";

  return (
    <div className="image-node-container">
      {/* 左侧输入锚点 */}
      <Handle type="target" position={Position.Left} id="input" className="image-handle-left" />

      {/* 顶部功能栏 */}
      <div className="image-node-header">
        <button className="image-node-btn" onClick={handleUpload} title="上传图片">
          <IconUpload />
          <span>上传</span>
        </button>
        <span className="image-node-title">{label}</span>
        <span className="image-node-resolution">
          {imgSize ? `${imgSize.w}×${imgSize.h}` : ""}
        </span>
      </div>

      {/* 图片预览区 */}
      <div className="image-node-preview" onClick={handleUpload}>
        {hasPath ? (
          <img src={src ?? undefined} alt="" className="image-node-img" onLoad={handleImgLoad} />
        ) : (
          <div className="image-node-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span>上传图片或输入提示词生成</span>
          </div>
        )}
        {/* 预览区有图时显示替换按钮 */}
        {hasPath && (
          <button className="image-node-replace" onClick={(e) => { e.stopPropagation(); handleUpload(); }}>
            <IconUpload />
            <span>替换</span>
          </button>
        )}
      </div>

      {/* 参数控制区 */}
      <div className="image-node-panel">
        {/* 快捷功能栏 */}
        <div className="image-node-toolbar">
          <button className="image-node-tool-btn">风格</button>
          <button className="image-node-tool-btn">标记</button>
        </div>

        {/* 提示词输入 */}
        <textarea
          className="image-node-prompt"
          placeholder="描述你想要生成的内容，使用 @可快速引用上传的文件，按 / 呼出指令"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        {/* 参数工具栏 */}
        <div className="image-node-controls">
          <select
            className="image-node-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="omnigen-v2">OmniGen v2</option>
            <option value="seedream">Seedream 5.0</option>
          </select>

          <select
            className="image-node-select"
            value={aspect}
            onChange={(e) => setAspect(e.target.value)}
          >
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
            <option value="1:1">1:1</option>
            <option value="3:4">3:4</option>
            <option value="9:16">9:16</option>
          </select>

          <button className="image-node-tool-btn">摄像机</button>

          <span className="image-node-meta">1张</span>

          <button className="image-node-generate" disabled={generating || !prompt.trim()}>
            {generating ? "停止" : "↑"}
          </button>
        </div>
      </div>

      {/* 隐藏的文件输入（Web 环境） */}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
        className="srOnly"
        aria-hidden
        tabIndex={-1}
        onChange={handleFileChange}
      />

      {/* 右侧输出锚点 */}
      <Handle type="source" position={Position.Right} id="output" className="image-handle-right" />
    </div>
  );
}