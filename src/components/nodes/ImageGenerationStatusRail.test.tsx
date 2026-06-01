import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ImageGenerationStatusRail } from "./ImageGenerationStatusRail";

describe("ImageGenerationStatusRail", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing when idle and valid", () => {
    const { container } = render(
      <ImageGenerationStatusRail
        isGenerating={false}
        errors={[]}
        showValidation={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing while generating", () => {
    const { container } = render(
      <ImageGenerationStatusRail
        isGenerating
        errors={[]}
        showValidation={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render failure panel (failures go to Hermes orb)", () => {
    const { container } = render(
      <ImageGenerationStatusRail
        isGenerating={false}
        errors={["任务不存在 (可能已过期)"]}
        showValidation={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows validation errors when showValidation", () => {
    render(
      <ImageGenerationStatusRail
        isGenerating={false}
        errors={["未配置可用的图片模型。请在 设置 → 图片模型 中启用并配置 API Key"]}
        showValidation
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("未配置可用的图片模型");
  });

  it("shows warn banner when only warnMessage", () => {
    render(
      <ImageGenerationStatusRail
        isGenerating={false}
        errors={[]}
        showValidation={false}
        warnMessage="参考图分辨率较低，可能影响生成质量"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("参考图分辨率较低");
  });

  it("prefers validation over warn when both would apply", () => {
    render(
      <ImageGenerationStatusRail
        isGenerating={false}
        errors={["当前模型不支持图像编辑，请在设置中启用或更换模型。"]}
        showValidation
        warnMessage="参考图分辨率较低"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("当前模型不支持图像编辑");
    expect(screen.queryByText(/参考图分辨率较低/)).not.toBeInTheDocument();
  });
});
