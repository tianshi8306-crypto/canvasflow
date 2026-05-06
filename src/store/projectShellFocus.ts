/** 原生对话框关闭后，部分环境下需同时聚焦窗口与 WebView，否则画布/按钮「点不动」 */
export async function focusShellAfterNativeDialog() {
  try {
    const [{ getCurrentWindow }, { getCurrentWebview }] = await Promise.all([
      import("@tauri-apps/api/window"),
      import("@tauri-apps/api/webview"),
    ]);
    await getCurrentWindow().setFocus();
    await getCurrentWebview().setFocus();
  } catch {
    // 非 Tauri 环境或权限不足时忽略
  }
}
