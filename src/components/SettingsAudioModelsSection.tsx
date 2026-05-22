import type { Dispatch, SetStateAction } from "react";
import type { AppSettings, ImageModelConfig } from "@/lib/settingsPanelTypes";
import { newAudioModelTemplate } from "@/lib/settingsModelTemplates";
import { SettingsFormField } from "@/components/SettingsFormField";

type Props = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings | null>>;
  audioModelKeys: Record<string, string>;
  setAudioModelKeys: Dispatch<SetStateAction<Record<string, string>>>;
  hasAudioModelKey: Record<string, boolean>;
};

export function SettingsAudioModelsSection({
  settings,
  setSettings,
  audioModelKeys,
  setAudioModelKeys,
  hasAudioModelKey,
}: Props) {
  const audioModels = settings.audioModels ?? [];

  return (
    <>
      <div style={{ height: 12 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontWeight: 650 }}>语音（TTS）模型</div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setSettings((prev) =>
              prev ? { ...prev, audioModels: [...(prev.audioModels ?? []), newAudioModelTemplate()] } : prev,
            )
          }
        >
          + 添加模型
        </button>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10, lineHeight: 1.45 }}>
        需 OpenAI 兼容接口 <span className="mono">POST …/v1/audio/speech</span>；Base URL 请包含{" "}
        <span className="mono">/v1</span>（与图片模型习惯一致）。保存后可在音频节点「模型」下拉里选择带「自定义」的条目。
      </div>

      {audioModels.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
          暂无语音模型；未配置时 TTS 走上方默认 Provider 的 Key 与所选 <span className="mono">tts-1</span> /{" "}
          <span className="mono">tts-1-hd</span>。
        </div>
      ) : null}

      {audioModels.map((m) => (
        <div key={m.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontWeight: 650 }}>{m.label?.trim() || m.model || "TTS 模型"}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--muted)" }}>
                <input
                  type="checkbox"
                  checked={m.enabled}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            audioModels: (prev.audioModels ?? []).map((x) =>
                              x.id === m.id ? { ...x, enabled: e.target.checked } : x,
                            ),
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
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          audioModels: (prev.audioModels ?? []).filter((x) => x.id !== m.id),
                        }
                      : prev,
                  )
                }
              >
                删除
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSettings((prev) => {
                    if (!prev) return prev;
                    const clone: ImageModelConfig = {
                      ...m,
                      id: `audio-model-${Date.now()}`,
                      enabled: false,
                    };
                    return { ...prev, audioModels: [...(prev.audioModels ?? []), clone] };
                  })
                }
              >
                复制
              </button>
            </div>
          </div>

          <div style={{ height: 10 }} />

          <SettingsFormField label="显示名称（可选）">
            <input
              className="mono"
              value={m.label}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        audioModels: (prev.audioModels ?? []).map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)),
                      }
                    : prev,
                )
              }
              placeholder="例如：自建 TTS"
            />
          </SettingsFormField>

          <SettingsFormField label="模型标识（speech API 的 model 字段）">
            <input
              className="mono"
              value={m.model}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        audioModels: (prev.audioModels ?? []).map((x) => (x.id === m.id ? { ...x, model: e.target.value } : x)),
                      }
                    : prev,
                )
              }
              placeholder="tts-1 或 tts-1-hd 等"
            />
          </SettingsFormField>

          <SettingsFormField label="API Base URL（须含 /v1）">
            <input
              className="mono"
              value={m.apiBaseUrl}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        audioModels: (prev.audioModels ?? []).map((x) =>
                          x.id === m.id ? { ...x, apiBaseUrl: e.target.value } : x,
                        ),
                      }
                    : prev,
                )
              }
              placeholder="https://api.openai.com/v1"
            />
          </SettingsFormField>

          <SettingsFormField label="API Key（音频节点；不会回显，保存后写入系统凭据）">
            <input
              className="mono"
              value={audioModelKeys[m.id] ?? ""}
              placeholder={hasAudioModelKey[m.id] ? "已保存（输入新值可覆盖）" : "请输入 API Key"}
              onChange={(e) => setAudioModelKeys((prev) => ({ ...prev, [m.id]: e.target.value }))}
            />
          </SettingsFormField>

          <SettingsFormField label="优先级（数字越小越靠前）">
            <input
              type="number"
              value={m.priority}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        audioModels: (prev.audioModels ?? []).map((x) =>
                          x.id === m.id ? { ...x, priority: Number.isFinite(v) ? v : 0 } : x,
                        ),
                      }
                    : prev,
                );
              }}
            />
          </SettingsFormField>
        </div>
      ))}
    </>
  );
}
