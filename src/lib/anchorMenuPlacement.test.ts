import { describe, expect, it } from "vitest";
import { ANCHOR_MENU_CURSOR_OFFSET_PX, anchorMenuPositionStyle } from "@/lib/anchorMenuPlacement";

describe("anchorMenuPositionStyle", () => {
  it("places menu below-right of cursor", () => {
    const style = anchorMenuPositionStyle(100, 200);
    expect(style.left).toBe(100 + ANCHOR_MENU_CURSOR_OFFSET_PX);
    expect(style.top).toBe(200 + ANCHOR_MENU_CURSOR_OFFSET_PX);
    expect(style.transform).toBe("none");
  });
});
