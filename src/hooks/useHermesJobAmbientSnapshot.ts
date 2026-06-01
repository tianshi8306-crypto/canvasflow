import { useMemo } from "react";
import { buildHermesJobAmbientSnapshot } from "@/lib/hermes/agent/hermesJobAmbient";
import { useHermesJobStore } from "@/lib/hermes/agent/hermesJobStore";
import { useHermesTaskStore } from "@/store/hermesTaskStore";

export function useHermesJobAmbientSnapshot(projectPath: string | null) {
  const jobs = useHermesJobStore((s) => s.jobs);
  const tasks = useHermesTaskStore((s) => s.tasks);
  return useMemo(
    () => buildHermesJobAmbientSnapshot(jobs, tasks, projectPath),
    [jobs, projectPath, tasks],
  );
}
