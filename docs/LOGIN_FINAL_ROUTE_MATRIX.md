# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## FINAL ROUTE ACCOUNTING & SECURITY MANIFEST

---

### 1. Route Summary Accounting

```text
General Application Routes:      149
Terminal Authentication Routes:    3 (#login/terminal, #login/enroll, #login/lock)
TOTAL ROUTES:                    152
TESTED ROUTES:                   152
UNTESTED ROUTES:                   0
COVERAGE:                        100.0%
```

---

### 2. Authentication & Security Routes Manifest

| Route Path | Type | Access Level | Description & Handoff Rule | Verified In Suite |
|---|---|---|---|---|
| `#login` | Personal Auth | Public | Standard personal login for all 5 personas | `audit_login_stage5_browser_flows.mjs` |
| `#login/forgot` | Password Recovery | Public | 3-step password recovery flow (Request, Verify, Complete) | `audit_login_stage5_browser_flows.mjs` |
| `#login/mfa` | MFA Challenge | Authenticated Partial | TOTP & recovery code prompt | `audit_login_stage5_browser_flows.mjs` |
| `#login/terminal` | Terminal Auth | Device-Bound | POS Till Operator PIN sign-in & Master elevation | `audit_login_stage4_browser_lifecycle.mjs` |
| `#login/enroll` | Device Trust | Primary Master | New hardware registration via Crockford Base32 code | `audit_login_stage4_browser_lifecycle.mjs` |
| `#login/lock` | Terminal Lock | Active Operator | Occluded POS terminal lock screen with PIN unlock | `audit_login_stage4_browser_lifecycle.mjs` |
| `#dashboard` | Persona Landing | Master / Owner / Cafe | Management Command Centre | `audit_all_five_personas.mjs` |
| `#pos` | Persona Landing | Cafe Operations | Full-screen interactive POS terminal | `audit_all_five_personas.mjs` |
| `#staff-home` | Persona Landing | Staff | Employee self-service, leave, payslip portal | `audit_all_five_personas.mjs` |
| `#settings/security`| Security Ops | Authenticated | Password change, MFA toggle, recovery codes, devices, sessions | `audit_login_stage5_identity_recovery.mjs` |
