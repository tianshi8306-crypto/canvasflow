/**
 * BgmSelector —— BGM 素材库选择器
 *
 * 按情绪/用途分类浏览预设曲目，也可上传自定义音频作为 BGM，
 * 预览后配置混音参数（音量、淡入淡出、循环等）。
 */
import { useCallback, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { pickAudioPathsForImport } from "@/lib/tauriMediaPaths";
import { resolveProjectAudioPlaybackSrc } from "@/lib/projectAudioPreview";
import {
  BGM_CATEGORIES,
  BGM_PRESETS,
  getPresetsByCategory,
  searchPresetsByTag,
  type BgmCategory,
} from "@/lib/bgm/bgmLibrary";
import {
  computeBgmLoopLayout,
  DEFAULT_BGM_ALIGN,
} from "@/lib/bgm/audioAlign";
import type { BgmAlignSettings } from "@/lib/bgm/audioAlign";

export type { BgmAlignSettings };
import { useProjectStore } from "@/store/projectStore";
import "./BgmSelector.css";

const PARAM_BGM_PRESET_ID = "bgmPresetId";
const PARAM_BGM_REL_PATH = "bgmRelPath";
const PARAM_BGM_SETTINGS = "bgmSettings";

type Props = {
  nodeId: string;
  /** 视频总时长（秒），用于计算循环布局 */
  videoDurationSec: number;
  /** 从节点 params 读取的已保存预设 id */
  selectedPresetId?: string;
  /** 用户自定义上传的 BGM 相对路径 */
  customBgmRelPath?: string;
  /** 对轨参数 */
  settings: BgmAlignSettings;
  /** 状态变更 */
  onPresetChange: (presetId: string | undefined) => void;
  onCustomBgmChange: (relPath: string | undefined) => void;
  onSettingsChange: (next: BgmAlignSettings) => void;
  /** 是否折叠显示 */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function BgmSelector({
  nodeId,
  videoDurationSec,
  selectedPresetId,
  customBgmRelPath,
  settings,
  onPresetChange,
  onCustomBgmChange,
  onSettingsChange,
  collapsed: collapsedProp,
  onToggleCollapsed,
}: Props) {
  const [collapsed, setCollapsed] = useState(collapsedProp ?? true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<BgmCategory | "all">("all");
  const [uploading, setUploading] = useState(false);
  const [bgmLoading, setBgmLoading] = useState(false);
  const projectPath = useProjectStore((s) => s.projectPath);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);
  const audioRef = useRef<HTMLAudioElement>(null);
  const queryClient = useQueryClient();
  const [previewSrc, setPreviewSrc] = useState<string>("");

  const handleToggle = () => {
    if (onToggleCollapsed) {
      onToggleCollapsed();
    } else {
      setCollapsed((v) => !v);
    }
  };

  const resolvedCollapsed = onToggleCollapsed ? collapsedProp ?? true : collapsed;

  // 过滤显示的预设
  const filteredPresets =
    search.trim()
      ? searchPresetsByTag(search.trim())
      : activeCategory === "all"
        ? BGM_PRESETS
        : getPresetsByCategory(activeCategory);

  // 计算 BGM 循环布局
  const getBgmDurationForPreview = (): number => {
    if (audioRef.current?.duration && Number.isFinite(audioRef.current.duration)) {
      return audioRef.current.duration;
    }
    return 60; // 默认 60 秒
  };

  const layout = customBgmRelPath
    ? computeBgmLoopLayout(videoDurationSec, getBgmDurationForPreview(), settings)
    : null;

  const handleUploadBgm = useCallback(async () => {
    if (!projectPath || !isTauri()) return;
    setUploading(true);
    try {
      const paths = await pickAudioPathsForImport(false);
      if (!paths || paths.length === 0) return;
      await assignImportedMediaToNode(nodeId, paths);
      void queryClient.invalidateQueries({ queryKey: ["project", "assets"] });
      // 从 store 读取刚导入的音频路径
      const node = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
      const relPath = node?.data?.path;
      if (relPath) {
        onCustomBgmChange(relPath);
      }
    } catch (e) {
      console.error("BGM 上传失败", e);
    } finally {
      setUploading(false);
    }
  }, [projectPath, assignImportedMediaToNode, nodeId, onCustomBgmChange, queryClient]);

  const handlePreview = useCallback(
    async (relPath: string) => {
      if (!projectPath) return;
      setBgmLoading(true);
      try {
        const url = await resolveProjectAudioPlaybackSrc(projectPath, relPath);
        if (url) {
          setPreviewSrc(url);
          requestAnimationFrame(() => {
            const a = audioRef.current;
            if (a) {
              a.src = url;
              void a.play();
            }
          });
        }
      } catch {
        setPreviewSrc("");
      } finally {
        setBgmLoading(false);
      }
    },
    [projectPath],
  );

  const handleClearBgm = useCallback(() => {
    onPresetChange(undefined);
    onCustomBgmChange(undefined);
    setPreviewSrc("");
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [onPresetChange, onCustomBgmChange]);

  const updateSetting = <K extends keyof BgmAlignSettings>(
    key: K,
    value: BgmAlignSettings[K],
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="bgmSelector" role="region" aria-label="BGM 选择">
      <button
        type="button"
        className={`bgmSelector__header${!resolvedCollapsed ? " bgmSelector__header--open" : ""}`}
        onClick={handleToggle}
        aria-expanded={!resolvedCollapsed}
      >
        <span className="bgmSelector__title">背景音乐</span>
        <span className="bgmSelector__chevron">{resolvedCollapsed ? "▸" : "▾"}</span>
      </button>

      {!resolvedCollapsed && (
        <div className="bgmSelector__body">
          {/* 搜索框 */}
          <div className="bgmSelector__searchWrap">
            <input
              type="text"
              className="bgmSelector__search"
              placeholder="搜索风格/标签…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value.trim()) setActiveCategory("all");
              }}
            />
          </div>

          {/* 分类标签 */}
          {!search.trim() && (
            <div className="bgmSelector__categories">
              <button
                type="button"
                className={`bgmSelector__cat${activeCategory === "all" ? " bgmSelector__cat--active" : ""}`}
                onClick={() => setActiveCategory("all")}
              >
                全部
              </button>
              {BGM_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`bgmSelector__cat${activeCategory === cat.id ? " bgmSelector__cat--active" : ""}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* 预设列表 */}
          <div className="bgmSelector__list">
            {filteredPresets.map((preset) => (
              <div
                key={preset.id}
                className={`bgmSelector__preset${selectedPresetId === preset.id ? " bgmSelector__preset--selected" : ""}`}
              >
                <div className="bgmSelector__presetMain">
                  <div className="bgmSelector__presetInfo">
                    <span className="bgmSelector__presetName">{preset.name}</span>
                    <span className="bgmSelector__presetDesc">{preset.description}</span>
                    {preset.bpmHint ? (
                      <span className="bgmSelector__presetBpm">
                        {preset.bpmHint[0]}–{preset.bpmHint[1]} BPM
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={`bgmSelector__pickBtn${selectedPresetId === preset.id ? " bgmSelector__pickBtn--active" : ""}`}
                    onClick={() => {
                      onPresetChange(selectedPresetId === preset.id ? undefined : preset.id);
                      onCustomBgmChange(undefined);
                    }}
                  >
                    {selectedPresetId === preset.id ? "已选" : "选择"}
                  </button>
                </div>
                <div className="bgmSelector__presetTags">
                  {preset.tags.map((tag) => (
                    <span key={tag} className="bgmSelector__tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 自定义上传区 */}
          <div className="bgmSelector__custom">
            <div className="bgmSelector__customLabel">自定义音频</div>
            <button
              type="button"
              className="bgmSelector__uploadBtn"
              onClick={handleUploadBgm}
              disabled={uploading}
            >
              {uploading ? "导入中…" : customBgmRelPath ? "更换音频" : "选择本地音频"}
            </button>
            {customBgmRelPath ? (
              <div className="bgmSelector__customInfo">
                <span className="bgmSelector__customPath" title={customBgmRelPath}>
                  {customBgmRelPath.split(/[/\\]/).pop()}
                </span>
                <button
                  type="button"
                  className="bgmSelector__previewBtn"
                  onClick={() => handlePreview(customBgmRelPath)}
                  disabled={bgmLoading}
                >
                  {bgmLoading ? "…" : "试听"}
                </button>
                <button
                  type="button"
                  className="bgmSelector__clearBtn"
                  onClick={() => {
                    onCustomBgmChange(undefined);
                    setPreviewSrc("");
                  }}
                >
                  移除
                </button>
              </div>
            ) : null}
          </div>

          {/* 循环布局信息 */}
          {layout && customBgmRelPath && (
            <div className="bgmSelector__layoutInfo">
              <span>
                BGM {layout.bgmDurationSec.toFixed(1)}s × {layout.loopCount}
                {layout.loopCount > 1 ? " 次" : " 次（无需循环）"}
              </span>
              <span>视频 {layout.videoDurationSec.toFixed(1)}s</span>
              <span>淡出 {settings.fadeOutSec}s</span>
            </div>
          )}

          {/* 混音参数 */}
          <div className="bgmSelector__settings">
            <div className="bgmSelector__settingsLabel">混音参数</div>

            <label className="bgmSelector__field">
              <span>BGM 音量</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.bgmVolume}
                onChange={(e) => updateSetting("bgmVolume", parseFloat(e.target.value))}
              />
              <span className="bgmSelector__fieldVal">
                {Math.round(settings.bgmVolume * 100)}%
              </span>
            </label>

            <label className="bgmSelector__field">
              <span>原声音量</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.keepOriginalAudio ? settings.originalVolume : 0}
                disabled={!settings.keepOriginalAudio}
                onChange={(e) => updateSetting("originalVolume", parseFloat(e.target.value))}
              />
              <span className="bgmSelector__fieldVal">
                {settings.keepOriginalAudio ? `${Math.round(settings.originalVolume * 100)}%` : "关闭"}
              </span>
            </label>

            <label className="bgmSelector__check">
              <input
                type="checkbox"
                checked={settings.keepOriginalAudio}
                onChange={(e) => updateSetting("keepOriginalAudio", e.target.checked)}
              />
              <span>保留视频原声</span>
            </label>

            <label className="bgmSelector__check">
              <input
                type="checkbox"
                checked={settings.loopToFit}
                onChange={(e) => updateSetting("loopToFit", e.target.checked)}
              />
              <span>BGM 短于视频时自动循环</span>
            </label>

            <label className="bgmSelector__field">
              <span>淡入</span>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={settings.fadeInSec}
                onChange={(e) => updateSetting("fadeInSec", parseFloat(e.target.value))}
              />
              <span className="bgmSelector__fieldVal">{settings.fadeInSec}s</span>
            </label>

            <label className="bgmSelector__field">
              <span>淡出</span>
              <input
                type="range"
                min="0"
                max="8"
                step="0.5"
                value={settings.fadeOutSec}
                onChange={(e) => updateSetting("fadeOutSec", parseFloat(e.target.value))}
              />
              <span className="bgmSelector__fieldVal">{settings.fadeOutSec}s</span>
            </label>
          </div>

          {/* 清除按钮 */}
          {(selectedPresetId || customBgmRelPath) && (
            <button
              type="button"
              className="bgmSelector__clearAll"
              onClick={handleClearBgm}
            >
              清除 BGM
            </button>
          )}
        </div>
      )}

      {/* 隐藏的音频预览元素 */}
      <audio ref={audioRef} src={previewSrc} preload="metadata" style={{ display: "none" }} />
    </div>
  );
}

/** 从节点 params 读取 BGM 参数的工具函数 */
export function readBgmParams(params: Record<string, unknown> | undefined): {
  presetId?: string;
  relPath?: string;
  settings: BgmAlignSettings;
} {
  return {
    presetId: typeof params?.[PARAM_BGM_PRESET_ID] === "string" ? (params[PARAM_BGM_PRESET_ID] as string) : undefined,
    relPath: typeof params?.[PARAM_BGM_REL_PATH] === "string" ? (params[PARAM_BGM_REL_PATH] as string) : undefined,
    settings:
      params?.[PARAM_BGM_SETTINGS] && typeof params[PARAM_BGM_SETTINGS] === "object"
        ? { ...DEFAULT_BGM_ALIGN, ...(params[PARAM_BGM_SETTINGS] as Partial<BgmAlignSettings>) }
        : { ...DEFAULT_BGM_ALIGN },
  };
}
