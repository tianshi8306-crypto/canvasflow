import { useEffect, useRef, useState } from "react";
import { formatUserError } from "@/lib/errors";
import { SettingsAudioModelsSection } from "@/components/SettingsAudioModelsSection";
import { SettingsFormField } from "@/components/SettingsFormField";
import { SettingsHeaderBar } from "@/components/SettingsHeaderBar";
import { SettingsImageModelsSection } from "@/components/SettingsImageModelsSection";
import { SettingsSaveBar } from "@/components/SettingsSaveBar";
import { SettingsTextProvidersSection } from "@/components/SettingsTextProvidersSection";
import { SettingsVideoModelsSection } from "@/components/SettingsVideoModelsSection";
import {
  loadSettingsPanelData,
  mergeImportedSettings,
  saveSettingsAndKeys,
  toUserMessage,
} from "@/lib/settingsPanelState";
import {
  keyOwnerLabel,
} from "@/lib/settingsKeyPreview";
import type {
  AppSettings,
  KeyPreviewItem,
} from "@/lib/settingsPanelTypes";

const CUSTOM_MODEL_NAME_VALUE = "__custom_model_name__";
const CUSTOM_MODEL_VARIANT_VALUE = "__custom_model_variant__";

export function SettingsPanel(props: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [hasKey, setHasKey] = useState<Record<string, boolean>>({});
  const [imageModelKeys, setImageModelKeys] = useState<Record<string, string>>({});
  const [hasImageModelKey, setHasImageModelKey] = useState<Record<string, boolean>>({});
  const [videoModelKeys, setVideoModelKeys] = useState<Record<string, string>>({});
  const [hasVideoModelKey, setHasVideoModelKey] = useState<Record<string, boolean>>({});
  const [audioModelKeys, setAudioModelKeys] = useState<Record<string, string>>({});
  const [hasAudioModelKey, setHasAudioModelKey] = useState<Record<string, boolean>>({});
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyPreviews, setKeyPreviews] = useState<Record<string, KeyPreviewItem>>({});
  const importFileRef = useRef<HTMLInputElement>(null);

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
        setHasImageModelKey(loaded.hasImageModelKey);
        setImageModelKeys({});
        setHasVideoModelKey(loaded.hasVideoModelKey);
        setVideoModelKeys({});
        setHasAudioModelKey(loaded.hasAudioModelKey);
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
        audioModelKeys,
        videoModelKeys,
        keyPreviews,
      });
      setHasKey(saved.hasKey);
      setHasImageModelKey(saved.hasImageModelKey);
      setHasAudioModelKey(saved.hasAudioModelKey);
      setHasVideoModelKey(saved.hasVideoModelKey);
      setKeyPreviews(saved.keyPreviews);
      setKeys({});
      setImageModelKeys({});
      setAudioModelKeys({});
      setVideoModelKeys({});
      setNotice(saved.notice);
    } catch (e) {
      setError(formatUserError(e));
      setNotice(null);
    }
  };

  if (!props.open) return null;

  return (
    <div className="settings-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="settings-modal">
        <SettingsHeaderBar
          importFileRef={importFileRef}
          onImportFile={importSettingsJson}
          onExport={exportSettingsJson}
          onClose={props.onClose}
        />

        {!settings ? (
          error ? (
            <div className="settings-error">{error}</div>
          ) : (
            <div className="settings-loading">加载中…</div>
          )
        ) : (
          <>
            {notice ? <div className="settings-notice">{notice}</div> : null}
            {error ? <div className="settings-error">{error}</div> : null}
            {Object.keys(keyPreviews).length > 0 ? (
              <div className="settings-key-previews">
                <div className="settings-key-previews__title">已保存密钥（脱敏）</div>
                <div className="settings-key-previews__list">
                  {Object.entries(keyPreviews).map(([id, item]) => (
                    <div key={id} className="settings-key-previews__item">
                      <span title={id}>
                        {keyOwnerLabel(id, settings)} · <span className="mono">{item.masked || "******"}</span>
                      </span>
                      <span>{item.savedAt}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <SettingsFormField label="FFmpeg 可执行文件（可选，默认使用 PATH 中的 ffmpeg）">
              <input
                className="mono"
                value={settings.ffmpegPath ?? ""}
                onChange={(e) => setSettings({ ...settings, ffmpegPath: e.target.value || null })}
                placeholder="ffmpeg"
              />
            </SettingsFormField>

            <div className="settings-checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={settings.abortWorkflowOnFailure}
                  onChange={(e) =>
                    setSettings({ ...settings, abortWorkflowOnFailure: e.target.checked })
                  }
                />
                <span>任一节点失败时中止整图（默认关闭：失败则跳过下游节点并标记为「跳过」）</span>
              </label>
            </div>

            <div className="settings-sections">
              <SettingsTextProvidersSection
                settings={settings}
                setSettings={setSettings}
                keys={keys}
                setKeys={setKeys}
                hasKey={hasKey}
              />

              <SettingsImageModelsSection
                settings={settings}
                setSettings={setSettings}
                imageModelKeys={imageModelKeys}
                setImageModelKeys={setImageModelKeys}
                hasImageModelKey={hasImageModelKey}
                testingModelId={testingModelId}
                setTestingModelId={setTestingModelId}
                setError={setError}
                customModelNameValue={CUSTOM_MODEL_NAME_VALUE}
                customModelVariantValue={CUSTOM_MODEL_VARIANT_VALUE}
              />

              <SettingsAudioModelsSection
                settings={settings}
                setSettings={setSettings}
                audioModelKeys={audioModelKeys}
                setAudioModelKeys={setAudioModelKeys}
                hasAudioModelKey={hasAudioModelKey}
              />

              <SettingsVideoModelsSection
                settings={settings}
                setSettings={setSettings}
                videoModelKeys={videoModelKeys}
                setVideoModelKeys={setVideoModelKeys}
                hasVideoModelKey={hasVideoModelKey}
              />
            </div>

            <SettingsSaveBar onSave={handleSave} />
          </>
        )}
      </div>
    </div>
  );
}
