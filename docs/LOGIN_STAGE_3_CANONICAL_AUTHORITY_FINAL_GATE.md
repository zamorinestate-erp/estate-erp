# Zamorin Café ERP — Login Integration Programme
# Stage 3 Canonical Authority & Security Hardening Final Gate

## 1. Executive Authority Answers

| Authority Domain | Authoritative Answer | Implementation Details |
|---|---|---|
| **Canonical Authorization Engine** | `backend/src/middleware/authorize.js` | `requireGovernanceRole` wraps and delegates directly to canonical role and `canAccessCafe` rules. No parallel role logic. |
| **Canonical Device Trust Authority** | `backend/src/models/DeviceRegistration.js` | Canonical device trust model. Authoritative for general web/personal device verification. |
| **CafeOpsDevice Purpose** | Hardware Terminal Binding Entity | Represents dedicated store POS / terminal instances (`effectiveCafeId = device.cafeId`, token hash at rest, lifecycle states). Subordinate to and cross-referenced with `DeviceRegistration`. |
| **Canonical Human Session** | `backend/src/models/Session.js` | Issues personal user access/refresh tokens. Unchanged and non-bypassable. |
| **OperatorSession Purpose** | Legacy Till Register Session | Retained for backward-compatible till transactions without elevation authority. |
| **CafeOpsSession Purpose** | Unified Cafe Operations Terminal Session | Manages active physical terminal operator lifecycle (`sessionType: OPERATOR_PIN | MASTER_ACCOUNT`, shift expiry, inactivity locking, store-scoped actions). |
| **Active Operator Source of Truth** | `CafeOpsSession` (on Terminal) | At any cafe hardware register, `CafeOpsSession` uniquely answers who the active attributed operator/master is. |
| **Effective Cafe Source of Truth** | `req.cafeOpsDevice.cafeId` | Authoritative store binding. Client-submitted `cafeId` in headers/body/query is discarded. |
| **Master MFA Assurance** | `mfaService.verifyTotpCode` on `User.mfaSecret` | Terminal Master login enforces identical or higher MFA requirements as web login. Zero elevation before TOTP challenge is completed. |
| **Rate Limit Storage** | In-Memory (Dev) / Redis-Ready Architecture | `MULTI_INSTANCE_PRODUCTION_LIMITATION = YES` (process-local for single node; documented for Redis adapter in multi-instance clusters). |
| **Production Mount Verified** | `/api/v1/cafe-ops` | Verified through `backend/src/server.js` and `backend/src/routes/index.js`. |

---

## 2. Complete Gate Certification

- [x] **Canonical Authorization Preserved**: YES
- [x] **Single Device Trust Authority**: YES
- [x] **Session Responsibilities Non-Conflicting**: YES
- [x] **Master MFA Cannot Be Bypassed**: YES
- [x] **Operator PIN Security**: PASS (Cost 12 Bcrypt + Peppered HMAC, uniform latency, brute-force rate limit)
- [x] **Cafe Binding**: PASS (Strictly server-derived)
- [x] **Security Tests Trustworthy**: YES (Tested via positive and negative controls)
- [x] **P0 Defects**: **0**
- [x] **P1 Defects**: **0**
- [x] **Login Stage 3 Certified**: **YES**
- [x] **Ready for Login Stage 4**: **YES**
