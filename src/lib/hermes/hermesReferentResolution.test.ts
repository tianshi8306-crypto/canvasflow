import { describe, expect, it } from "vitest";
import type { HermesCanvasEvent } from "@/lib/hermes/agent/hermesCanvasEvents";
import { parseShotNumberFromLabel } from "@/lib/hermes/agent/hermesCanvasReferent";
import {
  messageHasShotReferent,
  resolveShotNumbersWithReferents,
  shotNumbersFromCanvasEvents,
} from "@/lib/hermes/hermesReferentResolution";

const now = new Date().toISOString();

function ev(
  kind: HermesCanvasEvent["kind"],
  shotNumber: string,
): HermesCanvasEvent {
  return {
    id: "1",
    kind,
    message: "test",
    shotNumber,
    at: now,
  };
}

describe("hermesReferentResolution", () => {
  it("messageHasShotReferent 识别指代", () => {
    expect(messageHasShotReferent("把那镜改成夜景")).toBe(true);
    expect(messageHasShotReferent("重试失败视频")).toBe(false);
  });

  it("parseShotNumberFromLabel", () => {
    expect(parseShotNumberFromLabel("3")).toBe(3);
    expect(parseShotNumberFromLabel("镜5")).toBe(5);
    expect(parseShotNumberFromLabel("")).toBe(null);
  });

  it("shotNumbersFromCanvasEvents 取最近一次相关事件", () => {
    const events = [
      ev("selection_focused", "2"),
      ev("storyboard_edited", "5"),
    ];
    expect(shotNumbersFromCanvasEvents(events)).toEqual([5]);
  });

  it("resolveShotNumbersWithReferents 优先明确镜号", () => {
    expect(
      resolveShotNumbersWithReferents("把第 2 镜和那镜都改亮", {
        canvasEvents: [ev("selection_focused", "7")],
      }),
    ).toEqual([2]);
  });

  it("resolveShotNumbersWithReferents 指代回落事件", () => {
    expect(
      resolveShotNumbersWithReferents("把这镜重新出图", {
        canvasEvents: [ev("storyboard_edited", "4")],
      }),
    ).toEqual([4]);
  });

  it("resolveShotNumbersWithReferents 指代回落选中", () => {
    expect(
      resolveShotNumbersWithReferents("刚才那镜加雨", {
        canvasEvents: [],
        selectedBeatShotNumber: "6",
      }),
    ).toEqual([6]);
  });

  it("resolveShotNumbersWithReferents 指代回落 workstate 默认镜", () => {
    expect(
      resolveShotNumbersWithReferents("把刚才改的重新出图", {
        canvasEvents: [],
        lastCanvasReferentShotNumber: "8",
      }),
    ).toEqual([8]);
  });

  it("无指代且无镜号时返回空", () => {
    expect(resolveShotNumbersWithReferents("批量出图")).toEqual([]);
  });
});
