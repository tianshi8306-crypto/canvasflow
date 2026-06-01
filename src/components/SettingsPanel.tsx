import "@/styles/settings-panel.css";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { formatUserError } from "@/lib/errors";
import {
  loadSettingsPanelData,
  mergeImportedSettings,
  normalizeLoadedSettings,
  saveSettingsAndKeys,
  toUserMessage,
} from "@/lib/settingsPanelState";
import type {
  AppSettings,
  KeyPreviewItem,
} from "@/lib/settingsPanelTypes";
import { SettingsNav, type SettingsCategory } from "@/components/SettingsNav";
import { SettingsCategoryPane } from "@/components/settings/SettingsCategoryPane";
import { SettingsPageHead } from "@/components/settings/SettingsPageHead";
import { SettingsModelsPane } from "@/components/settings/SettingsModelsPane";
import { SettingsAgentPane } from "@/components/settings/SettingsAgentPane";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import {
  loadHermesAutoChainSettings,
  saveHermesAutoChainSettings,
  type HermesAutoChainSettings,
} from "@/lib/hermes/hermesAutoChainPolicy";
import {
  fetchHermesMemoryPaths,
  formatHermesMemoryMigrationNotice,
  hermesMemoryRootsEqual,
  migrateHermesUserMemory,
  normalizeHermesMemoryRoot,
} from "@/lib/hermes/knowledge/hermesMemoryPaths";
import { useProjectStore } from "@/store/projectStore";
import { SettingsProjectAssetsSection } from "@/components/settings/SettingsProjectAssetsSection";
import { SettingsMaterialLibrarySection } from "@/components/settings/SettingsMaterialLibrarySection";
import { PROJECT_AUTO_SAVE_OPTIONS, normalizeProjectAutoSaveIdleSec } from "@/lib/projectAutoSaveSettings";
import { applyProjectAutoSaveIdleSec } from "@/store/projectSaveDebounce";

export function SettingsPanel(props: {
  open: boolean;
  onClose: () => void;
  initialCategory?: SettingsCategory | null;
  focusSectionId?: string | null;
  openRequestNonce?: number;
}) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [imageModelKeys, setImageModelKeys] = useState<Record<string, string>>({});
  const [videoModelKeys, setVideoModelKeys] = useState<Record<string, string>>({});
  const [audioModelKeys, setAudioModelKeys] = useState<Record<string, string>>({});
  const [hasKey, setHasKey] = useState<Record<string, boolean>>({});
  const [hasImageModelKey, setHasImageModelKey] = useState<Record<string, boolean>>({});
  const [hasVideoModelKey, setHasVideoModelKey] = useState<Record<string, boolean>>({});
  const [hasAudioModelKey, setHasAudioModelKey] = useState<Record<string, boolean>>({});
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyPreviews, setKeyPreviews] = useState<Record<string, KeyPreviewItem>>({});
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
  const [visitedCategories, setVisitedCategories] = useState<Set<SettingsCategory>>(
    () => new Set(["general"]),
  );
  const importFileRef = useRef<HTMLInputElement>(null);
  const loadedHermesMemoryRootRef = useRef<string | null | undefined>(undefined);

  const selectCategory = useCallback((cat: SettingsCategory) => {
    startTransition(() => {
      setActiveCategory(cat);
      setVisitedCategories((prev) => {
        if (prev.has(cat)) return prev;
        const next = new Set(prev);
        next.add(cat);
        return next;
      });
    });
  }, []);

  const [minimapVisible, setMinimapVisible] = useState(false);
  const [nodeSnapAlignmentEnabled, setNodeSnapAlignmentEnabled] = useState(true);
  const [snapGuidesEnabled, setSnapGuidesEnabled] = useState(true);
  const [snapGridEnabled, setSnapGridEnabled] = useState(false);
  const [alignDistributeGap, setAlignDistributeGap] = useState(40);
  const [hermesAutoChain, setHermesAutoChain] = useState<HermesAutoChainSettings>(() =>
    loadHermesAutoChainSettings(),
  );
  const projectPath = useProjectStore((s) => s.projectPath);
  const [hermesMemoryPreview, setHermesMemoryPreview] = useState<string | null>(null);

  useEffect(() => {
    if (activeCategory === "canvas") {
      const ui = useCanvasUiStore.getState();
      setMinimapVisible(ui.minimapVisible);
      setNodeSnapAlignmentEnabled(ui.nodeSnapAlignmentEnabled);
      setSnapGuidesEnabled(ui.snapGuidesEnabled);
      setSnapGridEnabled(ui.snapGridEnabled);
      setAlignDistributeGap(ui.alignDistributeGap);
    }
    if (activeCategory === "agent") {
      setHermesAutoChain(loadHermesAutoChainSettings());
    }
  }, [activeCategory]);

  useEffect(() => {
    if (!props.open || activeCategory !== "agent") return;
    void (async () => {
      const paths = await fetchHermesMemoryPaths(projectPath);
      setHermesMemoryPreview(paths?.userDir ?? null);
    })();
  }, [props.open, activeCategory, projectPath, settings?.hermesMemoryRoot]);

  useEffect(() => {
    if (!props.open) return;
    if (props.initialCategory) {
      selectCategory(props.initialCategory);
    }
  }, [props.open, props.initialCategory, props.openRequestNonce, selectCategory]);

  useEffect(() => {
    if (!props.open) return;
    if (!settings) return;
    if (!props.focusSectionId) return;
    const sectionId = props.focusSectionId;
    const timer = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [props.open, settings, props.focusSectionId, props.openRequestNonce]);

  const patchHermesAutoChain = (patch: Partial<HermesAutoChainSettings>) => {
    const next = { ...hermesAutoChain, ...patch };
    setHermesAutoChain(next);
    saveHermesAutoChainSettings(next);
  };

  useEffect(() => {
    if (!props.open) {
      setActiveCategory("general");
      setVisitedCategories(new Set(["general"]));
      return;
    }
    void (async () => {
      setError(null);
      setNotice(null);
      setSettings(null);
      try {
        const loaded = await loadSettingsPanelData();
        setKeyPreviews(loaded.keyPreviews);
        setSettings(loaded.settings);
        loadedHermesMemoryRootRef.current = normalizeHermesMemoryRoot(
          loaded.settings.hermesMemoryRoot,
        );
        setHasKey(loaded.hasKey);
        setHasImageModelKey(loaded.hasImageModelKey);
        setHasVideoModelKey(loaded.hasVideoModelKey);
        setHasAudioModelKey(loaded.hasAudioModelKey);
        setKeys({});
        setImageModelKeys({});
        setVideoModelKeys({});
        setAudioModelKeys({});
      } catch (e) {
        setError(formatUserError(e));
        setNotice(null);
      }
    })();
  }, [props.open]);

  const exportSettingsJson = () => {
    if (!settings) return;
    try {
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `canvasflow-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`导出失败：${formatUserError(e)}`);
    }
  };

  const importSettingsJson = (file: File | null) => {
    if (!file) return;
    void (async () => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<AppSettings>;
        setSettings((prev) => (prev ? mergeImportedSettings(prev, parsed) : prev));
        setError(null);
      } catch (e) {
        setError(toUserMessage("导入失败", e));
      } finally {
        if (importFileRef.current) importFileRef.current.value = "";
      }
    })();
  };

  const handleSave = async () => {
    if (!settings) return;
    const normalized = normalizeLoadedSettings(settings);
    const previousMemoryRoot =
      loadedHermesMemoryRootRef.current === undefined
        ? normalizeHermesMemoryRoot(settings.hermesMemoryRoot)
        : loadedHermesMemoryRootRef.current;
    const nextMemoryRoot = normalizeHermesMemoryRoot(normalized.hermesMemoryRoot);
    try {
      setError(null);
      setNotice(null);
      const saved = await saveSettingsAndKeys({
        settings: normalized,
        keys,
        imageModelKeys,
        videoModelKeys,
        audioModelKeys,
        keyPreviews,
      });
      setHasKey(saved.hasKey);
      setHasImageModelKey(saved.hasImageModelKey);
      setHasVideoModelKey(saved.hasVideoModelKey);
      setHasAudioModelKey(saved.hasAudioModelKey);
      setKeyPreviews(saved.keyPreviews);
      setKeys({});
      setImageModelKeys({});
      setVideoModelKeys({});
      setAudioModelKeys({});
      setSettings(saved.settings);
      loadedHermesMemoryRootRef.current = nextMemoryRoot;

      let noticeText = saved.notice;
      if (
        projectPath?.trim() &&
        !hermesMemoryRootsEqual(previousMemoryRoot, nextMemoryRoot)
      ) {
        const migration = await migrateHermesUserMemory(
          projectPath,
          previousMemoryRoot,
          nextMemoryRoot,
        );
        const migrationNotice = formatHermesMemoryMigrationNotice(migration);
        if (migrationNotice) {
          noticeText = `${noticeText} ${migrationNotice}`;
        }
        const paths = await fetchHermesMemoryPaths(projectPath);
        setHermesMemoryPreview(paths?.userDir ?? null);
      }

      setNotice(noticeText);
      window.dispatchEvent(new Event("canvasflow-settings-saved"));
    } catch (e) {
      setError(formatUserError(e));
      setNotice(null);
    }
  };

  // 处理 Provider API Key 变化（统一写入 keys state）
  const handleKeysChange = (providerId: string, field: "apiKey" | "modelApiKey", value: string) => {
    const keyId = field === "modelApiKey" ? `${providerId}:model` : providerId;
    setKeys((prev) => ({ ...prev, [keyId]: value }));
  };

  // 处理 Provider 配置变化（更新 settings.providers）
  const handleProviderSettingsChange = (patch: Partial<AppSettings>) => {
    setSettings((prev) => prev ? { ...prev, ...patch } : prev);
  };

  if (!props.open) return null;

  return (
    <div className="settings-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="settings-modal">
        <div className="settingsHeader">
          <div className="settingsTitle">设置</div>
          <div className="settingsHeaderActions">
            <button type="button" className="btn btn--secondary" onClick={() => importFileRef.current?.click()}>
              导入
            </button>
            <button type="button" className="btn btn--secondary" onClick={exportSettingsJson}>
              导出
            </button>
            <button type="button" className="btn btn--icon" onClick={props.onClose} aria-label="关闭">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => importSettingsJson(e.currentTarget.files?.[0] ?? null)}
          />
        </div>

        {settings && (notice || error) ? (
          <div className="settingsAlerts">
            {notice ? <div className="settings-notice">{notice}</div> : null}
            {error ? <div className="settings-error">{error}</div> : null}
          </div>
        ) : null}

        {!settings ? (
          <div className="settingsBody settingsBody--loading">
            {error ? <div className="settings-error">{error}</div> : <div className="settings-loading">正在加载设置…</div>}
          </div>
        ) : (
          <div className="settingsBody">
            <SettingsNav activeCategory={activeCategory} onSelect={selectCategory} />

            <div className="settingsContent">
              <SettingsCategoryPane
                category="general"
                activeCategory={activeCategory}
                visited={visitedCategories}
              >
                <SettingsPageHead
                  title="常规"
                  description="系统路径、工程保存与工作流行为。"
                />
                <div className="settingsSection">
                  <div className="settingsSectionTitle">媒体引擎</div>

                  <div className="settingsField">
                    <label className="settingsFieldLabel" htmlFor="settingsFfmpegPath">
                      FFmpeg 路径
                    </label>
                    <span className="settingsFieldHint">留空则使用系统 PATH 中的 ffmpeg</span>
                    <input
                      id="settingsFfmpegPath"
                      className="settingsInput mono"
                      value={settings.ffmpegPath ?? ""}
                      onChange={(e) => setSettings({ ...settings, ffmpegPath: e.target.value || null })}
                      placeholder="ffmpeg"
                    />
                  </div>
                </div>

                <div className="settingsSection">
                  <div className="settingsSectionTitle">工程保存</div>
                  <div className="settingsField">
                    <label className="settingsFieldLabel" htmlFor="projectAutoSaveIdleSec">
                      画布自动保存
                    </label>
                    <span className="settingsFieldHint">
                      在已有工程路径下，画布有改动且你<strong>停止编辑</strong>达到所选时长后，在<strong>后台</strong>写入
                      canvasflow.json（不阻塞拖拽与输入）。关闭后请用 Ctrl+S 或菜单保存。
                    </span>
                    <select
                      id="projectAutoSaveIdleSec"
                      className="settingsInput"
                      value={settings.projectAutoSaveIdleSec ?? 2}
                      onChange={(e) => {
                        const idleSec = normalizeProjectAutoSaveIdleSec(Number(e.target.value));
                        applyProjectAutoSaveIdleSec(idleSec);
                        setSettings({
                          ...settings,
                          projectAutoSaveIdleSec: idleSec,
                        });
                      }}
                    >
                      {PROJECT_AUTO_SAVE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <span className="settingsFieldHint">
                      {
                        PROJECT_AUTO_SAVE_OPTIONS.find(
                          (o) => o.value === (settings.projectAutoSaveIdleSec ?? 2),
                        )?.hint
                      }
                    </span>
                  </div>
                </div>

                <SettingsProjectAssetsSection />
                <SettingsMaterialLibrarySection />

                <div className="settingsSection">
                  <div className="settingsSectionTitle">工作流</div>
                  <div className="settingsField">
                    <div className="settingsToggle">
                      <input
                        type="checkbox"
                        id="abortWorkflow"
                        checked={settings.abortWorkflowOnFailure}
                        onChange={(e) => setSettings({ ...settings, abortWorkflowOnFailure: e.target.checked })}
                      />
                      <label htmlFor="abortWorkflow" className="settingsToggleLabel">
                        <span className="settingsToggleSwitch" />
                        <span className="settingsToggleText">节点失败时中止整张工作流</span>
                      </label>
                    </div>
                    <span className="settingsFieldHint">关闭时：失败节点标记为跳过，下游继续执行</span>
                  </div>
                </div>
              </SettingsCategoryPane>

              <SettingsCategoryPane
                category="models"
                activeCategory={activeCategory}
                visited={visitedCategories}
              >
                <SettingsModelsPane
                  settings={settings}
                  setSettings={setSettings}
                  keys={keys}
                  setKeys={setKeys}
                  hasKey={hasKey}
                  imageModelKeys={imageModelKeys}
                  setImageModelKeys={setImageModelKeys}
                  hasImageModelKey={hasImageModelKey}
                  videoModelKeys={videoModelKeys}
                  setVideoModelKeys={setVideoModelKeys}
                  hasVideoModelKey={hasVideoModelKey}
                  audioModelKeys={audioModelKeys}
                  setAudioModelKeys={setAudioModelKeys}
                  hasAudioModelKey={hasAudioModelKey}
                  testingModelId={testingModelId}
                  setTestingModelId={setTestingModelId}
                  onProviderSettingsChange={handleProviderSettingsChange}
                  onKeysChange={handleKeysChange}
                  setError={setError}
                  setNotice={setNotice}
                />
              </SettingsCategoryPane>

              <SettingsCategoryPane
                category="agent"
                activeCategory={activeCategory}
                visited={visitedCategories}
              >
                <SettingsAgentPane
                  settings={settings}
                  setSettings={setSettings}
                  projectPath={projectPath}
                  hermesAutoChain={hermesAutoChain}
                  onPatchHermesAutoChain={patchHermesAutoChain}
                  hermesMemoryPreview={hermesMemoryPreview}
                />
              </SettingsCategoryPane>

              <SettingsCategoryPane
                category="canvas"
                activeCategory={activeCategory}
                visited={visitedCategories}
              >
                <SettingsPageHead
                  title="画布"
                  description="控制无限画布的视图、吸附与排列间距。"
                />
                <div className="settingsSection">
                  <div className="settingsSectionTitle">视图与吸附</div>

                  <div className="settingsField">
                    <div className="settingsToggle">
                      <input
                        type="checkbox"
                        id="toggleMinimap"
                        checked={minimapVisible}
                        onChange={(e) => {
                          setMinimapVisible(e.target.checked);
                          useCanvasUiStore.getState().setMinimapVisible(e.target.checked);
                        }}
                      />
                      <label htmlFor="toggleMinimap" className="settingsToggleLabel">
                        <span className="settingsToggleSwitch" />
                        <span className="settingsToggleText">显示小地图</span>
                      </label>
                    </div>
                  </div>

                  <div className="settingsField">
                    <div className="settingsToggle">
                      <input
                        type="checkbox"
                        id="toggleSnap"
                        checked={nodeSnapAlignmentEnabled}
                        onChange={(e) => {
                          setNodeSnapAlignmentEnabled(e.target.checked);
                          useCanvasUiStore.getState().setNodeSnapAlignmentEnabled(e.target.checked);
                        }}
                      />
                      <label htmlFor="toggleSnap" className="settingsToggleLabel">
                        <span className="settingsToggleSwitch" />
                        <span className="settingsToggleText">启用节点对齐吸附</span>
                      </label>
                    </div>
                  </div>

                  <div className="settingsField">
                    <div className="settingsToggle">
                      <input
                        type="checkbox"
                        id="toggleSnapGuides"
                        checked={snapGuidesEnabled}
                        onChange={(e) => {
                          setSnapGuidesEnabled(e.target.checked);
                          useCanvasUiStore.getState().setSnapGuidesEnabled(e.target.checked);
                        }}
                      />
                      <label htmlFor="toggleSnapGuides" className="settingsToggleLabel">
                        <span className="settingsToggleSwitch" />
                        <span className="settingsToggleText">显示对齐辅助线</span>
                      </label>
                    </div>
                  </div>

                  <div className="settingsField">
                    <div className="settingsToggle">
                      <input
                        type="checkbox"
                        id="toggleSnapGrid"
                        checked={snapGridEnabled}
                        onChange={(e) => {
                          setSnapGridEnabled(e.target.checked);
                          useCanvasUiStore.getState().setSnapGridEnabled(e.target.checked);
                        }}
                      />
                      <label htmlFor="toggleSnapGrid" className="settingsToggleLabel">
                        <span className="settingsToggleSwitch" />
                        <span className="settingsToggleText">拖拽结束时吸附网格（步长同排列间距）</span>
                      </label>
                    </div>
                  </div>

                  <div className="settingsField">
                    <label className="settingsFieldLabel" htmlFor="alignDistributeGap">
                      排列/分布间距
                    </label>
                    <select
                      id="alignDistributeGap"
                      className="settingsInput"
                      value={alignDistributeGap}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setAlignDistributeGap(v);
                        useCanvasUiStore.getState().setAlignDistributeGap(v);
                      }}
                    >
                      <option value={24}>24 px</option>
                      <option value={40}>40 px</option>
                      <option value={80}>80 px</option>
                    </select>
                  </div>
                </div>
              </SettingsCategoryPane>

              <SettingsCategoryPane
                category="about"
                activeCategory={activeCategory}
                visited={visitedCategories}
              >
                <SettingsPageHead title="关于" description="应用信息与问题排查。" />
                <div className="settingsSection">
                  <div className="settingsAbout">
                    <div className="settingsAboutLogo">CanvasFlow AI Studio</div>
                    <div className="settingsAboutVersion">版本 1.0.0</div>
                    <div className="settingsAboutDesc">面向视频创作流程的节点化 AI 工作台</div>
                  </div>

                  <div className="settingsDivider" role="separator" />

                  <div className="settingsSectionTitle">诊断</div>
                  <div className="settingsDiagnostics">
                    <p className="settingsDiagnosticsHint">
                      导出 JSON 诊断包，包含版本、运行环境与时间戳，便于反馈问题时附带。
                    </p>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => {
                        const info = {
                          version: "1.0.0",
                          timestamp: new Date().toISOString(),
                          userAgent: navigator.userAgent,
                          platform: navigator.platform,
                        };
                        const blob = new Blob([JSON.stringify(info, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `canvasflow-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      导出诊断信息
                    </button>
                  </div>
                </div>
              </SettingsCategoryPane>
            </div>
          </div>
        )}

        {settings && (
          <div className="settingsFooter">
            <button type="button" className="btn btn--secondary" onClick={props.onClose}>
              取消
            </button>
            <button type="button" className="btn btnPrimary" onClick={() => void handleSave()}>
              保存更改
            </button>
          </div>
        )}
      </div>
    </div>
  );
}