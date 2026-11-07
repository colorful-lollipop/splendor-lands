@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Stopping Splendor ...
for %%P in (3001 3002 3003 3004 3005 3006 3007 3008) do (
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>&1
)
echo Done.
timeout /t 2 >nul