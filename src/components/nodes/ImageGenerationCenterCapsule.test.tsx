import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ImageGenerationCenterCapsule } from "./ImageGenerationCenterCapsule";

describe("ImageGenerationCenterCapsule", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders label and stop button", () => {
    const onCancel = vi.fn();
    render(
      <ImageGenerationCenterCapsule label="正在生成图片 42%…" onCancel={onCancel} />,
    );
    expect(screen.getByText("正在生成图片 42%…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "停止" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables stop while cancelling", () => {
    render(
      <ImageGenerationCenterCapsule
        label="停止中…"
        onCancel={() => {}}
        cancelling
      />,
    );
    expect(screen.getByRole("button", { name: "停止中" })).toBeDisabled();
  });
});
