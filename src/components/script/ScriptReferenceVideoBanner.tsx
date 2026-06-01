import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatScriptReferenceVideoMediaMeta,
  listScriptReferenceVideoSources,
  incomingVideoUpstreamState,
  scriptReferenceVideoDisabledMessage,
  scriptReferenceVideoPanelHint,
  scriptReferenceVideoStatusMessage,
  type ScriptReferenceVideoSource,
} from "@/lib/scriptReferenceVideo";
import { probeScriptReferenceVideoMeta } from "@/lib/scriptReferenceVideoProbe";
import { useFocusLinkedPartnerNode } from "@/hooks/canvas/useFocusLinkedPartnerNode";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  nodeId: string;
  variant?: "float" | "inline";
};

export function ScriptReferenceVideoBanner({ nodeId, variant = "inline" }: Props) {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const { focusPartnerNode } = useFocusLinkedPartnerNode();

  const upstreamState = useMemo(
    () => incomingVideoUpstreamState(nodes, edges, nodeId),
    [edges, nodeId, nodes],
  );
  const baseSources = useMemo(
    () => listScriptReferenceVideoSources(nodes, edges, nodeId),
    [edges, nodeId, nodes],
  );
  const projectPath = useProjectStore((s) => s.projectPath);
  const [mediaMetaByNode, setMediaMetaByNode] = useState<
    Record<string, ScriptReferenceVideoSource["mediaMeta"]>
  >({});

  useEffect(() => {
    if (!projectPath?.trim()) {
      setMediaMetaByNode({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, ScriptReferenceVideoSource["mediaMeta"]> = {};
      for (const s of baseSources) {
        if (!s.hasPath) continue;
        const meta = await probeScriptReferenceVideoMeta(projectPath, s.relPath);
        if (meta) next[s.nodeId] = meta;
      }
      if (!cancelled) setMediaMetaByNode(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [baseSources, projectPath]);

  const sources = useMemo(
    () =>
      baseSources.map((s) => ({
        ...s,
        mediaMeta: mediaMetaByNode[s.nodeId] ?? null,
      })),
    [baseSources, mediaMetaByNode],
  );

  const onFocusUpstream = useCallback(
    (videoNodeId: string) => {
      void focusPartnerNode(videoNodeId, {
        label: sources.find((s) => s.nodeId === videoNodeId)?.label,
      });
    },
    [focusPartnerNode, sources],
  );

  const onFocusFirst = useCallback(() => {
    const first = sources[0];
    if (!first) {
      setStatusText(scriptReferenceVideoStatusMessage([]));
      return;
    }
    void onFocusUpstream(first.nodeId);
  }, [onFocusUpstream, setStatusText, sources]);

  if (variant === "float") {
    if (upstreamState === "none") return null;
    const withPath = sources.filter((s) => s.hasPath).length;
    const title =
      upstreamState === "disabled_only"
        ? scriptReferenceVideoDisabledMessage()
        : sources.length > 0
          ? scriptReferenceVideoStatusMessage(sources)
          : "已连接参考视频节点，但尚未导入媒体文件";

    return (
      <button
        type="button"
        className="nodeChrome-upload-float scriptChrome-sync-float scriptChrome-ref-video-float"
        title={title}
        disabled={upstreamState === "disabled_only"}
        onClick={() => {
          if (upstreamState === "disabled_only") {
            setStatusText(scriptReferenceVideoDisabledMessage());
            return;
          }
          void onFocusFirst();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 8h16v10H4V8Zm3 2v6h4v-6H7Zm6 0v6h4v-6h-4Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M9 6l3-2 3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {upstreamState === "disabled_only"
          ? "参考视频已禁用"
          : sources.length > 0
            ? `参考视频 · ${sources.length}${withPath < sources.length ? `（${withPath} 有路径）` : ""}`
            : "参考视频（无路径）"}
      </button>
    );
  }

  const panelHint = scriptReferenceVideoPanelHint(upstreamState);
  const showDisabled = upstreamState === "disabled_only";
  const showReady = sources.length > 0;

  return (
    <div
      className={`scriptUpstreamPanel scriptRefVideoPanel${showDisabled ? " scriptUpstreamPanel--warn" : showReady ? " scriptUpstreamPanel--ok" : ""}`}
      role="region"
      aria-label="参考视频"
    >
      {panelHint ? <p className="scriptUpstreamPanel-hint">{panelHint}</p> : null}
      {showDisabled ? (
        <p className="scriptUpstreamPanel-msg">{scriptReferenceVideoDisabledMessage()}</p>
      ) : null}
      {showReady ? (
        <>
          <p className="scriptUpstreamPanel-msg">{scriptReferenceVideoStatusMessage(sources)}</p>
          <ul className="scriptUpstreamPanel-list">
            {sources.map((s) => (
              <li key={s.nodeId}>
                <span className="scriptUpstreamPanel-label">{s.label}</span>
                <span className="scriptUpstreamPanel-meta mono">
                  {s.hasPath
                    ? `${s.relPath}${formatScriptReferenceVideoMediaMeta(s.mediaMeta)}`
                    : "未导入媒体"}
                </span>
                <button
                  type="button"
                  className="btn scriptUpstreamPanel-locateBtn"
                  onClick={() => void onFocusUpstream(s.nodeId)}
                >
                  定位
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {upstreamState === "enabled" && sources.length === 0 ? (
        <p className="scriptUpstreamPanel-msg">
          参考视频节点已连线，但尚未导入文件。请在视频节点导入媒体后再解析。
        </p>
      ) : null}
    </div>
  );
}
