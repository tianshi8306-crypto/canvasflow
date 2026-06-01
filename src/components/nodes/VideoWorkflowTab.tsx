import type { VideoGenerationWorkflow } from "@/lib/videoNodeTypes";

type Props = {
  tab: { id: VideoGenerationWorkflow; label: string };
  activeWorkflow: VideoGenerationWorkflow;
  locked: boolean;
  onTabClick: (id: VideoGenerationWorkflow, unlock?: boolean) => void;
};

export function VideoWorkflowTab({ tab, activeWorkflow, locked, onTabClick }: Props) {
  const isActive = activeWorkflow === tab.id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={`mmTab mmTab--clickable ${isActive ? "mmTab--active" : "mmTab--inactive"}${
        isActive && locked ? " mmTab--locked" : ""
      }`}
      title={
        isActive && locked
          ? "创作模式已锁定，再次点击解锁"
          : isActive
            ? "点击锁定当前创作模式"
            : `切换为${tab.label}`
      }
      onClick={() => {
        if (isActive && locked) onTabClick(tab.id, true);
        else onTabClick(tab.id);
      }}
    >
      {tab.label}
      {isActive && locked ? (
        <span className="mmTabLock" aria-label="已锁定">
          🔒
        </span>
      ) : null}
    </button>
  );
}
