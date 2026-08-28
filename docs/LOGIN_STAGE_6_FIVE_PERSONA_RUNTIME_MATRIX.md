# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## STAGE 6 — FIVE-PERSONA RUNTIME AUTHORIZATION & HANDOFF MATRIX

---

| Dimension | 1. Primary Master | 2. Normal Master | 3. Executive Owner | 4. Cafe Operations (Admin) | 5. Staff Member |
|---|---|---|---|---|---|
| **Role Identifier** | `master` (`isPrimary: true`) | `master` (`isPrimary: false`) | `owner` | `cafe_admin` | `staff` |
| **Personal Login** | Password + TOTP MFA | Password + TOTP MFA | Password + TOTP MFA | Password + TOTP MFA / Device | Password (15+ chars) |
| **MFA Requirement** | **MANDATORY** | **MANDATORY** | **MANDATORY** | **MANDATORY** | Optional Self-Service |
| **Canonical Landing** | `#dashboard` | `#dashboard` | `#dashboard` | `#pos` / `#dashboard` | `#staff-home` |
| **Route Scope** | All 24 Management Routes | 21 Management Routes | 12 Executive Routes | 15 Cafe Operations Routes | 5 Self-Service Routes |
| **Deep Link Restoration** | Restores authorized target | Restores authorized target | Restores authorized target | Restores authorized target | Restores authorized target |
| **Unauthorized Deep Link** | Replaces with `#dashboard` | Replaces with `#dashboard` | Replaces with `#dashboard` | Replaces with `#pos` | Replaces with `#staff-home` |
| **Denied Examples** | N/A (Full authority) | `#ledger`, `#universal-payroll` | `#admin/rbac`, `#system/config` | `#ledger`, `#payroll`, `#admin` | All 24 Management Routes |
| **Terminal Eligibility** | Master Elevation | Master Elevation | Master Elevation | Cafe Operator PIN | Strictly Prohibited |
| **Recovery Options** | Recovery Code / Offline Admin | Recovery Code / Primary Master | Recovery Code / Primary Master | Recovery Code / Master Reset | Self-Service Email Reset |
| **Session Control** | Full Remote Session Revoke | Personal Session Revoke | Personal Session Revoke | Cafe Device Session Revoke | Personal Session Revoke |
| **Logout Behavior** | Purges cache -> `#login` | Purges cache -> `#login` | Purges cache -> `#login` | Purges cache -> `#login` | Purges cache -> `#login` |
| **Runtime Result** | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** |
