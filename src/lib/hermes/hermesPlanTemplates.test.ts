import { describe, expect, it } from "vitest";
import {
  expandTemplateStepsInPlan,
  instantiateTemplatePlan,
  resolveTemplateIdFromMessage,
  saveUserHermesPlanTemplate,
  loadUserHermesPlanTemplates,
  HERMES_USER_TEMPLATES_STORAGE_KEY,
} from "@/lib/hermes/hermesPlanTemplates";

describe("hermesPlanTemplates", () => {
  it("resolves alias from message", () => {
    expect(resolveTemplateIdFromMessage("跑模板 分镜出关键帧")).toBe(
      "storyboard-keyframes",
    );
  });

  it("instantiates creative pipeline with brief from message", () => {
    const plan = instantiateTemplatePlan("creative-pipeline", "雨夜女主短剧");
    expect(plan?.steps.some((s) => s.toolId === "script.update_brief")).toBe(true);
    const brief = plan?.steps.find((s) => s.toolId === "script.update_brief");
    expect(brief?.args?.briefText).toBe("雨夜女主短剧");
  });

  it("expands template.run in plan", () => {
    const expanded = expandTemplateStepsInPlan({
      id: "p",
      title: "t",
      sourceMessage: "x",
      steps: [
        {
          id: "s1",
          toolId: "template.run",
          label: "跑模板",
          args: { templateId: "retry-failed-video" },
        },
      ],
    });
    expect(expanded.steps).toHaveLength(1);
    expect(expanded.steps[0]?.toolId).toBe("video.retry_failed");
  });

  it("expands retry-failed-keyframe template", () => {
    const expanded = expandTemplateStepsInPlan({
      id: "p1",
      title: "重试关键帧",
      sourceMessage: "重试",
      steps: [
        {
          id: "s1",
          toolId: "template.run",
          label: "跑模板",
          args: { templateId: "retry-failed-keyframe" },
        },
      ],
    });
    expect(expanded.steps).toHaveLength(1);
    expect(expanded.steps[0]?.toolId).toBe("image.retry_failed");
  });

  it("persists user template", () => {
    localStorage.removeItem(HERMES_USER_TEMPLATES_STORAGE_KEY);
    saveUserHermesPlanTemplate({
      id: "user-test",
      title: "我的流程",
      steps: [{ toolId: "canvas.focus", label: "定位", args: { beatIds: [1] } }],
    });
    expect(loadUserHermesPlanTemplates().some((t) => t.id === "user-test")).toBe(true);
    localStorage.removeItem(HERMES_USER_TEMPLATES_STORAGE_KEY);
  });
});
