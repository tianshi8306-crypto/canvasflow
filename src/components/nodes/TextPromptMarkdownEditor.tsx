import { forwardRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import "./TextPromptDocument.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  className?: string;
  placeholder?: string;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onWheel?: (e: ReactWheelEvent) => void;
  onBlur?: () => void;
  onPaste?: () => void;
};

export const TextPromptMarkdownEditor = forwardRef<HTMLTextAreaElement, Props>(
  function TextPromptMarkdownEditor(
    { value, onChange, maxLength, className = "", placeholder, onPointerDown, onWheel, onBlur, onPaste },
    ref,
  ) {
    return (
      <textarea
        ref={ref}
        className={`textPromptMarkdownEditor ${RF_NODE_INPUT_CLASS} ${className}`.trim()}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={onPointerDown}
        onWheel={onWheel}
        onBlur={onBlur}
        onPaste={onPaste}
        spellCheck
      />
    );
  },
);
