import {
  projectFolderName,
  readRecentProjects,
} from "@/lib/recentProjects";

type RowProps = {
  label: string;
  hint?: string;
  className?: string;
  onClick: () => void;
};

function RecentRow({ label, hint, className, onClick }: RowProps) {
  return (
    <button type="button" className={className ?? "recentProjectRow"} onClick={onClick}>
      <span className="recentProjectRowLabel">{label}</span>
      {hint ? (
        <span className="recentProjectRowHint" title={hint}>
          {hint}
        </span>
      ) : null}
    </button>
  );
}

type Props = {
  limit?: number;
  rowClassName?: string;
  onOpenPath: (path: string) => void | Promise<void>;
};

/** 最近工程列表（读取 localStorage，由父级在打开面板时挂载即可刷新） */
export function RecentProjectRows({ limit = 5, rowClassName, onOpenPath }: Props) {
  const recent = readRecentProjects().slice(0, limit);
  if (recent.length === 0) return null;

  return (
    <div className="recentProjectRows">
      {recent.map((path) => (
        <RecentRow
          key={path}
          className={rowClassName}
          label={projectFolderName(path)}
          hint={path}
          onClick={() => void onOpenPath(path)}
        />
      ))}
    </div>
  );
}
