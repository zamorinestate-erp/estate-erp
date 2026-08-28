# Zamorin Café ERP — Login Integration Programme
# Stage 3 Device Model Parity Matrix

## 1. Model Responsibilities & Coexistence

| Model | Schema File | Scope & Role | Authority | Lifecycle States |
|---|---|---|---|---|
| **`DeviceRegistration`** | `backend/src/models/DeviceRegistration.js` | General web browser & mobile device trust for personal user logins | Authorizes personal MFA bypass and trusted browser recognition | `PENDING`, `ACTIVE`, `BLOCKED`, `REVOKED` |
| **`CafeOpsDevice`** | `backend/src/cafe-operations/models/CafeOpsDevice.js` | Physical dedicated hardware terminal deployed inside a specific cafe | Authorizes terminal operations, operator PIN login, and fixed cafe scope | `PENDING_ENROLLMENT`, `ACTIVE`, `REVOKED`, `LOST`, `RETIRED`, `REPLACED` |

---

## 2. Parity Assessment

1. **Separation of Concerns**: `DeviceRegistration` protects user accounts from unknown remote browsers. `CafeOpsDevice` protects the physical store's point of sale from unauthorized network access.
2. **Zero Authority Collision**: A personal device enrollment in `DeviceRegistration` cannot authenticate an operator in `CafeOpsDevice`, and a cafe POS tablet token cannot be used to log in as a personal user on the web dashboard.
