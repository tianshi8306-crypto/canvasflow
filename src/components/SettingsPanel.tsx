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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        style={{
          width: "min(920px, calc(100vw - 24px))",
          maxHeight: "min(720px, calc(100vh - 24px))",
          overflow: "auto",
          border: "1px solid var(--border)",
          borderRadius: 14,
          background: "var(--panel)",
          padding: 14,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SettingsHeaderBar
          importFileRef={importFileRef}
          onImportFile={importSettingsJson}
          onExport={exportSettingsJson}
          onClose={props.onClose}
        />

        {!settings ? (
          error ? (
            <div style={{ color: "var(--danger)", marginBottom: 10, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{error}</div>
          ) : (
            <div style={{ color: "var(--muted)" }}>加载中…</div>
          )
        ) : (
          <>
            {notice ? <div style={{ color: "#22c55e", marginBottom: 10 }}>{notice}</div> : null}
            {error ? <div style={{ color: "var(--danger)", marginBottom: 10 }}>{error}</div> : null}
            {Object.keys(keyPreviews).length > 0 ? (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 10,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>已保存密钥（脱敏）</div>
                <div style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)" }}>
                  {Object.entries(keyPreviews).map(([id, item]) => (
                    <div key={id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
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

            <div className="field">
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings.abortWorkflowOnFailure}
                  onChange={(e) =>
                    setSettings({ ...settings, abortWorkflowOnFailure: e.target.checked })
                  }
                  style={{ marginTop: 3 }}
                />
                <span style={{ lineHeight: 1.45 }}>
                  任一节点失败时中止整图（默认关闭：失败则跳过下游节点并标记为「跳过」）
                </span>
              </label>
            </div>

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

            <SettingsSaveBar onSave={handleSave} />
          </>
        )}
      </div>
    </div>
  );
}
