# ZAMORIN CAFÉ ERP — LOGIN MODULE INTEGRATION (STAGE 1)
# CLAUDE INTEGRATION PROMPT REQUIREMENTS ANALYSIS

**Analysis Date:** 2026-08-28  
**Source Document:** [`files/Login/ANTIGRAVITY_INTEGRATION_PROMPT.md`](file:///d:/Zamorin_Cafe_ERP_Build/files/Login/ANTIGRAVITY_INTEGRATION_PROMPT.md)  
**Target Branch:** `feature/login-integration`  

---

## 1. Executive Analysis & Core Premise

The `ANTIGRAVITY_INTEGRATION_PROMPT.md` document is an explicit set of constraints and instructions designed to govern the integration of the **Cafe Operations Shared Terminal / Trusted Device Operator Session Module**.

Crucially, **the prompt strictly orders that the existing Zamorin personal login page must not change by a single character of code, style, or behavior.**

---

## 2. Exhaustive Requirements Classification Matrix

| Req # | Specific Clause / Requirement from Claude Prompt | Classification | Zamorin Context & Rationale |
|:-----:|:-------------------------------------------------|:--------------:|:----------------------------|
| **R01** | Section 0: "THE EXISTING PERSONAL LOGIN PAGE MUST NOT CHANGE. Not its code. Not its styling. Not its behaviour. Not a single line." | `COMPATIBLE_WITH_ZAMORIN` | Protects certified personal login flow (`src/js/pages/login.js`). Perfectly aligned with baseline security. |
| **R02** | Section 1: "The module gives two ways to access a cafe-owned shared device: CAFE_ADMIN (6-digit PIN) and Master (password + MFA)." | `ALREADY_IMPLEMENTED_IN_ZAMORIN` | Zamorin already possesses `operatorSessionRoutes.js` (`/signin`, `/signin-master`) and `cafeOperatorSignIn.js` adhering to this exact model. |
| **R03** | Section 1: "Both paths share one session engine underneath... fixed to the device's cafe." | `COMPATIBLE_WITH_ZAMORIN` | Zamorin's `OperatorSession` model and `deviceContext` middleware bind sessions strictly to the trusted device's `cafeId`. |
| **R04** | Section 3: "Audit before you integrate... do not implement before the audit is complete." | `COMPATIBLE_WITH_ZAMORIN` | Governs the current Stage 1 discovery and audit phase. |
| **R05** | Section 4: "Audit real repository for Employee/User model, Cafe model, and session middleware." | `ALREADY_IMPLEMENTED_IN_ZAMORIN` | Identified: `User.js` (`User`), `Cafe.js` (`Cafe`), `authenticate.js`, `deviceContext.js`. |
| **R06** | Section 4: "Response envelopes must be `{ success, data }` / `{ success: false, error: { code, message } }`." | `ALREADY_IMPLEMENTED_IN_ZAMORIN` | Standard Zamorin envelope matches this specification across all endpoints. |
| **R07** | Section 5: "Extract code into new locations (e.g. `backend/src/cafe-operations/` and `frontend/cafe-operations/`); touch zero existing files." | `COMPATIBLE_WITH_ADAPTATION` | In Zamorin, routes and services are cleanly organized under `backend/src/routes/` and `backend/src/services/`. Modules can be placed in additive directories. |
| **R08** | Section 6 (Seam 1): "Set `EMPLOYEE_MODEL_NAME = 'User'` and `CAFE_MODEL_NAME = 'Cafe'` in `integrationRefs.js`." | `COMPATIBLE_WITH_ADAPTATION` | Zamorin stores employees in the unified `User` collection and cafes in `Cafe`. |
| **R09** | Section 6 (Seam 2): "Wire `masterAuthAdapter.js` to real Master password/MFA system. Do NOT build a second password/MFA implementation." | `SECURITY_REVIEW_REQUIRED` | Master authentication must call Zamorin's canonical `authService.authenticatePassword()` and `mfaService.verifyTotpCode()`. |
| **R10** | Section 6 (Seam 3): "Mount admin routes behind real RBAC guard (`requireGovernanceRole.js` -> `authorize('USER:MANAGE')`)." | `COMPATIBLE_WITH_ADAPTATION` | Zamorin's canonical `authorize.js` middleware will be used directly. |
| **R11** | Section 7: "Deploy `cafe-operations.html` as a separate entry point (Option B) using real `components.css`." | `UI_ONLY` | Additive separate entry point or router view ensures zero collision with the main application shell. |
| **R12** | Section 7: "`cafe-operations.css` must only ever be additive with `.cafeops-*` prefix; never redeclare `:root`." | `COMPATIBLE_WITH_ZAMORIN` | Eliminates CSS token collisions and preserves four-theme architecture. |
| **R13** | Section 8: "64/64 backend tests passing. Fix integration, not tests." | `COMPATIBLE_WITH_ZAMORIN` | Ensures complete test integrity and strict regression bounds. |
| **R14** | Section 9: "Regression-verify personal login page is byte-for-byte unchanged via `git diff`." | `COMPATIBLE_WITH_ZAMORIN` | Mandatory regression safeguard for personal authentication. |
| **R15** | Section 10: "Files that must NEVER be modified: personal login HTML/JS/CSS, User model, Cafe model, RBAC middleware." | `COMPATIBLE_WITH_ZAMORIN` | Protects certified codebase invariants. |
| **R16** | Section 11: "Do not add new dependencies beyond `express`, `mongoose`, `bcryptjs`." | `COMPATIBLE_WITH_ZAMORIN` | Zamorin already includes these dependencies in `backend/package.json`. |
| **R17** | Section 11: "Do not rename canonical roles (`MASTER`, `OWNER`, `CAFE_ADMIN`, `STAFF`)." | `COMPATIBLE_WITH_ZAMORIN` | Invariant matches Zamorin's 5-persona RBAC system. |
| **R18** | Section 11: "Do not implement offline sign-in; fail closed when connection is unavailable." | `COMPATIBLE_WITH_ZAMORIN` | Both systems enforce server-authoritative authentication. |
| **R19** | Section 11: "Do not add global Master PIN or shared cafe password." | `COMPATIBLE_WITH_ZAMORIN` | Master uses password + MFA only; Operator uses personal PIN only. |
| **R20** | Section 14: "Zero unrelated changes; audit before you integrate." | `COMPATIBLE_WITH_ZAMORIN` | Standard engineering protocol. |

---

## 3. Summary of Analysis

- **Total Requirements Extracted:** 20 core requirements.
- **`COMPATIBLE_WITH_ZAMORIN`:** 13
- **`ALREADY_IMPLEMENTED_IN_ZAMORIN`:** 3
- **`COMPATIBLE_WITH_ADAPTATION`:** 3
- **`SECURITY_REVIEW_REQUIRED`:** 1 (Master Auth Adapter Seam)
- **`CONFLICTS_WITH_ZAMORIN`:** 0 (Because Claude's prompt mandates 100% preservation of Zamorin's personal login and authoritative backend).
- **`UI_ONLY`:** 1

### Key Takeaway
The Claude integration prompt is remarkably disciplined: it was explicitly designed to prevent tampering with personal login (`login.js`), forbids hardcoded credentials or bypasses, and mandates binding to the real backend rather than introducing parallel auth stores.
