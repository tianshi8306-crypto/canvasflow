/**
 * 模型 & API 配置区块
 * 参考 AI CanvasPro 的 API 输入面板（pane-api-input）
 *
 * 使用 ProviderCard 展示所有 AI 服务商的 API Key 配置，
 * 包含连接测试和即梦 OAuth 登录功能。
 *
 * 适配层：读取 settings.providers（已有结构）+ keys（已有结构），
 * 转换为 ProviderCard 需要的格式。
 */
import { memo, useState, useCallback, useMemo } from "react";
import { ProviderCard } from "@/components/ProviderCard";
import { testProviderConnections } from "@/lib/connectionTestApi";
import {
  DEFAULT_PROVIDER_TEST_IDS,
  getAllProviderIds,
  getProviderMeta,
  type ProviderId,
} from "@/lib/providers";
import type { AppSettings } from "@/lib/settingsPanelTypes";

/** 连接测试状态 */
type TestStatusMap = Partial<Record<ProviderId, "pending" | "testing" | "pass" | "fail">>;
type TestMessageMap = Partial<Record<ProviderId, string>>;

/** ProviderCard 需要的配置格式 */
type ProviderCardConfig = {
  baseUrl: string;
  apiKey: string;
  modelApiKey: string;
  enabled: boolean;
};

type Props = {
  /** 完整 settings（用于读取 providers 配置） */
  settings: AppSettings;
  /** API Keys（providerId → 用户输入的 key） */
  keys: Record<string, string>;
  /** 哪些 providerId 已有保存的 key */
  hasKeyMap: Record<string, boolean>;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onKeysChange: (providerId: string, field: "apiKey" | "modelApiKey", value: string) => void;
  onError?: (msg: string) => void;
  onNotice?: (msg: string) => void;
};

export const SettingsModelsSection = memo(function SettingsModelsSection({
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

  // 从 settings.providers 构建 providerConfigs 映射
  const providerConfigs = useMemo<Record<ProviderId, ProviderCardConfig>>(() => {
    const map: Record<string, ProviderCardConfig> = {};
    for (const p of settings.providers) {
      const id = p.id as ProviderId;
      map[id] = {
        baseUrl: p.baseUrl || getProviderMeta(id)?.defaultUrl || "",
        apiKey: keys[p.id] || "",
        modelApiKey: keys[`${p.id}:model`] || "",
        enabled: p.enabled,
      };
    }
    return map as Record<ProviderId, ProviderCardConfig>;
  }, [settings.providers, keys]);

  // 所有需要展示的 Provider IDs（优先用已配置的，其次用全部列表兜底）
  const displayProviderIds = useMemo<ProviderId[]>(() => {
    const configured = settings.providers.map((p) => p.id as ProviderId);
    const all = getAllProviderIds();
    // 去重：configured 在前，all 中未配置的追加在后
    const seen = new Set<string>(configured);
    const result: ProviderId[] = configured as ProviderId[];
    for (const id of all) {
      if (!seen.has(id)) result.push(id);
    }
    return result;
  }, [settings.providers]);

  // 单个 Provider 配置变化
  const handleProviderConfigChange = useCallback(
    (id: ProviderId, patch: Partial<ProviderCardConfig>) => {
      const idx = settings.providers.findIndex((p) => p.id === id);
      if (idx >= 0) {
        // 更新已有 provider
        onSettingsChange({
          providers: settings.providers.map((p, i) =>
            i === idx ? { ...p, ...patch } : p,
          ),
        });
      } else {
        // 新增 provider
        const meta = getProviderMeta(id);
        onSettingsChange({
          providers: [
            ...settings.providers,
            {
              id,
              label: meta?.label || id,
              baseUrl: patch.baseUrl || meta?.defaultUrl || "",
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

  // API Key 变化
  const handleApiKeyChange = useCallback(
    (id: ProviderId, field: "apiKey" | "modelApiKey", value: string) => {
      onKeysChange(id, field, value);
    },
    [onKeysChange],
  );

  // 批量测试所有 Provider
  const handleTestAll = useCallback(async () => {
    setTestingAll(true);
    const configsToTest: Partial<Record<ProviderId, { apiUrl?: string; apiKey?: string; modelApiKey?: string }>> = {};

    for (const id of DEFAULT_PROVIDER_TEST_IDS) {
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
      onNotice?.("连接测试完成，请查看各 Provider 状态");
    } catch (err: unknown) {
      onError?.("批量测试失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setTestingAll(false);
    }
  }, [providerConfigs, keys, onError, onNotice]);

  return (
    <div className="settingsSection">
      <div className="settingsSectionTitle">API 与服务</div>
      <p className="settings-desc settings-desc-lead">
        按服务商配置接口地址与密钥；画布节点将按所选模型自动路由请求。
      </p>

      {/* 已保存密钥预览 */}
      {Object.keys(hasKeyMap).length > 0 && (
        <div className="settingsKeyPreviews">
          <div className="settingsKeyPreviewsTitle">已保存的密钥（脱敏显示）</div>
          <div className="settingsKeyPreviewsList">
            {Object.entries(hasKeyMap).map(([id, saved]) =>
              saved ? (
                <div key={id} className="settingsKeyPreviewsItem">
                  <span title={id}>
                    {getProviderMeta(id)?.label || id} · <span className="mono">******.{id.slice(-4)}</span>
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Provider 卡片列表 */}
      <div className="settingsProviderList">
        {displayProviderIds.map((id) => {
          const config = providerConfigs[id] || {
            baseUrl: getProviderMeta(id)?.defaultUrl || "",
            apiKey: "",
            modelApiKey: "",
            enabled: false,
          };
          return (
            <ProviderCard
              key={id}
              providerId={id}
              config={config}
              hasKey={!!hasKeyMap[id]}
              hasModelKey={!!hasKeyMap[`${id}:model`]}
              testStatus={testStatus[id] || "pending"}
              testMessage={testMessages[id]}
              onConfigChange={(patch) => handleProviderConfigChange(id, patch)}
              onApiKeyChange={(field, value) => handleApiKeyChange(id, field, value)}
            />
          );
        })}
      </div>

      {/* 底部操作栏 */}
      <div className="settingsApiActions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleTestAll}
          disabled={testingAll}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {testingAll ? "测试中…" : "测试全部连接"}
        </button>
      </div>
    </div>
  );
});
