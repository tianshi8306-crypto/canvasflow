import type { Dispatch, SetStateAction } from "react";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import { SettingsPageHead } from "@/components/settings/SettingsPageHead";
import { SettingsAgentSection } from "@/components/settings/SettingsAgentSection";
import { SettingsMcpServersSection } from "@/components/settings/SettingsMcpServersSection";
import { SettingsCanvasMcpServerSection } from "@/components/settings/SettingsCanvasMcpServerSection";
import { SettingsHermesPlanTemplates } from "@/components/settings/SettingsHermesPlanTemplates";
import { SettingsHermesModelHudSection } from "@/components/settings/SettingsHermesModelHudSection";
import { pickProjectFolder } from "@/lib/pickProjectFolder";
import {
  clampHermesPackImageCount,
  HERMES_PACK_IMAGE_COUNT_MAX,
  HERMES_PACK_IMAGE_COUNT_MIN,
  type HermesAutoChainSettings,
  type HermesBatchSplitStrategy,
  type HermesGlobalScope,
} from "@/lib/hermes/hermesAutoChainPolicy";

type Props = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings | null>>;
  projectPath: string | null;
  hermesAutoChain: HermesAutoChainSettings;
  onPatchHermesAutoChain: (patch: Partial<HermesAutoChainSettings>) => void;
  hermesMemoryPreview: string | null;
};

export function SettingsAgentPane({
  settings,
  setSettings,
  projectPath,
  hermesAutoChain,
  onPatchHermesAutoChain,
  hermesMemoryPreview,
}: Props) {
  return (
    <>
      <SettingsPageHead
        title="Agent"
        description="灵体 Hermes 的自动执行、分镜建链、记忆与 MCP 扩展。"
      />

      <SettingsAgentSection />

      <div className="settingsSection">
        <div className="settingsSectionTitle">分镜自动建链</div>
        <div className="settingsField">
          <span className="settingsFieldHint">
            分镜文案就绪后，按策略自动创建图片与视频节点（不含脚本解析阶段）。
          </span>
          <div className="settingsToggle">
            <input
              type="checkbox"
              id="hermesAutoChainEnabled"
              checked={hermesAutoChain.enabled}
              onChange={(e) => onPatchHermesAutoChain({ enabled: e.target.checked })}
            />
            <label htmlFor="hermesAutoChainEnabled" className="settingsToggleLabel">
              <span className="settingsToggleSwitch" />
              <span className="settingsToggleText">启用自动建链</span>
            </label>
          </div>
          {hermesAutoChain.enabled ? (
            <>
              <div className="settingsField">
                <label className="settingsFieldLabel">自动建链范围</label>
                <select
                  className="settingsInput"
                  value={hermesAutoChain.scope}
                  onChange={(e) =>
                    onPatchHermesAutoChain({ scope: e.target.value as HermesGlobalScope })
                  }
                >
                  <option value="selected_only">仅已勾选且就绪的镜头</option>
                  <option value="all_ready">全部就绪的镜头</option>
                </select>
              </div>
              <div className="settingsField">
                <label className="settingsFieldLabel">批量出图 · 拆镜策略</label>
                <select
                  className="settingsInput"
                  value={hermesAutoChain.batchSplitStrategy}
                  onChange={(e) =>
                    onPatchHermesAutoChain({
                      batchSplitStrategy: e.target.value as HermesBatchSplitStrategy,
                    })
                  }
                >
                  <option value="pack_forward">打包拆镜（首镜多图，向后填充空缺镜）</option>
                  <option value="per_beat">逐镜出图（每镜独立生成）</option>
                </select>
              </div>
              {hermesAutoChain.batchSplitStrategy === "pack_forward" ? (
                <div className="settingsField">
                  <label className="settingsFieldLabel">打包张数</label>
                  <select
                    className="settingsInput"
                    value={hermesAutoChain.packImageCount}
                    onChange={(e) =>
                      onPatchHermesAutoChain({
                        packImageCount: clampHermesPackImageCount(Number(e.target.value)),
                      })
                    }
                  >
                    {Array.from(
                      {
                        length: HERMES_PACK_IMAGE_COUNT_MAX - HERMES_PACK_IMAGE_COUNT_MIN + 1,
                      },
                      (_, i) => HERMES_PACK_IMAGE_COUNT_MIN + i,
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n} 张
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <SettingsMcpServersSection
        settings={settings}
        onChange={(patch) => setSettings((prev) => (prev ? { ...prev, ...patch } : prev))}
      />

      <SettingsCanvasMcpServerSection projectPath={projectPath} />

      <div className="settingsSection">
        <div className="settingsSectionTitle">对话模板</div>
        <div className="settingsField">
          <span className="settingsFieldHint">
            Hermes 仅通过画布 <strong>H</strong> 浮窗对话驱动：识别到可执行意图后自动在画布落结果。请在画布审核；不满意时继续对话或改节点。
          </span>
        </div>
        <SettingsHermesPlanTemplates />
      </div>

      <div className="settingsSection">
        <div className="settingsSectionTitle">记忆</div>
        <div className="settingsField">
          <span className="settingsFieldHint">
            「教给 Hermes」写入的经验会保存为 Markdown，并在本工程检索时优先召回。默认保存在工程目录内；也可指定统一文件夹（按工程名分子目录）。
          </span>
          <div className="settingsField">
            <label className="settingsFieldLabel">保存位置</label>
            <select
              className="settingsInput"
              value={settings.hermesMemoryRoot ? "custom" : "project"}
              onChange={(e) => {
                if (e.target.value === "project") {
                  setSettings({ ...settings, hermesMemoryRoot: null });
                } else {
                  setSettings({
                    ...settings,
                    hermesMemoryRoot: settings.hermesMemoryRoot ?? "",
                  });
                }
              }}
            >
              <option value="project">保存在当前工程内（.canvasflow/hermes-knowledge-user）</option>
              <option value="custom">保存在自定义文件夹</option>
            </select>
          </div>
          {settings.hermesMemoryRoot != null ? (
            <div className="settingsField">
              <label className="settingsFieldLabel" htmlFor="settingsHermesMemoryRoot">
                记忆文件夹
              </label>
              <div className="settingsPathRow">
                <input
                  id="settingsHermesMemoryRoot"
                  className="settingsInput mono"
                  value={settings.hermesMemoryRoot}
                  onChange={(e) =>
                    setSettings({ ...settings, hermesMemoryRoot: e.target.value })
                  }
                  placeholder="例如 D:\HermesMemory"
                />
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    void (async () => {
                      const folder = await pickProjectFolder(projectPath);
                      if (folder) {
                        setSettings({ ...settings, hermesMemoryRoot: folder });
                      }
                    })();
                  }}
                >
                  浏览…
                </button>
              </div>
              <span className="settingsFieldHint">
                每个工程会在该目录下创建子文件夹；索引数据库与 Markdown 同目录。保存设置且已打开工程时，会自动把当前工程的记忆迁移到新位置。
              </span>
            </div>
          ) : null}
          {hermesMemoryPreview ? (
            <span className="settingsFieldHint mono">
              当前工程有效路径：{hermesMemoryPreview}
            </span>
          ) : null}
        </div>
      </div>

      <SettingsHermesModelHudSection />
    </>
  );
}
