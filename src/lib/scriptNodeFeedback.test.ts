import { describe, expect, it } from "vitest";
import {
  isScriptNodeTaskBusy,
  isScriptStoryboardAgentBusy,
  resolveScriptNodePanelFeedback,
  scriptParseCompleteStatus,
} from "@/lib/scriptNodeFeedback";
import type { NodeStatus } from "@/lib/types";

describe("scriptNodeFeedback", () => {
  it("busy when graph running or node pending/running", () => {
    expect(isScriptNodeTaskBusy({ isGraphRunning: true })).toBe(true);
    expect(
      isScriptNodeTaskBusy({
        isGraphRunning: false,
        status: { status: "running", updatedAt: 0 },
      }),
    ).toBe(true);
    expect(isScriptNodeTaskBusy({ isGraphRunning: false, status: { status: "idle", updatedAt: 0 } })).toBe(
      false,
    );
  });

  it("detects storyboard agent busy", () => {
    expect(
      isScriptStoryboardAgentBusy({ status: "running", updatedAt: 0, agentName: "分镜" }),
    ).toBe(true);
    expect(
      isScriptStoryboardAgentBusy({ status: "running", updatedAt: 0, agentName: "脚本" }),
    ).toBe(false);
  });

  it("formats parse complete status", () => {
    expect(scriptParseCompleteStatus(3)).toContain("3");
    expect(scriptParseCompleteStatus(0)).toContain("未生成镜头");
  });

  it("panel feedback prioritizes failure", () => {
    const failed: NodeStatus = { status: "failed", updatedAt: 0, error: "未配置 API Key" };
    const fb = resolveScriptNodePanelFeedback({
      status: failed,
      isGraphRunning: false,
      beatCount: 0,
      themeFilled: true,
    });
    expect(fb?.tone).toBe("error");
    expect(fb?.message).toContain("API Key");
  });
});
