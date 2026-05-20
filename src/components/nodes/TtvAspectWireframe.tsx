import type { TextToVideoAspectId } from "@/lib/videoNodeTypes";

/** 线框示意：在固定视口内按比例画内框 */
export function TtvAspectWireframe({ id }: { id: TextToVideoAspectId }) {
  const maxW = 30;
  const maxH = 20;
  const inner = (() => {
    switch (id) {
      case "auto":
        return { w: 10, h: 18 };
      case "16:9":
        return { w: maxW, h: Math.round((maxW * 9) / 16) };
      case "4:3":
        return { w: Math.min(24, maxW), h: Math.round((Math.min(24, maxW) * 3) / 4) };
      case "1:1":
        return { w: 16, h: 16 };
      case "3:4":
        return { w: 14, h: Math.round((14 * 4) / 3) };
      case "9:16":
        return { w: 11, h: Math.round((11 * 16) / 9) };
      case "21:9":
        return { w: maxW, h: Math.round((maxW * 9) / 21) };
      default:
        return { w: 16, h: 16 };
    }
  })();
  return (
    <div className="textNodeTtvWireViewport" aria-hidden>
      <div
        className="textNodeTtvWireInner"
        style={{ width: inner.w, height: Math.min(inner.h, maxH) }}
      />
    </div>
  );
}
