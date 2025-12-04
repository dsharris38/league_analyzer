@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

cd /d "%~dp0"

echo.
echo ============================================
echo  Starting League Analyzer Web Dashboard
echo ============================================
echo.

REM 1. Activate venv if exists
IF EXIST ".venv\Scripts\activate.bat" (
    echo [Backend] Activating .venv...
    call ".venv\Scripts\activate.bat"
) ELSE (
    echo [Backend] No .venv found. Using global python.
)

echo [Backend] Checking dependencies...
pip install -r requirements.txt >nul 2>&1


REM 2. Start Django Server in background
echo [Backend] Starting Django API on port 8000...
REM We need to activate venv inside the new window
REM The path to activate.bat is relative to where the new cmd starts (which is %~dp0 by default or System32)
REM Let's use absolute path for safety
set "VENV_PATH=%~dp0.venv\Scripts\activate.bat"
start "Django Backend" cmd /k "call "%VENV_PATH%" && cd web_dashboard\backend && python manage.py runserver 0.0.0.0:8000"

REM 3. Start React Frontend
echo [Frontend] Starting React Dev Server...
cd web_dashboard\frontend

REM Check if node_modules exists, if not install
IF NOT EXIST "node_modules" (
    echo [Frontend] Installing dependencies...
    call npm install
)

echo [Frontend] Launching Vite...
call npm run dev

pause
ENDLOCAL
