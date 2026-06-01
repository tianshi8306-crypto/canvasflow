import {
  SIMPLE_ANCHOR_KNOB,
  SIMPLE_ANCHOR_MAGNET_RADIUS,
  getSimpleAnchorRestingKnobPos,
} from "@/lib/simpleAnchorGeometry";

const KNOB_R = SIMPLE_ANCHOR_KNOB / 2;

export type KnobPos = { left: number; top: number };

/** 热区内「+」默认停靠位置（相对 zone 左上角） */
export function getRestingKnobPos(zone: DOMRect, side: "left" | "right"): KnobPos {
  return getSimpleAnchorRestingKnobPos(zone.width, zone.height, side);
}

/** 指针在 zone 内的圆钮位置（返回圆心坐标，配合 CSS translate(-50%, -50%)） */
export function clientToKnobPos(zone: DOMRect, clientX: number, clientY: number): KnobPos {
  const pad = 4;
  const cx = clientX - zone.left;
  const cy = clientY - zone.top;
  return {
    left: Math.max(pad + KNOB_R, Math.min(zone.width - pad - KNOB_R, cx)),
    top: Math.max(pad + KNOB_R, Math.min(zone.height - pad - KNOB_R, cy)),
  };
}

/** 指针与默认圆心距离（用于进入磁吸） */
export function distanceToRestingKnob(
  zone: DOMRect,
  side: "left" | "right",
  clientX: number,
  clientY: number,
): number {
  const rest = getRestingKnobPos(zone, side);
  const rcx = zone.left + rest.left + KNOB_R;
  const rcy = zone.top + rest.top + KNOB_R;
  return Math.hypot(clientX - rcx, clientY - rcy);
}

export { SIMPLE_ANCHOR_MAGNET_RADIUS };

/** 在热区按下时把拖线起点转发到边框 Handle（React Flow 只认 Handle 上的按下） */
export function dispatchHandleConnectPointerDown(
  handleEl: HTMLElement,
  source: { pointerId: number; pointerType: string },
): void {
  const r = handleEl.getBoundingClientRect();
  const clientX = r.left + r.width / 2;
  const clientY = r.top + r.height / 2;
  const init: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button: 0,
    buttons: 1,
    pointerId: source.pointerId,
    pointerType: source.pointerType,
    isPrimary: true,
  };
  handleEl.dispatchEvent(new PointerEvent("pointerdown", init));
  handleEl.dispatchEvent(
    new MouseEvent("mousedown", {
      ...init,
      detail: 1,
    }),
  );
}
