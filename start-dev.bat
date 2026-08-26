@echo off
TITLE Zamorin Cafe ERP — Development & Local Preview Runner
COLOR 0B
echo ===============================================================================
echo            ZAMORIN CAFE ERP — DEVELOPMENT & PREVIEW LAUNCHER
echo ===============================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found on PATH. Please install Node.js v18+.
    pause
    exit /b 1
)

echo Starting Backend in Development Mode with in-memory MongoDB fallback...
start "Zamorin ERP Backend Dev" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 2 /nobreak >nul
start "Zamorin ERP Frontend Dev" cmd /k "cd /d %~dp0 && node scripts/serve_frontend.js"

echo.
echo Development Servers Running:
echo   - Local Frontend: http://localhost:3000/?role=master
echo   - Persona Switch: http://localhost:3000/?role=owner / admin / staff
echo.
pause
