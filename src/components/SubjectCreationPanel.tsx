import { createPortal } from "react-dom";
import { useState, useRef, type ChangeEvent } from "react";
import { addSubject, loadSubjects } from "@/lib/subjectStorage";
import type { SubjectCategory, SubjectDraft } from "@/types/subject";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  open: boolean;
  nodeId: string;
  onClose: () => void;
  onSubjectsChanged?: () => void;
};

type Tab = "smart" | "name" | "voice" | "desc";

const CATEGORY_OPTIONS: { value: SubjectCategory; label: string }[] = [
  { value: "character", label: "角色" },
  { value: "product", label: "商品" },
  { value: "pet", label: "宠物" },
  { value: "person", label: "人物" },
];

export function SubjectCreationPanel({ open, nodeId, onClose, onSubjectsChanged }: Props) {
  void nodeId; // 参数暂未使用
  const [tab, setTab] = useState<Tab>("smart");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SubjectCategory>("character");
  const [description, setDescription] = useState("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [voicePath, setVoicePath] = useState<string | undefined>();
  const [voiceText, setVoiceText] = useState("");
  const [subjects, setSubjects] = useState(() => loadSubjects());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  if (!open) return null;

  const handleAddImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPaths: string[] = [];
    for (let i = 0; i < files.length && imagePaths.length + newPaths.length < 3; i++) {
      const file = files[i];
      const path = URL.createObjectURL(file);
      newPaths.push(path);
    }
    setImagePaths((prev) => [...prev, ...newPaths].slice(0, 3));
    e.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setImagePaths((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAudio = () => {
    audioInputRef.current?.click();
  };

  const handleAudioFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const path = URL.createObjectURL(file);
    setVoicePath(path);
    e.target.value = "";
  };

  const handleCreate = () => {
    if (!name.trim()) {
      setStatusText("请填写主体名称");
      return;
    }
    const draft: SubjectDraft = {
      name: name.trim(),
      category,
      description: description.trim(),
      imagePaths,
      voicePath,
      voiceText: voiceText.trim(),
    };
    const newSubject = addSubject(draft);
    setSubjects((prev) => [newSubject, ...prev]);
    setStatusText(`已创建主体：${newSubject.name}`);
    onSubjectsChanged?.();
    onClose();
  };

  const handleGenerateDesc = () => {
    if (imagePaths.length === 0) {
      setStatusText("请先添加视角图再生成描述");
      return;
    }
    setStatusText("智能生成描述功能开发中...");
  };

  return createPortal(
    <div className="subjectCreationBackdrop" role="presentation" onClick={onClose}>
      <div
        className="subjectCreationPanel"
        role="dialog"
        aria-modal="true"
        aria-label="创建主体"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="subjectCreationHead">
          <span className="subjectCreationTitle">创建主体</span>
          <button type="button" className="btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="subjectCreationTabs">
          {(
            [
              { key: "smart", label: "智能补全" },
              { key: "name", label: "主体名称" },
              { key: "voice", label: "音色" },
              { key: "desc", label: "描述" },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              className={`subjectCreationTab ${tab === t.key ? "subjectCreationTab--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="subjectCreationBody">
          {tab === "smart" && (
            <div className="subjectCreationSection">
              <p className="subjectCreationHint">添加主体的其他视角图（2-3张）</p>
              <div className="subjectCreationImages">
                {imagePaths.map((path, i) => (
                  <div key={i} className="subjectCreationImageThumb">
                    <img src={path} alt={`视角图 ${i + 1}`} />
                    <button
                      type="button"
                      className="subjectCreationImageRemove"
                      onClick={() => handleRemoveImage(i)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {imagePaths.length < 3 && (
                  <button
                    type="button"
                    className="subjectCreationImageAdd"
                    onClick={handleAddImage}
                  >
                    <span>+</span>
                    <span>添加</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handleImageFileChange}
              />
            </div>
          )}

          {tab === "name" && (
            <div className="subjectCreationSection">
              <div className="field">
                <label>主体名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入主体名称"
                />
              </div>
              <div className="field">
                <label>主体类别</label>
                <div className="subjectCreationCategoryRow">
                  {CATEGORY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`subjectCreationCategoryBtn ${category === opt.value ? "subjectCreationCategoryBtn--active" : ""}`}
                      onClick={() => setCategory(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "voice" && (
            <div className="subjectCreationSection">
              <p className="subjectCreationHint">支持本地上传或历史生成的5-30s音频/视频</p>
              <div className="subjectCreationVoiceRow">
                <button type="button" className="btn" onClick={handleAddAudio}>
                  上传音频
                </button>
                {voicePath && (
                  <span className="subjectCreationVoiceFile">已选择音频文件</span>
                )}
              </div>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,video/*"
                style={{ display: "none" }}
                onChange={handleAudioFileChange}
              />
              <div className="field" style={{ marginTop: 12 }}>
                <label>音色关联文本（可选）</label>
                <textarea
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  placeholder="输入关联文本，用于生成音色样本"
                  rows={3}
                />
              </div>
              <div className="subjectCreationVoiceHistory">
                <p className="subjectCreationHint">历史记录</p>
                {subjects.filter((s) => s.voicePath).length === 0 ? (
                  <p className="subjectCreationEmpty">暂无历史音色</p>
                ) : (
                  subjects
                    .filter((s) => s.voicePath)
                    .slice(0, 5)
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="subjectCreationVoiceHistoryItem"
                        onClick={() => {
                          setName(s.name);
                          setVoicePath(s.voicePath);
                        }}
                      >
                        {s.name}
                      </button>
                    ))
                )}
              </div>
            </div>
          )}

          {tab === "desc" && (
            <div className="subjectCreationSection">
              <div className="subjectCreationDescHeader">
                <p className="subjectCreationHint">描述将自动拼接到生成提示词中</p>
                <button
                  type="button"
                  className="btn"
                  onClick={handleGenerateDesc}
                  disabled={imagePaths.length === 0}
                >
                  智能生成
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入主体描述，或点击「智能生成」从视角图分析生成描述"
                rows={6}
              />
              <p className="subjectCreationHint" style={{ marginTop: 8 }}>
                描述内容会参与生成，请详细描述主体的视觉特征
              </p>
            </div>
          )}
        </div>

        <div className="subjectCreationFoot">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btnPrimary"
            onClick={handleCreate}
            disabled={!name.trim()}
          >
            创建主体
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
