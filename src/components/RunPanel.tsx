import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";
import { enabledEdges } from "@/lib/edgeState";
import { summarizeAgentPhases, summarizeRunEvents } from "@/lib/runPanelSummaries";
import { fetchRunEvents, fetchRuns } from "@/shared/api/runs";
import { useProjectStore } from "@/store/projectStore";

export function RunPanel() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const edges = useProjectStore((s) => s.edges);
  const lastRunId = useProjectStore((s) => s.lastRunId);
  const nodeRunStateById = useProjectStore((s) => s.nodeRunStateById);
  const rerunFailedSubgraph = useProjectStore((s) => s.rerunFailedSubgraph);
  const hasFailed = Object.values(nodeRunStateById).some((s) => s === "failed");
  const disabledEdgeCount = useMemo(() => edges.length - enabledEdges(edges).length, [edges]);
  const [agentEvents, setAgentEvents] = useState<NodeAgentRuntimeEvent[]>([]);

  useEffect(() => {
    const onAgentEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<NodeAgentRuntimeEvent>).detail;
      if (!detail) return;
      setAgentEvents((prev) => [detail, ...prev].slice(0, 30));
    };
    window.addEventListener("node-agent-event", onAgentEvent);
    return () => window.removeEventListener("node-agent-event", onAgentEvent);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["runs", projectPath, lastRunId],
    queryFn: () => fetchRuns(projectPath!, 12),
    enabled: Boolean(projectPath),
  });
  const latestRunId = data?.[0]?.id ?? null;
  const { data: latestEvents, isLoading: isEventsLoading } = useQuery({
    queryKey: ["run-events", projectPath, latestRunId],
    queryFn: () => fetchRunEvents(projectPath!, latestRunId!),
    enabled: Boolean(projectPath && latestRunId),
  });
  const latestSummary = useMemo(
    () => (latestEvents ? summarizeRunEvents(latestEvents) : null),
    [latestEvents],
  );

  const scriptParseSummary = useMemo(() => {
    if (!latestEvents?.length) return null;
    let requests = 0;
    let responses = 0;
    let retries = 0;
    let failures = 0;
    let lastError = "";
    for (const ev of latestEvents) {
      if (ev.kind === "script_parse_request") requests += 1;
      if (ev.kind === "script_parse_response") responses += 1;
      if (ev.kind === "script_parse_retry") retries += 1;
      if (ev.kind === "script_parse_failed") {
        failures += 1;
        try {
          const p = JSON.parse(ev.payloadJson || "{}") as { error?: string };
          if (p.error) lastError = p.error;
        } catch {
          /* ignore */
        }
      }
    }
    if (requests === 0 && responses === 0 && retries === 0 && failures === 0) return null;
    return { requests, responses, retries, failures, lastError };
  }, [latestEvents]);
  const latestAgentSummary = useMemo(
    () => (latestEvents ? summarizeAgentPhases(latestEvents) : null),
    [latestEvents],
  );

  return (
    <div className="panelBody">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 650 }}>运行记录</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={() => void refetch()} disabled={!projectPath}>
            刷新
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void rerunFailedSubgraph(false)}
            disabled={!projectPath || !lastRunId || !hasFailed}
            title={hasFailed ? "从最近失败节点重跑其下游子图" : "最近一次运行无失败节点"}
          >
            重跑失败子图
          </button>
        </div>
      </div>

      {!projectPath ? <div style={{ color: "var(--muted)" }}>请先打开工程。</div> : null}
      {projectPath && isLoading ? <div style={{ color: "var(--muted)" }}>加载中…</div> : null}
      {projectPath && isError ? <div style={{ color: "var(--danger)" }}>加载运行记录失败</div> : null}
      {projectPath && latestRunId && isEventsLoading ? <div style={{ color: "var(--muted)" }}>分析最近运行中…</div> : null}
      {projectPath && latestRunId && scriptParseSummary ? (
        <div style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 10, fontSize: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 650, marginBottom: 6 }}>脚本解析（run_events）</div>
          <div style={{ color: "var(--muted)", lineHeight: 1.5 }}>
            请求 {scriptParseSummary.requests} · 成功 {scriptParseSummary.responses} · 重试{" "}
            {scriptParseSummary.retries}
            {scriptParseSummary.failures > 0 ? ` · 失败 ${scriptParseSummary.failures}` : ""}
          </div>
          {scriptParseSummary.lastError ? (
            <div style={{ marginTop: 6, color: "var(--danger)", whiteSpace: "pre-wrap" }}>
              {scriptParseSummary.lastError}
            </div>
          ) : null}
        </div>
      ) : null}

      {projectPath && latestRunId && latestSummary ? (
        <div style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 10, fontSize: 12 }}>
          <div style={{ fontWeight: 650, marginBottom: 6 }}>最近运行解读</div>
          <div style={{ color: "var(--muted)", lineHeight: 1.5 }}>
            节点总数 {latestSummary.total} · 成功 {latestSummary.succeeded} · 失败 {latestSummary.failed} · 跳过{" "}
            {latestSummary.skipped}
          </div>
          <div style={{ color: "var(--muted)", marginTop: 4 }}>当前画布禁用连线：{disabledEdgeCount}</div>
          {latestSummary.failedNodeIds.length > 0 ? (
            <div style={{ marginTop: 6, color: "var(--danger)" }}>
              失败节点：{latestSummary.failedNodeIds.join("、")}
            </div>
          ) : null}
          {Object.keys(latestSummary.skippedReasonCount).length > 0 ? (
            <div style={{ marginTop: 6, color: "var(--muted)" }}>
              跳过原因：
              {Object.entries(latestSummary.skippedReasonCount)
                .map(([reason, n]) => `${reason} (${n})`)
                .join("，")}
            </div>
          ) : null}
        </div>
      ) : null}

      {projectPath && latestRunId && latestAgentSummary ? (
        <div style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 10, fontSize: 12 }}>
          <div style={{ fontWeight: 650, marginBottom: 6 }}>Agent 阶段解读（最近运行）</div>
          <div style={{ color: "var(--muted)", lineHeight: 1.5 }}>
            轨迹事件 {latestAgentSummary.totalEvents} 条
            {latestAgentSummary.errorEvents > 0 ? ` · 错误 ${latestAgentSummary.errorEvents}` : ""}
            {latestAgentSummary.stalled.length > 0
              ? ` · 未结束节点 ${latestAgentSummary.stalled.length}`
              : " · 所有节点已收敛"}
          </div>
          {latestAgentSummary.nodePhases.slice(0, 8).map((item) => (
            <div
              key={`${item.nodeId}-${item.latestTs}`}
              style={{
                marginTop: 6,
                color: item.latestPhase === "error" ? "var(--danger)" : "var(--muted)",
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span className="mono">
                {item.nodeId.slice(0, 8)}… · {item.agentName} · {item.latestPhase}
              </span>
              <span className="mono">
                {item.elapsedMs}ms{item.error ? ` · ${item.error}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {agentEvents.length > 0 ? (
        <div style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 10, fontSize: 12 }}>
          <div style={{ fontWeight: 650, marginBottom: 6 }}>Agent 运行轨迹（本次会话）</div>
          <div style={{ display: "grid", gap: 6 }}>
            {agentEvents.map((evt, idx) => (
              <div
                key={`${evt.timestampMs}-${evt.nodeId}-${evt.phase}-${idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  color: evt.phase === "error" ? "var(--danger)" : "var(--muted)",
                }}
              >
                <span className="mono">
                  {new Date(evt.timestampMs).toLocaleTimeString()} · {evt.agentName} · {evt.phase}
                </span>
                <span className="mono">
                  {evt.elapsedMs}ms{evt.error ? ` · ${evt.error}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {projectPath && data?.length === 0 ? <div style={{ color: "var(--muted)" }}>暂无运行记录。</div> : null}
      {data?.map((run) => (
        <div key={run.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
          <div className="mono" style={{ color: "var(--text)" }}>
            {run.id}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            状态：{run.status} · 开始：{new Date(run.startedAt).toLocaleString()}
          </div>
          {run.error ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--danger)", whiteSpace: "pre-wrap" }}>
              {run.error}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
