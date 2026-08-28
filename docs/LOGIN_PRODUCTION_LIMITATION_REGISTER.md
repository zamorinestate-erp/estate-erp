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
| **LOGIN-PROD-003** | **Hardware Cryptoprocessor (HSM / FIPS 140-2)**<br>MFA and token secrets use AES-256-GCM and SHA-256 in software. | **CERTIFIED** (AES-256-GCM / HMAC-SHA256) | Hardware Security Module (HSM / KMS) integration for formal AAL3 assurance. | Enterprise AAL3 compliance requirements. | Security Architect | Configure AWS KMS / Azure Key Vault envelope encryption for `MFA_ENCRYPTION_KEY`. |
