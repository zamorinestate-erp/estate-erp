# ZAMORIN CAFÉ ERP — LOGIN MODULE INTEGRATION (STAGE 1)
# CONFLICT & DEFECT REGISTER

**Audit Date:** 2026-08-28  
**Scope:** Stage 1 Discovery & Seam Analysis  

---

## 1. Severity Definitions

- **P0 (Critical):** Critical authentication bypass, credential disclosure, or breaking changes to existing personal login.
- **P1 (High):** Session, RBAC, device-trust, or multi-tenant scope incompatibility.
- **P2 (Medium):** UX, responsive reflow, performance, or theme token adaptation.
- **P3 (Low):** Minor styling, reference artifacts, or documentation gap.

---

## 2. Comprehensive Conflict & Seam Resolution Register

| ID | Source File | Requirement | Identified Conflict / Gap | Severity | Existing Zamorin Architecture | Recommended Resolution | Future Stage |
|:--:|:------------|:------------|:--------------------------|:--------:|:------------------------------|:-----------------------|:------------:|
| **CONF-01** | `frontend/css/components.base.css` | Use Zamorin design tokens | Duplicate bundled CSS file contains full `components.css` copy. | **P2** | Canonical single `frontend/src/styles/components.css` already exists. | Delete `components.base.css` during integration and point `cafe-operations.html` `<link>` to real `components.css`. | **Stage 2** |
| **CONF-02** | `backend/src/services/masterAuthAdapter.js` | Master Strong Auth on Terminal | Bundled file contains demo bcrypt accounts and static MFA. | **P1** | Zamorin has canonical `authService.authenticatePassword()` and `mfaService.verifyTotpCode()`. | Wire `masterAuthAdapter.js` (`identify`, `completeMfa`, `reauth`) directly to Zamorin's canonical `authService` & `mfaService`. | **Stage 3** |
| **CONF-03** | `backend/src/config/integrationRefs.js` | Mongoose Model Registration | Assumes external model names `Employee` and `Cafe`. | **P1** | Zamorin's unified user collection is named `User` (`mongoose.model('User')`), and cafe is `Cafe`. | Set `EMPLOYEE_MODEL_NAME = 'User'` and `CAFE_MODEL_NAME = 'Cafe'` in `integrationRefs.js`. | **Stage 3** |
| **CONF-04** | `backend/src/middleware/requireGovernanceRole.js` | Role Guard for Admin Endpoints | Placeholder role guard in bundled module. | **P1** | Zamorin has canonical `backend/src/middleware/authorize.js` (`authorize('USER:MANAGE')`). | Replace or mount admin routes behind Zamorin's canonical `authorize.js` middleware. | **Stage 3** |
| **CONF-05** | `frontend/js/api/cafeOpsApi.js` | API Transport & Origin Base | Standalone client expects relative `/api/cafe-ops` without global configuration. | **P2** | Zamorin client uses `apiClient.js` with `window.ZAMORIN_API_BASE_URL` or relative origin. | Ensure `cafeOpsApi.js` respects `window.ZAMORIN_API_BASE_URL` and standard `{ success, data, error }` error unwrapping. | **Stage 2** |
| **CONF-06** | `frontend/src/js/pages/login.js` | Personal Login Protection | Potential accidental editing during login module integration. | **P0** | Fully certified 3-screen recovery & login page (`src/js/pages/login.js`). | Strictly enforce byte-for-byte zero diff on `login.js` across all future stages. | **All Stages** |

---

## 3. Register Summary

- **Total Conflicts / Seams Logged:** 6 items.
- **P0:** 1 (Personal Login Protection Guard)
- **P1:** 3 (Master Auth Adapter Seam, Model Name Reference Seam, Admin RBAC Seam)
- **P2:** 2 (Duplicate Stylesheet Cleanup, API Base URL Binding)
- **P3:** 0
- **Zero Insoluble Architectural Blockers Identified.** All 6 items have clean, deterministic resolutions mapped to Stages 2–6.
