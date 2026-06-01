/**
 * 总览：即梦 CLI 登录（图片 + 视频共用）
 */
import { memo, useCallback, useMemo } from "react";
import { ProviderCard } from "@/components/ProviderCard";
import { getProviderMeta } from "@/lib/providers";
import type { AppSettings } from "@/lib/settingsPanelTypes";

type Props = {
  settings: AppSettings;
  keys: Record<string, string>;
  hasKeyMap: Record<string, boolean>;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onKeysChange: (providerId: string, field: "apiKey" | "modelApiKey", value: string) => void;
};

export const SettingsDreaminaOverviewCard = memo(function SettingsDreaminaOverviewCard({
  settings,
  keys,
  hasKeyMap,
  onSettingsChange,
  onKeysChange,
}: Props) {
  const dreamina = useMemo(
    () => settings.providers.find((p) => p.id === "dreamina"),
    [settings.providers],
  );

  const config = useMemo(
    () => ({
      baseUrl: dreamina?.baseUrl || getProviderMeta("dreamina")?.defaultUrl || "",
      apiKey: keys.dreamina || "",
      modelApiKey: keys["dreamina:model"] || "",
      enabled: dreamina?.enabled ?? true,
    }),
    [dreamina, keys],
  );

  const ensureDreamina = useCallback(
    (patch: Partial<typeof config>) => {
      const idx = settings.providers.findIndex((p) => p.id === "dreamina");
      if (idx >= 0) {
        onSettingsChange({
          providers: settings.providers.map((p, i) =>
            i === idx ? { ...p, ...patch, enabled: patch.enabled ?? p.enabled } : p,
          ),
        });
      } else {
        const meta = getProviderMeta("dreamina");
        onSettingsChange({
          providers: [
            ...settings.providers,
            {
              id: "dreamina",
              label: meta?.label || "即梦",
              baseUrl: patch.baseUrl || "",
              model: "",
              priority: 100,
              enabled: patch.enabled ?? true,
            },
          ],
        });
      }
    },
    [settings.providers, onSettingsChange],
  );

  return (
    <section className="settingsDreaminaOverview" aria-labelledby="settings-dreamina-heading">
      <h3 id="settings-dreamina-heading" className="settingsDreaminaOverviewTitle">
        即梦 CLI（图片 · 视频共用）
      </h3>
      <p className="settings-desc settings-desc-tight">
        登录一次即可。图片节点与视频节点中的即梦（CLI）模型依赖此账号；具体型号在「图片」「视频」页配置。
      </p>
      <div className="settingsModelsNodeBadges">
        <span className="settingsModelsNodeBadge">图片节点</span>
        <span className="settingsModelsNodeBadge">视频节点</span>
      </div>
      <ProviderCard
        providerId="dreamina"
        config={config}
        hasKey={!!hasKeyMap.dreamina}
        hasModelKey={!!hasKeyMap["dreamina:model"]}
        onConfigChange={(patch) => ensureDreamina(patch)}
        onApiKeyChange={(field, value) => onKeysChange("dreamina", field, value)}
      />
    </section>
  );
});
