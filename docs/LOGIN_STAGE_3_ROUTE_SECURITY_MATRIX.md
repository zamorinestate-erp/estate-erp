# Zamorin Café ERP — Login Integration Programme
# Stage 3 Route Security Matrix

## 1. Complete Cafe Operations Route Inventory

All endpoints mounted under `/api/v1/cafe-ops/` (or `/api/cafe-ops/` in standalone mode).

| Method | Path | Purpose | Device Required | Session Required | Role Required | Mutation | Audit Event | Rate Limit |
|---|---|---|---|---|---|---|---|---|
| `POST` | `/devices/enroll` | Complete device enrollment | ❌ (Pre-auth) | ❌ | None (Requires 8-char token) | ✅ | `DEVICE_ENROLLED` | IP-based |
| `GET` | `/devices/status` | Read device registration status | ✅ | ❌ | None | ❌ | None | Standard |
| `GET` | `/devices/policy` | Fetch terminal timeouts & policy | ✅ | ❌ | None | ❌ | None | Standard |
| `POST` | `/operator/signin` | 6-digit PIN operator login | ✅ | ❌ | `CAFE_ADMIN` (via Grant) | ✅ | `OPERATOR_SIGNIN_SUCCESS` / `FAILED` | Per-Device PIN |
| `POST` | `/operator/master-signin/credentials` | Master password authentication | ✅ | ❌ | `MASTER_PRIMARY` / `MASTER_NORMAL` | ✅ | `MASTER_SIGNIN_SUCCESS` / `FAILED` | Per-Device Master |
| `POST` | `/operator/master-signin/mfa` | Master step-up MFA challenge | ✅ | ❌ | `MASTER_PRIMARY` / `MASTER_NORMAL` | ✅ | `MASTER_MFA_SUCCESS` / `FAILED` | Per-Device Master |
| `GET` | `/operator/session` | Validate & read active session | ✅ | ✅ | Session Operator | ❌ | None | Standard |
| `POST` | `/operator/lock` | Manually lock terminal session | ✅ | ✅ | Session Operator | ✅ | `SESSION_LOCKED` | Standard |
| `POST` | `/operator/unlock` | Re-auth unlock locked terminal | ✅ | ✅ (Locked) | Session Operator | ✅ | `SESSION_UNLOCKED` | Per-Device |
| `POST` | `/operator/end` | End terminal session with handover | ✅ | ✅ | Session Operator | ✅ | `SESSION_ENDED` | Standard |
| `POST` | `/operator/heartbeat` | Keep-alive interaction pulse | ✅ | ✅ | Session Operator | ❌ | None | Gated to interaction |
| `GET` | `/admin/devices` | Governance: List cafe devices | ❌ | ❌ | `MASTER`, `CAFE_ADMIN` | ❌ | None | Standard |
| `POST` | `/admin/devices/enrollment-tokens` | Governance: Issue enrollment code | ❌ | ❌ | `MASTER`, `CAFE_ADMIN` | ✅ | `ENROLLMENT_TOKEN_ISSUED` | Standard |
| `POST` | `/admin/devices/:id/revoke` | Governance: Revoke device | ❌ | ❌ | `MASTER`, `CAFE_ADMIN` | ✅ | `DEVICE_REVOKED` | Standard |
| `POST` | `/admin/devices/:id/reassign-cafe` | Governance: Move device to new cafe | ❌ | ❌ | `MASTER` | ✅ | `DEVICE_REASSIGNED` | Standard |
| `POST` | `/admin/operator-access/grant` | Governance: Grant cafe access | ❌ | ❌ | `MASTER`, `CAFE_ADMIN` | ✅ | `OPERATOR_ACCESS_GRANTED` | Standard |
| `POST` | `/admin/operator-access/revoke` | Governance: Revoke cafe access | ❌ | ❌ | `MASTER`, `CAFE_ADMIN` | ✅ | `OPERATOR_ACCESS_REVOKED` | Standard |
| `POST` | `/admin/operator-access/issue-pin` | Governance: Issue / reset PIN | ❌ | ❌ | `MASTER`, `CAFE_ADMIN` | ✅ | `OPERATOR_PIN_ISSUED` | Standard |
| `GET` | `/admin/operator-sessions/active` | Governance: List active terminal sessions | ❌ | ❌ | `MASTER`, `CAFE_ADMIN` | ❌ | None | Standard |
| `POST` | `/admin/operator-sessions/:id/terminate` | Governance: Remote force-terminate session | ❌ | ❌ | `MASTER`, `CAFE_ADMIN` | ✅ | `SESSION_FORCE_TERMINATED` | Standard |
