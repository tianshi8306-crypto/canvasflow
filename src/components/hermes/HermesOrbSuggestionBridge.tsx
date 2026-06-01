import { useEffect, useRef } from "react";
import { useHermesOrbSuggestStore } from "@/store/hermesOrbSuggestStore";
import { useHermesTaskStore } from "@/store/hermesTaskStore";
import { useProjectStore } from "@/store/projectStore";
import {
  canOrbProactiveAutoAct,
  dispatchHermesOrbAutoAct,
  markOrbSuggestionAutoActed,
} from "@/lib/hermes/hermesOrbProactiveAct";
import { HERMES_AGENT_SETTINGS_UPDATED } from "@/lib/hermes/agent/hermesAgentSettings";

const AUTO_ACT_SETTLE_MS = 1500;

/** 订阅画布与任务变化，刷新灵体主动建议；可选自动执行恢复类建议 */
export function HermesOrbSuggestionBridge() {
  const refresh = useHermesOrbSuggestStore((s) => s.refresh);
  const reset = useHermesOrbSuggestStore((s) => s.reset);
  const dismissCurrent = useHermesOrbSuggestStore((s) => s.dismissCurrent);
  const suggestion = useHermesOrbSuggestStore((s) => s.suggestion);
  const projectPath = useProjectStore((s) => s.projectPath);
  const autoActTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>();
  const autoActKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectPath) {
      reset();
      return;
    }
    refresh();
    const unsubProject = useProjectStore.subscribe((state, prev) => {
      if (
        state.nodes !== prev.nodes ||
        state.edges !== prev.edges ||
        state.projectPath !== prev.projectPath
      ) {
        refresh();
      }
    });
    const unsubTasks = useHermesTaskStore.subscribe((state, prev) => {
      if (state.tasks !== prev.tasks) refresh();
    });
    return () => {
      unsubProject();
      unsubTasks();
    };
  }, [projectPath, refresh, reset]);

  useEffect(() => {
    if (autoActTimerRef.current) {
      clearTimeout(autoActTimerRef.current);
      autoActTimerRef.current = undefined;
    }

    if (!projectPath?.trim() || !suggestion) {
      autoActKeyRef.current = null;
      return;
    }

    const prompt = suggestion.actionPrompt.trim();
    if (!canOrbProactiveAutoAct(suggestion.id, projectPath, prompt)) {
      return;
    }

    const actKey = `${suggestion.id}:${prompt}`;
    if (autoActKeyRef.current === actKey) return;

    autoActTimerRef.current = setTimeout(() => {
      const latest = useHermesOrbSuggestStore.getState().suggestion;
      if (!latest || latest.id !== suggestion.id) return;
      const latestPrompt = latest.actionPrompt.trim();
      if (!canOrbProactiveAutoAct(latest.id, projectPath, latestPrompt)) return;

      autoActKeyRef.current = actKey;
      markOrbSuggestionAutoActed(projectPath, latest.id, latestPrompt);
      dismissCurrent();
      dispatchHermesOrbAutoAct({
        prompt: latestPrompt,
        suggestionId: latest.id,
      });
    }, AUTO_ACT_SETTLE_MS);

    return () => {
      if (autoActTimerRef.current) {
        clearTimeout(autoActTimerRef.current);
        autoActTimerRef.current = undefined;
      }
    };
  }, [dismissCurrent, projectPath, suggestion]);

  useEffect(() => {
    const onSettings = () => {
      autoActKeyRef.current = null;
    };
    window.addEventListener(HERMES_AGENT_SETTINGS_UPDATED, onSettings);
    return () => window.removeEventListener(HERMES_AGENT_SETTINGS_UPDATED, onSettings);
  }, []);

  return null;
}
