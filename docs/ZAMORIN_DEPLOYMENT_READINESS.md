# ZAMORIN CAFE ERP — DEPLOYMENT READINESS (SECTION 141.12)

> **Status**: VERIFIED & RECONCILED

## Architecture & Production Targets
- **Frontend Host**: Vercel (Static SPA Shell with Service Worker `v1.0.1` and Client SPA Rewrites)
- **Backend Host**: Render (`0.0.0.0` binding, `process.env.PORT`, `/api/v1/health` and `/api/v1/readiness` endpoints)
- **Database**: MongoDB Atlas (TLS encryption, restricted DB user, index validation)
- **Business Timezone**: `Asia/Kolkata`
- **Business Currency**: `INR` (`₹`)

## Operational Verification
- Local dev environment running via `node src/scripts/startDev.js`.
- Health check endpoint `/api/v1/health` verified returning `status: "ok"`.
