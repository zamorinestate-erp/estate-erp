# 🚀 Zamorin Cafe ERP — Production Deployment Guide

This document provides complete, step-by-step instructions for deploying the **Zamorin Cafe ERP** enterprise application into production.

---

## 1. System Architecture & Prerequisites

### Architecture Overview
- **Backend**: Node.js 20+ / Express 5 API server with cryptographic session governance, rate limiting, and multi-document transaction support.
- **Database**: MongoDB 6.0+ (**MongoDB Atlas** or **Replica Set** `rs0` required for atomic transactions).
- **Frontend**: High-performance Vanilla ES Modules Single Page Application (zero build-step required, dynamic API routing, service worker version cache busting).
- **Security**: Strict CORS origin allowlists, Helmet security headers, HttpOnly cookies, SHA-256 integrity verification, and fail-closed production guards.

### Prerequisites Checklist
- [x] Node.js **v20.x or higher** installed.
- [x] Production **MongoDB Atlas** connection string or local MongoDB Replica Set.
- [x] Production domain (e.g. `app.zamorincafe.com`) with SSL/TLS certificate.
- [x] Cryptographic secrets generated for `JWT_ACCESS_SECRET` ($\ge 32$ chars) and `MFA_ENCRYPTION_KEY` (64 hex characters).

---

## 2. Pre-Flight Verification Diagnostic

Before launching in any environment, run the built-in deployment validator:

```bash
cd backend
npm run check:deploy
```

This automated validator inspects:
1. `NODE_ENV` and production flags.
2. `JWT_ACCESS_SECRET` strength and lack of placeholders.
3. `MFA_ENCRYPTION_KEY` 64-hex validity.
4. `ALLOWED_ORIGINS` exact matching and absence of wildcards.
5. MongoDB cluster connectivity and **multi-document transaction capability**.

---

## 3. Deployment Options

### Option A: Recommended Cloud Stack (Vercel Frontend + Render Backend + MongoDB Atlas)

#### 1. Database Provisioning on MongoDB Atlas
1. Sign up/Log in at **[MongoDB Atlas](https://cloud.mongodb.com)**.
2. Create a new Cluster (e.g. Free Tier M0 or Shared M10+ in your preferred AWS/GCP region like `ap-south-1` Mumbai or `eu-central-1`).
3. Under **Security $\rightarrow$ Network Access**:
   - Add IP Address `0.0.0.0/0` (Allow Access from Anywhere) — safe with strong DB credentials — or whitelist Render's static egress IP.
4. Under **Security $\rightarrow$ Database Access**:
   - Create a Database User with username (e.g. `zamorin_admin`) and password.
   - Assign built-in role: `readWriteAnyDatabase` or `readWrite` on `zamorin_production`.
5. Under **Database $\rightarrow$ Connect $\rightarrow$ Drivers (Node.js)**:
   - Copy your connection string:
     ```
     mongodb+srv://zamorin_admin:<password>@cluster0.xxxxx.mongodb.net/zamorin_production?retryWrites=true&w=majority&appName=ZamorinCafeERP
     ```

#### 2. Backend Web Service Deployment on Render
1. Log in to **[Render.com](https://render.com)**.
2. Click **New + $\rightarrow$ Blueprint** and select your GitHub repository `zamorinestate-erp/estate-erp`.
   - Render will detect `render.yaml` and configure the backend service automatically.
   - Alternatively, choose **New Web Service**:
     - **Root Directory**: `backend`
     - **Build Command**: `npm ci --only=production`
     - **Start Command**: `node src/scripts/startProd.js`
     - **Health Check Path**: `/api/v1/health`
3. Fill in the Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `4000` (Render binds to `$PORT` automatically)
   - `TZ`: `Asia/Kolkata`
   - `MONGODB_URI`: `<Your MongoDB Atlas Connection String>`
   - `ALLOWED_ORIGINS`: `https://<YOUR-FRONTEND-NAME>.vercel.app` (and custom domain if available)
   - `JWT_ACCESS_SECRET`: `<Generated 32+ character random string>`
   - `MFA_ENCRYPTION_KEY`: `<Generated 64-character hex string>`
   - `INITIAL_ORGANISATION_ID`: `ZAMORIN`
   - `INITIAL_MASTER_EMAIL`: `admin@zamorincafe.com`
   - `INITIAL_MASTER_PASSWORD`: `<Strong initial password>`
   - `PRIVATE_STORAGE_DRIVER`: `local` (or `cloudinary`)
4. Click **Apply / Create Web Service**.
5. Once deployed, note your Render backend URL: `https://zamorin-cafe-erp-backend.onrender.com`.

#### 3. Frontend SPA Deployment on Vercel
1. Log in to **[Vercel](https://vercel.com/new)** and import your GitHub repository.
2. Configure Project Settings:
   - **Framework Preset**: `Other`
   - **Root Directory**: `frontend` (or select `./` since root `vercel.json` is provided)
   - **Build Command**: Leave empty or enter `echo "zero-build"`
   - **Output Directory**: `.`
3. In `frontend/vercel.json`, ensure the proxy destination matches your active Render service URL:
   ```json
   { "source": "/api/(.*)", "destination": "https://zamorin-cafe-erp-backend.onrender.com/api/$1" }
   ```
4. Click **Deploy**.
5. Vercel automatically deploys the frontend with global CDN edge caching, SSL, and instant SPA rewrites.

#### 4. GitHub Actions CI/CD Integration
- Every commit or PR pushed to `main` or `master` automatically runs `.github/workflows/ci.yml` and `.github/workflows/deploy-check.yml`.
- Workflows validate JavaScript syntax, execute regression tests, check router imports, and audit all 28 enterprise modules.

---

## 4. Post-Deployment Verification Checklist

1. **Verify Health Endpoints**:
   ```bash
   curl -i https://app.zamorincafe.com/api/v1/health
   # Expected: {"success":true,"status":"ok","service":"zamorin-cafe-erp-api"}

   curl -i https://app.zamorincafe.com/api/v1/readiness
   # Expected: {"success":true,"status":"ready","database":"connected"}
   ```

2. **First Master Admin Login**:
   - Open browser at `https://app.zamorincafe.com/#login`.
   - Enter your `INITIAL_ORGANISATION_ID`, `INITIAL_MASTER_EMAIL`, and `INITIAL_MASTER_PASSWORD`.
   - Confirm immediate landing at **Command Centre Dashboard**.

3. **Verify App Updates & Invariant Check**:
   - Navigate to **Settings $\rightarrow$ Application Updates** (`#settings/updates`).
   - Click **"Check for Updates (Refresh)"** and verify server synchronization.
   - Click **"Verify Invariants"** to confirm that Core Engine, POS Till, Security Hub, Attendance Sync, and Governance layers are 100% cryptographically sealed.

---

## 5. Security & Maintenance Best Practices

- **Database Backups**: Enable automated point-in-time recovery (PITR) and daily snapshots in MongoDB Atlas.
- **Log Management**: Application access and error logs stream structured JSON with correlation IDs (`req.correlationId`).
- **Secret Rotation**: Use Settings $\rightarrow$ Security Hub to rotate API credentials, MFA keys, or passwords.
- **Fail-Closed Guarantee**: The production server strictly forbids direct dashboard bypass when `NODE_ENV === "production"`.
