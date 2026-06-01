import { describe, expect, it, beforeEach } from "vitest";
import {
  pushRecentProject,
  readRecentProjects,
  projectFolderName,
  rememberProjectOpened,
  readDefaultBrowseDirectory,
  readLastBrowseDirectory,
  removeRecentProject,
  projectParentDirectory,
} from "@/lib/recentProjects";

describe("recentProjects", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("pushRecentProject dedupes and caps list", () => {
    pushRecentProject("/a");
    pushRecentProject("/b");
    pushRecentProject("/a");
    expect(readRecentProjects()).toEqual(["/a", "/b"]);
  });

  it("projectFolderName", () => {
    expect(projectFolderName("D:/work/my-ad")).toBe("my-ad");
  });

  it("rememberProjectOpened stores browse parent", () => {
    rememberProjectOpened("D:/work/my-ad");
    expect(readRecentProjects()[0]).toBe("D:/work/my-ad");
    expect(readLastBrowseDirectory()).toBe("D:/work");
    expect(readDefaultBrowseDirectory()).toBe("D:/work");
  });

  it("readDefaultBrowseDirectory prefers current project parent", () => {
    rememberProjectOpened("D:/old/proj");
    expect(readDefaultBrowseDirectory("E:/current/proj")).toBe("E:/current");
  });

  it("removeRecentProject drops stale entry", () => {
    pushRecentProject("/gone");
    pushRecentProject("/stay");
    removeRecentProject("/gone");
    expect(readRecentProjects()).toEqual(["/stay"]);
  });

  it("projectParentDirectory", () => {
    expect(projectParentDirectory("D:/work/my-ad")).toBe("D:/work");
    expect(projectParentDirectory("my-ad")).toBe(null);
  });
});
