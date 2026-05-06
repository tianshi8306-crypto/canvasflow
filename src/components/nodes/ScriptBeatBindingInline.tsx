import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import {
  incomingScriptUpstreamState,
  inspectorScriptUpstreamHint,
  orderedIncomingScriptNodeIds,
} from "@/lib/incomingScriptBinding";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";

type Choice = { beatId: string; label: string; shotNumber: string };

function buildChoices(nodes: ReturnType<typeof useProjectStore.getState>["nodes"], edges: ReturnType<typeof useProjectStore.getState>["edges"], nodeId: string): Choice[] {
  const node = nodes.find((n) => n.id === nodeId);
  const t = node?.type ?? "";
  if (t !== "imageNode" && t !== "audioNode" && t !== "videoNode") return [];
  const scriptIds = orderedIncomingScriptNodeIds(nodes, edges, nodeId);
  const out: Choice[] = [];
  for (const scriptId of scriptIds) {
    const sn = nodes.find((n) => n.id === scriptId);
    const rawBeats = sn?.data.scriptBeats;
    if (!rawBeats?.length) continue;
    const scriptLabel = (sn?.data.label ?? "").trim().slice(0, 10) || scriptId.slice(0, 6);
    const beats = normalizeScriptBeats(rawBeats);
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      const num = (b.shotNumber ?? "").trim() || String(i + 1);
      const desc = (b.description ?? "").trim().replace(/\s+/g, " ").slice(0, 36);
      const more = desc.length >= 36 ? "…" : "";
      const label =
        scriptIds.length > 1 ? `[${scriptLabel}] 镜${num} · ${desc}${more}` : `镜${num} · ${desc}${more}`;
      out.push({ beatId: b.id, label: label.trim() || `镜${num}`, shotNumber: num });
    }
  }
  return out;
}

function safeParamsRecord(p: unknown): Record<string, unknown> {
  return p && typeof p === "object" && !Array.isArray(p) ? { ...(p as Record<string, unknown>) } : {};
}

export function ScriptBeatBindingInline({ nodeId, dense }: { nodeId: string; dense?: boolean }) {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId) ?? null, [nodes, nodeId]);
  const choices = useMemo(() => buildChoices(nodes, edges, nodeId), [nodes, edges, nodeId]);

  const upstreamState = useMemo(() => {
    if (!node) return "none" as const;
    const t = node.type ?? "";
    if (t !== "imageNode" && t !== "audioNode" && t !== "videoNode") return "none" as const;
    return incomingScriptUpstreamState(nodes, edges, nodeId);
  }, [node, nodes, edges, nodeId]);

  const curBeatId = useMemo(() => {
    const cur = String((node?.data.params as Record<string, unknown> | undefined)?.scriptBeatId ?? "").trim();
    return cur;
  }, [node]);

  const orphanId = useMemo(() => {
    if (!curBeatId) return "";
    if (choices.length === 0) return "";
    return choices.some((c) => c.beatId === curBeatId) ? "" : curBeatId;
  }, [choices, curBeatId]);

  if (!node) return null;
  const t = node.type ?? "";
  if (t !== "imageNode" && t !== "audioNode" && t !== "videoNode") return null;

  const hint = inspectorScriptUpstreamHint(upstreamState);
  const wrapClass = dense ? "scriptBeatInline scriptBeatInline--dense" : "scriptBeatInline";

  return (
    <div className={wrapClass} onPointerDown={(e) => e.stopPropagation()}>
      <div className="scriptBeatInlineRow">
        <span className="scriptBeatInlineLabel">绑定镜头</span>
        {choices.length > 0 ? (
          <select
            className="scriptBeatInlineSelect mono"
            value={curBeatId}
            onChange={(e) => {
              const v = e.target.value.trim();
              const hit = choices.find((c) => c.beatId === v);
              const base = safeParamsRecord(node.data.params);
              if (!v) {
                delete base.scriptBeatId;
                delete base.shotNumber;
              } else {
                base.scriptBeatId = v;
                if (hit?.shotNumber) base.shotNumber = hit.shotNumber;
              }
              updateNodeData(nodeId, { params: base });
            }}
          >
            <option value="">（不绑定镜头）</option>
            {orphanId ? (
              <option value={orphanId}>
                当前：{orphanId.slice(0, 10)}…（上游列表中未找到，保留原绑定）
              </option>
            ) : null}
            {choices.map((c) => (
              <option key={c.beatId} value={c.beatId}>
                {c.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="scriptBeatInlineValue mono" title={curBeatId || "未绑定"}>
            {curBeatId ? `${curBeatId.slice(0, 10)}…` : "未绑定"}
          </span>
        )}
      </div>
      <div className="scriptBeatInlineHint">{hint}</div>
    </div>
  );
}

