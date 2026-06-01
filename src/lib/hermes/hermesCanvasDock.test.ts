import { describe, expect, it } from "vitest";
import {
  defaultOrbDockForWrap,
  HERMES_ORB_SIZE,
  HERMES_ORB_SUGGEST_ESTIMATED_WIDTH,
  resolveHermesOrbDisplayPos,
  resolveOrbSuggestPosition,
} from "@/lib/hermes/hermesCanvasDock";
import { HERMES_ORB_DOCK_DEFAULT } from "@/lib/hermes/hermesShellPrefs";

describe("resolveHermesOrbDisplayPos", () => {
  it("wrap 尺寸不足时不返回位置", () => {
    expect(resolveHermesOrbDisplayPos(null, HERMES_ORB_DOCK_DEFAULT, 0, 0)).toBeNull();
    expect(resolveHermesOrbDisplayPos(null, HERMES_ORB_DOCK_DEFAULT, 100, 100)).toBeNull();
  });

  it("正常 wrap 时返回右下角锚点", () => {
    const pos = resolveHermesOrbDisplayPos(null, HERMES_ORB_DOCK_DEFAULT, 1200, 800);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeGreaterThan(1000);
    expect(pos!.y).toBeGreaterThan(600);
  });

  it("误写入左上角 (10,10) 时自动恢复右下", () => {
    const pos = resolveHermesOrbDisplayPos(null, { x: 10, y: 10 }, 1200, 800);
    expect(pos!.x).toBeGreaterThan(1000);
    expect(pos!.y).toBeGreaterThan(600);
  });

  it("误写入左上角 (10,10) 在矮画布上也能恢复", () => {
    const pos = resolveHermesOrbDisplayPos(null, { x: 10, y: 10 }, 320, 200);
    expect(pos!.x).toBeGreaterThan(200);
    expect(pos!.y).toBeGreaterThan(40);
  });

  it("pos 缓存为 (10,10) 时不应覆盖校正", () => {
    const pos = resolveHermesOrbDisplayPos({ x: 10, y: 10 }, { x: 10, y: 10 }, 1200, 800);
    expect(pos!.x).toBeGreaterThan(1000);
  });
});

describe("resolveOrbSuggestPosition", () => {
  it("灵体贴右下时气泡显示在左侧", () => {
    const orb = defaultOrbDockForWrap(1200, 800);
    const layout = resolveOrbSuggestPosition(
      orb,
      1200,
      800,
      HERMES_ORB_SUGGEST_ESTIMATED_WIDTH,
    );
    expect(layout.placement).toBe("left");
    expect(layout.left + layout.maxWidth).toBeLessThanOrEqual(orb.x);
  });

  it("灵体贴左时气泡显示在右侧", () => {
    const orb = { x: 20, y: 400 };
    const layout = resolveOrbSuggestPosition(
      orb,
      1200,
      800,
      HERMES_ORB_SUGGEST_ESTIMATED_WIDTH,
    );
    expect(layout.placement).toBe("right");
    expect(layout.left).toBeGreaterThanOrEqual(orb.x + HERMES_ORB_SIZE);
  });

  it("气泡整体保持在画布内", () => {
    const orb = defaultOrbDockForWrap(640, 480);
    const layout = resolveOrbSuggestPosition(orb, 640, 480, 220);
    expect(layout.left).toBeGreaterThanOrEqual(10);
    expect(layout.left + layout.maxWidth).toBeLessThanOrEqual(630);
    expect(layout.top).toBeGreaterThanOrEqual(10);
  });
});
