import { describe, expect, it } from "vitest";
import { summarizeModelLanes } from "./settingsModelsOverview";
import type { AppSettings } from "@/lib/settingsPanelTypes";

const base: AppSettings = {
  providers: [],
  imageModels: [],
  videoModels: [],
  audioModels: [],
  defaultProviderId: null,
  ffmpegPath: null,
  abortWorkflowOnFailure: false,
  themePreset: "dark",
  fontSize: "medium",
  cursorStyle: "default",
  gridDotsVisible: true,
  promptActionSurface: "themed",
  showVideoMeta: true,
  imageVideoNodeResizeEnabled: true,
  promptBoxResizeEnabled: true,
  titleFollowsCanvasZoom: true,
  nodeSpacing: 120,
  nodeDirection: "right",
  nodeAvoidOverlap: true,
  alignFeatureTriggerMode: "click",
  alignDistributeGap: 40,
  selectionRelatedHighlightEnabled: true,
  selectionRelatedHighlightColor: "white",
  snapGuidesEnabled: true,
  connectionLinesVisible: true,
  snapGridEnabled: false,
  uploadQuality: "standard",
};

describe("summarizeModelLanes", () => {
  it("marks chat ready when enabled provider has model id", () => {
    const lanes = summarizeModelLanes({
      ...base,
      providers: [
        {
          id: "openai",
          label: "OpenAI",
          baseUrl: "https://api.openai.com",
          model: "gpt-4o-mini",
          priority: 10,
          enabled: true,
        },
      ],
    });
    const chat = lanes.find((l) => l.id === "chat");
    expect(chat?.ready).toBe(true);
  });
});
