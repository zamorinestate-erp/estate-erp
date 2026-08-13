# ZAMORIN CAFE ERP — DEPLOYMENT READINESS (SECTION 141.12)

> **Status**: VERIFIED & RECONCILED

## Architecture & Production Targets
- **Frontend Host**: Vercel or Caddy (`:3000` static SPA shell with PWA service worker)
- **Backend Host**: Render or Docker Container (`startProd.js` with `0.0.0.0:4000` binding, `/api/v1/health` verified)
- **Database**: MongoDB Atlas or Local MongoDB 7.0 (`mongodb://mongodb:27017/zamorin_cafe_erp`)
- **Deployment Assets**: Production `Dockerfile`, `docker-compose.yml`, and `startProd.js` script active
- **Business Timezone**: `Asia/Kolkata`
- **Business Currency**: `INR` (`₹`)

## Operational Verification
- Production dev server script [`startProd.js`](file:///D:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/scripts/startProd.js) verified.
- Local dev environment running via `startDev.js` on port 4000.
- Automated Test Suite: **330 / 330 Backend Tests PASSING** (`npm test`).
- Health check endpoint `/api/v1/health` verified returning `status: "ok"`.
