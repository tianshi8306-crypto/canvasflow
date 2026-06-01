import { useCallback, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import {
  defaultHermesMcpServer,
  probeExternalMcpServer,
  type HermesMcpServerConfig,
} from "@/lib/hermes/agent/hermesExternalMcp";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";

type Props = {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
};

function parseArgsLine(line: string): string[] {
  return line
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SettingsMcpServersSection({ settings, onChange }: Props) {
  const servers = settings.hermesMcpServers ?? [];
  const [probingId, setProbingId] = useState<string | null>(null);
  const [probeNote, setProbeNote] = useState<string | null>(null);

  const updateServers = useCallback(
    (next: HermesMcpServerConfig[]) => {
      onChange({ hermesMcpServers: next });
    },
    [onChange],
  );

  const patchServer = (id: string, patch: Partial<HermesMcpServerConfig>) => {
    updateServers(
      servers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  };

  const removeServer = (id: string) => {
    updateServers(servers.filter((s) => s.id !== id));
  };

  const addServer = () => {
    updateServers([...servers, defaultHermesMcpServer()]);
  };

  const runProbe = async (server: HermesMcpServerConfig) => {
    if (!isTauri()) {
      setProbeNote(DESKTOP_SHELL_HINT);
      return;
    }
    setProbingId(server.id);
    setProbeNote(null);
    try {
      const count = await probeExternalMcpServer(server);
      setProbeNote(`「${server.label}」连接成功，发现 ${count} 个工具。`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setProbeNote(`「${server.label}」连接失败：${msg}`);
    } finally {
      setProbingId(null);
    }
  };

  return (
    <section className="settingsSection" aria-labelledby="settings-mcp-heading">
      <h3 id="settings-mcp-heading" className="settingsSectionTitle">
        外接 MCP（stdio）
      </h3>
      <p className="settingsSectionDesc">
        通过子进程连接 MCP Server（如 filesystem、自定义工具）。画布制片仍走内置 Canvas
        MCP；外接工具供 Hermes 扩展能力。仅运行你信任的服务。
      </p>

      {servers.length === 0 ? (
        <p className="settingsFieldHint">尚未配置外接 MCP。可添加一条后点「测试连接」。</p>
      ) : null}

      {servers.map((server) => (
        <div key={server.id} className="settingsMcpCard">
          <div className="settingsField">
            <label className="settingsFieldLabel">显示名称</label>
            <input
              className="settingsInput"
              value={server.label}
              onChange={(e) => patchServer(server.id, { label: e.target.value })}
            />
          </div>
          <div className="settingsField">
            <label className="settingsFieldLabel">命令</label>
            <input
              className="settingsInput"
              value={server.command}
              placeholder="npx"
              onChange={(e) => patchServer(server.id, { command: e.target.value })}
            />
          </div>
          <div className="settingsField">
            <label className="settingsFieldLabel">参数（空格分隔）</label>
            <input
              className="settingsInput"
              value={server.args.join(" ")}
              placeholder="-y @modelcontextprotocol/server-filesystem ."
              onChange={(e) =>
                patchServer(server.id, { args: parseArgsLine(e.target.value) })
              }
            />
          </div>
          <div className="settingsField settingsField--row">
            <label className="settingsToggle">
              <input
                type="checkbox"
                checked={server.enabled}
                onChange={(e) => patchServer(server.id, { enabled: e.target.checked })}
              />
              <span className="settingsToggleText">启用</span>
            </label>
            <button
              type="button"
              className="settingsBtn settingsBtn--secondary"
              disabled={probingId === server.id}
              onClick={() => void runProbe(server)}
            >
              {probingId === server.id ? "测试中…" : "测试连接"}
            </button>
            <button
              type="button"
              className="settingsBtn settingsBtn--ghost"
              onClick={() => removeServer(server.id)}
            >
              删除
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="settingsBtn settingsBtn--secondary" onClick={addServer}>
        添加 MCP 服务
      </button>

      {probeNote ? <p className="settingsFieldHint">{probeNote}</p> : null}

      <p className="settingsFieldHint">
        Hermes 对话可说「外接 mcp 工具」查看列表；「调用 mcp Filesystem list_directory
        {`{"path":"."}`}」试调工具（服务名填显示名称）。
      </p>
    </section>
  );
}
