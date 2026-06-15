import { useCallback, useEffect, useState } from "react";
import {
  AGENT_RISK_BULLETS,
  agentSettingsFromAppSettings,
  patchHermesAgentSettings,
  refreshHermesAgentSettings,
  type HermesAgentSettings,
} from "@/lib/hermes/agent/hermesAgentSettings";
export function SettingsAgentSection() {
  const [agent, setAgent] = useState<HermesAgentSettings>(() =>
    agentSettingsFromAppSettings(null),
  );
  const [riskOpen, setRiskOpen] = useState(false);

  useEffect(() => {
    void refreshHermesAgentSettings().then(setAgent);
  }, []);

  const patch = useCallback(async (p: Partial<HermesAgentSettings>) => {
    const next = await patchHermesAgentSettings(p);
    setAgent(next);
  }, []);

  return (
    <div className="settingsSection">
      <div className="settingsSectionTitle">执行行为</div>
      <p className="settingsFieldHint" style={{ marginBottom: 12 }}>
        控制 Hermes 是否自动改脚本/分镜并提交生成。关闭后仅展示计划，需回复「执行」再落画布。
      </p>
      <p className="settingsFieldHint" style={{ marginBottom: 12 }}>
        回复长短由 H 根据你的指令自动判断。
      </p>

      <div className="settingsField">
        <div className="settingsToggle">
          <input
            type="checkbox"
            id="agentAutoExecute"
            checked={agent.agentAutoExecute}
            onChange={(e) => void patch({ agentAutoExecute: e.target.checked })}
          />
          <label htmlFor="agentAutoExecute" className="settingsToggleLabel">
            <span className="settingsToggleSwitch" />
            <span className="settingsToggleText">自动执行制片操作</span>
          </label>
        </div>
      </div>

      <div className="settingsField">
        <div className="settingsToggle">
          <input
            type="checkbox"
            id="agentProactiveRecovery"
            checked={agent.agentProactiveRecovery}
            disabled={!agent.agentAutoExecute}
            onChange={(e) => void patch({ agentProactiveRecovery: e.target.checked })}
          />
          <label htmlFor="agentProactiveRecovery" className="settingsToggleLabel">
            <span className="settingsToggleSwitch" />
            <span className="settingsToggleText">
              灵体自动处理失败与续跑（重试视频/分镜、流程修复）
            </span>
          </label>
        </div>
        <span className="settingsFieldHint">
          开启后，检测到失败或未完成的流程时，灵体约 1.5 秒后自动提交修复建议（消耗 API）。需同时开启「自动执行制片操作」。
        </span>
      </div>

      <div className="settingsField">
        <div className="settingsToggle">
          <input
            type="checkbox"
            id="agentAutoBatch"
            checked={agent.agentAutoBatch}
            onChange={(e) => void patch({ agentAutoBatch: e.target.checked })}
          />
          <label htmlFor="agentAutoBatch" className="settingsToggleLabel">
            <span className="settingsToggleSwitch" />
            <span className="settingsToggleText">大批量出图/出视频免「继续」确认</span>
          </label>
        </div>
      </div>

      <div className="settingsField">
        <div className="settingsToggle">
          <input
            type="checkbox"
            id="agentAllowScriptEdit"
            checked={agent.agentAllowScriptEdit}
            onChange={(e) => void patch({ agentAllowScriptEdit: e.target.checked })}
          />
          <label htmlFor="agentAllowScriptEdit" className="settingsToggleLabel">
            <span className="settingsToggleSwitch" />
            <span className="settingsToggleText">允许自动改脚本/分镜</span>
          </label>
        </div>
      </div>

      <div className="settingsField">
        <div className="settingsToggle">
          <input
            type="checkbox"
            id="agentLoopEnabled"
            checked={agent.agentLoopEnabled}
            onChange={(e) => void patch({ agentLoopEnabled: e.target.checked })}
          />
          <label htmlFor="agentLoopEnabled" className="settingsToggleLabel">
            <span className="settingsToggleSwitch" />
            <span className="settingsToggleText">
              步内智能调整（缺图先出图、失败自动修复）
            </span>
          </label>
        </div>
        <span className="settingsFieldHint">
          关闭后按固定计划顺序执行，不在步骤间插入依赖或修复步。
        </span>
      </div>

      <div className="settingsField">
        <div className="settingsToggle">
          <input
            type="checkbox"
            id="agentLongContextLlmSummary"
            checked={agent.agentLongContextLlmSummary}
            onChange={(e) =>
              void patch({ agentLongContextLlmSummary: e.target.checked })
            }
          />
          <label htmlFor="agentLongContextLlmSummary" className="settingsToggleLabel">
            <span className="settingsToggleSwitch" />
            <span className="settingsToggleText">长上下文摘要用 LLM</span>
          </label>
        </div>
        <span className="settingsFieldHint">
          开启后，较长对话写入工程摘要时会调用文本模型压缩；失败时回退为规则摘要。
        </span>
      </div>

      <div className="settingsField">
        <div className="settingsToggle">
          <input
            type="checkbox"
            id="agentPostJobLlmReflect"
            checked={agent.agentPostJobLlmReflect}
            onChange={(e) =>
              void patch({ agentPostJobLlmReflect: e.target.checked })
            }
          />
          <label htmlFor="agentPostJobLlmReflect" className="settingsToggleLabel">
            <span className="settingsToggleSwitch" />
            <span className="settingsToggleText">任务结束后 LLM 复盘</span>
          </label>
        </div>
        <span className="settingsFieldHint">
          制片任务完成后，用对话模型总结可复用经验并写入工程记忆。
        </span>
      </div>

      <div className="settingsField">
        <div className="settingsToggle">
          <input
            type="checkbox"
            id="agentAllowMediaSubmit"
            checked={agent.agentAllowMediaSubmit}
            onChange={(e) => void patch({ agentAllowMediaSubmit: e.target.checked })}
          />
          <label htmlFor="agentAllowMediaSubmit" className="settingsToggleLabel">
            <span className="settingsToggleSwitch" />
            <span className="settingsToggleText">允许自动提交出图/出视频</span>
          </label>
        </div>
      </div>

      <div className="settingsField">
        <label className="settingsFieldLabel" htmlFor="agentMaxConcurrentMedia">
          同时媒体生成任务上限
        </label>
        <select
          id="agentMaxConcurrentMedia"
          className="settingsInput"
          value={agent.agentMaxConcurrentMedia}
          onChange={(e) =>
            void patch({ agentMaxConcurrentMedia: Number(e.target.value) })
          }
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
        <span className="settingsFieldHint">
          批量出图/出视频时，最多同时提交几个镜头的 API 任务（1=顺序，2～3=并行）
        </span>
      </div>

      <div className="settingsField">
        <button
          type="button"
          className="settingsFieldHint"
          style={{ cursor: "pointer", textAlign: "left", border: "none", background: "none", padding: 0 }}
          onClick={() => setRiskOpen((v) => !v)}
          aria-expanded={riskOpen}
        >
          {riskOpen ? "收起风险说明 ▲" : "展开风险说明 ▼"}
        </button>
        {riskOpen ? (
          <ul className="settingsFieldHint" style={{ marginTop: 8, paddingLeft: 18 }}>
            {AGENT_RISK_BULLETS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
