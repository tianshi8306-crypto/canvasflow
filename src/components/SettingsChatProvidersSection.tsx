/**
 * 文本 / 脚本 / LLM 节点：对话类服务商（合并原「API 与服务」+「文本模型」）
 */
import { memo, useState, useCallback, useMemo } from "react";
import { ProviderCard } from "@/components/ProviderCard";
import { SettingsSectionHeader } from "@/components/settings/SettingsSectionHeader";
import { testProviderConnections } from "@/lib/connectionTestApi";
import {
  DEFAULT_PROVIDER_TEST_IDS,
  getProviderMeta,
  type ProviderId,
} from "@/lib/providers";
import { providerSupportsCapability } from "@/lib/providerCapabilities";
import {
  createChatProviderConfig,
  listAddableChatProviderIds,
} from "@/lib/settingsModelDefaults";
import type { AppSettings } from "@/lib/settingsPanelTypes";

type TestStatusMap = Partial<Record<ProviderId, "pending" | "testing" | "pass" | "fail">>;
type TestMessageMap = Partial<Record<ProviderId, string>>;

type ProviderCardConfig = {
  baseUrl: string;
  apiKey: string;
  modelApiKey: string;
  enabled: boolean;
  model: string;
  priority: number;
};

type Props = {
  settings: AppSettings;
  keys: Record<string, string>;
  hasKeyMap: Record<string, boolean>;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onKeysChange: (providerId: string, field: "apiKey" | "modelApiKey", value: string) => void;
  onError?: (msg: string) => void;
  onNotice?: (msg: string) => void;
};

export const SettingsChatProvidersSection = memo(function SettingsChatProvidersSection({
  settings,
  keys,
  hasKeyMap,
  onSettingsChange,
  onKeysChange,
  onError,
  onNotice,
}: Props) {
  const [testStatus, setTestStatus] = useState<TestStatusMap>({});
  const [testMessages, setTestMessages] = useState<TestMessageMap>({});
  const [testingAll, setTestingAll] = useState(false);

  const chatProviderRecords = useMemo(
    () => settings.providers.filter((p) => providerSupportsCapability(p.id, "chat")),
    [settings.providers],
  );

  const displayProviderIds = useMemo<ProviderId[]>(
    () => chatProviderRecords.map((p) => p.id as ProviderId),
    [chatProviderRecords],
  );

  const addableProviderIds = useMemo(
    () => listAddableChatProviderIds(settings.providers),
    [settings.providers],
  );

  const handleAddProvider = useCallback(
    (id: ProviderId) => {
      onSettingsChange({
        providers: [...settings.providers, createChatProviderConfig(id)],
      });
    },
    [onSettingsChange, settings.providers],
  );

  const handleRemoveProvider = useCallback(
    (id: string) => {
      const nextProviders = settings.providers.filter((p) => p.id !== id);
      const patch: Partial<AppSettings> = { providers: nextProviders };
      if (settings.defaultProviderId === id) {
        const fallback = nextProviders.find(
          (p) => p.enabled && providerSupportsCapability(p.id, "chat"),
        );
        patch.defaultProviderId = fallback?.id ?? null;
      }
      onSettingsChange(patch);
    },
    [onSettingsChange, settings.defaultProviderId, settings.providers],
  );

  const providerConfigs = useMemo<Record<ProviderId, ProviderCardConfig>>(() => {
    const map: Record<string, ProviderCardConfig> = {};
    for (const id of displayProviderIds) {
      const p = settings.providers.find((x) => x.id === id);
      map[id] = {
        baseUrl: p?.baseUrl || getProviderMeta(id)?.defaultUrl || "",
        apiKey: keys[id] || "",
        modelApiKey: keys[`${id}:model`] || "",
        enabled: p?.enabled ?? false,
        model: p?.model ?? "",
        priority: p?.priority ?? 100,
      };
    }
    return map as Record<ProviderId, ProviderCardConfig>;
  }, [displayProviderIds, settings.providers, keys]);

  const handleProviderConfigChange = useCallback(
    (id: ProviderId, patch: Partial<ProviderCardConfig>) => {
      const idx = settings.providers.findIndex((p) => p.id === id);
      if (idx >= 0) {
        onSettingsChange({
          providers: settings.providers.map((p, i) =>
            i === idx
              ? {
                  ...p,
                  ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
                  ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
                  ...(patch.model !== undefined ? { model: patch.model } : {}),
                  ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
                }
              : p,
          ),
        });
      } else {
        const meta = getProviderMeta(id);
        onSettingsChange({
          providers: [
            ...settings.providers,
            {
              id,
              label: meta?.label || id,
              baseUrl: patch.baseUrl || meta?.defaultUrl || "",
              model: patch.model ?? "",
              priority: patch.priority ?? 100,
              enabled: patch.enabled ?? true,
            },
          ],
        });
      }
    },
    [settings.providers, onSettingsChange],
  );

  const handleApiKeyChange = useCallback(
    (id: ProviderId, field: "apiKey" | "modelApiKey", value: string) => {
      onKeysChange(id, field, value);
    },
    [onKeysChange],
  );

  const handleTestAll = useCallback(async () => {
    setTestingAll(true);
    const configsToTest: Partial<
      Record<ProviderId, { apiUrl?: string; apiKey?: string; modelApiKey?: string }>
    > = {};

    for (const id of DEFAULT_PROVIDER_TEST_IDS) {
      if (!providerSupportsCapability(id, "chat")) continue;
      const config = providerConfigs[id];
      if (config) {
        configsToTest[id] = {
          apiUrl: config.baseUrl,
          apiKey: config.apiKey || keys[id] || "",
          modelApiKey: config.modelApiKey || keys[`${id}:model`] || "",
        };
      }
    }

    try {
      const results = await testProviderConnections(configsToTest);
      const newStatus: TestStatusMap = {};
      const newMessages: TestMessageMap = {};
      for (const [id, result] of Object.entries(results)) {
        if (result) {
          newStatus[id as ProviderId] = result.ok ? "pass" : "fail";
          newMessages[id as ProviderId] = result.suggestion || result.summary;
        }
      }
      setTestStatus((prev) => ({ ...prev, ...newStatus }));
      setTestMessages((prev) => ({ ...prev, ...newMessages }));
      onNotice?.("连接测试完成，请查看各服务商状态");
    } catch (err: unknown) {
      onError?.("批量测试失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setTestingAll(false);
    }
  }, [providerConfigs, keys, onError, onNotice]);

  const chatKeyPreviews = Object.entries(hasKeyMap).filter(
    ([id, saved]) => saved && providerSupportsCapability(id, "chat"),
  );

  return (
    <div className="settingsSection">
      <SettingsSectionHeader
        title="文本与脚本"
        description="默认只显示已添加的对话服务商。画布文本 / 脚本 / LLM 节点在底栏「默认模型」中选用。"
        action={
          addableProviderIds.length > 0 ? (
            <label className="settingsAddModelSelect" aria-label="添加对话服务商">
              <select
                className="settingsInput"
                defaultValue=""
                aria-label="添加对话服务商"
                onChange={(e) => {
                  const id = e.target.value as ProviderId;
                  if (!id) return;
                  handleAddProvider(id);
                  e.target.value = "";
                }}
              >
                <option value="">添加对话服务商…</option>
                {addableProviderIds.map((id) => (
                  <option key={id} value={id}>
                    {getProviderMeta(id)?.label ?? id}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />

      <div className="settingsModelsNodeBadges" aria-label="适用节点">
        <span className="settingsModelsNodeBadge">文本节点</span>
        <span className="settingsModelsNodeBadge">脚本节点</span>
        <span className="settingsModelsNodeBadge">LLM 节点</span>
      </div>

      {chatKeyPreviews.length > 0 ? (
        <div className="settingsKeyPreviews">
          <div className="settingsKeyPreviewsTitle">已保存的密钥（脱敏）</div>
          <div className="settingsKeyPreviewsList">
            {chatKeyPreviews.map(([id]) => (
              <div key={id} className="settingsKeyPreviewsItem">
                <span title={id}>
                  {getProviderMeta(id)?.label || id} · <span className="mono">******.{id.slice(-4)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {displayProviderIds.length === 0 ? (
        <p className="settings-desc">请从右上角添加对话服务商，或保存后使用默认 DeepSeek 配置。</p>
      ) : (
        <div className="settingsProviderList">
          {displayProviderIds.map((id) => {
            const config = providerConfigs[id] || {
              baseUrl: getProviderMeta(id)?.defaultUrl || "",
              apiKey: "",
              modelApiKey: "",
              enabled: false,
              model: "",
              priority: 100,
            };
            return (
              <ProviderCard
                key={id}
                providerId={id}
                config={config}
                chatMode
                hasKey={!!hasKeyMap[id]}
                hasModelKey={!!hasKeyMap[`${id}:model`]}
                testStatus={testStatus[id] || "pending"}
                testMessage={testMessages[id]}
                onConfigChange={(patch) => handleProviderConfigChange(id, patch)}
                onApiKeyChange={(field, value) => handleApiKeyChange(id, field, value)}
                onRemove={() => handleRemoveProvider(id)}
              />
            );
          })}
        </div>
      )}

      <div className="settingsApiActions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleTestAll}
          disabled={testingAll}
        >
          {testingAll ? "测试中…" : "测试对话服务商连接"}
        </button>
      </div>
    </div>
  );
});
