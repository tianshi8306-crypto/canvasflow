import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ASSET_LIST_DEFAULT_LIMIT } from "@/lib/canvasAssets";
import { useAssetIdVisibilityPreference } from "@/hooks/useAssetIdVisibilityPreference";
import { listAssets } from "@/shared/api/assets";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";

export function AssetPanel() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [manualPath, setManualPath] = useState("assets/sample.png");
  const [showAssetIds, setShowAssetIds] = useAssetIdVisibilityPreference();

  const { data, refetch, isLoading } = useQuery({
    queryKey: projectPath ? queryKeys.assets.list(projectPath) : ["assets", "__none__"],
    queryFn: () => listAssets(projectPath!, ASSET_LIST_DEFAULT_LIMIT),
    enabled: Boolean(projectPath),
    staleTime: 15_000,
    retry: 1,
  });

  return (
    <div className="panelBody">
      <div style={{ fontWeight: 650 }}>资产与历史</div>
      <div className="field">
        <label>快速引用路径（手动）</label>
        <input
          className="mono"
          value={manualPath}
          onChange={(e) => setManualPath(e.target.value)}
          placeholder="assets/xxx.mp4"
        />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={() => void refetch()} disabled={!projectPath}>
          刷新资产
        </button>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: 12,
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={showAssetIds}
            onChange={(e) => setShowAssetIds(e.target.checked)}
          />
          显示素材 ID
        </label>
      </div>
      {!projectPath ? <div style={{ color: "var(--muted)" }}>请先打开工程。</div> : null}
      {projectPath && isLoading ? <div style={{ color: "var(--muted)" }}>加载中…</div> : null}
      {data?.map((asset) => (
        <div key={asset.assetId} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
          <div className="mono" style={{ color: "var(--text)", wordBreak: "break-all" }}>
            {asset.relPath}
          </div>
          {showAssetIds ? (
            <div
              className="mono"
              style={{ color: "var(--muted)", fontSize: 11, wordBreak: "break-all", marginTop: 4 }}
              title={asset.assetId}
            >
              {asset.assetId}
            </div>
          ) : null}
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {asset.mediaType} · {new Date(asset.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
