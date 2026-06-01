import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { SettingsAudioModelsSection } from "@/components/SettingsAudioModelsSection";
import { SettingsChatProvidersSection } from "@/components/SettingsChatProvidersSection";
import { SettingsImageModelsSection } from "@/components/SettingsImageModelsSection";
import { SettingsVideoModelsSection } from "@/components/SettingsVideoModelsSection";
import { SettingsModelsOverview } from "@/components/settings/SettingsModelsOverview";
import { SettingsModelsSubNav } from "@/components/settings/SettingsModelsSubNav";
import { SettingsPageHead } from "@/components/settings/SettingsPageHead";
import {
  SETTINGS_IMAGE_CUSTOM_MODEL_NAME,
  SETTINGS_IMAGE_CUSTOM_MODEL_VARIANT,
} from "@/lib/settingsModelConstants";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import type { SettingsModelsTabId } from "@/lib/settingsModelsOverview";

type Props = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings | null>>;
  keys: Record<string, string>;
  setKeys: Dispatch<SetStateAction<Record<string, string>>>;
  hasKey: Record<string, boolean>;
  imageModelKeys: Record<string, string>;
  setImageModelKeys: Dispatch<SetStateAction<Record<string, string>>>;
  hasImageModelKey: Record<string, boolean>;
  videoModelKeys: Record<string, string>;
  setVideoModelKeys: Dispatch<SetStateAction<Record<string, string>>>;
  hasVideoModelKey: Record<string, boolean>;
  audioModelKeys: Record<string, string>;
  setAudioModelKeys: Dispatch<SetStateAction<Record<string, string>>>;
  hasAudioModelKey: Record<string, boolean>;
  testingModelId: string | null;
  setTestingModelId: Dispatch<SetStateAction<string | null>>;
  onProviderSettingsChange: (patch: Partial<AppSettings>) => void;
  onKeysChange: (providerId: string, field: "apiKey" | "modelApiKey", value: string) => void;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
};

export function SettingsModelsPane({
  settings,
  setSettings,
  keys,
  hasKey,
  imageModelKeys,
  setImageModelKeys,
  hasImageModelKey,
  videoModelKeys,
  setVideoModelKeys,
  hasVideoModelKey,
  audioModelKeys,
  setAudioModelKeys,
  hasAudioModelKey,
  testingModelId,
  setTestingModelId,
  onProviderSettingsChange,
  onKeysChange,
  setError,
  setNotice,
}: Props) {
  const [modelsTab, setModelsTab] = useState<SettingsModelsTabId>("overview");

  const goToTab = useCallback((tab: SettingsModelsTabId) => {
    setModelsTab(tab);
  }, []);

  return (
    <>
      <SettingsPageHead
        title="模型与服务"
        description="按画布节点类型配置模型。每一类节点只读取对应列表，互不混用。"
      />
      <SettingsModelsSubNav active={modelsTab} onSelect={setModelsTab} />

      {modelsTab === "overview" ? (
        <SettingsModelsOverview
          settings={settings}
          onGoToTab={goToTab}
          keys={keys}
          hasKey={hasKey}
          onProviderSettingsChange={onProviderSettingsChange}
          onKeysChange={onKeysChange}
        />
      ) : null}

      {modelsTab === "chat" ? (
        <SettingsChatProvidersSection
          settings={settings}
          keys={keys}
          hasKeyMap={hasKey}
          onSettingsChange={onProviderSettingsChange}
          onKeysChange={onKeysChange}
          onError={(msg) => setError(msg)}
          onNotice={(msg) => setNotice(msg)}
        />
      ) : null}

      {modelsTab === "image" ? (
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
      ) : null}

      {modelsTab === "video" ? (
        <SettingsVideoModelsSection
          settings={settings}
          setSettings={setSettings}
          videoModelKeys={videoModelKeys}
          setVideoModelKeys={setVideoModelKeys}
          hasVideoModelKey={hasVideoModelKey}
        />
      ) : null}

      {modelsTab === "audio" ? (
        <SettingsAudioModelsSection
          settings={settings}
          setSettings={setSettings}
          audioModelKeys={audioModelKeys}
          setAudioModelKeys={setAudioModelKeys}
          hasAudioModelKey={hasAudioModelKey}
        />
      ) : null}
    </>
  );
}
