import { useMemo } from "react";
import { ScriptNodeWorkbench } from "@/components/ScriptNodeWorkbench";
import { ScriptStoryboardSection } from "@/components/ScriptStoryboardSection";
import {
  incomingScriptUpstreamState,
  inspectorScriptUpstreamHint,
  orderedIncomingScriptNodeIds,
} from "@/lib/incomingScriptBinding";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  AUDIO_TTS_PROMPT_MAX_CHARS,
  IMAGE_GENERATION_PROMPT_MAX_CHARS,
  VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS,
} from "@/lib/promptLimits";
import { defaultVideoGenerationDraft, defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { useProjectStore } from "@/store/projectStore";

export function Inspector() {
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);

  const node = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  /** 直连上游脚本节点中的分镜条目，供图/音/视频节点绑定 scriptBeatId */
  const scriptBeatBindingChoices = useMemo(() => {
    if (!node) return [] as { beatId: string; label: string; shotNumber: string }[];
    const t = node.type ?? "";
    if (t !== "imageNode" && t !== "audioNode" && t !== "videoNode") return [];
    const scriptIds = orderedIncomingScriptNodeIds(nodes, edges, node.id);
    const out: { beatId: string; label: string; shotNumber: string }[] = [];
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
          scriptIds.length > 1
            ? `[${scriptLabel}] 镜${num} · ${desc}${more}`
            : `镜${num} · ${desc}${more}`;
        out.push({ beatId: b.id, label: label.trim() || `镜${num}`, shotNumber: num });
      }
    }
    return out;
  }, [node, nodes, edges]);

  /** 当前已保存的 scriptBeatId 不在上游列表中（如粘贴工程后未重连）时，保留下拉中一条只读说明 */
  const scriptBeatOrphanId = useMemo(() => {
    if (!node || scriptBeatBindingChoices.length === 0) return "";
    const cur = String(
      (node.data.params as Record<string, unknown> | undefined)?.scriptBeatId ?? "",
    ).trim();
    if (!cur) return "";
    return scriptBeatBindingChoices.some((c) => c.beatId === cur) ? "" : cur;
  }, [node, scriptBeatBindingChoices]);

  if (!node) {
    return (
      <div className="panelBody">
        <div className="inspectorEmpty">
          <div className="inspectorEmpty__icon" aria-hidden>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <rect x="10" y="14" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
              <rect x="26" y="14" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
              <rect x="10" y="26" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
              <rect x="26" y="26" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
              <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.25" />
            </svg>
          </div>
          <p className="inspectorEmpty__title">选择节点以编辑属性</p>
          <p className="inspectorEmpty__hint">点击画布上的节点可查看和编辑其参数</p>
          <div className="inspectorEmpty__tips">
            <div className="inspectorEmpty__tip">
              <kbd>双击</kbd>
              <span>画布空白处添加节点</span>
            </div>
            <div className="inspectorEmpty__tip">
              <kbd>Delete</kbd>
              <span>删除选中节点</span>
            </div>
            <div className="inspectorEmpty__tip">
              <kbd>Ctrl+D</kbd>
              <span>复制节点</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const type = node.type ?? "default";
  const typeLabel =
    type === "textNode"
      ? "文本"
      : type === "scriptNode"
        ? "脚本"
        : type === "ffmpegConcat"
          ? "视频合成"
          : type === "imageNode" || type === "imageAsset"
            ? "图片"
            : type === "videoNode"
              ? "视频"
              : type === "audioNode"
                ? "音频"
                : type;

  const isScript = type === "scriptNode";
  const isTextLike = type === "llm" || type === "textNode" || type === "scriptNode";
  const isMediaPath =
    type === "mediaImport" ||
    type === "imageNode" ||
    type === "imageAsset" ||
    type === "videoNode" ||
    type === "audioNode";
  const imagePromptLen = (node.data.prompt ?? "").length;
  const audioPromptLen = (node.data.prompt ?? "").length;
  const videoPromptLen = (node.data.video?.draft?.prompt ?? "").length;
  const scriptUpstreamState =
    type === "imageNode" || type === "audioNode" || type === "videoNode"
      ? incomingScriptUpstreamState(nodes, edges, node.id)
      : "none";

  return (
    <div className="panelBody">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 650 }}>属性</div>
        <div className="pill">{typeLabel}</div>
      </div>
      <div className="field">
        <label>ID</label>
        <input className="mono" value={node.id} readOnly />
      </div>

      {isTextLike && (
        <>
          <div className="field">
            <label>标题（可选）</label>
            <input
              value={node.data.label ?? ""}
              onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
            />
          </div>
          <div className="field">
            <label>{isScript ? "剧情主题 / 一句话梗概" : "提示词（Prompt）"}</label>
            <textarea
              value={node.data.prompt ?? ""}
              onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
              placeholder={isScript ? "输入故事主题，用于生成脚本草案…" : ""}
            />
          </div>
          {(type === "llm" || type === "textNode") && (
            <div className="field">
              <label>额外参数（JSON）</label>
              <textarea
                className="mono"
                value={JSON.stringify(node.data.params ?? {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value || "{}") as Record<string, unknown>;
                    updateNodeData(node.id, { params: parsed });
                  } catch {
                    // ignore invalid JSON while typing
                  }
                }}
              />
            </div>
          )}
        </>
      )}

      {isMediaPath && (
        <>
          <div className="field">
            <label>本地文件路径（相对工程目录）</label>
            <input
              className="mono"
              value={node.data.path ?? ""}
              onChange={(e) => updateNodeData(node.id, { path: e.target.value })}
              placeholder="例如：assets/sample.wav"
            />
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            预览：<span className="mono">{node.data.path?.trim() || "未设置路径"}</span>
          </div>
        </>
      )}

      {(type === "imageNode" || type === "audioNode" || type === "videoNode") && (
        <>
          <div className="field">
            <label>绑定镜头（scriptBeatId）</label>
            {scriptBeatBindingChoices.length > 0 ? (
              <select
                className="mono"
                value={String((node.data.params as Record<string, unknown> | undefined)?.scriptBeatId ?? "")}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  const hit = scriptBeatBindingChoices.find((c) => c.beatId === v);
                  const prev = node.data.params;
                  const base: Record<string, unknown> =
                    prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev } : {};
                  if (!v) {
                    delete base.scriptBeatId;
                    delete base.shotNumber;
                  } else {
                    base.scriptBeatId = v;
                    if (hit?.shotNumber) base.shotNumber = hit.shotNumber;
                  }
                  updateNodeData(node.id, { params: base });
                }}
              >
                <option value="">（不绑定镜头）</option>
                {scriptBeatOrphanId ? (
                  <option value={scriptBeatOrphanId}>
                    当前：{scriptBeatOrphanId.slice(0, 10)}…（上游列表中未找到，保留原绑定）
                  </option>
                ) : null}
                {scriptBeatBindingChoices.map((c) => (
                  <option key={c.beatId} value={c.beatId}>
                    {c.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="mono"
                value={String((node.data.params as Record<string, unknown> | undefined)?.scriptBeatId ?? "")}
                onChange={(e) => {
                  const prev = node.data.params;
                  const base: Record<string, unknown> =
                    prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev } : {};
                  const v = e.target.value.trim();
                  if (v) base.scriptBeatId = v;
                  else delete base.scriptBeatId;
                  updateNodeData(node.id, { params: base });
                }}
                placeholder="与脚本节点中镜头 id 一致；连接上游脚本后可下拉选择"
              />
            )}
            <div className="inspectorWeakHint">{inspectorScriptUpstreamHint(scriptUpstreamState)}</div>
          </div>
          <div className="field">
            <label>镜号（shotNumber，可选）</label>
            <input
              value={String((node.data.params as Record<string, unknown> | undefined)?.shotNumber ?? "")}
              onChange={(e) => {
                const prev = node.data.params;
                const base: Record<string, unknown> =
                  prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev } : {};
                const v = e.target.value.trim();
                if (v) base.shotNumber = v;
                else delete base.shotNumber;
                updateNodeData(node.id, { params: base });
              }}
              placeholder="如 1、12A"
            />
          </div>
        </>
      )}

      {(type === "imageNode" || type === "imageAsset") && (
        <div className="field">
          <label>图片提示词（与节点内生成面板同步）</label>
          <textarea
            value={node.data.prompt ?? ""}
            onChange={(e) =>
              updateNodeData(node.id, {
                prompt: e.target.value.slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS),
              })
            }
            placeholder="描述待生成或编辑的画面；也可在画布图片节点展开区编辑"
            rows={5}
          />
          <div className="fieldCounter">
            {imagePromptLen}/{IMAGE_GENERATION_PROMPT_MAX_CHARS}
          </div>
        </div>
      )}

      {type === "audioNode" && (
        <div className="field">
          <label>TTS 文案（与节点内展开面板同步）</label>
          <textarea
            value={node.data.prompt ?? ""}
            onChange={(e) =>
              updateNodeData(node.id, { prompt: e.target.value.slice(0, AUDIO_TTS_PROMPT_MAX_CHARS) })
            }
            placeholder="待转语音的文本；也可在画布音频节点展开区编辑"
            rows={4}
          />
          <div className="fieldCounter">
            {audioPromptLen}/{AUDIO_TTS_PROMPT_MAX_CHARS}
          </div>
        </div>
      )}

      {type === "videoNode" && (
        <div className="field">
          <label>视频生成提示词（与节点内文生视频面板同步）</label>
          <textarea
            value={node.data.video?.draft?.prompt ?? ""}
            onChange={(e) => {
              const cur = node.data.video;
              const baseDraft = cur?.draft ?? defaultVideoGenerationDraft();
              const nextPrompt = e.target.value.slice(0, VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS);
              updateNodeData(node.id, {
                video: {
                  ...defaultVideoNodePersisted(),
                  ...cur,
                  draft: { ...baseDraft, prompt: nextPrompt },
                },
              });
            }}
            placeholder="描述成片内容、风格与镜头；也可在画布视频节点展开区编辑"
            rows={5}
          />
          <div className="fieldCounter">
            {videoPromptLen}/{VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS}
          </div>
        </div>
      )}

      {(type === "textNode" || type === "scriptNode") && (
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          画布摘要：{(node.data.prompt ?? "").slice(0, 80)}
          {(node.data.prompt?.length ?? 0) > 80 ? "…" : ""}
        </div>
      )}

      {isScript && (
        <>
          <ScriptNodeWorkbench
            nodeId={node.id}
            beats={node.data.scriptBeats ?? []}
            storedSelection={node.data.scriptBeatSelection}
            themePrompt={node.data.prompt ?? ""}
          />
          <ScriptStoryboardSection
            nodeId={node.id}
            beats={node.data.scriptBeats ?? []}
            scriptBeatSelection={node.data.scriptBeatSelection}
            shots={node.data.storyboardShots}
            themePrompt={node.data.prompt ?? ""}
          />
        </>
      )}

      {type === "ffmpegConcat" && (
        <>
          <div className="field">
            <label>输入（每行一个相对路径）</label>
            <textarea
              className="mono"
              value={(node.data.inputs ?? []).join("\n")}
              onChange={(e) => {
                const lines = e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                updateNodeData(node.id, { inputs: lines });
              }}
            />
          </div>
          <div className="field">
            <label>输出（相对工程目录）</label>
            <input
              className="mono"
              value={node.data.output ?? ""}
              onChange={(e) => updateNodeData(node.id, { output: e.target.value })}
              placeholder="例如：output/final.mp4"
            />
          </div>
        </>
      )}
    </div>
  );
}
