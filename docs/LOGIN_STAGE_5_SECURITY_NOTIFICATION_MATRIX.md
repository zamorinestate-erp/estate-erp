# ZAMORIN CAFÉ ERP
## LOGIN STAGE 5 — SECURITY NOTIFICATION MATRIX

---

| Security Event | Notification Recipient | Primary Delivery Channel | Redacted / Excluded Values | Audit Correlation ID | Delivery Status Classification |
|---|---|---|---|---|---|
| **Password Reset Code** | Account Corporate Email | System Outbox / Email Provider | Password, raw reset token | `PRC-YYYYMMDD-XXXX` | `SANDBOX_DELIVERED` / `LOCAL_QUEUED` |
| **Password Reset Complete** | Account Corporate Email | System Outbox / In-app | Plaintext password, session tokens | `PRC-YYYYMMDD-XXXX` | `SANDBOX_DELIVERED` / `LOCAL_QUEUED` |
| **Password Changed** | Account Corporate Email | System Outbox / In-app | Old/new password hashes, secrets | `EVT-AUTH-PWD-CHG` | `SANDBOX_DELIVERED` / `LOCAL_QUEUED` |
| **MFA Enabled** | Account Corporate Email | System Outbox / In-app | Base32 TOTP secret, recovery codes | `EVT-AUTH-MFA-ENA` | `SANDBOX_DELIVERED` / `LOCAL_QUEUED` |
| **Recovery Codes Regenerated** | Account Corporate Email | System Outbox / In-app | Raw recovery code values | `EVT-AUTH-MFA-RGN` | `SANDBOX_DELIVERED` / `LOCAL_QUEUED` |
| **Recovery Code Used** | Account Corporate Email | System Outbox / In-app | Consumed recovery code | `EVT-AUTH-MFA-USE` | `SANDBOX_DELIVERED` / `LOCAL_QUEUED` |
| **Session Terminated** | Targeted User Email / In-App | In-App / System Outbox | Session cookies, JWT access tokens | `SS-YYYYMMDD-XXXX` | `LOCAL_QUEUED` |
| **New Device / Sign-In** | Account Corporate Email | In-App Notification | Device hardware secrets | `DEV-SIGNIN-EVT` | `LOCAL_QUEUED` |

---

### Delivery Classification Reference:
- **`LOCAL_QUEUED`**: Security event persisted in local `NotificationOutbox` / in-app notification database ready for dispatch.
- **`SANDBOX_DELIVERED`**: Dispatched to local console/mock test transport during automated test runs with 100% verified payloads.
- **`PRODUCTION_DELIVERY_PENDING`**: Operational production SMTP / SMS / Push gateways pending production deployment activation.
