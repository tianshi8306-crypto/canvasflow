import { useEffect, useRef } from "react";
import {
  dueHermesJobs,
  loadHermesAutomations,
  markHermesJobRan,
} from "@/lib/hermes/agent/hermesAutomation";

/** App 打开时轮询工程内 Hermes 定时任务（需已保存工程路径） */
export function useHermesAutomationRunner(
  projectPath: string | null,
  onRunPrompt: (prompt: string) => void,
  opts?: { enabled?: boolean; intervalMs?: number },
) {
  const onRunRef = useRef(onRunPrompt);
  onRunRef.current = onRunPrompt;
  const runningRef = useRef(false);

  useEffect(() => {
    if (opts?.enabled === false) return;
    if (!projectPath?.trim()) return;

    const tick = async () => {
      if (runningRef.current) return;
      const store = await loadHermesAutomations(projectPath);
      const due = dueHermesJobs(store);
      if (due.length === 0) return;
      runningRef.current = true;
      try {
        for (const job of due.slice(0, 2)) {
          onRunRef.current(`[定时] ${job.prompt}`);
          await markHermesJobRan(projectPath, job.id);
        }
      } finally {
        runningRef.current = false;
      }
    };

    const ms = opts?.intervalMs ?? 60_000;
    const id = window.setInterval(() => void tick(), ms);
    void tick();
    return () => window.clearInterval(id);
  }, [projectPath, opts?.enabled, opts?.intervalMs]);
}
