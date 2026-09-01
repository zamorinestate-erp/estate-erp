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

### Option A: Render Cloud (Automated Blueprint)
The repository includes a production-ready `render.yaml` specification.

1. Connect your Git repository to **[Render.com](https://render.com)**.
2. Select **New Blueprint Instance** and choose your repository.
3. In the Render environment variable prompt, supply your production values:
   - `MONGODB_URI`: Your MongoDB Atlas cluster connection string.
   - `ALLOWED_ORIGINS`: Your frontend URL(s) (e.g., `https://app.zamorincafe.com`).
   - `JWT_ACCESS_SECRET`: 32+ character random string.
   - `MFA_ENCRYPTION_KEY`: 64-character hex string.
   - `INITIAL_MASTER_EMAIL`: Primary Master email address.
   - `INITIAL_MASTER_PASSWORD`: Strong password for the initial master admin.
4. Click **Apply Blueprint**.
5. Render will automatically build backend dependencies, seed the database idempotently, start the server, and monitor health at `/api/v1/health`.

---

### Option B: Docker & Docker Compose (Containerized Cluster)
The repository includes an auto-provisioning `docker-compose.yml` with a self-initializing MongoDB replica set (`rs0`).

1. Create a `.env` file in the root workspace or copy `backend/.env.production.example`:
   ```bash
   cp backend/.env.production.example .env
   ```
2. Fill in your secrets and domain in `.env`.
3. Build and launch the containerized stack:
   ```bash
   docker-compose up -d --build
   ```
4. Verify container health:
   ```bash
   docker ps
   curl http://localhost:4000/api/v1/health
   ```
   - Frontend is live at `http://localhost:3000` (or your mapped public port).
   - Backend API is live at `http://localhost:4000`.

---

### Option C: Linux VPS / Bare-Metal Server (PM2 + Nginx)

#### Step 1: Install Dependencies & Build
```bash
# Clone repository
git clone <your-repo-url> /var/www/zamorin-cafe-erp
cd /var/www/zamorin-cafe-erp

# Install production dependencies
cd backend
npm ci --only=production

# Configure production environment
cp .env.production.example .env
nano .env # Configure real secrets and MongoDB URI
```

#### Step 2: Start Backend with PM2 Process Manager
```bash
sudo npm install -g pm2
pm2 start src/scripts/startProd.js --name "zamorin-backend"
pm2 save
pm2 startup
```

#### Step 3: Configure Nginx Reverse Proxy
Copy the provided `nginx.conf` template to `/etc/nginx/sites-available/zamorin.conf`:
```nginx
server {
    listen 80;
    server_name app.zamorincafe.com;

    root /var/www/zamorin-cafe-erp/frontend;
    index index.html;

    # Static caching
    location ~* \.(?:css|js|svg|png|jpg|jpeg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # SPA routing
    location / {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and configure HTTPS with Let's Encrypt Certbot:
```bash
sudo ln -s /etc/nginx/sites-available/zamorin.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d app.zamorincafe.com
```

---

### Option D: Split Cloud (Vercel / Netlify Frontend + Cloud Backend)

1. **Backend**:
   - Deploy `backend/` directory to Render, Railway, or AWS App Runner.
   - Note the assigned backend URL (e.g. `https://zamorin-api.onrender.com`).
2. **Frontend**:
   - Deploy `frontend/` directory to Vercel or Netlify.
   - In your deployment settings, add environment variable:
     - `ZAMORIN_API_BASE_URL` = `https://zamorin-api.onrender.com/api/v1`
   - In your backend environment settings, set:
     - `ALLOWED_ORIGINS` = `https://your-frontend-app.vercel.app`

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
