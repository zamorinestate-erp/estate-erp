# ZAMORIN CAFE ERP — SETTINGS CAPABILITY MATRIX

This document records the exact capability, access boundary, and operational readiness for all 17 Settings destinations across the 4 canonical management profiles (Primary Master, Normal Master, Owner, and Cafe Operations).

---

## Settings Matrix

| # | Setting | Primary Master | Normal Master | Owner | Cafe Operations | Canonical Route | Backend / API Endpoint | Editable / Read-Only | Audit Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Profile & Identity** | PASS | PASS | PASS | PASS | `#settings/profile` | `GET /api/v1/settings/profile`<br>`PATCH /api/v1/settings/profile`<br>`POST /api/v1/settings/profile/change-request` | Editable (Preferred name, personal email/mobile) + Governed approval for legal name | **PASS** |
| 2 | **My Employment** | PASS | PASS | PASS | PASS | `#settings/employment` | `GET /api/v1/settings/profile`<br>`GET /api/v1/staff/payslips`<br>`GET /api/v1/staff/loans-advances` | Read-Only (Official HR/designation summary & payslips; self-service advance request) | **PASS** |
| 3 | **My Access & Permissions** | PASS | PASS | PASS | PASS | `#settings/access` | `POST /api/v1/settings/access/request` | Read-Only scope display + Governed access request submission | **PASS** |
| 4 | **Delegation & Coverage** | PASS | PASS | PASS | PASS | `#settings/delegation` | `GET /api/v1/settings/delegations`<br>`POST /api/v1/settings/delegations`<br>`DELETE /api/v1/settings/delegations/:id` | Editable (Create out-of-office delegations, revoke active delegations) | **PASS** |
| 5 | **Security & Sign-In** | PASS | PASS | PASS | PASS | `#settings/security` | `POST /api/v1/auth/change-password`<br>`POST /api/v1/auth/mfa/setup` | Editable (Password rotation, TOTP MFA configuration, backup codes) | **PASS** |
| 6 | **Devices & Sessions** | PASS | PASS | PASS | PASS | `#settings/devices` | `GET /api/v1/auth/sessions`<br>`DELETE /api/v1/auth/sessions/:id` | Editable (Inspect active authenticated sessions, terminate remote sessions, clear cache) | **PASS** |
| 7 | **Account Recovery** | PASS | PASS | PASS | PASS | `#settings/recovery` | `POST /api/v1/auth/lost-device-revoke`<br>`POST /api/v1/auth/secure-account` | Actionable (Emergency lost device workflows, instant session revocation) | **PASS** |
| 8 | **Notifications** | PASS | PASS | PASS | PASS | `#settings/notifications` | `GET /api/v1/settings/preferences/notifications`<br>`PATCH /api/v1/settings/preferences/notifications` | Editable (Matrix per category & channel; policy-required alerts locked) | **PASS** |
| 9 | **Language & Region** | PASS | PASS | PASS | PASS | `#settings/language` | `PATCH /api/v1/settings/preferences/language`<br>`GET /api/v1/settings/locales` | Editable (23 Indian Eighth Schedule languages supported; default INR currency locked) | **PASS** |
| 10 | **Appearance** | PASS | PASS | PASS | PASS | `#settings/appearance` | Local storage persistence + Client theme engine | Editable (Paper, Pearl, Midnight, Noir themes, font sizing, density) | **PASS** |
| 11 | **Accessibility** | PASS | PASS | PASS | PASS | `#settings/accessibility` | `PATCH /api/v1/settings/preferences/accessibility` | Editable (WCAG 2.2 contrast, focus rings, reduced motion, link underlines) | **PASS** |
| 12 | **Navigation & Workspace** | PASS | PASS | PASS | PASS | `#settings/workspace` | `PATCH /api/v1/settings/preferences/workspace` | Editable (Default landing route, table page size, report export formats) | **PASS** |
| 13 | **Privacy & Data** | PASS | PASS | PASS | PASS | `#settings/privacy` | `POST /api/v1/settings/privacy/request` | Read-Only DPDP summary + Governed privacy data request submission | **PASS** |
| 14 | **Connected Apps** | PASS | PASS | PASS | PASS | `#settings/connected` | `GET /api/v1/settings/integrations/user` | Read-Only (User machine identity & service status; enterprise tokens shielded) | **PASS** |
| 15 | **Help & Diagnostics** | PASS | PASS | PASS | PASS | `#settings/help` | `GET /api/v1/settings/diagnostics` | Read-Only (Safe diagnostic summary copy; no tokens, keys, or secrets leaked) | **PASS** |
| 16 | **Data Management & Recovery** | PASS | PASS | N/A — POLICY | N/A — POLICY | `#settings/trash` (or `#trash`) | `GET /api/v1/trash/items`<br>`POST /api/v1/trash/restore`<br>`POST /api/v1/trash/purge` | Master Governance Only (Restore catalogue items, vendors, soft-deleted entities) | **PASS** |
| 17 | **Global System Administration** | PASS | PASS | N/A — POLICY | N/A — POLICY | `#settings/admin` (or `#admin`) | `GET /api/v1/admin/overview`<br>`GET /api/v1/admin/roles`<br>`GET /api/v1/audit/logs` | Master Governance Only (Central organisation defaults, role governance, audit logs) | **PASS** |

---

## Architectural Verification Summary

1. **Routing Architecture**:
   - Single unified destination registry `SETTINGS_DESTINATIONS` in `frontend/src/js/pages/settingsShared.js`.
   - Deterministic subrouting `#settings/<section>` handled through `frontend/src/js/router.js` and `frontend/src/js/navigation.js`.
   - Browser History (Back / Forward), Page Reload (F5), and Direct Deep Linking preserve the active subpage with 0 shell takeover.

2. **Security & Scope Governance**:
   - Master Governance destinations (`Data Management & Recovery`, `Global System Administration`) are strictly filtered from the Hub for Owner and Cafe Operations profiles and fail-closed with `__blocked__` / `renderNotAvailable()` if accessed via direct URL tampering.
   - All Personal Settings (1 to 15) remain strictly personal and self-service without requiring or assuming organisation-wide cafe portfolio access.
