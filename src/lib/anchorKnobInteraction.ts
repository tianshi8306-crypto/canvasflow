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

/** 指针在 zone 内的圆钮位置（返回圆心坐标，配合 CSS translate(-50%, -50%)）。
 * `zone` 来自 getBoundingClientRect（屏幕坐标），`left`/`top` 最终作用在
 * 节点的本地 CSS 坐标空间，需要除以 React Flow 的缩放倍率。 */
export function clientToKnobPos(
  zone: DOMRect,
  clientX: number,
  clientY: number,
  zoom: number,
): KnobPos {
  const pad = 4;
  const scale = zoom <= 0 ? 1 : zoom;
  const cx = (clientX - zone.left) / scale;
  const cy = (clientY - zone.top) / scale;
  const zoneW = zone.width / scale;
  const zoneH = zone.height / scale;
  return {
    left: Math.max(pad + KNOB_R, Math.min(zoneW - pad - KNOB_R, cx)),
    top: Math.max(pad + KNOB_R, Math.min(zoneH - pad - KNOB_R, cy)),
  };
}

/** 指针是否落在锚点热区内（进入即磁吸跟随十字） */
export function isPointerInAnchorZone(zone: DOMRect, clientX: number, clientY: number): boolean {
  return (
    clientX >= zone.left &&
    clientX <= zone.right &&
    clientY >= zone.top &&
    clientY <= zone.bottom
  );
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
