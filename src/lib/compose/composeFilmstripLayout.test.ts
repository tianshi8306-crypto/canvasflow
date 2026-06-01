import { describe, expect, it } from "vitest";
import { filmstripCellCount, filmstripSeekTimes } from "./composeFilmstripLayout";

describe("filmstripSeekTimes", () => {
  it("samples across clip span", () => {
    const times = filmstripSeekTimes(2, 8, 4);
    expect(times).toHaveLength(4);
    expect(times[0]).toBeGreaterThan(2);
    expect(times[3]).toBeLessThan(10);
  });
});

describe("filmstripCellCount", () => {
  it("scales with width", () => {
    expect(filmstripCellCount(400)).toBeGreaterThan(filmstripCellCount(100));
  });
});
