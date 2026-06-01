import { useMemo, useState } from "react";
import {
  hermesAutoChainSettingsHint,
  loadHermesAutoChainSettings,
  clampHermesPackImageCount,
  HERMES_PACK_IMAGE_COUNT_MAX,
  HERMES_PACK_IMAGE_COUNT_MIN,
  hermesBatchSplitStrategyLabel,
  readHermesBatchSplitNodeOverride,
  readHermesNodeOverride,
  resolveHermesBatchSplitSettings,
  type HermesBatchSplitNodeOverride,
  type HermesNodeOverride,
} from "@/lib/hermes/hermesAutoChainPolicy";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  nodeId: string;
  compact?: boolean;
};

/** 脚本节点 Hermes 自动建链策略（节点级覆盖；全屏 / 最大化 / 未挂载侧栏共用） */
export function ScriptHermesAutoChainControl({ nodeId, compact = false }: Props) {
  const node = useProjectStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const [globalSettings] = useState(() => loadHermesAutoChainSettings());

  const params =
    node?.data.params && typeof node.data.params === "object"
      ? (node.data.params as Record<string, unknown>)
      : {};
  const override = readHermesNodeOverride(params);
  const splitOverride = readHermesBatchSplitNodeOverride(params);
  const resolvedSplit = resolveHermesBatchSplitSettings(globalSettings, params);

  const hint = useMemo(() => {
    const globalHint = hermesAutoChainSettingsHint(globalSettings);
    const splitHint = hermesBatchSplitStrategyLabel(
      resolvedSplit.batchSplitStrategy,
      resolvedSplit.packImageCount,
    );
    let line = globalHint;
    if (override === "off") line += " · 本节点：强制关闭";
    else if (override === "on") line += " · 本节点：强制开启";
    else line += " · 本节点：跟随全局";
    if (splitOverride !== "inherit") line += ` · 拆镜：节点覆盖为 ${splitHint}`;
    else line += ` · 拆镜：${splitHint}`;
    return line;
  }, [globalSettings, override, resolvedSplit, splitOverride]);

  const setOverride = (next: HermesNodeOverride) => {
    const { hermesAutoChain: _drop, ...rest } = params;
    updateNodeData(nodeId, {
      params: next === "inherit" ? rest : { ...rest, hermesAutoChain: next },
    });
  };

  const setSplitOverride = (next: HermesBatchSplitNodeOverride) => {
    const { hermesBatchSplit: _drop, ...rest } = params;
    updateNodeData(nodeId, {
      params: next === "inherit" ? rest : { ...rest, hermesBatchSplit: next },
    });
  };

  const setNodePackCount = (count: number) => {
    updateNodeData(nodeId, {
      params: {
        ...params,
        hermesPackImageCount: clampHermesPackImageCount(count),
      },
    });
  };

  return (
    <div className={`scriptHermesPolicy${compact ? " scriptHermesPolicy--compact" : ""}`}>
      <label className="scriptHermesPolicy-label">Hermes 自动建链</label>
      <select
        className="scriptHermesPolicy-select"
        value={override}
        onChange={(e) => setOverride(e.target.value as HermesNodeOverride)}
        aria-label="Hermes 自动建链策略"
      >
        <option value="inherit">跟随全局设置</option>
        <option value="off">本节点关闭</option>
        <option value="on">本节点开启</option>
      </select>
      <label className="scriptHermesPolicy-label" style={{ marginTop: 8 }}>
        批量出图 · 拆镜
      </label>
      <select
        className="scriptHermesPolicy-select"
        value={splitOverride}
        onChange={(e) => setSplitOverride(e.target.value as HermesBatchSplitNodeOverride)}
        aria-label="Hermes 批量拆镜策略"
      >
        <option value="inherit">跟随全局拆镜策略</option>
        <option value="pack_forward">本节点：打包拆镜</option>
        <option value="per_beat">本节点：逐镜出图</option>
      </select>
      {(splitOverride === "pack_forward" ||
        (splitOverride === "inherit" && globalSettings.batchSplitStrategy === "pack_forward")) && (
        <select
          className="scriptHermesPolicy-select"
          style={{ marginTop: 6 }}
          value={resolvedSplit.packImageCount}
          onChange={(e) => setNodePackCount(Number(e.target.value))}
          aria-label="Hermes 打包张数"
        >
          {Array.from(
            { length: HERMES_PACK_IMAGE_COUNT_MAX - HERMES_PACK_IMAGE_COUNT_MIN + 1 },
            (_, i) => HERMES_PACK_IMAGE_COUNT_MIN + i,
          ).map((n) => (
            <option key={n} value={n}>
              打包 {n} 张
            </option>
          ))}
        </select>
      )}
      <p className="scriptHermesPolicy-hint">{hint}</p>
    </div>
  );
}
