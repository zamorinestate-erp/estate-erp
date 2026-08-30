# ZAMORIN CAFÉ ERP — PRODUCTION DEPLOYMENT & GO-LIVE RUNBOOK

## 1. Overview
This runbook provides the authoritative, step-by-step operational procedures for deploying Zamorin Café ERP to the canonical production environment:
- **Frontend**: Static Web Application hosted on **Vercel** (Global Edge CDN).
- **Backend API**: Node.js REST API service hosted on **Render** (Containerized Web Service).
- **Database**: **MongoDB Atlas** (Replica Set Cluster).
- **Distributed Cache & Queues**: **Redis** (Managed Redis Instance).

---

## 2. Environment Variables & Secret Configuration

### 2.1 Backend Secrets (Render Dashboard)
Configure the following environment variables in the Render Service Environment Settings:

| Environment Variable | Recommended Production Value / Format | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations and secure cookie modes |
| `PORT` | `10000` (Render default) | Service listening port |
| `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster.mongodb.net/zamorin_cafe_erp?retryWrites=true&w=majority` | Primary MongoDB Atlas connection string |
| `MONGODB_MAX_POOL_SIZE` | `50` | Connection pool size for enterprise concurrency |
| `ALLOWED_ORIGINS` | `https://zamorin-cafe-erp.vercel.app` (or custom domain) | Strict CORS allowed origins |
| `JWT_ACCESS_SECRET` | High-entropy 64-character hex string | Access token signing key (15 min TTL) |
| `JWT_ACCESS_TTL_MINUTES` | `15` | Short-lived access token expiry |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh token rolling lifetime |
| `SESSION_ABSOLUTE_TTL_DAYS` | `7` | Absolute session boundary |
| `SESSION_IDLE_TIMEOUT_MINUTES` | `30` | Inactivity lock timeout |
| `MFA_ENCRYPTION_KEY` | High-entropy 64-character hex string | AES-256 encryption key for TOTP secrets |
| `COOKIE_SECURE` | `true` | Enforces HTTPS-only cookie transmission |
| `COOKIE_SAME_SITE` | `none` (or `strict` on shared root domain) | Cross-site cookie transmission flag |
| `INITIAL_ORGANISATION_ID` | `ZAMORIN` | Root tenant identifier |
| `INITIAL_MASTER_EMAIL` | `master@zamorincafe.com` | Primary Master administrative account |
| `PRIVATE_STORAGE_DRIVER` | `cloudinary` (or `s3`) | Private file storage adapter |
| `CLOUDINARY_CLOUD_NAME` | `<cloud_name>` | Cloudinary credentials for receipts/vault files |
| `CLOUDINARY_API_KEY` | `<api_key>` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | `<api_secret>` | Cloudinary API Secret |

---

## 3. Database Initialization & Primary Master Bootstrap

### Step 1: Atlas Network Access
1. In MongoDB Atlas, add Render Outbound IP addresses (or `0.0.0.0/0` with strong password authentication) to the **IP Access List**.
2. Ensure database user has `readWriteAnyDatabase` or `readWrite@zamorin_cafe_erp` permissions.

### Step 2: Seed Initial Roles & Master Account
Run the initial seed script from the Render shell or deployment task:
```bash
npm run seed
```
*Expected Output*:
```text
✓ Organisation ZAMORIN created/verified.
✓ 4 Canonical Roles (MASTER, OWNER, CAFE_ADMIN, STAFF) created with full permission matrices.
✓ Primary Master account created with credentials from environment.
```

---

## 4. Frontend Deployment Procedure (Vercel)

### Step 1: Connect Repository
1. In Vercel, import the repository root `15_INTEGRATION_WORKSPACE`.
2. Set **Root Directory** to `frontend`.
3. Set **Framework Preset** to `Other` (Zero-Build Vanilla ES Modules).

### Step 2: Configure Rewrites in `vercel.json`
Verify `frontend/vercel.json` rewrites API calls to your live Render backend URL:
```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://<your-render-service>.onrender.com/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 5. Post-Deployment Verification Checklist

1. [ ] **Health Endpoint**: Navigate to `https://<backend>.onrender.com/api/v1/health` and verify HTTP 200 OK.
2. [ ] **Frontend Load**: Navigate to `https://<frontend>.vercel.app` and verify login screen displays with theme controls.
3. [ ] **Primary Master Sign-In**: Log in as Primary Master, verify access to `#dashboard` and `#ledger`.
4. [ ] **Session Security**: Open DevTools Application tab and verify:
   - `accessToken` is in memory only (0 items in `localStorage`/`sessionStorage`).
   - `refreshToken` cookie is marked `HttpOnly`, `Secure`, `SameSite=None` (or `Lax`).
5. [ ] **Responsive Verification**: Verify layouts on mobile (375px), tablet (768px), and desktop (1440px).
6. [ ] **All 4 Themes**: Switch between `Paper`, `Pearl`, `Midnight`, and `Noir` and verify readable contrast.
