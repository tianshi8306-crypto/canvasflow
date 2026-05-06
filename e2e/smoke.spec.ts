import { expect, test } from "@playwright/test";

test.describe("应用壳与画布", () => {
  test("首屏加载并显示顶栏操作", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "新建工程" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "打开工程" })).toBeVisible();
  });

  test("主区域存在 React Flow 画布", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".appShell")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
  });

  test("画布可交互区域存在", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".react-flow__pane")).toBeVisible({ timeout: 30_000 });
  });
});
