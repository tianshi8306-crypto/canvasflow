@echo off
setlocal
cd /d "%~dp0"

echo [tauri-dev] 目录: %CD%
echo [tauri-dev] 启动 npm run tauri:dev ...
echo.

npm run tauri:dev
if errorlevel 1 (
  echo.
  echo [tauri-dev] 退出码非 0，按任意键关闭窗口。
  pause >nul
)
