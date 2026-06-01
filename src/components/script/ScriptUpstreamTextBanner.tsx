import { useCallback, useMemo } from "react";
import {
  incomingTextUpstreamState,
  scriptSyncDisabledOnlyStatus,
} from "@/lib/incomingScriptBinding";
import {
  listScriptUpstreamTextSources,
  scriptUpstreamDisabledEdgeMessage,
  scriptUpstreamImportStatusMessage,
  scriptUpstreamPanelHint,
  formatUpstreamTextCharCount,
  totalUpstreamTextChars,
} from "@/lib/scriptUpstreamText";
import { useFocusLinkedPartnerNode } from "@/hooks/canvas/useFocusLinkedPartnerNode";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  nodeId: string;
  /** float：画布节点上方；inline：全屏 / 最大化工作台 */
  variant?: "float" | "inline";
};

export function ScriptUpstreamTextBanner({ nodeId, variant = "inline" }: Props) {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const { focusPartnerNode } = useFocusLinkedPartnerNode();

  const upstreamState = useMemo(
    () => incomingTextUpstreamState(nodes, edges, nodeId),
    [edges, nodeId, nodes],
  );
  const sources = useMemo(
    () => listScriptUpstreamTextSources(nodes, edges, nodeId),
    [edges, nodeId, nodes],
  );

  const onFocusUpstream = useCallback(
    (textNodeId: string) => {
      void focusPartnerNode(textNodeId, { label: sources.find((s) => s.nodeId === textNodeId)?.label });
    },
    [focusPartnerNode, sources],
  );

  const onFocusFirst = useCallback(() => {
    const first = sources[0];
    if (!first) {
      setStatusText(scriptUpstreamImportStatusMessage([]));
      return;
    }
    void onFocusUpstream(first.nodeId);
  }, [onFocusUpstream, setStatusText, sources]);

  if (variant === "float") {
    if (upstreamState === "none") return null;
    const total = totalUpstreamTextChars(sources);
    const title =
      upstreamState === "disabled_only"
        ? scriptUpstreamDisabledEdgeMessage()
        : sources.length > 0
          ? scriptUpstreamImportStatusMessage(sources)
          : "已连接上游文本节点，但正文为空，请先在文本节点中写入剧本";

    return (
      <button
        type="button"
        className="nodeChrome-upload-float scriptChrome-sync-float scriptChrome-upstream-float"
        title={title}
        disabled={upstreamState === "disabled_only" || sources.length === 0}
        onClick={() => {
          if (upstreamState === "disabled_only") {
            setStatusText(scriptSyncDisabledOnlyStatus("定位上游剧本"));
            return;
          }
          void onFocusFirst();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 6h16M4 12h10M4 18h7M14 12l4 4m0-4-4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {upstreamState === "disabled_only"
          ? "上游已禁用"
          : sources.length > 0
            ? `上游剧本 · ${formatUpstreamTextCharCount(total)}字`
            : "上游文本（空）"}
      </button>
    );
  }

  const panelHint = scriptUpstreamPanelHint(upstreamState);
  const showDisabled = upstreamState === "disabled_only";
  const showReady = sources.length > 0;

  return (
    <div
      className={`scriptUpstreamPanel${showDisabled ? " scriptUpstreamPanel--warn" : showReady ? " scriptUpstreamPanel--ok" : ""}`}
      role="region"
      aria-label="上游剧本导入"
    >
      {panelHint ? <p className="scriptUpstreamPanel-hint">{panelHint}</p> : null}
      {showDisabled ? (
        <p className="scriptUpstreamPanel-msg">{scriptUpstreamDisabledEdgeMessage()}</p>
      ) : null}
      {showReady ? (
        <>
          <p className="scriptUpstreamPanel-msg">{scriptUpstreamImportStatusMessage(sources)}</p>
          <ul className="scriptUpstreamPanel-list">
            {sources.map((s) => (
              <li key={s.nodeId}>
                <span className="scriptUpstreamPanel-label">{s.label}</span>
                <span className="scriptUpstreamPanel-meta mono">
                  {formatUpstreamTextCharCount(s.charCount)} 字
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
        <p className="scriptUpstreamPanel-msg">上游文本节点已连线，但正文为空。请在文本节点粘贴剧本后再解析。</p>
      ) : null}
    </div>
  );
}
