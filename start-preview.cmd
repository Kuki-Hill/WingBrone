@echo off
cd /d "%~dp0"
echo Windborne: http://127.0.0.1:5174/
echo Keep this window open while using the experience.
if not exist node_modules\vite\bin\vite.js (
  echo Dependencies missing. Run npm ci first.
  pause
  exit /b 1
)
call npm run dev -- --strictPort
pause
