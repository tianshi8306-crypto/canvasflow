/**
 * 纯 Vite 浏览器预览无法使用 Tauri 后端（文件夹选择、写入工程、import_media、execute_graph 等）。
 * 与顶栏、状态栏、设置面板等处共用，避免用户误以为按钮损坏。
 */
export const DESKTOP_SHELL_HINT =
  "当前为浏览器预览，无法使用工程目录与后端命令。请在项目根目录执行 npm run tauri:dev，在打开的桌面窗口中使用新建/打开工程、保存、运行工作流与设置。";
