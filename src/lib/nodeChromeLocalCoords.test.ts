import { describe, expect, it } from "vitest";
import {
  computeInNodeChromePos,
  viewportDeltaToLocal,
} from "@/lib/nodeChromeLocalCoords";
import { GEN_PANEL_CHROME_GAP } from "@/hooks/useNodeGenerationChrome";

describe("viewportDeltaToLocal", () => {
  it("divides viewport delta by zoom via invZoom", () => {
    expect(viewportDeltaToLocal(200, 0.5)).toBe(100);
    expect(viewportDeltaToLocal(100, 2)).toBe(200);
  });
});

describe("computeInNodeChromePos", () => {
  const mountRect = { left: 100, top: 200 };
  const mountLocalWidth = 400;

  it("places below panel at preview bottom + gap in local space when zoomed in", () => {
    const zoom = 2;
    const invZoom = 0.5;
    const previewLocalH = 300;
    const anchorRect = {
      left: 100,
      top: 200,
      bottom: 200 + previewLocalH * zoom,
      width: 400 * zoom,
    };

    const pos = computeInNodeChromePos({
      anchorRect,
      mountRect,
      mountLocalWidth,
      chromeLocalWidth: 200,
      placement: "below",
      invZoom,
      gapBelow: GEN_PANEL_CHROME_GAP,
    });

    expect(pos.x).toBe(200);
    expect(pos.y).toBe(previewLocalH + GEN_PANEL_CHROME_GAP);
  });

  it("places below panel flush when zoomed out (no viewport/local mix)", () => {
    const zoom = 0.5;
    const invZoom = 2;
    const previewLocalH = 300;
    const anchorRect = {
      left: 100,
      top: 200,
      bottom: 200 + previewLocalH * zoom,
      width: 400 * zoom,
    };

    const pos = computeInNodeChromePos({
      anchorRect,
      mountRect,
      mountLocalWidth,
      chromeLocalWidth: 200,
      placement: "below",
      invZoom,
      gapBelow: GEN_PANEL_CHROME_GAP,
    });

    expect(pos.y).toBe(previewLocalH + GEN_PANEL_CHROME_GAP);
  });

  it("centers horizontally in local mount width", () => {
    const pos = computeInNodeChromePos({
      anchorRect: { left: 100, top: 200, bottom: 560, width: 400 },
      mountRect,
      mountLocalWidth: 400,
      chromeLocalWidth: 100,
      placement: "below",
      invZoom: 1,
    });

    expect(pos.x).toBe(200);
  });
});
