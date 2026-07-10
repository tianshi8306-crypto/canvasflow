import { describe, expect, it, beforeEach } from "vitest";
import {
  loadWorkbenchTableLayout,
  persistWorkbenchTableLayout,
} from "@/lib/scriptWorkbenchTableLayout";

describe("scriptWorkbenchTableLayout", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("defaults to basic", () => {
    expect(loadWorkbenchTableLayout()).toBe("basic");
  });

  it("persists pro layout", () => {
    persistWorkbenchTableLayout("pro");
    expect(loadWorkbenchTableLayout()).toBe("pro");
  });
});
