@echo off
TITLE Zamorin Cafe ERP — Comprehensive System Verification Suite
COLOR 0E
echo ===============================================================================
echo            ZAMORIN CAFE ERP — FULL SYSTEM VERIFICATION HARNESS
echo ===============================================================================
echo.

echo [1/4] Running Backend Unit and Contract Regression Tests...
cd /d %~dp0backend
call npm test
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FAIL] Backend test suite encountered failures!
    pause
    exit /b 1
)

echo.
echo [2/4] Verifying 100% Backend JavaScript Syntax...
call npm run check
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FAIL] Backend JavaScript syntax checks failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Verifying Frontend Router Imports and ES Module Exports...
cd /d %~dp0
node frontend/verifyRouterImports.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FAIL] Frontend router import verification failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Executing Master System Verification Engine...
node scripts/master_system_verification.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FAIL] Master system verification failed!
    pause
    exit /b 1
)

echo.
echo ===============================================================================
echo [SUCCESS] 100% SYSTEM VERIFICATION COMPLETE — ZERO DEFECTS CERTIFIED!
echo ===============================================================================
echo.
pause
