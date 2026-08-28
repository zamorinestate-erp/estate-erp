# ZAMORIN CAFÉ ERP
## LOGIN STAGE 5 — PERSONA AUTHENTICATION & SECURITY CONTROLS MATRIX

---

| Feature / Dimension | Primary Master | Normal Master | Owner | Café Operations | Staff Member |
|---|---|---|---|---|---|
| **Primary Credential** | Email + Password | Email + Password | Email + Password | Email + Password (Personal) / PIN (Terminal) | Employee ID / Email + Password (Personal) / PIN (Terminal) |
| **MFA Requirement** | MANDATORY (TOTP) | MANDATORY (TOTP) | MANDATORY (TOTP) | MANDATORY for Admin / Conditional | Optional |
| **Terminal Eligibility** | Elevation on any active enrolled device | Elevation on any active enrolled device | Not eligible for terminal PIN | Operator / Master sign-in on assigned café terminal | Operator sign-in with Operator Access grant |
| **Session Lifetime** | 15m idle / 12h absolute | 15m idle / 12h absolute | 30m idle / 12h absolute | 5m terminal idle / 12h absolute | 15m idle / 12h absolute |
| **Recovery Methods** | Canonical Email Reset + Recovery Codes | Canonical Email Reset + Recovery Codes | Canonical Email Reset + Recovery Codes | Canonical Email Reset + Recovery Codes / Governed Admin PIN Reset | Canonical Email Reset / Governed Admin PIN Reset |
| **Settings Access** | Full System & Security Settings | Standard Security Settings | Financial & Profile Settings | Café & Device Settings | Personal Profile & Payslips only |
| **Session Management** | Can revoke all user sessions & manage devices | Can manage personal sessions & assigned devices | Can manage personal sessions | Can view assigned terminal sessions | Can view personal active sessions only |
