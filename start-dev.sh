#!/usr/bin/env bash
set -e

echo "==============================================================================="
echo "           ZAMORIN CAFE ERP — DEVELOPMENT & PREVIEW LAUNCHER"
echo "==============================================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Launch Backend in Dev Mode
(cd backend && npm run dev) &
BACKEND_PID=$!

# Launch Frontend
(node scripts/serve_frontend.js) &
FRONTEND_PID=$!

echo "Development Services Running:"
echo "  - Local Frontend: http://localhost:3000/?role=master"
echo "  - Backend API:    http://localhost:4000/api/v1/health"

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT INT TERM
wait
