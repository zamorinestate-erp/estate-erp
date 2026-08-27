# ZAMORIN CAFÉ ERP — LOGIN MODULE INTEGRATION (STAGE 1)
# FEATURE COMPATIBILITY & CAPABILITY MATRIX

**Audit Date:** 2026-08-28  
**Scope:** Personal Login vs Cafe Operations Trusted Terminal Module  

---

## 1. Feature-by-Feature Compatibility Matrix

| Feature Discovered | Current Zamorin Equivalent | Compatibility | Security Impact | UI Impact | Backend Impact | Decision | Technical Rationale |
|--------------------|----------------------------|:-------------:|:---------------:|:---------:|:--------------:|:--------:|---------------------|
| **Personal Email/Password Login** | `login.js` & `authController.login` | `COMPATIBLE_WITH_ZAMORIN` | **Critical P0** | None (Protected) | None | **RETAIN UNCHANGED** | Certified personal login must remain untouched per Section 0 constraint. |
| **Personal Password Reset Flow** | 3-Screen flow in `login.js` | `COMPATIBLE_WITH_ZAMORIN` | High | None | None | **RETAIN UNCHANGED** | Canonical 3-screen recovery flow is fully certified and tested. |
| **Personal MFA (TOTP)** | `authController.mfaVerify` | `COMPATIBLE_WITH_ZAMORIN` | **Critical P0** | None | None | **RETAIN UNCHANGED** | Silent/explicit TOTP authentication for Master and Owner accounts. |
| **Public Self-Registration** | None (Intentionally absent) | `CONFLICTS_WITH_ZAMORIN` | High Risk | None | None | **REJECT / OMIT** | Zamorin is an enterprise ERP with strictly governed identities. No public sign-up permitted. |
| **Social / Third-Party OAuth** | None (Intentionally absent) | `NOT_APPLICABLE` | High Risk | None | None | **REJECT / OMIT** | Internal enterprise identities only; zero external OAuth SDKs. |
| **Cafe Operator 6-Digit PIN** | `cafeOperatorSignIn.js` & `operatorSessionRoutes.js` | `COMPATIBLE_WITH_ADAPTATION` | High | Additive PIN pad screen | Additive PIN verification | **ADAPT / INTEGRATE** | Dedicated shared hardware terminal sign-in for `CAFE_ADMIN` operators. |
| **Master Sign-In on Terminal** | `/operator/signin-master` | `COMPATIBLE_WITH_ADAPTATION` | **Critical P0** | Additive Master screen | Calls `authService` | **ADAPT / INTEGRATE** | Strong credential sign-in on terminal, bound strictly to device's `cafeId`. |
| **Device Enrollment (15m Code)** | `deviceRoutes.js` | `COMPATIBLE_WITH_ADAPTATION` | High | Additive enrollment screen | Additive enrollment routes | **ADAPT / INTEGRATE** | Crockford base32 one-time 15-minute token enrollment. |
| **Hardware Inactivity Lock** | `sessionPolicyClient.js` | `COMPATIBLE_WITH_ZAMORIN` | Medium | Pre-lock warning & lock overlay | Lazy lock evaluation | **REUSE AS-IS** | Automatically locks shared terminal after 5 minutes of inactivity. |
| **Operator Switch (Both Ways)** | `/operator/switch` | `COMPATIBLE_WITH_ZAMORIN` | Medium | Switch operator button & modal | Session termination & rotation | **REUSE AS-IS** | Clean session termination and fresh sign-in without privilege elevation. |
| **Remote Session Termination** | `/admin/sessions/terminate` | `COMPATIBLE_WITH_ZAMORIN` | High | Governance view | Revokes session immediately | **ADAPT / INTEGRATE** | Allows governance roles to force-kill compromised terminal sessions. |
| **Cafe Reassignment** | `/admin/devices/reassign-cafe` | `COMPATIBLE_WITH_ZAMORIN` | High | Governance view | Ends sessions & rebinds cafe | **ADAPT / INTEGRATE** | Governed action transferring physical device to new cafe branch. |
| **Four-Theme Support** | `zamorin.css` (Paper, Pearl, Midnight, Noir) | `COMPATIBLE_WITH_ZAMORIN` | None | Reuses theme tokens | None | **REUSE AS-IS** | Terminal styles reference `var(--ink)`, `var(--bg-surface)`, etc. |
| **Zero-Dead-Controls Compliance** | Zero dead button standards | `COMPATIBLE_WITH_ZAMORIN` | Low | Deterministic toast feedback | Real mutation handlers | **ENFORCE STRICTLY** | All buttons, links, and forms on terminal must bind to real actions. |

---

## 2. Capability Architecture Summary

- **Personal Login Flow:** Dedicated personal credentials for Master, Owner, Staff, and Admin on personal workstations and mobile browsers.
- **Cafe Operations Terminal Flow:** Dedicated shared hardware terminal workflow (Attendance Kiosk -> Operator PIN Sign-In / Master Sign-In -> Operational Shell).
- **Security Invariant:** Zero role elevation, zero token leakage, 100% server-authoritative RBAC.
