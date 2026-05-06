import { describe, expect, it } from "vitest";
import { getNextReplayArmState } from "./useReplayArmCountdown";

describe("useReplayArmCountdown helper", () => {
  it("returns null when current state is null", () => {
    expect(getNextReplayArmState(null)).toBeNull();
  });

  it("returns null when countdown reaches 1", () => {
    expect(getNextReplayArmState({ id: "x", left: 1 })).toBeNull();
  });

  it("decrements left when countdown is greater than 1", () => {
    expect(getNextReplayArmState({ id: "x", left: 3 })).toEqual({ id: "x", left: 2 });
  });
});
