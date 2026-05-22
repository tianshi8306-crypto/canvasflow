import { useEffect, useRef, useState } from "react";
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
import { shortcutsByCategory } from "@/lib/shortcuts";
import { SettingsNav, type SettingsCategory } from "@/components/SettingsNav";
import { SettingsModelsSection } from "@/components/SettingsModelsSection";
import { useCanvasUiStore } from "@/store/canvasUiStore";

export function SettingsPanel(props: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [hasKey, setHasKey] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyPreviews, setKeyPreviews] = useState<Record<string, KeyPreviewItem>>({});
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
  const importFileRef = useRef<HTMLInputElement>(null);

  const [minimapVisible, setMinimapVisible] = useState(true);
  const [nodeSnapAlignmentEnabled, setNodeSnapAlignmentEnabled] = useState(true);

  useEffect(() => {
    if (activeCategory === "canvas") {
      setMinimapVisible(useCanvasUiStore.getState().minimapVisible);
      setNodeSnapAlignmentEnabled(useCanvasUiStore.getState().nodeSnapAlignmentEnabled);
    }
  }, [activeCategory]);

  useEffect(() => {
    if (!props.open) return;
    void (async () => {
      setError(null);
      setNotice(null);
      setSettings(null);
      try {
        const loaded = await loadSettingsPanelData();
        setKeyPreviews(loaded.keyPreviews);
        setSettings(loaded.settings);
        setHasKey(loaded.hasKey);
        setKeys({});
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
        keyPreviews,
      });
      setHasKey(saved.hasKey);
      setKeyPreviews(saved.keyPreviews);
      setKeys({});
      setNotice(saved.notice);
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

        {!settings ? (
          error ? (
            <div className="settings-error">{error}</div>
          ) : (
            <div className="settings-loading">加载中…</div>
          )
        ) : (
          <div className="settingsBody">
            <SettingsNav activeCategory={activeCategory} onSelect={setActiveCategory} />

            <div className="settingsContent">
              {notice ? <div className="settings-notice">{notice}</div> : null}
              {error ? <div className="settings-error">{error}</div> : null}

              {activeCategory === "general" && (
                <div className="settingsSection">
                  <div className="settingsSectionTitle">系统</div>

                  <div className="settingsField">
                    <label className="settingsFieldLabel">FFmpeg 可执行文件</label>
                    <span className="settingsFieldHint">可选，默认使用 PATH 中的 ffmpeg</span>
                    <input
                      className="settingsInput mono"
                      value={settings.ffmpegPath ?? ""}
                      onChange={(e) => setSettings({ ...settings, ffmpegPath: e.target.value || null })}
                      placeholder="ffmpeg"
                    />
                  </div>

                  <div className="settingsField">
                    <label className="settingsFieldLabel">工作流行为</label>
                    <div className="settingsToggle">
                      <input
                        type="checkbox"
                        id="abortWorkflow"
                        checked={settings.abortWorkflowOnFailure}
                        onChange={(e) => setSettings({ ...settings, abortWorkflowOnFailure: e.target.checked })}
                      />
                      <label htmlFor="abortWorkflow" className="settingsToggleLabel">
                        <span className="settingsToggleSwitch" />
                        <span className="settingsToggleText">任一节点失败时中止整图</span>
                      </label>
                    </div>
                    <span className="settingsFieldHint">默认关闭：失败则跳过下游节点并标记为「跳过」</span>
                  </div>
                </div>
              )}

              {activeCategory === "models" && settings && (
                <SettingsModelsSection
                  settings={settings}
                  keys={keys}
                  hasKeyMap={hasKey}
                  onSettingsChange={handleProviderSettingsChange}
                  onKeysChange={handleKeysChange}
                  onError={setError}
                  onNotice={setNotice}
                />
              )}

              {activeCategory === "shortcuts" && (
                <div className="settingsSection">
                  <div className="settingsSectionTitle">快捷键</div>
                  {Object.entries(shortcutsByCategory).map(([category, items]) => (
                    <div key={category} className="settingsShortcutCategory">
                      <div className="settingsShortcutCategoryTitle">{category}</div>
                      <div className="settingsShortcutsList">
                        {items.map((s) => (
                          <div key={s.id} className="settingsShortcutItem">
                            <span className="settingsShortcutKey">{s.key}</span>
                            <span className="settingsShortcutAction">{s.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeCategory === "canvas" && (
                <div className="settingsSection">
                  <div className="settingsSectionTitle">画布视图</div>

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
                </div>
              )}

              {activeCategory === "about" && (
                <div className="settingsSection">
                  <div className="settingsSectionTitle">关于</div>
                  <div className="settingsAbout">
                    <div className="settingsAboutLogo">CanvasFlow AI Studio</div>
                    <div className="settingsAboutVersion">版本 1.0.0</div>
                    <div className="settingsAboutDesc">智能视频创作工作流平台</div>
                  </div>

                  <div className="settingsDivider" />

                  <div className="settingsSectionTitle">诊断</div>
                  <div className="settingsDiagnostics">
                    <div className="settingsDiagnosticsHint">
                      生成诊断文件用于排查问题，包含版本信息等
                    </div>
                    <button
                      type="button"
                      className="btn btnPrimary"
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
                      生成诊断文件
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {settings && (
          <div className="settingsFooter">
            <button type="button" className="btn btnPrimary" onClick={() => void handleSave()}>
              保存
            </button>
          </div>
        )}
      </div>
    </div>
  );
}