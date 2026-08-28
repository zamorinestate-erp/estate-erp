# Zamorin Café ERP — Login Integration Programme
# Stage 4 Device Lifecycle Matrix

## 1. Valid Transitions Matrix

| From State | To State | Initiator Role | Authorization Engine Check | Session Consequence | Audit Event Type | Reversible |
|---|---|---|---|---|---|---|
| `[NONE]` | `PENDING` | `MASTER_PRIMARY`, `MASTER_NORMAL`, `OWNER`, `CAFE_ADMIN` | `requireGovernanceRole` (Cafe Scoped) | None | `DEVICE_ENROLLMENT_INITIATED` | N/A (15m TTL) |
| `PENDING` | `ACTIVE` | Hardware POS Terminal | `deviceEnrollmentService.enrollDevice` | Terminal Paired & Token Issued | `DEVICE_ENROLLED` | N/A |
| `ACTIVE` | `LOST` | `MASTER_PRIMARY`, `MASTER_NORMAL`, `OWNER` | `requireGovernanceRole` | Live sessions ended immediately (`DEVICE_LOST`) | `DEVICE_LIFECYCLE_EVENT (LOST)` | No (Manual Review) |
| `ACTIVE` | `REVOKED` | `MASTER_PRIMARY`, `MASTER_NORMAL`, `OWNER` | `requireGovernanceRole` | Live sessions ended immediately (`DEVICE_REVOKED`) | `DEVICE_LIFECYCLE_EVENT (REVOKED)` | No |
| `ACTIVE` | `RETIRED` | `MASTER_PRIMARY`, `MASTER_NORMAL`, `OWNER` | `requireGovernanceRole` | Live sessions ended immediately (`DEVICE_RETIRED`) | `DEVICE_LIFECYCLE_EVENT (RETIRED)` | No |
| `ACTIVE` | `REPLACED` | `MASTER_PRIMARY`, `MASTER_NORMAL`, `OWNER` | `requireGovernanceRole` | Live sessions ended (`DEVICE_REPLACED`) + new token generated | `DEVICE_LIFECYCLE_EVENT (REPLACED)` | No |
| `ACTIVE (Cafe A)` | `ACTIVE (Cafe B)` | `MASTER_PRIMARY`, `MASTER_NORMAL`, `OWNER` | `requireGovernanceRole` | Live sessions ended immediately (`DEVICE_REASSIGNED`) | `DEVICE_REASSIGNED_EVENT` | Yes (Reassign back) |

---

## 2. Invalid Transitions Matrix (Strictly Rejected)

| Attempted Transition | Rejection Mechanism | HTTP Status | Error Code | Reason |
|---|---|---|---|---|
| `REVOKED` → `ACTIVE` | `deviceContext` / `deviceService` | `403 Forbidden` | `DEVICE_REVOKED` | Revoked hardware cannot self-reactivate. |
| `LOST` → `ACTIVE` | `deviceContext` / `deviceService` | `403 Forbidden` | `DEVICE_LOST` | Stolen/lost hardware remains blocked. |
| `RETIRED` → `ACTIVE` | `deviceContext` / `deviceService` | `403 Forbidden` | `DEVICE_RETIRED` | Decommissioned hardware is permanent. |
| `REPLACED` → `ACTIVE` | `deviceContext` / `deviceService` | `403 Forbidden` | `DEVICE_REPLACED` | Superseded hardware cannot be reused. |
| `PENDING (CONSUMED)` → `ACTIVE` | `enrollDevice` | `400 / 409` | `ENROLLMENT_UNAVAILABLE` | Enrollment token replay is prohibited. |
| `PENDING (EXPIRED)` → `ACTIVE` | `enrollDevice` | `400 / 409` | `ENROLLMENT_UNAVAILABLE` | Expired tokens are rejected. |
| Unauthenticated → Any State Change | `requireGovernanceRole` | `401 Unauthorized` | `UNAUTHORIZED` | Governance caller required. |
| `STAFF` → Any State Change | `requireGovernanceRole` | `403 Forbidden` | `FORBIDDEN` | Staff cannot manage device fleet. |
