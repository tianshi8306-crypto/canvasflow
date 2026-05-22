import "@/styles/settings-panel.css";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { formatUserError } from "@/lib/errors";
import {
  loadSettingsPanelData,
  mergeImportedSettings,
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
import { SettingsModelsSection } from "@/components/SettingsModelsSection";
import { SettingsTextProvidersSection } from "@/components/SettingsTextProvidersSection";
import { SettingsImageModelsSection } from "@/components/SettingsImageModelsSection";
import { SettingsVideoModelsSection } from "@/components/SettingsVideoModelsSection";
import { SettingsAudioModelsSection } from "@/components/SettingsAudioModelsSection";
import {
  SETTINGS_IMAGE_CUSTOM_MODEL_NAME,
  SETTINGS_IMAGE_CUSTOM_MODEL_VARIANT,
} from "@/lib/settingsModelConstants";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import {
  loadHermesAutoChainSettings,
  saveHermesAutoChainSettings,
  clampHermesPackImageCount,
  HERMES_PACK_IMAGE_COUNT_MAX,
  HERMES_PACK_IMAGE_COUNT_MIN,
  type HermesAutoChainSettings,
  type HermesBatchSplitStrategy,
  type HermesGlobalScope,
} from "@/lib/hermes/hermesAutoChainPolicy";

export function SettingsPanel(props: { open: boolean; onClose: () => void }) {
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

  useEffect(() => {
    if (activeCategory === "canvas") {
      const ui = useCanvasUiStore.getState();
      setMinimapVisible(ui.minimapVisible);
      setNodeSnapAlignmentEnabled(ui.nodeSnapAlignmentEnabled);
      setSnapGuidesEnabled(ui.snapGuidesEnabled);
      setSnapGridEnabled(ui.snapGridEnabled);
      setAlignDistributeGap(ui.alignDistributeGap);
    }
    if (activeCategory === "general") {
      setHermesAutoChain(loadHermesAutoChainSettings());
    }
  }, [activeCategory]);

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
    try {
      setError(null);
      setNotice(null);
      const saved = await saveSettingsAndKeys({
        settings,
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
      setNotice(saved.notice);
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
                  description="系统路径、工作流行为与分镜自动化偏好。"
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

                <div className="settingsSection">
                  <div className="settingsSectionTitle">分镜自动建链</div>
                  <div className="settingsField">
                    <span className="settingsFieldHint">
                      分镜文案就绪后，按策略自动创建图片与视频节点（不含脚本解析阶段）。
                    </span>
                    <div className="settingsToggle">
                      <input
                        type="checkbox"
                        id="hermesAutoChainEnabled"
                        checked={hermesAutoChain.enabled}
                        onChange={(e) => patchHermesAutoChain({ enabled: e.target.checked })}
                      />
                      <label htmlFor="hermesAutoChainEnabled" className="settingsToggleLabel">
                        <span className="settingsToggleSwitch" />
                        <span className="settingsToggleText">启用自动建链</span>
                      </label>
                    </div>
                    {hermesAutoChain.enabled ? (
                      <>
                        <div className="settingsField">
                          <label className="settingsFieldLabel">自动建链范围</label>
                          <select
                            className="settingsInput"
                            value={hermesAutoChain.scope}
                            onChange={(e) =>
                              patchHermesAutoChain({ scope: e.target.value as HermesGlobalScope })
                            }
                          >
                            <option value="selected_only">仅已勾选且就绪的镜头</option>
                            <option value="all_ready">全部就绪的镜头</option>
                          </select>
                        </div>
                        <div className="settingsField">
                          <label className="settingsFieldLabel">批量出图 · 拆镜策略</label>
                          <select
                            className="settingsInput"
                            value={hermesAutoChain.batchSplitStrategy}
                            onChange={(e) =>
                              patchHermesAutoChain({
                                batchSplitStrategy: e.target.value as HermesBatchSplitStrategy,
                              })
                            }
                          >
                            <option value="pack_forward">打包拆镜（首镜多图，向后填充空缺镜）</option>
                            <option value="per_beat">逐镜出图（每镜独立生成）</option>
                          </select>
                        </div>
                        {hermesAutoChain.batchSplitStrategy === "pack_forward" ? (
                          <div className="settingsField">
                            <label className="settingsFieldLabel">打包张数</label>
                            <select
                              className="settingsInput"
                              value={hermesAutoChain.packImageCount}
                              onChange={(e) =>
                                patchHermesAutoChain({
                                  packImageCount: clampHermesPackImageCount(Number(e.target.value)),
                                })
                              }
                            >
                              {Array.from(
                                {
                                  length:
                                    HERMES_PACK_IMAGE_COUNT_MAX - HERMES_PACK_IMAGE_COUNT_MIN + 1,
                                },
                                (_, i) => HERMES_PACK_IMAGE_COUNT_MIN + i,
                              ).map((n) => (
                                <option key={n} value={n}>
                                  {n} 张
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </SettingsCategoryPane>

              <SettingsCategoryPane
                category="models"
                activeCategory={activeCategory}
                visited={visitedCategories}
              >
                <SettingsPageHead
                  title="模型与服务"
                  description="配置各厂商 API 与生成模型，供画布节点在运行时选用。"
                />
                <>
                  <SettingsModelsSection
                    settings={settings}
                    keys={keys}
                    hasKeyMap={hasKey}
                    onSettingsChange={handleProviderSettingsChange}
                    onKeysChange={handleKeysChange}
                    onError={setError}
                    onNotice={setNotice}
                  />
                  <div className="settingsSection settingsSection--sub">
                    <div className="settingsSectionTitle">文本模型</div>
                    <p className="settings-desc">
                      用于文本、脚本与 LLM 节点；请在对应服务商卡片中填写模型 ID（如 gpt-4o-mini）。
                    </p>
                    <SettingsTextProvidersSection
                      settings={settings}
                      setSettings={setSettings}
                      keys={keys}
                      setKeys={setKeys}
                      hasKey={hasKey}
                    />
                  </div>
                  <SettingsImageModelsSection
                    settings={settings}
                    setSettings={setSettings}
                    imageModelKeys={imageModelKeys}
                    setImageModelKeys={setImageModelKeys}
                    hasImageModelKey={hasImageModelKey}
                    testingModelId={testingModelId}
                    setTestingModelId={setTestingModelId}
                    setError={setError}
                    customModelNameValue={SETTINGS_IMAGE_CUSTOM_MODEL_NAME}
                    customModelVariantValue={SETTINGS_IMAGE_CUSTOM_MODEL_VARIANT}
                  />
                  <SettingsVideoModelsSection
                    settings={settings}
                    setSettings={setSettings}
                    videoModelKeys={videoModelKeys}
                    setVideoModelKeys={setVideoModelKeys}
                    hasVideoModelKey={hasVideoModelKey}
                  />
                  <SettingsAudioModelsSection
                    settings={settings}
                    setSettings={setSettings}
                    audioModelKeys={audioModelKeys}
                    setAudioModelKeys={setAudioModelKeys}
                    hasAudioModelKey={hasAudioModelKey}
                  />
                </>
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