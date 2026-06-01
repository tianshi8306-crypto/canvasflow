import { afterEach, describe, expect, it } from "vitest";
import {
  clearHermesChatHistory,
  loadHermesChatHistory,
  saveHermesChatHistory,
  toLlmHistory,
} from "./hermesChatHistory";

describe("hermesChatHistory", () => {
  const project = "/tmp/test-project";

  afterEach(() => {
    clearHermesChatHistory(project, "tab-a");
    clearHermesChatHistory(project, "tab-b");
    clearHermesChatHistory(project);
  });

  it("persists per project path and tab", () => {
    saveHermesChatHistory(
      project,
      [{ id: "1", role: "user", content: "hi" }],
      "tab-a",
    );
    saveHermesChatHistory(
      project,
      [{ id: "2", role: "user", content: "other" }],
      "tab-b",
    );
    expect(loadHermesChatHistory(project, "tab-a")).toHaveLength(1);
    expect(loadHermesChatHistory(project, "tab-b")[0]?.content).toBe("other");
    expect(toLlmHistory(loadHermesChatHistory(project, "tab-a"))[0]?.role).toBe("user");
  });
});
