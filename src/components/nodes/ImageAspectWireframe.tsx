import type { ImageAspectId } from "@/lib/imageGeneration/catalog";

type WireframeProps = { id: ImageAspectId; compact?: boolean };

/** 比例线框（触发钮 / 浮层菜单内图标） */
export function ImageAspectWireframe({ id, compact = false }: WireframeProps) {
  const maxW = compact ? 18 : 28;
  const maxH = compact ? 12 : 18;
  const inner = (() => {
    switch (id) {
      case "auto":
        return { w: 12, h: 16 };
      case "16:9":
        return { w: maxW, h: Math.round((maxW * 9) / 16) };
      case "21:9":
        return { w: maxW, h: Math.round((maxW * 9) / 21) };
      case "4:3":
        return { w: Math.min(22, maxW), h: Math.round((Math.min(22, maxW) * 3) / 4) };
      case "3:4":
        return { w: 14, h: Math.round((14 * 4) / 3) };
      case "1:1":
        return { w: 16, h: 16 };
      case "9:16":
        return { w: 10, h: Math.round((10 * 16) / 9) };
      case "3:2":
        return { w: maxW, h: Math.round((maxW * 2) / 3) };
      case "2:3":
        return { w: 12, h: Math.round((12 * 3) / 2) };
      case "4:5":
        return { w: 14, h: Math.round((14 * 5) / 4) };
      case "5:4":
        return { w: 20, h: Math.round((20 * 4) / 5) };
      default:
        return { w: 16, h: 16 };
    }
  })();
  return (
    <div className="igp-ar-wire-viewport" aria-hidden>
      <div
        className={`igp-ar-wire-inner${id === "auto" ? " igp-ar-wire-inner--auto" : ""}`}
        style={{ width: inner.w, height: Math.min(inner.h, maxH) }}
      />
    </div>
  );
}
