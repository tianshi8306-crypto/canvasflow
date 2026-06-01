import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { VideoGenerationStatusRail } from "./VideoGenerationStatusRail";

describe("VideoGenerationStatusRail", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing when idle and valid", () => {
    const { container } = render(
      <VideoGenerationStatusRail
        isGenerating={false}
        errors={[]}
        showValidation={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render failure panel (failures go to Hermes orb)", () => {
    const { container } = render(
      <VideoGenerationStatusRail
        isGenerating={false}
        errors={["任务不存在 (可能已过期)"]}
        showValidation={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows validation errors when showValidation", () => {
    render(
      <VideoGenerationStatusRail
        isGenerating={false}
        errors={["请先填写提示词"]}
        showValidation
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("请先填写提示词");
  });
});
