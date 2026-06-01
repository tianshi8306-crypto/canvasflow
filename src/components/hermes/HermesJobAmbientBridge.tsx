import { useEffect, useRef } from "react";
import type { HermesJob, HermesJobStatus } from "@/lib/hermes/agent/hermesJobStore";
import { useHermesJobStore } from "@/lib/hermes/agent/hermesJobStore";
import { pushHermesJobToast } from "@/store/hermesJobToastStore";
import { useProjectStore } from "@/store/projectStore";

function terminalToastForJob(job: HermesJob): { kind: "success" | "error" | "info"; message: string } | null {
  switch (job.status) {
    case "done":
      return {
        kind: "success",
        message: job.payload.plan.isRecovery
          ? "修复步骤已完成，请在画布审核。"
          : `「${job.title}」执行完成`,
      };
    case "failed":
      return {
        kind: "error",
        message: job.error
          ? `「${job.title}」失败：${job.error.slice(0, 80)}`
          : `「${job.title}」执行失败`,
      };
    case "cancelled":
      return { kind: "info", message: `「${job.title}」已取消` };
    default:
      return null;
  }
}

/** Job 终态 → ambient toast（不写入聊天） */
export function HermesJobAmbientBridge() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const jobs = useHermesJobStore((s) => s.jobs);
  const prevStatusRef = useRef<Map<string, HermesJobStatus>>(new Map());

  useEffect(() => {
    if (!projectPath) return;
    const prev = prevStatusRef.current;
    for (const job of jobs) {
      if (job.projectPath !== projectPath || job.kind !== "director_plan") continue;
      const was = prev.get(job.id);
      if (was === job.status) continue;
      prev.set(job.id, job.status);
      if (
        was &&
        (was === "running" || was === "queued") &&
        (job.status === "done" || job.status === "failed" || job.status === "cancelled")
      ) {
        const toast = terminalToastForJob(job);
        if (toast) pushHermesJobToast(toast);
      }
    }
  }, [jobs, projectPath]);

  return null;
}
