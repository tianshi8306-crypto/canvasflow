/**
 * 单个 Provider 的配置卡片
 * 参考 AI CanvasPro 的 settings-card 样式
 */
import { useState, useEffect, useCallback } from "react";
import { ApiKeyInput } from "@/components/ApiKeyInput";
import { DreaminaLoginPanel } from "@/components/DreaminaLoginPanel";
import { getProviderMeta, type ProviderId } from "@/lib/providers";
import {
  checkDreaminaAuthState,
  clearDreaminaToken,
  type DreaminaAuthState,
} from "@/lib/dreaminaAuth";

type Props = {
  providerId: ProviderId;
  config: {
    baseUrl: string;
    apiKey: string;
    modelApiKey: string;
    enabled: boolean;
  };
  hasKey: boolean;
  hasModelKey: boolean;
  testStatus?: "pending" | "testing" | "pass" | "fail";
  testMessage?: string;
  onConfigChange: (patch: Partial<Props["config"]>) => void;
  onApiKeyChange: (field: "apiKey" | "modelApiKey", value: string) => void;
  onDreaminaAuthChange?: (state: DreaminaAuthState) => void;
};

function getProviderBadge(id: ProviderId): string {
  const badges: Partial<Record<ProviderId, string>> = {
    openai: "OA",
    apimart: "AM",
    dreamina: "即",
    aicanvas: "本",
  };
  return badges[id] || id.slice(0, 2).toUpperCase();
}

function StatusIcon({ status }: { status: Props["testStatus"] }) {
  if (!status || status === "pending") return null;
  if (status === "testing") {
    return (
      <span className="settings-provider-status settings-provider-status--testing">
        <svg className="spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        测试中
      </span>
    );
  }
  if (status === "pass") {
    return <span className="settings-provider-status settings-provider-status--pass">✓ 通过</span>;
  }
  if (status === "fail") {
    return <span className="settings-provider-status settings-provider-status--fail">✗ 未通过</span>;
  }
  return null;
}

export function ProviderCard({
  providerId,
  config,
  hasKey,
  hasModelKey,
  testStatus,
  testMessage,
  onConfigChange,
  onApiKeyChange,
  onDreaminaAuthChange,
}: Props) {
  const meta = getProviderMeta(providerId);
  const label = meta?.label || providerId;
  const logoPath = meta?.logoPath;
  const getKeyUrl = meta?.getKeyUrl;
  const supportsModelKey = meta?.supportsModelKey ?? false;
  const isDreamina = providerId === "dreamina";

  const [dreaminaAuth, setDreaminaAuth] = useState<DreaminaAuthState | null>(null);

  useEffect(() => {
    if (!isDreamina) return;
    checkDreaminaAuthState(false).then((state) => {
      setDreaminaAuth(state);
      onDreaminaAuthChange?.(state);
    });
  }, [isDreamina, onDreaminaAuthChange]);

  const handleDreaminaAuthChange = useCallback(
    (state: DreaminaAuthState) => {
      setDreaminaAuth(state);
      onDreaminaAuthChange?.(state);
    },
    [onDreaminaAuthChange],
  );

  const handleDreaminaLogout = useCallback(() => {
    if (!isDreamina) return;
    void (async () => {
      try {
        const state = await clearDreaminaToken();
        handleDreaminaAuthChange(state);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "退出登录失败";
        handleDreaminaAuthChange({
          isLoggedIn: false,
          statusText: "退出失败",
          message: msg,
          creditText: "登录后显示余额",
          installed: dreaminaAuth?.installed ?? false,
          runtime: dreaminaAuth?.runtime ?? null,
        });
      }
    })();
  }, [isDreamina, handleDreaminaAuthChange, dreaminaAuth]);

  return (
    <div className="settings-card">
      <div className="settings-card-head">
        {logoPath ? (
          <img src={logoPath} className="settings-card-icon" alt={label} />
        ) : (
          <span className="settings-card-badge">{getProviderBadge(providerId)}</span>
        )}
        <span className="settings-card-title">{label}</span>
        <StatusIcon status={testStatus} />
        {getKeyUrl && !isDreamina && (
          <a
            href={getKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="settings-getkey"
            title={`前往 ${label} 获取 API Key`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            获取 Key
          </a>
        )}
        {isDreamina && (
          <span className="settings-getkey settings-getkey--muted">
            {dreaminaAuth?.isLoggedIn ? "已登录" : "CLI 授权登录"}
          </span>
        )}
      </div>

      {isDreamina && (
        <>
          <DreaminaLoginPanel auth={dreaminaAuth} onAuthChange={handleDreaminaAuthChange} />
          {dreaminaAuth?.isLoggedIn ? (
            <div className="settings-dreamina-actions settings-dreamina-actions--footer">
              <button type="button" className="btn btn--ghost" onClick={handleDreaminaLogout}>
                退出登录
              </button>
            </div>
          ) : null}
        </>
      )}

      {providerId === "openai" && (
        <div className="settingsField">
          <label className="settingsFieldLabel">接口地址</label>
          <input
            className="settingsInput mono"
            value={config.baseUrl}
            placeholder={meta?.defaultUrl || "https://api.openai.com"}
            onChange={(e) => onConfigChange({ baseUrl: e.target.value })}
          />
        </div>
      )}

      {!isDreamina && (
        <div className="settingsField">
          <label className="settingsFieldLabel">API 密钥</label>
          <ApiKeyInput
            value={config.apiKey}
            placeholder={hasKey ? "已保存（输入新值可覆盖）" : "请输入 API Key"}
            onChange={(v) => onApiKeyChange("apiKey", v)}
            id={`providerKey-${providerId}`}
          />
        </div>
      )}

      {supportsModelKey && (
        <div className="settingsField">
          <label className="settingsFieldLabel">模型 API 密钥（企业级）</label>
          <ApiKeyInput
            value={config.modelApiKey}
            placeholder={hasModelKey ? "已保存（输入新值可覆盖）" : "请输入模型 API Key"}
            onChange={(v) => onApiKeyChange("modelApiKey", v)}
            id={`providerKey-${providerId}-model`}
          />
        </div>
      )}

      {testStatus === "fail" && testMessage && (
        <div className="settings-test-error">{testMessage}</div>
      )}
    </div>
  );
}
