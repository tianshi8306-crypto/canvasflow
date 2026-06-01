import { useEffect, useId, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";

type Props = {
  open: boolean;
  defaultName: string;
  projectOpen: boolean;
  onCancel: () => void;
  onConfirm: (name: string, targets: { local: boolean; project: boolean }) => void;
};

export function SaveWorkflowDialog({
  open,
  defaultName,
  projectOpen,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(defaultName);
  const [saveLocal, setSaveLocal] = useState(true);
  const [saveProject, setSaveProject] = useState(projectOpen && isTauri());

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setSaveLocal(true);
    setSaveProject(projectOpen && isTauri());
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, defaultName, projectOpen]);

  if (!open) return null;

  const canProject = projectOpen && isTauri();
  const canSubmit = name.trim().length > 0 && (saveLocal || (saveProject && canProject));

  return (
    <div className="saveWorkflowDialogRoot" role="presentation">
      <button type="button" className="saveWorkflowDialogOverlay" aria-label="关闭" onClick={onCancel} />
      <div
        className="saveWorkflowDialogPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && canSubmit) {
            e.preventDefault();
            onConfirm(name.trim(), { local: saveLocal, project: saveProject && canProject });
          }
        }}
      >
        <h2 id={titleId} className="saveWorkflowDialogTitle">
          保存为工作流
        </h2>
        <p className="saveWorkflowDialogHint">保存节点拓扑与参数骨架，不含媒体文件与密钥。</p>
        <label className="saveWorkflowDialogField">
          <span>名称</span>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：文生图→视频"
          />
        </label>
        <fieldset className="saveWorkflowDialogTargets">
          <legend>保存位置</legend>
          <label className="saveWorkflowDialogCheck">
            <input
              type="checkbox"
              checked={saveLocal}
              onChange={(e) => setSaveLocal(e.target.checked)}
            />
            本机工作流库
          </label>
          <label className={`saveWorkflowDialogCheck${canProject ? "" : " saveWorkflowDialogCheck--disabled"}`}>
            <input
              type="checkbox"
              checked={saveProject && canProject}
              disabled={!canProject}
              onChange={(e) => setSaveProject(e.target.checked)}
            />
            当前工程（.canvasflow/workflows）
          </label>
          {!canProject ? (
            <p className="saveWorkflowDialogFoot">打开工程后可将工作流随项目一起备份或分享。</p>
          ) : null}
        </fieldset>
        <div className="saveWorkflowDialogActions">
          <button type="button" className="saveWorkflowDialogBtn" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="saveWorkflowDialogBtn saveWorkflowDialogBtn--primary"
            disabled={!canSubmit}
            onClick={() =>
              onConfirm(name.trim(), { local: saveLocal, project: saveProject && canProject })
            }
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
