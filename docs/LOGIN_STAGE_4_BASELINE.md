# Zamorin Café ERP — Login Integration Programme
# Stage 4 Baseline Freeze Report

## 1. Baseline Integrity

- **Branch**: `feature/login-integration`
- **Certified Stage-3 Base Commit**: `e2eff63b76156989c59cae57186a19b65abe33db`
- **Working Tree**: `CLEAN`
- **Personal Login File**: `frontend/src/js/pages/login.js`
- **Expected & Certified SHA-256**: `C4E2006502A8A39550587D5FB29DE2D296BF06DFCBF5755DCC7143064FA3C1A2`

---

## 2. Frozen Architectural Invariants

1. **Personal Login Zero-Diff**: `frontend/src/js/pages/login.js` remains 100% frozen; zero lines or characters modified.
2. **Canonical Authorization Engine**: `backend/src/middleware/authorize.js` and `canAccessCafe` remain authoritative; no parallel role guard.
3. **Single Device Authority**: `models/DeviceRegistration.js` represents canonical device registration; `CafeOpsDevice` manages physical store terminal binding.
4. **Single Session Authority**: `models/Session.js` represents personal user sessions; `CafeOpsSession` manages physical terminal operator sessions.
5. **Rate Limiter Storage**: Process-local in-memory implementation classified with `MULTI_INSTANCE_PRODUCTION_LIMITATION = YES`.
