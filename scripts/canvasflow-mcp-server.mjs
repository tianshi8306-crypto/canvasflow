#!/usr/bin/env node
/**
 * CanvasFlow 对外 MCP stdio Server（T5）
 * Cursor / Claude Desktop 配置 command=node args=[本脚本绝对路径]
 * 需 CanvasFlow 桌面 App 已打开并加载工程（桥接 127.0.0.1:14230）
 */
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MCP_PROTOCOL_VERSION = "2024-11-05";
const BRIDGE_HOST = process.env.CANVASFLOW_MCP_BRIDGE_HOST ?? "127.0.0.1";
const BRIDGE_PORT = Number(process.env.CANVASFLOW_MCP_BRIDGE_PORT ?? "14230");
const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_PATH = join(__dirname, "../src/lib/hermes/mcp/canvasMcpTools.catalog.json");

function loadToolsCatalog() {
  const raw = readFileSync(TOOLS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return parsed.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema ?? { type: "object", properties: {} },
  }));
}

function writeMessage(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

async function bridgeFetch(path, opts = {}) {
  const url = `http://${BRIDGE_HOST}:${BRIDGE_PORT}${path}`;
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { ok: false, message: text };
  }
  if (!res.ok && body.message == null) {
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return { status: res.status, body };
}

async function handleRequest(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "canvasflow-canvas-mcp", version: "0.1.0" },
      },
    });
    return;
  }
  if (method === "notifications/initialized") {
    return;
  }
  if (method === "tools/list") {
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: { tools: loadToolsCatalog() },
    });
    return;
  }
  if (method === "tools/call") {
    const name = params?.name?.trim?.() ?? "";
    const args = params?.arguments ?? {};
    try {
      const health = await bridgeFetch("/health");
      if (!health.body?.frontendReady) {
        throw new Error(
          "CanvasFlow App 未就绪：请先打开桌面 App 并加载工程",
        );
      }
      const { body } = await bridgeFetch("/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          arguments: args,
          sourceMessage: `external-mcp:${name}`,
        }),
      });
      if (body.ok === false && body.message) {
        writeMessage({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: body.message }],
            isError: true,
          },
        });
        return;
      }
      writeMessage({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: body.message ?? JSON.stringify(body) }],
          isError: !body.ok,
        },
      });
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      writeMessage({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text }],
          isError: true,
        },
      });
    }
    return;
  }
  if (id != null) {
    writeMessage({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  void handleRequest(msg);
});

process.stderr.write(
  `[canvasflow-mcp] stdio server · bridge http://${BRIDGE_HOST}:${BRIDGE_PORT}\n`,
);
