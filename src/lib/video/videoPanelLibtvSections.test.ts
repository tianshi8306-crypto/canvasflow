import { describe, expect, it } from "vitest";
import {
  allVideoWorkflowTabs,
  VIDEO_WORKFLOW_LIBTV,
  videoWorkflowTabsForPanel,
} from "@/lib/video/videoPanelLibtvSections";

describe("videoPanelLibtvSections", () => {
  it("lists LibTV workflow order without video ref by default", () => {
    expect(videoWorkflowTabsForPanel({ hasIncomingVideoRef: false }).map((t) => t.id)).toEqual([
      "text_to_video",
      "multimodal_reference",
      "image_to_video",
      "first_last_frame",
      "image_reference",
    ]);
  });

  it("appends video_reference when upstream video is connected", () => {
    const tabs = videoWorkflowTabsForPanel({ hasIncomingVideoRef: true });
    expect(tabs).toHaveLength(6);
    expect(tabs[tabs.length - 1]?.id).toBe("video_reference");
  });

  it("includes all six workflow modes in catalog", () => {
    expect(allVideoWorkflowTabs()).toHaveLength(6);
    expect(VIDEO_WORKFLOW_LIBTV).toHaveLength(5);
  });
});
