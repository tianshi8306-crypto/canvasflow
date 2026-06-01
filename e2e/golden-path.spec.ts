import { expect, test, type Page } from "@playwright/test";

async function gotoApp(page: Page) {
  await page.goto("/");
  await expect(page.locator(".appShell")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30_000 });
}

async function openLeftAddDock(page: Page) {
  const fab = page.getByRole("button", { name: "添加", exact: true });
  await fab.click();
  await expect(page.getByRole("dialog", { name: "添加" })).toBeVisible();
}

async function addFromDock(page: Page, label: string) {
  await openLeftAddDock(page);
  await page.getByRole("button", { name: label, exact: true }).click();
}

test.describe("黄金路径冒烟（浏览器模式）", () => {
  test.describe.configure({ mode: "serial" });

  test("临时画布：加节点后标签与顶栏显示未保存", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "生文本", exact: true }).click();
    await expect(page.locator(".canvasTabUnsavedDot")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".appTopBadge--unsaved")).toHaveText("未保存");
    await expect(page.locator(".appTopBadge--warn")).toHaveText("临时画布");
  });

  test("脚本节点可落到画布", async ({ page }) => {
    await gotoApp(page);
    const before = await page.locator(".react-flow__node").count();
    await addFromDock(page, "脚本");
    await expect(page.locator(".react-flow__node")).toHaveCount(before + 1, { timeout: 10_000 });
    await expect(page.locator(".scriptChrome-shell").first()).toBeVisible({ timeout: 10_000 });
  });

  test("合成节点单击打开全屏剪辑工作台", async ({ page }) => {
    await gotoApp(page);
    await addFromDock(page, "视频合成");
    const composeNode = page.locator(".react-flow__node").last();
    await expect(composeNode).toBeVisible({ timeout: 10_000 });
    await composeNode.dblclick();
    const editor = page.getByRole("dialog", { name: "视频剪辑" });
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await expect(editor.locator(".composeEditorTimelineDock")).toBeVisible();
    await page.getByRole("button", { name: "关闭剪辑", exact: true }).click();
    await expect(editor).toBeHidden({ timeout: 10_000 });
  });

  test("浏览器预览：点新建工程提示桌面壳且不崩溃", async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator(".appTopWarn")).toHaveText("浏览器预览");
    await page.locator(".workspaceMenuTrigger").click();
    await page.getByRole("button", { name: "新建工程…", exact: true }).click();
    const status = page.locator(".appTopBadge--status");
    await expect(status).toBeVisible({ timeout: 10_000 });
    await expect(status).toContainText("浏览器预览");
    await expect(page.locator(".appShell")).toBeVisible();
    await expect(page.locator(".react-flow")).toBeVisible();
    await expect(status).toHaveAttribute("title", /浏览器预览/);
    await expect(status).toHaveAttribute("title", /tauri:dev/);
  });
});
