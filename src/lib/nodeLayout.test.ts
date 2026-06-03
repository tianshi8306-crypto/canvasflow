import { describe, expect, it } from "vitest";
import {
  CANVAS_NODE_LAYOUT_GAP,
  computeBatchImportDropPositions,
  computeImageOutputGridPositions,
  IMAGE_OUTPUT_GRID_CELL_H,
  IMAGE_OUTPUT_GRID_CELL_W,
  IMPORT_BATCH_GRID_MAX_COLS,
  IMPORT_BATCH_NODE_ESTIMATE_H,
  IMPORT_BATCH_NODE_ESTIMATE_W,
} from "@/lib/nodeLayout";

describe("computeBatchImportDropPositions", () => {
  it("returns empty for non-positive count", () => {
    expect(computeBatchImportDropPositions(0, { x: 10, y: 20 })).toEqual([]);
    expect(computeBatchImportDropPositions(-1, { x: 0, y: 0 })).toEqual([]);
  });

  it("places single node at base", () => {
    expect(computeBatchImportDropPositions(1, { x: 100, y: 200 })).toEqual([{ x: 100, y: 200 }]);
  });

  it("uses row-major grid with bounded columns", () => {
    const n = IMPORT_BATCH_GRID_MAX_COLS + 2;
    const base = { x: 0, y: 0 };
    const pts = computeBatchImportDropPositions(n, base);
    expect(pts).toHaveLength(n);
    const stepX = IMPORT_BATCH_NODE_ESTIMATE_W + CANVAS_NODE_LAYOUT_GAP;
    const stepY = IMPORT_BATCH_NODE_ESTIMATE_H + CANVAS_NODE_LAYOUT_GAP;
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[IMPORT_BATCH_GRID_MAX_COLS - 1]).toEqual({
      x: (IMPORT_BATCH_GRID_MAX_COLS - 1) * stepX,
      y: 0,
    });
    expect(pts[IMPORT_BATCH_GRID_MAX_COLS]).toEqual({ x: 0, y: stepY });
  });
});

describe("computeImageOutputGridPositions", () => {
  it("lays out two cells in a single row from anchor", () => {
    const pts = computeImageOutputGridPositions(2, { x: 50, y: 80 });
    expect(pts).toHaveLength(2);
    const stepX = IMAGE_OUTPUT_GRID_CELL_W + CANVAS_NODE_LAYOUT_GAP;
    expect(pts[0]).toEqual({ x: 50, y: 80 });
    expect(pts[1]).toEqual({ x: 50 + stepX, y: 80 });
  });

  it("lays out four cells in row-major grid from anchor", () => {
    const pts = computeImageOutputGridPositions(4, { x: 100, y: 200 });
    expect(pts).toHaveLength(4);
    const stepX = IMAGE_OUTPUT_GRID_CELL_W + CANVAS_NODE_LAYOUT_GAP;
    const stepY = IMAGE_OUTPUT_GRID_CELL_H + CANVAS_NODE_LAYOUT_GAP;
    expect(pts[0]).toEqual({ x: 100, y: 200 });
    expect(pts[1]).toEqual({ x: 100 + stepX, y: 200 });
    expect(pts[2]).toEqual({ x: 100, y: 200 + stepY });
    expect(pts[3]).toEqual({ x: 100 + stepX, y: 200 + stepY });
  });
});
