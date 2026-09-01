@echo off
REM =============================================================================
REM ZAMORIN CAFE ERP — PRODUCTION DEPLOYMENT & BOOTSTRAP SCRIPT (WINDOWS)
REM =============================================================================

echo ===============================================================================
echo         ZAMORIN CAFE ERP — PRODUCTION DEPLOYMENT PRE-FLIGHT CHECK        
echo ===============================================================================

echo [1/4] Verifying Node.js runtime...
node -v
if %ERRORLEVEL% NEQ 0 (
    echo [FATAL] Node.js is not installed or not in PATH.
    exit /b 1
)

echo [2/4] Verifying production dependencies...
cd backend
call npm ci --only=production
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] npm ci warning, falling back to existing dependencies...
)

echo [3/4] Running Pre-Flight Deployment Invariant Verification...
call node src/scripts/verifyDeploymentConfig.js
if %ERRORLEVEL% NEQ 0 (
    echo [FATAL] Pre-flight deployment check failed. Please correct the items above.
    exit /b 1
)

echo [4/4] Starting Zamorin Cafe ERP Production Server...
call node src/scripts/startProd.js
