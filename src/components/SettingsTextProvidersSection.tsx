import type { Dispatch, SetStateAction } from "react";
import type { AppSettings, ProviderConfig } from "@/lib/settingsPanelTypes";
import { SettingsFormField } from "@/components/SettingsFormField";

type Props = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings | null>>;
  keys: Record<string, string>;
  setKeys: Dispatch<SetStateAction<Record<string, string>>>;
  hasKey: Record<string, boolean>;
};

export function SettingsTextProvidersSection({ settings, setSettings, keys, setKeys, hasKey }: Props) {
  return (
    <>
      <div style={{ height: 12 }} />
      <div style={{ fontWeight: 650, marginBottom: 10 }}>文本模型（文本节点 / 脚本节点）</div>
      {settings.providers.map((p) => (
        <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 650 }}>{p.label}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--muted)" }}>
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
                启用
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
          <div style={{ height: 10 }} />
          <SettingsFormField label="Base URL">
            <input
              className="mono"
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
          </SettingsFormField>
          <SettingsFormField label="Model">
            <input
              className="mono"
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
          </SettingsFormField>
          <SettingsFormField label="优先级（数字越小越优先）">
            <input
              type="number"
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
          </SettingsFormField>
          <SettingsFormField label="API Key（文本节点/脚本节点；不会回显，保存后写入系统凭据）">
            <input
              className="mono"
              value={keys[p.id] ?? ""}
              placeholder={hasKey[p.id] ? "已保存（输入新值可覆盖）" : "请输入 API Key"}
              onChange={(e) => setKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
            />
          </SettingsFormField>
        </div>
      ))}
    </>
  );
}
