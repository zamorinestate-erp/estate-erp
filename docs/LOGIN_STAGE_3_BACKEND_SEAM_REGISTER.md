# Zamorin Café ERP — Login Integration Stage 2
# Stage 3 Backend Seam Register

## 1. Overview
Stage 2 places the frontend screens with strictly defined, stubbed integration seams. This register catalogs every bridge point to be connected during Stage 3 (Backend Integration).

---

## 2. Seam Inventory

| Seam ID | Component / File | Function / Callback | Stage-2 Stub | Stage-3 Implementation Target |
|---|---|---|---|---|
| **S3-1** | `frontend/src/js/router.js` (`case "cafe-master-signin"`) | `onSignIn` | `undefined` | POST `/api/v1/cafe-ops/operator/master-signin/credentials` (wraps `authService.authenticatePassword`) |
| **S3-2** | `frontend/src/js/router.js` (`case "cafe-master-signin"`) | `onMfaVerify` | `undefined` | POST `/api/v1/cafe-ops/operator/master-signin/mfa` (wraps `mfaService.verifyTotpCode`) |
| **S3-3** | `frontend/src/js/router.js` (`case "cafe-device-enroll"`) | `onEnroll` | `undefined` | POST `/api/v1/cafe-ops/devices/enroll` (wraps `deviceService.enrollDevice`) |
| **S3-4** | `backend/src/cafe-operations/config/integrationRefs.js` | `EMPLOYEE_MODEL_NAME` | `'Employee'` | Map to `'User'` (Mongoose model in `backend/src/models/User.js`) |
| **S3-5** | `backend/src/cafe-operations/config/integrationRefs.js` | `CAFE_MODEL_NAME` | `'Cafe'` | Map to `'Cafe'` (Mongoose model in `backend/src/models/Cafe.js`) |
| **S3-6** | `backend/src/cafe-operations/middleware/requireGovernanceRole.js` | `resolveCallerFromRequest` | Placeholder | Read authenticated caller from `req.auth` or `req.authenticatedUser` |
