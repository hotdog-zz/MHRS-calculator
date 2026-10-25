@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel% equ 0 (
  py -3 start_local.py
  goto end
)
where python >nul 2>&1
if %errorlevel% equ 0 (
  python start_local.py
  goto end
)
echo Python 3 was not found. Open SunbreakForge.html directly in Chrome or Edge.
:end
pause
