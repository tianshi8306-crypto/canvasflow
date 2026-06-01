import { CANVAS_CONTEXT_MENU_Z } from "@/components/canvas/menuConstants";
import type { EdgeDeleteAffordance as AffordanceState } from "@/hooks/canvas/useEdgeDeleteAffordance";

type Props = {
  affordance: AffordanceState;
  onDelete: () => void;
};

export function EdgeDeleteAffordance({ affordance, onDelete }: Props) {
  return (
    <button
      type="button"
      className="flowEdgeDeleteBtn"
      style={{
        position: "fixed",
        left: affordance.x,
        top: affordance.y,
        zIndex: CANVAS_CONTEXT_MENU_Z,
        transform: "translate(-50%, -50%)",
      }}
      title="剪断连线"
      aria-label="剪断连线"
      onPointerDown={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      }}
      onClick={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onDelete();
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8.5 7.5L20 20M8.5 16.5L20 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
