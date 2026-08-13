# ZAMORIN CAFE ERP — PRODUCTION OPERATIONS RUNBOOK (SECTION 141.16)

> **Status**: OPERATIONAL & VERIFIED

## Local Development & Startup Commands

1. **Start Dev Environment (In-Memory MongoDB + Backend Server)**:
   ```bash
   cd backend
   node src/scripts/startDev.js
   ```

2. **Serve Frontend Static UI**:
   ```bash
   cd frontend
   npx serve . -p 3000 --no-clipboard
   ```

3. **Run Full Automated Test Suite**:
   ```bash
   cd backend
   npm test
   ```

## Production Deployment Checklist
- [x] Configure `MONGODB_URI` pointing to MongoDB Atlas cluster.
- [x] Set `JWT_ACCESS_SECRET` and `MFA_ENCRYPTION_KEY` secrets in Render environment.
- [x] Set `ALLOWED_ORIGINS` to Vercel production frontend domain.
- [x] Verify `/api/v1/health` and `/api/v1/readiness` endpoints respond 200 OK.
