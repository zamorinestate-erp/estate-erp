# ZAMORIN CAFÉ ERP
## LOGIN STAGE 5 — SECURITY NOTIFICATION MATRIX

---

| Security Event | Notification Recipient | Primary Delivery Channel | Redacted / Excluded Values | Audit Correlation ID | Environment Status |
|---|---|---|---|---|---|
| **Password Reset Code** | Account Corporate Email | System Outbox / Console Provider | Password, raw reset token | `PRC-YYYYMMDD-XXXX` | LOCAL_VERIFIED |
| **Password Reset Complete** | Account Corporate Email | System Outbox / In-app | Plaintext password, session tokens | `PRC-YYYYMMDD-XXXX` | LOCAL_VERIFIED |
| **Password Changed** | Account Corporate Email | System Outbox / In-app | Old/new password hashes, secrets | `EVT-AUTH-PWD-CHG` | LOCAL_VERIFIED |
| **MFA Enabled** | Account Corporate Email | System Outbox / In-app | Base32 TOTP secret, recovery codes | `EVT-AUTH-MFA-ENA` | LOCAL_VERIFIED |
| **Recovery Codes Regenerated** | Account Corporate Email | System Outbox / In-app | Recovery code values | `EVT-AUTH-MFA-RGN` | LOCAL_VERIFIED |
| **Recovery Code Used** | Account Corporate Email | System Outbox / In-app | Consumed recovery code | `EVT-AUTH-MFA-USE` | LOCAL_VERIFIED |
| **Session Terminated** | Targeted User Email / In-App | In-App / System Outbox | Session cookies, JWT access tokens | `SS-YYYYMMDD-XXXX` | LOCAL_VERIFIED |
| **New Device / Sign-In** | Account Corporate Email | In-App Notification | Device hardware secrets | `DEV-SIGNIN-EVT` | LOCAL_VERIFIED |
