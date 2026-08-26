#!/usr/bin/env bash
set -e

echo "==============================================================================="
echo "                  ZAMORIN CAFE ERP — ENTERPRISE LAUNCHER"
echo "==============================================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Launch Backend
(cd backend && npm start) &
BACKEND_PID=$!

# Launch Frontend
(node scripts/serve_frontend.js) &
FRONTEND_PID=$!

echo "Services started:"
echo "  - Backend (PID $BACKEND_PID):  http://localhost:4000/api/v1/health"
echo "  - Frontend (PID $FRONTEND_PID): http://localhost:3000"

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT INT TERM
wait
