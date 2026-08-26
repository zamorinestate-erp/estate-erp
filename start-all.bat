@echo off
TITLE Zamorin Cafe ERP — Production-Grade Local Runner
COLOR 0A
echo ===============================================================================
echo                   ZAMORIN CAFE ERP — ENTERPRISE LAUNCHER
echo ===============================================================================
echo.
echo Checking environment prerequisites...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found on PATH. Please install Node.js v18+.
    pause
    exit /b 1
)

echo [OK] Node.js detected: 
node -v

echo.
echo Starting Backend API Server (Port 4000) and Frontend Web Server (Port 3000)...
echo.

start "Zamorin ERP Backend API" cmd /k "cd /d %~dp0backend && npm start"
timeout /t 2 /nobreak >nul
start "Zamorin ERP Frontend UI" cmd /k "cd /d %~dp0 && node scripts/serve_frontend.js"

echo.
echo ===============================================================================
echo Services Launched Successfully:
echo   - Frontend UI:  http://localhost:3000
echo   - Backend API:  http://localhost:4000/api/v1/health
echo ===============================================================================
echo.
pause
