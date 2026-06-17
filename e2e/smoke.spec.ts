import { expect, test } from "@playwright/test";

test.describe("应用壳与画布", () => {
  test("首屏加载并显示顶栏操作", async ({ page }) => {
    await page.goto("/");
    // WorkspaceMenu trigger is visible when no project is open
    const trigger = page.locator(".workspaceMenuTrigger");
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    // Open the dropdown to reveal menu items
    await trigger.click();
    // 菜单项在 .workspaceMenuRow 中，trigger 按钮也包含类似文字，用 .workspaceMenuRow 限定
    await expect(page.locator(".workspaceMenuRow", { hasText: "新建工程" })).toBeVisible();
    await expect(page.locator(".workspaceMenuRow", { hasText: "打开工程" })).toBeVisible();
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
