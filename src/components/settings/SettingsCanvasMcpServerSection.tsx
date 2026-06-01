import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  buildCursorMcpServerConfigSnippet,
  CANVAS_MCP_BRIDGE_PORT,
} from "@/lib/hermes/mcp/canvasMcpToolsCatalog";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";

type BridgeStatus = {
  listening: boolean;
  port: number;
  frontendReady: boolean;
  projectPath?: string | null;
};

type Props = {
  projectPath: string | null;
};

export function SettingsCanvasMcpServerSection({ projectPath }: Props) {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [copied, setCopied] = useState(false);

  const configSnippet = useMemo(() => {
    const examplePath = "D:/vibevideo/scripts/canvasflow-mcp-server.mjs";
    return buildCursorMcpServerConfigSnippet(examplePath);
  }, []);

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      setStatus(null);
      return;
    }
    try {
      const s = await invoke<BridgeStatus>("canvas_mcp_bridge_status");
      setStatus(s);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(t);
  }, [refresh, projectPath]);

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configSnippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (!isTauri()) {
    return (
      <div className="settingsField" style={{ marginTop: 16 }}>
        <div className="settingsSectionTitle" style={{ fontSize: 14 }}>
          对外 Canvas MCP（stdio）
        </div>
        <p className="settingsFieldHint">{DESKTOP_SHELL_HINT}</p>
      </div>
    );
  }

  return (
    <div className="settingsField" style={{ marginTop: 16 }}>
      <div className="settingsSectionTitle" style={{ fontSize: 14 }}>
        对外 Canvas MCP（stdio）
      </div>
      <p className="settingsFieldHint" style={{ marginBottom: 8 }}>
        将下方 JSON 粘贴到 Cursor → Settings → MCP；把 <code>args</code> 改为你本机{" "}
        <code>scripts/canvasflow-mcp-server.mjs</code> 的绝对路径。也可本地试跑：{" "}
        <code>npm run mcp:server</code>
      </p>
      <p className="settingsFieldHint" style={{ marginBottom: 8 }}>
        桥接（127.0.0.1:{CANVAS_MCP_BRIDGE_PORT}）：
        {status?.listening ? "监听中" : "未启动"}
        {status?.frontendReady ? " · 前端就绪" : " · 等待前端"}
        {projectPath || status?.projectPath
          ? ` · 工程已加载`
          : " · 请先打开工程"}
      </p>
      <pre
        className="settingsFieldHint"
        style={{
          whiteSpace: "pre-wrap",
          fontSize: 11,
          padding: 10,
          borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          marginBottom: 8,
        }}
      >
        {configSnippet}
      </pre>
      <button type="button" className="btn btnSecondary" onClick={() => void copyConfig()}>
        {copied ? "已复制" : "复制 Cursor MCP 配置"}
      </button>
    </div>
  );
}
