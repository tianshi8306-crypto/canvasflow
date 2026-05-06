@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting Tauri desktop (npm run tauri:dev)...
call npm run tauri:dev
if errorlevel 1 pause
