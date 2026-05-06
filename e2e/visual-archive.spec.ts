import { expect, test } from "@playwright/test";

/**
 * P2：不依赖像素对比基线，仅生成截图供 CI 产物人工验收 / 后续接入快照对比。
 */
test("首屏截图归档", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".appShell")).toBeVisible({ timeout: 30_000 });

  const file = testInfo.outputPath("app-shell.png");
  await page.locator(".appShell").screenshot({ path: file });
  await testInfo.attach("app-shell", { path: file, contentType: "image/png" });
});
