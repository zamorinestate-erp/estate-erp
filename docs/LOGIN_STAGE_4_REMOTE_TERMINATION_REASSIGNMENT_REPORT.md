# Zamorin Café ERP — Login Integration Programme
# Stage 4 Remote Termination, Reassignment & Lifecycle Security Report

## 1. Governance Operations

### A. Remote Session Termination
- **Endpoint**: `POST /api/v1/cafe-ops/admin/sessions/:sessionId/end`
- **Authorized Roles**: `MASTER_PRIMARY`, `MASTER_NORMAL`, `OWNER`, `CAFE_ADMIN` (within assigned cafe scope).
- **Execution Flow**:
  1. Authoritative session record in database transitioned to `status: 'ENDED'`, `endReason: 'REMOTE_REVOKED'`, `endedAt = now`.
  2. Security event `SESSION_ENDED_REMOTELY` recorded.
  3. The very next API request from the terminal receives `401 / 403`, triggering immediate transition to the sign-in hub.

### B. Device Revocation & Marking Lost
- **Endpoints**:
  - Revoke: `POST /api/v1/cafe-ops/admin/devices/:deviceId/revoke`
  - Mark Lost: `POST /api/v1/cafe-ops/admin/devices/:deviceId/mark-lost`
- **Authorized Roles**: `MASTER_PRIMARY`, `MASTER_NORMAL`, `OWNER`.
- **Execution Flow**:
  1. Device entity marked `REVOKED` / `LOST`.
  2. All active/locked sessions on the device immediately terminated via `endAllActiveSessionsForDevice`.
  3. Subsequent authentication attempts rejected with `DEVICE_REVOKED` / `DEVICE_LOST` before PIN or password inspection.

### C. Cafe Reassignment (Cafe A → Cafe B)
- **Endpoint**: `POST /api/v1/cafe-ops/admin/devices/:deviceId/reassign-cafe`
- **Authorized Roles**: `MASTER_PRIMARY`, `MASTER_NORMAL`, `OWNER`.
- **Execution Flow**:
  1. Active Cafe A sessions terminated atomically (`DEVICE_REASSIGNED`).
  2. Device record updated: `previousCafeId = 'Cafe A'`, `cafeId = 'Cafe B'`, `reassignedAt = now`.
  3. Security event `DEVICE_REASSIGNED_EVENT` recorded.
  4. Subsequent operator sign-ins on this device require active `CafeOpsOperatorAccess` grants for **Cafe B**.
  5. Any previous Cafe A requests or cached tokens are rejected.

---

## 2. Real-Time Transport vs Server Security Boundary

- **Push Notification / Real-Time WebSocket**: Provides rapid UX feedback to display lock/revocation screens.
- **Authoritative Security Boundary**: Every protected HTTP request strictly queries the current server-side database state. Even if real-time push fails, the backend prevents any unauthorized business execution.
