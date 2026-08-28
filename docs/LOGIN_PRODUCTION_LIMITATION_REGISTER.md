# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## PRODUCTION LIMITATION REGISTER & RELEASE-READINESS CLASSIFICATION

---

### 1. Classification Statement

```text
Classification:  LOGIN FEATURE COMPLETE — LOCAL / INTEGRATION CERTIFIED
                 PRODUCTION VALIDATION PENDING FOR DOCUMENTED INFRASTRUCTURE ITEMS
```

---

### 2. Registered Production Limitations

| Register ID | Title & Summary | Local / Integration Status | Production Requirement | Blocking Condition | Owner | Validation Procedure |
|---|---|---|---|---|---|---|
| **LOGIN-PROD-001** | **Process-Local Rate Limiter Store**<br>Rate limiters for auth endpoints operate in-memory per Node.js process. | **CERTIFIED** (Deterministic local memory bucket) | **Redis / Memcached** backing store required for clustered multi-instance horizontal scaling. | Horizontal multi-instance load balancing. | DevOps / Infrastructure | Configure `REDIS_URL` in production environment and execute distributed load test across >= 2 backend instances. |
| **LOGIN-PROD-002** | **External Notification Gateway Delivery**<br>Security notification delivery operates via `NotificationOutbox` & local sandbox logger. | **CERTIFIED** (100% verified outbox payloads) | Production SMTP (SendGrid/AWS SES) / SMS gateway configuration. | Customer/Staff live email/SMS delivery. | DevOps / Communications | Connect production SMTP/SMS credentials, trigger auth alerts, and verify external inbox arrival with 0 secret leakage. |
| **LOGIN-PROD-003** | **AAL3 Not Currently Claimed / Defense-in-Depth Key Storage**<br>MFA uses RFC 6238 software TOTP and 128-bit CSPRNG recovery codes with AES-256-GCM secret encryption at rest. Formal NIST AAL3 is NOT claimed. | **CERTIFIED** (AAL2 Established; AAL3 Not Claimed) | Future formal AAL3 architecture would require a phishing-resistant hardware-protected public-key authenticator with non-exportable private key (FIDO2/WebAuthn / YubiKey), replay resistance, authentication intent, applicable FIPS validation, and all other NIST SP 800-63B-4 AAL3 requirements. Dedicated Cloud KMS/HSM secret-vault envelope encryption for `MFA_ENCRYPTION_KEY` is classified as defense-in-depth. | Formal AAL3 regulatory/enterprise procurement requirements. | Security Architect / DevOps | Deploy WebAuthn/FIDO2 authenticator layer with hardware security keys for AAL3; configure AWS KMS / Azure Key Vault envelope encryption for defense-in-depth secret storage. |
