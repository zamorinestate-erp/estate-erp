#!/usr/bin/env bash
# =============================================================================
# ZAMORIN CAFE ERP — PRODUCTION DEPLOYMENT & BOOTSTRAP SCRIPT
# =============================================================================

set -e

echo "==============================================================================="
echo "        ZAMORIN CAFE ERP — PRODUCTION DEPLOYMENT PRE-FLIGHT CHECK        "
echo "==============================================================================="

# 1. Verify Node.js version
NODE_VERSION=$(node -v)
echo "[1/4] Detected Node.js runtime: $NODE_VERSION"

# 2. Check dependencies
echo "[2/4] Verifying dependencies..."
cd backend
npm ci --only=production

# 3. Execute Pre-Flight Deployment Diagnostic
echo "[3/4] Running Pre-Flight Deployment Invariant Verification..."
node src/scripts/verifyDeploymentConfig.js

# 4. Start Production API Server
echo "[4/4] Starting Zamorin Cafe ERP Production Cluster..."
node src/scripts/startProd.js
