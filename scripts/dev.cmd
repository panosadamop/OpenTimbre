@echo off
cd /d "%~dp0.."
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (py -3 scripts\dev.py %* ) else (python scripts\dev.py %*)
exit /b %ERRORLEVEL%
