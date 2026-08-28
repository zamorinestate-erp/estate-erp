# ZAMORIN CAFÉ ERP
## LOGIN STAGE 5 — RECOVERY FLOW & TOKEN LIFECYCLE MATRIX

---

| Flow Stage | Entry Method | Credential / Token Type | Storage Format | Expiry (TTL) | Max Attempts | Concurrency Policy | Session Consequence | Audit Event Type |
|---|---|---|---|---|---|---|---|---|
| **1. Forgot Request** | POST `/api/v1/auth/password/forgot` | 6-Digit Numeric Code | HMAC-SHA256 Digest | 10 Minutes | 5 | Invalids prior pending challenges | None (Zero side effects) | `PASSWORD_RESET_REQUESTED` |
| **2. Verify Code** | POST `/api/v1/auth/password/reset/verify` | 48-byte Base64URL Token | HMAC-SHA256 Digest | 15 Minutes | 1 | Transitions challenge to `VERIFIED` | None | `PASSWORD_RESET_CODE_VERIFIED` |
| **3. Reset Final** | POST `/api/v1/auth/password/reset` | New Password + Reset Token | bcrypt (12 rounds) | Single-use | 1 | Challenge marked `CONSUMED` (Race-proof) | Revokes ALL personal sessions | `PASSWORD_RESET_COMPLETED` |
| **4. Password Change** | POST `/api/v1/auth/password/change` | Current + New Password | bcrypt (12 rounds) | Immediate | 1 | Atomic update | Revokes other sessions (retains current) | `PASSWORD_CHANGED` |
| **5. MFA Setup** | POST `/api/v1/auth/mfa/setup` | Base32 TOTP Secret | AES-256-GCM Encrypted | Session flow | N/A | Temporary until confirmed | None | `MFA_SETUP_INITIATED` |
| **6. MFA Confirm** | POST `/api/v1/auth/mfa/confirm` | 6-Digit TOTP Code | AES-256-GCM Encrypted | Immediate | 5 | Generates 10 Recovery Codes | Flags user as `mfaEnabled=true` | `MFA_ENABLED` |
| **7. Recovery Code Use** | POST `/api/v1/auth/mfa/verify` | 10-char Recovery Code | SHA-256 Hash Digest | One-Time | 1 | Consumed code removed atomically | Completes MFA authentication | `MFA_RECOVERY_CODE_CONSUMED` |
| **8. Code Regenerate** | POST `/api/v1/auth/mfa/recovery-codes/regenerate` | Authenticated session | SHA-256 Hash Digests | One-Time | 1 | Overwrites all prior recovery codes | None | `MFA_RECOVERY_CODES_REGENERATED` |
