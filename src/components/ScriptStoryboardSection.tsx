import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { formatUserError } from "@/lib/errors";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { scriptStoryboardGenerateAgentRuntime } from "@/lib/nodeAgentRuntime/scriptStoryboardAgent";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { makeFlowEdge } from "@/lib/flowEdge";
import { defaultVideoGenerationDraft, defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { useProjectStore } from "@/store/projectStore";
import { importMediaFiles } from "@/shared/api/assets";

type Props = {
  nodeId: string;
  beats: ScriptBeat[];
  /** 与脚本工作台勾选一致；用于「为勾选生成分镜」 */
  scriptBeatSelection: string[] | undefined;
  shots: StoryboardShot[] | undefined;
  themePrompt: string;
};

export function ScriptStoryboardSection({
  nodeId,
  beats,
  scriptBeatSelection,
  shots,
  themePrompt,
}: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const addNodesWithEdges = useProjectStore((s) => s.addNodesWithEdges);
  const setSelectedNodeIds = useProjectStore((s) => s.setSelectedNodeIds);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const [sbView, setSbView] = useState<"grid" | "list">("grid");
  const [generating, setGenerating] = useState(false);
  const [detail, setDetail] = useState<StoryboardShot | null>(null);
  const storyboardImageInputRef = useRef<HTMLInputElement | null>(null);

  const shotByBeat = useMemo(() => {
    const m = new Map<string, StoryboardShot>();
    for (const s of shots ?? []) m.set(s.scriptBeatId, s);
    return m;
  }, [shots]);

  const beatsNorm = useMemo(() => normalizeScriptBeats(beats), [beats]);

  const orderedRows = useMemo(() => {
    return beatsNorm.map((b) => ({
      beat: b,
      shot: shotByBeat.get(b.id),
    }));
  }, [beatsNorm, shotByBeat]);

  const storyboardHealth = useMemo(() => {
    const beatIds = new Set(beatsNorm.map((b) => b.id));
    const list = shots ?? [];
    const dupMap = new Map<string, number>();
    for (const s of list) dupMap.set(s.scriptBeatId, (dupMap.get(s.scriptBeatId) ?? 0) + 1);
    const duplicateShotIds = [...dupMap.entries()].filter(([, c]) => c > 1).map(([id]) => id);
    const orphanShots = list.filter((s) => !beatIds.has(s.scriptBeatId));
    const missingShotBeats = beatsNorm.filter((b) => !shotByBeat.get(b.id));
    const emptyPromptBeats = beatsNorm.filter((b) => {
      const s = shotByBeat.get(b.id);
      return Boolean(s && !s.visualPrompt?.trim());
    });
    return {
      totalBeats: beatsNorm.length,
      totalShots: list.length,
      orphanShots,
      duplicateShotIds,
      missingShotBeats,
      emptyPromptBeats,
    };
  }, [beatsNorm, shotByBeat, shots]);

  const runGenerate = async (targetBeats: ScriptBeat[]) => {
    setGenerating(true);
    try {
      if (!projectPath) {
        setStatusText("请先打开工程后再生成分镜");
        return;
      }
      await runNodeTaskAgent(
        scriptStoryboardGenerateAgentRuntime,
        {
          targetBeats,
          themePrompt,
          prevShots: shots,
        },
        {
          nodeId,
          projectPath,
          updateNodeData,
          setStatusText,
        },
      );
    } catch {
      // runNodeTaskAgent 已统一写入失败状态
    } finally {
      setGenerating(false);
    }
  };

  const cleanupStoryboardCache = () => {
    const beatIds = new Set(beatsNorm.map((b) => b.id));
    const list = shots ?? [];
    const seen = new Set<string>();
    const cleaned: StoryboardShot[] = [];
    // 保留同 id 最后一次出现（更贴合“后来覆盖”）
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]!;
      if (!beatIds.has(s.scriptBeatId)) continue;
      if (seen.has(s.scriptBeatId)) continue;
      seen.add(s.scriptBeatId);
      cleaned.push(s);
    }
    cleaned.reverse();
    updateNodeData(nodeId, { storyboardShots: cleaned });
    const removedOrphans = (shots ?? []).filter((s) => !beatIds.has(s.scriptBeatId)).length;
    const removedDups = (shots ?? []).length - removedOrphans - cleaned.length;
    const parts = [
      removedOrphans ? `清理无效 ${removedOrphans} 条` : "",
      removedDups ? `去重 ${removedDups} 条` : "",
    ].filter(Boolean);
    setStatusText(parts.length ? `已清理分镜缓存：${parts.join("，")}` : "分镜缓存无需清理");
  };

  const generateMissingOnly = () => {
    const picked = storyboardHealth.missingShotBeats;
    if (picked.length === 0) {
      setStatusText("当前没有缺失的分镜条目");
      return;
    }
    void runGenerate(picked);
  };

  const generateEmptyPromptsOnly = () => {
    const picked = storyboardHealth.emptyPromptBeats;
    if (picked.length === 0) {
      setStatusText("当前没有空的分镜文案条目");
      return;
    }
    void runGenerate(picked);
  };

  const generateSelected = () => {
    const sel = scriptBeatSelection ?? [];
    const valid = sel.filter((id) => beatsNorm.some((b) => b.id === id));
    const picked = valid.length > 0 ? beatsNorm.filter((b) => valid.includes(b.id)) : beatsNorm;
    if (valid.length === 0 && beatsNorm.length > 0 && sel.length > 0) {
      setStatusText("所选脚本条目已不存在，请重新勾选");
      return;
    }
    void runGenerate(picked);
  };

  const generateAll = () => {
    void runGenerate(beatsNorm);
  };

  const persistShotPatch = (id: string, patch: Partial<StoryboardShot>) => {
    const list = [...(shots ?? [])];
    const idx = list.findIndex((s) => s.scriptBeatId === id);
    const prev =
      idx >= 0 ? list[idx] : ({ scriptBeatId: id, visualPrompt: "" } satisfies StoryboardShot);
    const next: StoryboardShot = { ...prev, ...patch, scriptBeatId: id };
    if (idx >= 0) list[idx] = next;
    else list.push(next);
    updateNodeData(nodeId, { storyboardShots: list });
  };

  const runStoryboardImportFromPaths = (paths: string[]) => {
    if (paths.length === 0 || !detail || !projectPath) return;
    const beatId = detail.scriptBeatId;
    void (async () => {
      try {
        const imported = await importMediaFiles(projectPath, paths.slice(0, 1));
        const item = imported[0];
        if (!item) return;
        persistShotPatch(beatId, { imagePath: item.relPath, imageAssetId: item.assetId });
        setDetail((d) => (d ? { ...d, imagePath: item.relPath } : null));
        setStatusText(`已关联分镜图：${item.relPath}`);
      } catch (e) {
        setStatusText(`导入分镜图失败：${formatUserError(e)}`);
      }
    })();
  };

  const pickStoryboardImage = () => {
    if (!projectPath) {
      setStatusText("请先打开工程后再关联分镜图");
      return;
    }
    if (!detail) return;
    void (async () => {
      if (isTauri()) {
        const paths = await pickImagePathsForImport(false);
        if (paths?.length) runStoryboardImportFromPaths(paths);
      } else {
        storyboardImageInputRef.current?.click();
      }
    })();
  };

  const onStoryboardImageFiles = (ev: ChangeEvent<HTMLInputElement>) => {
    const input = ev.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0 || !detail || !projectPath) return;
    const paths = files
      .map((f) => (f as File & { path?: string }).path)
      .filter((p): p is string => Boolean(p && typeof p === "string"));
    if (paths.length === 0) {
      setStatusText("未拿到本地文件路径：请在 Tauri 桌面端选择文件（浏览器预览不支持 path）");
      return;
    }
    runStoryboardImportFromPaths(paths);
  };

  const createVideoNodesFromSelection = () => {
    const anchor = nodes.find((n) => n.id === nodeId);
    if (!anchor) {
      setStatusText("找不到脚本节点，无法创建视频链路");
      return;
    }
    const selected = (scriptBeatSelection ?? []).filter((id) => beatsNorm.some((b) => b.id === id));
    const picked = selected.length > 0 ? beatsNorm.filter((b) => selected.includes(b.id)) : beatsNorm;
    if (picked.length === 0) {
      setStatusText("请先添加或勾选脚本镜头");
      return;
    }
    const shotMap = new Map((shots ?? []).map((s) => [s.scriptBeatId, s]));
    const gapX = 420;
    const gapY = 230;
    const startY = anchor.position.y - ((picked.length - 1) * gapY) / 2;

    const newNodes: Node<FlowNodeData>[] = [];
    const newEdges = [];
    for (const [i, beat] of picked.entries()) {
      const sid = beat.id;
      const shot = shotMap.get(sid);
      const shotNo = (beat.shotNumber || "").trim() || String(i + 1);
      const promptParts = [
        shot?.visualPrompt?.trim() || beat.description?.trim() || "",
        beat.videoMotionPrompt?.trim() ? `运镜：${beat.videoMotionPrompt.trim()}` : "",
      ].filter(Boolean);
      const prompt = promptParts.join("\n");
      const videoId = crypto.randomUUID();
      const data = newNodeDataByType.videoNode();
      data.label = `镜头 ${shotNo} 视频`;
      data.video = {
        ...defaultVideoNodePersisted(),
        draft: {
          ...defaultVideoGenerationDraft(),
          ...data.video?.draft,
          workflow: "text_to_video",
          prompt,
        },
      };
      data.params = {
        ...(data.params && typeof data.params === "object" ? data.params : {}),
        scriptBeatId: sid,
        shotNumber: shotNo,
      };
      newNodes.push({
        id: videoId,
        type: "videoNode",
        position: { x: anchor.position.x + gapX, y: startY + i * gapY },
        data,
      });
      newEdges.push(makeFlowEdge(nodeId, videoId, "scriptNode"));
    }
    addNodesWithEdges(newNodes, newEdges);
    setSelectedNodeIds(newNodes.map((n) => n.id));
    setStatusText(`已创建 ${newNodes.length} 条「脚本镜头→视频节点」试点链路`);
  };

  const createImageNodesFromSelection = () => {
    const anchor = nodes.find((n) => n.id === nodeId);
    if (!anchor) {
      setStatusText("找不到脚本节点，无法创建图片链路");
      return;
    }
    const selected = (scriptBeatSelection ?? []).filter((id) => beatsNorm.some((b) => b.id === id));
    const picked = selected.length > 0 ? beatsNorm.filter((b) => selected.includes(b.id)) : beatsNorm;
    if (picked.length === 0) {
      setStatusText("请先添加或勾选脚本镜头");
      return;
    }
    const shotMap = new Map((shots ?? []).map((s) => [s.scriptBeatId, s]));
    const gapX = 420;
    const gapY = 230;
    const startY = anchor.position.y - ((picked.length - 1) * gapY) / 2;

    const newNodes: Node<FlowNodeData>[] = [];
    const newEdges = [];
    for (const [i, beat] of picked.entries()) {
      const sid = beat.id;
      const shot = shotMap.get(sid);
      const shotNo = (beat.shotNumber || "").trim() || String(i + 1);
      const promptParts = [shot?.visualPrompt?.trim() || beat.description?.trim() || ""].filter(Boolean);
      const imageId = crypto.randomUUID();
      const data = newNodeDataByType.imageNode();
      data.label = `镜头 ${shotNo} 图`;
      if (promptParts.length) data.prompt = promptParts.join("\n");
      data.params = {
        ...(typeof data.params === "object" && data.params ? data.params : {}),
        scriptBeatId: sid,
        shotNumber: shotNo,
      };
      newNodes.push({
        id: imageId,
        type: "imageNode",
        position: { x: anchor.position.x + gapX, y: startY + i * gapY },
        data,
      });
      newEdges.push(makeFlowEdge(nodeId, imageId, "scriptNode"));
    }
    addNodesWithEdges(newNodes, newEdges);
    setSelectedNodeIds(newNodes.map((n) => n.id));
    setStatusText(`已创建 ${newNodes.length} 条「脚本镜头→图片节点」试点链路`);
  };

  const createAudioNodesFromSelection = () => {
    const anchor = nodes.find((n) => n.id === nodeId);
    if (!anchor) {
      setStatusText("找不到脚本节点，无法创建音频链路");
      return;
    }
    const selected = (scriptBeatSelection ?? []).filter((id) => beatsNorm.some((b) => b.id === id));
    const picked = selected.length > 0 ? beatsNorm.filter((b) => selected.includes(b.id)) : beatsNorm;
    if (picked.length === 0) {
      setStatusText("请先添加或勾选脚本镜头");
      return;
    }
    const gapX = 420;
    const gapY = 230;
    const startY = anchor.position.y - ((picked.length - 1) * gapY) / 2;

    const newNodes: Node<FlowNodeData>[] = [];
    const newEdges = [];
    for (const [i, beat] of picked.entries()) {
      const sid = beat.id;
      const shotNo = (beat.shotNumber || "").trim() || String(i + 1);
      const hint = [beat.dialogue?.trim(), beat.soundEffect?.trim()].filter(Boolean).join("\n");
      const audioId = crypto.randomUUID();
      const data = newNodeDataByType.audioNode();
      data.label = `镜头 ${shotNo} 音频`;
      if (hint) data.prompt = hint;
      data.params = {
        ...(typeof data.params === "object" && data.params ? data.params : {}),
        scriptBeatId: sid,
        shotNumber: shotNo,
      };
      newNodes.push({
        id: audioId,
        type: "audioNode",
        position: { x: anchor.position.x + gapX, y: startY + i * gapY },
        data,
      });
      newEdges.push(makeFlowEdge(nodeId, audioId, "scriptNode"));
    }
    addNodesWithEdges(newNodes, newEdges);
    setSelectedNodeIds(newNodes.map((n) => n.id));
    setStatusText(`已创建 ${newNodes.length} 条「脚本镜头→音频节点」试点链路`);
  };

  return (
    <div id={`script-storyboard-anchor-${nodeId}`} className="storyboardSection">
      <div className="storyboardToolbar">
        <span className="storyboardTitle">分镜（文案 + 本地图）</span>
        <button type="button" className="btn" disabled={sbView === "grid"} onClick={() => setSbView("grid")}>
          网格
        </button>
        <button type="button" className="btn" disabled={sbView === "list"} onClick={() => setSbView("list")}>
          列表
        </button>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={generating || beatsNorm.length === 0}
          title="使用当前 Provider 与 API Key"
          onClick={() => void generateSelected()}
        >
          {generating ? "分镜生成中…" : "为勾选脚本生成分镜"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={generating || beatsNorm.length === 0}
          onClick={() => void generateAll()}
        >
          {generating ? "分镜生成中…" : "为全部脚本生成分镜"}
        </button>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={beatsNorm.length === 0}
          title="M5 试点：按勾选镜头一键创建视频节点并连线"
          onClick={createVideoNodesFromSelection}
        >
          生成视频链路（试点）
        </button>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={beatsNorm.length === 0}
          title="按勾选镜头创建图片节点并写入 params.scriptBeatId"
          onClick={createImageNodesFromSelection}
        >
          生成图片链路（试点）
        </button>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={beatsNorm.length === 0}
          title="按勾选镜头创建音频节点并写入 params.scriptBeatId"
          onClick={createAudioNodesFromSelection}
        >
          生成音频链路（试点）
        </button>
      </div>
      <p className="storyboardHint">
        LLM 生成分镜文案；可在详情中从本机选择一张图导入工程并关联为「分镜图」（不出云端图生）。须已打开工程，桌面端选择文件。
      </p>
      {beatsNorm.length > 0 ? (
        <div className="storyboardHealthBar" role="status" aria-label="分镜一致性自检">
          <div className="storyboardHealthMain">
            <span className="mono">
              镜头 {storyboardHealth.totalBeats} · 分镜缓存 {storyboardHealth.totalShots}
            </span>
            {storyboardHealth.missingShotBeats.length > 0 ? (
              <span className="storyboardHealthWarn mono">缺失 {storyboardHealth.missingShotBeats.length}</span>
            ) : (
              <span className="storyboardHealthOk mono">齐全</span>
            )}
            {storyboardHealth.emptyPromptBeats.length > 0 ? (
              <span className="storyboardHealthWarn mono">空文案 {storyboardHealth.emptyPromptBeats.length}</span>
            ) : null}
            {storyboardHealth.orphanShots.length > 0 ? (
              <span className="storyboardHealthWarn mono">无效缓存 {storyboardHealth.orphanShots.length}</span>
            ) : null}
            {storyboardHealth.duplicateShotIds.length > 0 ? (
              <span className="storyboardHealthWarn mono">重复 {storyboardHealth.duplicateShotIds.length}</span>
            ) : null}
          </div>
          <div className="storyboardHealthActions">
            <button
              type="button"
              className="btn"
              disabled={generating || storyboardHealth.missingShotBeats.length === 0}
              onClick={generateMissingOnly}
              title="只为缺失分镜的镜头补全（不会覆盖已有文案）"
            >
              补生成（缺失）
            </button>
            <button
              type="button"
              className="btn"
              disabled={generating || storyboardHealth.emptyPromptBeats.length === 0}
              onClick={generateEmptyPromptsOnly}
              title="只为分镜文案为空的镜头补全（会覆盖空文案）"
            >
              补生成（空文案）
            </button>
            <button
              type="button"
              className="btn"
              disabled={generating || (storyboardHealth.orphanShots.length === 0 && storyboardHealth.duplicateShotIds.length === 0)}
              onClick={cleanupStoryboardCache}
              title="清理已不在脚本镜头列表中的分镜缓存，并对重复 scriptBeatId 去重"
            >
              清理缓存
            </button>
          </div>
        </div>
      ) : null}
      <input
        ref={storyboardImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
        style={{ display: "none" }}
        onChange={onStoryboardImageFiles}
      />

      {beatsNorm.length === 0 ? (
        <div className="storyboardEmpty">请先在脚本工作台添加或生成脚本条目。</div>
      ) : sbView === "grid" ? (
        <div className="storyboardGrid">
          {orderedRows.map(({ beat, shot }) => (
            <button
              key={beat.id}
              type="button"
              className="storyboardCard"
              onClick={() =>
                setDetail(
                  shot ?? {
                    scriptBeatId: beat.id,
                    visualPrompt: "",
                  },
                )
              }
            >
              {shot?.imagePath && resolveProjectAssetSrc(projectPath, shot.imagePath) ? (
                <div className="storyboardCardThumb">
                  <img
                    alt=""
                    src={resolveProjectAssetSrc(projectPath, shot.imagePath) ?? undefined}
                  />
                </div>
              ) : null}
              <div className="storyboardCardMeta mono">
                {(beat.shotNumber ?? "").trim() || "未标镜号"}
              </div>
              <div className="storyboardCardPreview">
                {shot?.visualPrompt?.trim()
                  ? `${shot.visualPrompt.slice(0, 120)}${shot.visualPrompt.length > 120 ? "…" : ""}`
                  : "待生成 · 点击填写或生成后查看全文"}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="storyboardListWrap">
          <table className="storyboardTable">
            <thead>
              <tr>
                <th style={{ width: 52 }}>图</th>
                <th>场次</th>
                <th>画面描述摘要</th>
                <th style={{ width: 72 }}>回看</th>
              </tr>
            </thead>
            <tbody>
              {orderedRows.map(({ beat, shot }) => (
                <tr key={beat.id}>
                  <td>
                    {shot?.imagePath && resolveProjectAssetSrc(projectPath, shot.imagePath) ? (
                      <img
                        className="storyboardListThumb"
                        alt=""
                        src={resolveProjectAssetSrc(projectPath, shot.imagePath) ?? undefined}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="mono">{beat.shotNumber}</td>
                  <td>
                    {shot?.visualPrompt?.trim()
                      ? `${shot.visualPrompt.slice(0, 80)}${shot.visualPrompt.length > 80 ? "…" : ""}`
                      : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "4px 8px" }}
                      onClick={() =>
                        setDetail(
                          shot ?? {
                            scriptBeatId: beat.id,
                            visualPrompt: "",
                          },
                        )
                      }
                    >
                      全文
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail ? (
        <div
          className="storyboardModalBackdrop"
          role="presentation"
          onClick={() => setDetail(null)}
        >
          <div
            className="storyboardModal"
            role="dialog"
            aria-modal="true"
            aria-label="分镜全文"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="storyboardModalHead">
              <span className="mono">镜头 {detail.scriptBeatId.slice(0, 8)}…</span>
              <button type="button" className="btn" onClick={() => setDetail(null)}>
                关闭
              </button>
            </div>
            {detail.imagePath && resolveProjectAssetSrc(projectPath, detail.imagePath) ? (
              <div className="field storyboardModalPreview">
                <img alt="分镜图" src={resolveProjectAssetSrc(projectPath, detail.imagePath) ?? undefined} />
              </div>
            ) : null}
            <div className="field" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button type="button" className="btn btnPrimary" onClick={pickStoryboardImage}>
                从本机选择分镜图…
              </button>
              {detail.imagePath ? (
                <button
                  type="button"
                  className="btn btnDanger"
                  onClick={() => {
                    persistShotPatch(detail.scriptBeatId, { imagePath: undefined });
                    setDetail({ ...detail, imagePath: undefined });
                    setStatusText("已移除分镜图关联");
                  }}
                >
                  移除图片
                </button>
              ) : null}
              <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                {detail.imagePath ?? "未关联"}
              </span>
            </div>
            <div className="field">
              <label>画面描述（visualPrompt）</label>
              <textarea
                rows={10}
                value={detail.visualPrompt}
                onChange={(e) => setDetail({ ...detail, visualPrompt: e.target.value })}
                onBlur={(e) => persistShotPatch(detail.scriptBeatId, { visualPrompt: e.currentTarget.value })}
              />
            </div>
            <div className="field">
              <label>构图补充（可选）</label>
              <textarea
                rows={3}
                value={detail.compositionNote ?? ""}
                onChange={(e) => setDetail({ ...detail, compositionNote: e.target.value })}
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim();
                  persistShotPatch(detail.scriptBeatId, {
                    compositionNote: v ? v : undefined,
                  });
                }}
              />
            </div>
            <div className="field">
              <label>负面提示（可选）</label>
              <textarea
                rows={2}
                value={detail.negativePrompt ?? ""}
                onChange={(e) => setDetail({ ...detail, negativePrompt: e.target.value })}
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim();
                  persistShotPatch(detail.scriptBeatId, {
                    negativePrompt: v ? v : undefined,
                  });
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
