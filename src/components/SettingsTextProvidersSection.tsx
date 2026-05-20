import type { Dispatch, SetStateAction } from "react";
import type { AppSettings, ProviderConfig } from "@/lib/settingsPanelTypes";
import { useState } from "react";

type Props = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings | null>>;
  keys: Record<string, string>;
  setKeys: Dispatch<SetStateAction<Record<string, string>>>;
  hasKey: Record<string, boolean>;
};

function ApiKeyInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="settingsApiKeyInput">
      <input
        type={visible ? "text" : "password"}
        className="settingsInput mono"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="settingsApiKeyToggle"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "隐藏密钥" : "显示密钥"}
      >
        {visible ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function SettingsTextProvidersSection({ settings, setSettings, keys, setKeys, hasKey }: Props) {
  return (
    <div className="settingsProviderList">
      {settings.providers.map((p) => (
        <div key={p.id} className="settingsProviderCard">
          <div className="settingsProviderHeader">
            <div className="settingsProviderLabel">{p.label}</div>
            <div className="settingsProviderActions">
              <label className="settingsProviderToggle">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            providers: prev.providers.map((x) => (x.id === p.id ? { ...x, enabled: e.target.checked } : x)),
                          }
                        : prev,
                    )
                  }
                />
                <span className="settingsProviderToggleSwitch" />
                <span>启用</span>
              </label>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSettings((prev) => {
                    if (!prev) return prev;
                    const clone: ProviderConfig = {
                      ...p,
                      id: `${p.id}-copy-${Date.now()}`,
                      label: `${p.label} 副本`,
                      enabled: false,
                    };
                    return { ...prev, providers: [...prev.providers, clone] };
                  })
                }
              >
                复制
              </button>
            </div>
          </div>

          <div className="settingsProviderBody">
            <div className="settingsField">
              <label className="settingsFieldLabel">Base URL</label>
              <input
                className="settingsInput mono"
                value={p.baseUrl}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          providers: prev.providers.map((x) => (x.id === p.id ? { ...x, baseUrl: e.target.value } : x)),
                        }
                      : prev,
                  )
                }
              />
            </div>

            <div className="settingsField">
              <label className="settingsFieldLabel">Model</label>
              <input
                className="settingsInput mono"
                value={p.model}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          providers: prev.providers.map((x) => (x.id === p.id ? { ...x, model: e.target.value } : x)),
                        }
                      : prev,
                  )
                }
              />
            </div>

            <div className="settingsField">
              <label className="settingsFieldLabel">优先级（数字越小越优先）</label>
              <input
                type="number"
                className="settingsInput"
                value={p.priority}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          providers: prev.providers.map((x) =>
                            x.id === p.id ? { ...x, priority: Number.isFinite(v) ? v : 0 } : x,
                          ),
                        }
                      : prev,
                  );
                }}
              />
            </div>

            <div className="settingsField">
              <label className="settingsFieldLabel">API Key</label>
              <span className="settingsFieldHint">文本节点/脚本节点使用；不会回显，保存后写入系统凭据</span>
              <ApiKeyInput
                value={keys[p.id] ?? ""}
                placeholder={hasKey[p.id] ? "已保存（输入新值可覆盖）" : "请输入 API Key"}
                onChange={(v) => setKeys((prev) => ({ ...prev, [p.id]: v }))}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}