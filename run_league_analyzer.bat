@echo off
title League Personal Analyzer
cd /d "%~dp0"

REM Use the Python inside your virtualenv to run main.py
".venv\Scripts\python.exe" main.py

echo.
echo ----------------------------------------
echo Done. Press any key to close this window.
pause >nul
