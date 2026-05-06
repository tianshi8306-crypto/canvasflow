import { useCallback, useEffect, useState } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { CAMERA_PRESETS } from "@/lib/ttvCameraPresets";
import { cardLabelFromMove } from "@/lib/ttvCameraUi";
import type {
  CameraCustomMove,
  CameraMovementDraft,
  CameraPresetId,
  VideoGenerationDraftPatch,
} from "@/lib/videoNodeTypes";
import { useProjectStore } from "@/store/projectStore";

export { CAMERA_PRESETS } from "@/lib/ttvCameraPresets";

type CamTab = "presets" | "custom" | "favorites";

function defaultCustomForm(): Omit<CameraCustomMove, "id"> {
  return { name: "", prompt: "" };
}

function normalizeCustomMove(raw: unknown): CameraCustomMove | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const name = typeof o.name === "string" ? o.name : "";
  const prompt = typeof o.prompt === "string" ? o.prompt : "";
  return { id, name, prompt };
}

function PresetThumb() {
  return (
    <div className="ttvCamPresetThumb" aria-hidden>
      <div className="ttvCamPresetThumbInner" />
    </div>
  );
}

export type TtvCameraMovementModalProps = {
  open: boolean;
  onClose: () => void;
  cameraMovement: CameraMovementDraft | undefined;
  patchDraft: (patch: VideoGenerationDraftPatch) => void;
  /** 选中运镜时写入 `insertIndex`，默认光标处或文末 */
  getInsertIndex?: () => number;
};

export function TtvCameraMovementModal({
  open,
  onClose,
  cameraMovement,
  patchDraft,
  getInsertIndex,
}: TtvCameraMovementModalProps) {
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const [tab, setTab] = useState<CamTab>("presets");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<CameraCustomMove, "id">>(() => defaultCustomForm());

  useEffect(() => {
    if (!open) {
      setEditorOpen(false);
      setEditingId(null);
      setTab("presets");
    }
  }, [open]);

  const favorites = new Set(cameraMovement?.favoritePresetIds ?? []);
  const customMovesRaw = cameraMovement?.customMoves ?? [];
  const customMoves: CameraCustomMove[] = customMovesRaw
    .map((x) => normalizeCustomMove(x))
    .filter((x): x is CameraCustomMove => x !== null);

  const openNewEditor = () => {
    setEditingId(null);
    setForm(defaultCustomForm());
    setEditorOpen(true);
  };

  const openEditEditor = (m: CameraCustomMove) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      prompt: m.prompt,
    });
    setEditorOpen(true);
  };

  const saveCustom = useCallback(() => {
    const prompt = form.prompt.trim();
    if (!prompt) {
      setStatusText("请填写运镜提示词");
      return;
    }
    const id = editingId ?? crypto.randomUUID();
    const displayName = form.name.trim();
    const row: CameraCustomMove = {
      id,
      name: displayName,
      prompt,
    };
    const idx = customMoves.findIndex((x) => x.id === id);
    const list = [...customMoves];
    if (idx >= 0) list[idx] = row;
    else list.push(row);
    const insertIndex = getInsertIndex?.();
    patchDraft({
      cameraMovement: {
        customMoves: list,
        presetId: undefined,
        selectedCustomMoveId: id,
        ...(insertIndex !== undefined ? { insertIndex } : {}),
      },
    });
    setEditorOpen(false);
    setTab("presets");
  }, [customMoves, editingId, form.name, form.prompt, getInsertIndex, patchDraft, setStatusText]);

  const toggleFavorite = (id: CameraPresetId) => {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    patchDraft({ cameraMovement: { favoritePresetIds: Array.from(next) } });
  };

  const pickPreset = (id: CameraPresetId) => {
    const insertIndex = getInsertIndex?.();
    patchDraft({
      cameraMovement: {
        presetId: id,
        selectedCustomMoveId: undefined,
        ...(insertIndex !== undefined ? { insertIndex } : {}),
      },
    });
    onClose();
  };

  const pickCustom = (id: string) => {
    const insertIndex = getInsertIndex?.();
    patchDraft({
      cameraMovement: {
        presetId: undefined,
        selectedCustomMoveId: id,
        ...(insertIndex !== undefined ? { insertIndex } : {}),
      },
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="ttvCamModal"
      role="dialog"
      aria-label="运镜"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="ttvCamModalHeader">
        {!editorOpen ? (
          <div className="ttvCamModalTabs" role="tablist">
            {(
              [
                ["presets", "预设"],
                ["custom", "自定义"],
                ["favorites", "我的收藏"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                className={`ttvCamModalTab ${tab === k ? "ttvCamModalTab--active" : ""}`}
                aria-selected={tab === k}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="ttvCamModalHeaderTitle">自定义运镜 · 提示词</div>
        )}
        <button type="button" className="ttvCamModalClose" aria-label="关闭" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="ttvCamModalBody">
        {editorOpen ? (
          <div className="ttvCamEditor">
            <div className="ttvCamEditorActions">
              <button type="button" className="ttvCamBtnGhost" onClick={() => setEditorOpen(false)}>
                返回
              </button>
              <span className="ttvCamEditorHint mono">{editingId ? "编辑" : "新建"}</span>
            </div>
            <p className="ttvCamEditorIntro">
              保存后将出现在「预设」列表中；选中后在提示词框内以可拖动标签插入，位置与正文融合。
            </p>
            <label className="ttvCamField">
              <span>显示名称（可选）</span>
              <input
                className={`ttvCamInput ${RF_NODE_INPUT_CLASS}`}
                placeholder="留空则使用提示词摘要作为卡片标题"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="ttvCamField">
              <span>运镜提示词</span>
              <textarea
                className={`ttvCamTextarea ${RF_NODE_INPUT_CLASS}`}
                rows={5}
                placeholder={
                  "例如：缓慢向前推进，低角度仰视建筑群，随后向左横摇跟随主体；节奏平稳，略带电影感。"
                }
                value={form.prompt}
                onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
              />
            </label>
            <button type="button" className="ttvCamBtnPrimary" onClick={saveCustom}>
              保存
            </button>
          </div>
        ) : tab === "presets" ? (
          <div className="ttvCamPresetGrid">
            {CAMERA_PRESETS.map((p) => (
              <div key={p.id} className="ttvCamPresetCell">
                <button
                  type="button"
                  className={`ttvCamPresetCard ${cameraMovement?.presetId === p.id ? "ttvCamPresetCard--active" : ""}`}
                  onClick={() => pickPreset(p.id)}
                >
                  <PresetThumb />
                  <span className="ttvCamPresetLabel">{p.label}</span>
                </button>
                <button
                  type="button"
                  className={`ttvCamPresetStar ${favorites.has(p.id) ? "ttvCamPresetStar--on" : ""}`}
                  title={favorites.has(p.id) ? "取消收藏" : "加入收藏"}
                  aria-label="收藏"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(p.id);
                  }}
                >
                  {favorites.has(p.id) ? "★" : "☆"}
                </button>
              </div>
            ))}
            {customMoves.map((m) => (
              <div key={m.id} className="ttvCamPresetCell">
                <button
                  type="button"
                  className={`ttvCamPresetCard ${
                    cameraMovement?.selectedCustomMoveId === m.id ? "ttvCamPresetCard--active" : ""
                  }`}
                  onClick={() => pickCustom(m.id)}
                >
                  <PresetThumb />
                  <span className="ttvCamPresetLabel">{cardLabelFromMove(m)}</span>
                  {m.prompt.trim() ? (
                    <span className="ttvCamPresetSub">{m.prompt.trim().split(/\r?\n/)[0]}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="ttvCamCellEdit"
                  title="编辑"
                  aria-label="编辑"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditEditor(m);
                  }}
                >
                  ✎
                </button>
              </div>
            ))}
          </div>
        ) : tab === "custom" ? (
          <div className="ttvCamCustomOnly">
            <p className="ttvCamCustomHint">
              新建的运镜会保存到「预设」列表；选中后以标签插入提示词，可在字间拖动改变融合位置。
            </p>
            <div className="ttvCamPresetGrid ttvCamPresetGrid--single">
              <button type="button" className="ttvCamNewCard" onClick={openNewEditor}>
                <div className="ttvCamNewPlus" aria-hidden>
                  +
                </div>
                <span>新建运镜</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="ttvCamPresetGrid">
            {CAMERA_PRESETS.filter((p) => favorites.has(p.id)).length === 0 ? (
              <div className="ttvCamEmpty">暂无收藏。在「预设」中点击星标即可加入。</div>
            ) : (
              CAMERA_PRESETS.filter((p) => favorites.has(p.id)).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`ttvCamPresetCard ${cameraMovement?.presetId === p.id ? "ttvCamPresetCard--active" : ""}`}
                  onClick={() => pickPreset(p.id)}
                >
                  <PresetThumb />
                  <span className="ttvCamPresetLabel">{p.label}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
