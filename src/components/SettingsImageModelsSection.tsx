import { invoke } from "@tauri-apps/api/core";
import type { Dispatch, SetStateAction } from "react";
import { formatUserError } from "@/lib/errors";
import {
  defaultApiBaseUrlByModelName,
  MAINSTREAM_IMAGE_MODEL_CATALOG,
  variantsByModelName,
} from "@/lib/imageGeneration/modelCatalog";
import { newImageModelTemplate } from "@/lib/settingsModelTemplates";
import type { AppSettings, ImageModelConfig } from "@/lib/settingsPanelTypes";
import { SettingsFormField } from "@/components/SettingsFormField";

type Props = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings | null>>;
  imageModelKeys: Record<string, string>;
  setImageModelKeys: Dispatch<SetStateAction<Record<string, string>>>;
  hasImageModelKey: Record<string, boolean>;
  testingModelId: string | null;
  setTestingModelId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  customModelNameValue: string;
  customModelVariantValue: string;
};

export function SettingsImageModelsSection({
  settings,
  setSettings,
  imageModelKeys,
  setImageModelKeys,
  hasImageModelKey,
  testingModelId,
  setTestingModelId,
  setError,
  customModelNameValue,
  customModelVariantValue,
}: Props) {
  return (
    <>
      <div style={{ height: 12 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontWeight: 650 }}>图片模型</div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setSettings((prev) => (prev ? { ...prev, imageModels: [...prev.imageModels, newImageModelTemplate()] } : prev))
          }
        >
          + 添加模型
        </button>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
        接入说明见教程：`docs/image-model-api-tutorial.md`
      </div>

      {settings.imageModels.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
          暂无图片模型；添加后可在图片节点下拉中选择。
        </div>
      ) : null}

      {settings.imageModels.map((m) => {
        const vendorMap = new Map<string, (typeof MAINSTREAM_IMAGE_MODEL_CATALOG)[number]>();
        for (const item of MAINSTREAM_IMAGE_MODEL_CATALOG) {
          if (!vendorMap.has(item.modelName)) vendorMap.set(item.modelName, item);
        }
        const vendors = [...vendorMap.values()];
        const variantMap = new Map<string, { label: string; value: string }>();
        for (const item of variantsByModelName(m.modelName)) {
          if (!variantMap.has(item.value)) variantMap.set(item.value, item);
        }
        const variants = [...variantMap.values()];
        const isCustomModelName = !m.modelName || m.modelName === customModelNameValue;
        const isCustomModelVariant = !m.modelVariant || m.modelVariant === customModelVariantValue;
        return (
          <div key={m.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 650 }}>{m.model || "自定义模型"}</div>
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
                              imageModels: prev.imageModels.map((x) => (x.id === m.id ? { ...x, enabled: e.target.checked } : x)),
                            }
                          : prev,
                      )
                    }
                  />
                  启用
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={m.supportsMultiRefFusion !== false}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              imageModels: prev.imageModels.map((x) =>
                                x.id === m.id ? { ...x, supportsMultiRefFusion: e.target.checked } : x,
                              ),
                            }
                          : prev,
                      )
                    }
                  />
                  多图参考
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={m.supportsImageEdit !== false}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              imageModels: prev.imageModels.map((x) =>
                                x.id === m.id ? { ...x, supportsImageEdit: e.target.checked } : x,
                              ),
                            }
                          : prev,
                      )
                    }
                  />
                  图像编辑
                </label>
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setSettings((prev) =>
                      prev ? { ...prev, imageModels: prev.imageModels.filter((x) => x.id !== m.id) } : prev,
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
                        id: `image-model-${Date.now()}`,
                        enabled: false,
                      };
                      return { ...prev, imageModels: [...prev.imageModels, clone] };
                    })
                  }
                >
                  复制
                </button>
              </div>
            </div>

            <div style={{ height: 10 }} />

            <SettingsFormField label="模型厂商">
              {isCustomModelName ? (
                <input
                  className="mono"
                  placeholder="请输入你的模型名称"
                  value={m.vendorName}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            imageModels: prev.imageModels.map((x) =>
                              x.id === m.id ? { ...x, vendorName: e.target.value, modelName: customModelNameValue } : x,
                            ),
                          }
                        : prev,
                    )
                  }
                />
              ) : (
                <select
                  className="mono"
                  value={m.modelName}
                  onChange={(e) => {
                    const modelName = e.target.value;
                    if (modelName === customModelNameValue) {
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              imageModels: prev.imageModels.map((x) =>
                                x.id === m.id
                                  ? {
                                      ...x,
                                      vendorName: "",
                                      modelName: customModelNameValue,
                                      modelVariant: customModelVariantValue,
                                      model: "",
                                      label: "",
                                      apiBaseUrl: "",
                                    }
                                  : x,
                              ),
                            }
                          : prev,
                      );
                      return;
                    }
                    const nextVariants = variantsByModelName(modelName);
                    const firstVariant = nextVariants[0]?.value ?? "";
                    const baseUrl = defaultApiBaseUrlByModelName(modelName);
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            imageModels: prev.imageModels.map((x) =>
                              x.id === m.id
                                ? {
                                    ...x,
                                    vendorName: modelName,
                                    modelName,
                                    modelVariant: firstVariant,
                                    model: firstVariant,
                                    label: "",
                                    apiBaseUrl: baseUrl,
                                  }
                                : x,
                            ),
                          }
                        : prev,
                    );
                  }}
                >
                  <option value="">请选择模型名称</option>
                  <option value={customModelNameValue}>自定义（请输入你的模型名称）</option>
                  {vendors.map((v) => (
                    <option key={v.modelName} value={v.modelName}>
                      {v.modelName}
                    </option>
                  ))}
                </select>
              )}
            </SettingsFormField>

            <SettingsFormField label="模型型号">
              {isCustomModelVariant ? (
                <input
                  className="mono"
                  placeholder="请输入你的模型型号"
                  value={m.model}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            imageModels: prev.imageModels.map((x) =>
                              x.id === m.id ? { ...x, modelVariant: customModelVariantValue, model: e.target.value } : x,
                            ),
                          }
                        : prev,
                    )
                  }
                />
              ) : (
                <select
                  className="mono"
                  value={m.modelVariant}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === customModelVariantValue) {
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              imageModels: prev.imageModels.map((x) =>
                                x.id === m.id ? { ...x, modelVariant: customModelVariantValue, model: "" } : x,
                              ),
                            }
                          : prev,
                      );
                      return;
                    }
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            imageModels: prev.imageModels.map((x) =>
                              x.id === m.id ? { ...x, modelVariant: val, model: val, label: "" } : x,
                            ),
                          }
                        : prev,
                    );
                  }}
                >
                  <option value="">请选择模型型号</option>
                  <option value={customModelVariantValue}>自定义（请输入你的模型型号）</option>
                  {variants.length > 0 ? (
                    variants.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))
                  ) : (
                    <option value={m.modelVariant}>{m.modelVariant || "无可选型号"}</option>
                  )}
                </select>
              )}
            </SettingsFormField>

            <SettingsFormField label="接口地址">
              <input
                className="mono"
                placeholder={isCustomModelName ? "请输入你的API Key地址" : "根据模型名称自动填充"}
                value={m.apiBaseUrl}
                disabled={!isCustomModelName}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          imageModels: prev.imageModels.map((x) => (x.id === m.id ? { ...x, apiBaseUrl: e.target.value } : x)),
                        }
                      : prev,
                  )
                }
              />
            </SettingsFormField>

            <SettingsFormField label="API Key（图片节点；不会回显，保存后写入系统凭据）">
              <input
                className="mono"
                value={imageModelKeys[m.id] ?? ""}
                placeholder={hasImageModelKey[m.id] ? "已保存（输入新值可覆盖）" : "请输入 API Key"}
                onChange={(e) => setImageModelKeys((prev) => ({ ...prev, [m.id]: e.target.value }))}
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
                          imageModels: prev.imageModels.map((x) =>
                            x.id === m.id ? { ...x, priority: Number.isFinite(v) ? v : 0 } : x,
                          ),
                        }
                      : prev,
                  );
                }}
              />
            </SettingsFormField>

            <SettingsFormField label="参考图上限（1～4）">
              <input
                type="number"
                min={1}
                max={4}
                value={m.maxReferenceImages ?? 4}
                onChange={(e) => {
                  const v = Math.min(4, Math.max(1, Number(e.target.value) || 4));
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          imageModels: prev.imageModels.map((x) =>
                            x.id === m.id ? { ...x, maxReferenceImages: v } : x,
                          ),
                        }
                      : prev,
                  );
                }}
              />
            </SettingsFormField>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                disabled={testingModelId === m.id}
                onClick={async () => {
                  try {
                    setTestingModelId(m.id);
                    const msg = await invoke<string>("test_image_model_connection", {
                      imageModelId: m.id,
                      apiKeyOverride: imageModelKeys[m.id]?.trim() || null,
                    });
                    setError(null);
                    alert(msg);
                  } catch (e) {
                    alert(formatUserError(e));
                  } finally {
                    setTestingModelId(null);
                  }
                }}
              >
                {testingModelId === m.id ? "测试中…" : "测试连接"}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
