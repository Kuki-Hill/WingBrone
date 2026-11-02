@echo off
setlocal
cd /d "%~dp0"
title WIND//01 - Local preview
echo WIND//01: http://127.0.0.1:5174/?theme=crt
if not exist node_modules\vite\bin\vite.js (
  echo Dependencies missing. Run npm ci first.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is missing from PATH.
  pause
  exit /b 1
)
powershell.exe -NoProfile -Command "try { $r = Invoke-WebRequest 'http://127.0.0.1:5174/' -UseBasicParsing -TimeoutSec 2; if ($r.Content -match 'Particle Interception System') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  echo Preview is already running. Opening it now.
  start "" "http://127.0.0.1:5174/?theme=crt"
  exit /b 0
)
echo Keep this window open while playing. Press Ctrl+C to stop the preview.
node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5174 --strictPort --open "/?theme=crt"
echo Preview stopped. If the port is occupied, close the other server and try again.
pause
