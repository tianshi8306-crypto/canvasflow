import { forwardRef, type CSSProperties, type ReactNode } from "react";

type ShellProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  role?: string;
  "aria-label"?: string;
};

export const FloatMenuShell = forwardRef<HTMLDivElement, ShellProps>(function FloatMenuShell(
  { children, className, style, role = "menu", "aria-label": ariaLabel },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`canvasFloatMenuShell${className ? ` ${className}` : ""}`}
      role={role}
      aria-label={ariaLabel}
      style={style}
    >
      <div className="canvasFloatMenuBody">{children}</div>
    </div>
  );
});

export function FloatMenuHeader({ label, detail }: { label: string; detail?: string }) {
  if (!detail) return null;
  return (
    <div className="canvasFloatMenuHeader">
      <span className="canvasFloatMenuHeaderLabel">{label}</span>
      <span className="canvasFloatMenuHeaderDetail" title={detail}>
        {detail}
      </span>
    </div>
  );
}

export function FloatMenuSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <>
      {title ? (
        <div className="canvasPaneCtxMenu__sectionTitle canvasFloatMenuTitle">{title}</div>
      ) : null}
      {children}
    </>
  );
}

export function FloatMenuDivider() {
  return <div className="canvasPaneCtxMenu__sep" role="separator" />;
}

type ItemProps = {
  icon?: ReactNode;
  label: string;
  detail?: string;
  kbd?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
};

export function FloatMenuItem({
  icon,
  label,
  detail,
  kbd,
  disabled,
  active,
  onClick,
}: ItemProps) {
  return (
    <button
      type="button"
      className={`canvasPaneCtxMenu__row canvasPaneCtxMenu__row--l2 canvasFloatMenuRow${active ? " canvasFloatMenuRow--active" : ""}`}
      disabled={disabled}
      title={detail}
      onClick={onClick}
    >
      {icon ? <span className="canvasPaneCtxMenu__icon">{icon}</span> : null}
      <span className="canvasPaneCtxMenu__label">{label}</span>
      {detail && !kbd ? (
        <span className="canvasFloatMenuRowDetail">{detail}</span>
      ) : null}
      {kbd ? <span className="canvasPaneCtxMenu__shortcut">{kbd}</span> : null}
    </button>
  );
}

export function FloatMenuFootnote({ children }: { children: ReactNode }) {
  return <p className="canvasFloatMenuFootnote">{children}</p>;
}

/** 资源区主操作：略强调的上传/新建按钮 */
export function FloatMenuPrimaryItem({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="canvasFloatMenuRow canvasFloatMenuRow--primary"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="canvasFloatMenuRowIcon canvasFloatMenuRowIcon--primary">{icon}</span>
      <span className="canvasFloatMenuRowLabel">{label}</span>
    </button>
  );
}
