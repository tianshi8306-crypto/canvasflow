import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { resolveSpiritShortMark } from "@/lib/hermes/agent/hermesSpiritIdentity";
import { useHermesSpiritIdentityStore } from "@/store/hermesSpiritIdentityStore";
import {
  hermesModelHudHasVisibleContent,
  HERMES_MODEL_HUD_PREFS_UPDATED,
  loadHermesModelHudPrefs,
  type HermesModelHudPrefs,
} from "@/lib/hermes/hermesModelHudPrefs";
import {
  quotaHintForProvider,
  resolveHermesLlmBinding,
  type HermesLlmBindingStatus,
} from "@/lib/hermes/pickHermesProvider";
import {
  formatTokenEstimate,
  getHermesSessionTokens,
  HERMES_USAGE_UPDATED_EVENT,
} from "@/lib/hermes/hermesSessionUsage";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { formatHermesChatScopeLabel } from "@/lib/hermes/hermesShellChat";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { useShallow } from "zustand/react/shallow";
import "@/styles/hermes-model-hud.css";

type HudRow = { id: string; text: string; tone?: "warn" };

function modelPrimaryLine(status: HermesLlmBindingStatus): HudRow | null {
  if (!isTauri()) {
    return { id: "browser", text: "浏览器预览", tone: "warn" };
  }
  if (status.kind === "no_chat_provider") {
    return { id: "no-provider", text: "未配置对话模型", tone: "warn" };
  }
  const binding = status.kind === "ready" ? status.binding : status.binding;
  return { id: "model", text: `${binding.providerLabel} · ${binding.modelDisplay}` };
}

function sessionUsageLine(sessionTokens: number): HudRow {
  const text =
    sessionTokens > 0
      ? `本会话约 ${formatTokenEstimate(sessionTokens)} tokens`
      : "本会话尚无用量";
  return { id: "usage", text };
}

function quotaLine(status: HermesLlmBindingStatus): HudRow | null {
  if (!isTauri() || status.kind === "no_chat_provider") return null;
  const binding = status.kind === "ready" ? status.binding : status.binding;
  const quota = quotaHintForProvider(binding.providerId);
  const extra = status.kind === "missing_key" ? " · 未配置 API Key" : "";
  return {
    id: "quota",
    text: `${quota}${extra}`,
    tone: status.kind === "missing_key" ? "warn" : undefined,
  };
}

function browserPreviewHint(): HudRow {
  return { id: "browser-hint", text: DESKTOP_SHELL_HINT, tone: "warn" };
}

export function HermesModelHud() {
  const [prefs, setPrefs] = useState<HermesModelHudPrefs>(() => loadHermesModelHudPrefs());
  const projectPath = useProjectStore((s) => s.projectPath);
  const spiritIdentity = useHermesSpiritIdentityStore(
    useShallow((s) => ({
      spiritName: s.spiritName,
      userHonorific: s.userHonorific,
      introShown: s.introShown,
    })),
  );
  const hydrateSpirit = useHermesSpiritIdentityStore((s) => s.hydrate);
  const spiritMark = resolveSpiritShortMark(spiritIdentity);
  useEffect(() => {
    void hydrateSpirit(projectPath);
  }, [hydrateSpirit, projectPath]);
  const activeTabId = useCanvasUiStore((s) => s.activeTabId);
  const tabs = useCanvasUiStore(useShallow((s) => s.tabs));
  const chatScopeLabel = useMemo(
    () =>
      formatHermesChatScopeLabel(
        projectPath,
        tabs.find((t) => t.id === activeTabId)?.name,
      ),
    [projectPath, tabs, activeTabId],
  );
  const [status, setStatus] = useState<HermesLlmBindingStatus | null>(null);
  const [sessionTokens, setSessionTokens] = useState(0);

  useEffect(() => {
    const syncPrefs = () => setPrefs(loadHermesModelHudPrefs());
    window.addEventListener(HERMES_MODEL_HUD_PREFS_UPDATED, syncPrefs);
    return () => window.removeEventListener(HERMES_MODEL_HUD_PREFS_UPDATED, syncPrefs);
  }, []);

  const refresh = useCallback(async () => {
    setSessionTokens(getHermesSessionTokens(projectPath));
    if (!isTauri()) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await resolveHermesLlmBinding());
    } catch {
      setStatus({ kind: "no_chat_provider" });
    }
  }, [projectPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSettings = () => void refresh();
    const onUsage = () => setSessionTokens(getHermesSessionTokens(projectPath));
    window.addEventListener("canvasflow-settings-saved", onSettings);
    window.addEventListener(HERMES_USAGE_UPDATED_EVENT, onUsage);
    return () => {
      window.removeEventListener("canvasflow-settings-saved", onSettings);
      window.removeEventListener(HERMES_USAGE_UPDATED_EVENT, onUsage);
    };
  }, [projectPath, refresh]);

  const resolved: HermesLlmBindingStatus =
    status ?? { kind: "no_chat_provider" };

  const rows = useMemo(() => {
    const out: HudRow[] = [];
    if (!isTauri()) {
      if (prefs.showModel) out.push(modelPrimaryLine(resolved)!);
      if (prefs.showScope) out.push({ id: "scope", text: chatScopeLabel });
      if (prefs.showSessionUsage || prefs.showQuotaHint) {
        out.push(browserPreviewHint());
      }
      return out;
    }

    if (prefs.showModel) {
      const model = modelPrimaryLine(resolved);
      if (model) out.push(model);
    }
    if (prefs.showScope) out.push({ id: "scope", text: chatScopeLabel });
    if (prefs.showSessionUsage) out.push(sessionUsageLine(sessionTokens));
    if (prefs.showQuotaHint) {
      const q = quotaLine(resolved);
      if (q) out.push(q);
    }
    return out;
  }, [chatScopeLabel, prefs, resolved, sessionTokens]);

  const dashboardUrl =
    isTauri() && resolved.kind !== "no_chat_provider" ? resolved.binding.dashboardUrl : null;
  const showBalanceLink = prefs.showBalanceLink && Boolean(dashboardUrl);

  const warn = rows.some((r) => r.tone === "warn");

  if (!hermesModelHudHasVisibleContent(prefs)) return null;
  if (isTauri() && !status) return null;
  if (!prefs.showHermesMark && rows.length === 0 && !showBalanceLink) return null;

  const title = [
    `${spiritMark} 对话模型（设置 → 画布 → 灵体模型状态条）`,
    ...rows.map((r) => r.text),
    dashboardUrl ? `控制台：${dashboardUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const primaryRow = rows.find((r) => r.id === "model" || r.id === "no-provider" || r.id === "browser");
  const secondaryRows = rows.filter((r) => r !== primaryRow);

  return (
    <div
      className={`hermesModelHud${warn ? " hermesModelHud--warn" : ""}${
        rows.length === 0 ? " hermesModelHud--compact" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        className="hermesModelHudBtn"
        title={title}
        onClick={() => window.dispatchEvent(new CustomEvent("r3-open-settings"))}
      >
        {prefs.showHermesMark ? (
          <span className="hermesModelHudMark">{spiritMark}</span>
        ) : null}
        {rows.length > 0 ? (
          <span className="hermesModelHudBody">
            {primaryRow ? (
              <span
                className={`hermesModelHudPrimary${
                  primaryRow.tone === "warn" ? " hermesModelHudLine--warn" : ""
                }`}
              >
                {primaryRow.text}
              </span>
            ) : null}
            {secondaryRows.map((row) => (
              <span
                key={row.id}
                className={`hermesModelHudSecondary${
                  row.tone === "warn" ? " hermesModelHudLine--warn" : ""
                }`}
              >
                {row.text}
              </span>
            ))}
          </span>
        ) : null}
        {showBalanceLink ? (
          <a
            className="hermesModelHudLink"
            href={dashboardUrl!}
            target="_blank"
            rel="noopener noreferrer"
            title="打开厂商控制台查看余额"
            onClick={(e) => e.stopPropagation()}
          >
            余额
          </a>
        ) : null}
      </button>
    </div>
  );
}
