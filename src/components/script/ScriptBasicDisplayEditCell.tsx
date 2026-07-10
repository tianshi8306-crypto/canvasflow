import { useEffect, useRef, useState, type ReactNode } from "react";

type BaseProps = {
  value: string;
  placeholder?: string;
  className?: string;
  displayContent?: ReactNode;
  emptyLabel?: string;
  onCommit: (value: string) => void;
};

type TextareaProps = BaseProps & { variant: "textarea"; rows?: number };
type InputProps = BaseProps & { variant: "input" };

type SelectProps = BaseProps & {
  variant: "select";
  options: readonly string[];
  emptyOptionLabel: string;
};

type Props = TextareaProps | InputProps | SelectProps;

export function ScriptBasicDisplayEditCell(props: Props) {
  const {
    value,
    placeholder,
    className,
    displayContent,
    emptyLabel = "—",
    onCommit,
  } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const finish = (commit: boolean) => {
    setEditing(false);
    if (commit && draft !== value) onCommit(draft);
    else setDraft(value);
  };

  const stopBubble = (e: { stopPropagation: () => void }) => e.stopPropagation();

  if (!editing) {
    const hasContent = value.trim().length > 0;
    return (
      <div
        role="button"
        tabIndex={0}
        className={["scriptTableDisplayCell", className].filter(Boolean).join(" ")}
        onPointerDown={stopBubble}
        onClick={(e) => {
          stopBubble(e);
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditing(true);
          }
        }}
      >
        {hasContent ? (
          (displayContent ?? value)
        ) : (
          <span className="scriptTableCellReadonly--placeholder">{placeholder ?? emptyLabel}</span>
        )}
      </div>
    );
  }

  if (props.variant === "textarea") {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        className={className}
        rows={props.rows ?? 3}
        placeholder={placeholder}
        value={draft}
        onPointerDown={stopBubble}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          }
          stopBubble(e);
        }}
      />
    );
  }

  if (props.variant === "select") {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        className={className}
        value={draft}
        onPointerDown={stopBubble}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          setEditing(false);
          if (next !== value) onCommit(next);
        }}
        onBlur={() => finish(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          }
          stopBubble(e);
        }}
      >
        <option value="">{props.emptyOptionLabel}</option>
        {props.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      className={className}
      value={draft}
      placeholder={placeholder}
      onPointerDown={stopBubble}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
        stopBubble(e);
      }}
    />
  );
}
