# Zamorin Café ERP — Login Integration Programme
# Stage 4 Management UI & Modal Matrix

## 1. UI Controls & Actions Matrix

| UI Location | Control Name | Target Action | Authoritative Role | API Endpoint | Post-condition | Audit Event |
|---|---|---|---|---|---|---|
| **Devices & Sessions** | `[Enroll Hardware]` | Open Enrollment Modal | `MASTER`, `OWNER`, `CAFE_ADMIN` | `POST /api/v1/cafe-ops/admin/devices/enrollment-tokens` | 8-character Crockford Base32 code issued (15m TTL) | `DEVICE_ENROLLMENT_INITIATED` |
| **Devices & Sessions** | `[Revoke Device]` | Open Revoke Confirmation Modal | `MASTER`, `OWNER` | `POST /api/v1/cafe-ops/admin/devices/:id/revoke` | Device status `REVOKED`, live sessions killed | `DEVICE_LIFECYCLE_EVENT (REVOKED)` |
| **Devices & Sessions** | `[Mark Lost]` | Open Mark Lost Modal | `MASTER`, `OWNER` | `POST /api/v1/cafe-ops/admin/devices/:id/mark-lost` | Device status `LOST`, terminal blocked | `DEVICE_LIFECYCLE_EVENT (LOST)` |
| **Devices & Sessions** | `[Reassign Location]` | Open Reassign Cafe Modal (Zamorin Select) | `MASTER`, `OWNER` | `POST /api/v1/cafe-ops/admin/devices/:id/reassign-cafe` | `cafeId` updated, live sessions ended, store cache purged | `DEVICE_REASSIGNED_EVENT` |
| **Devices & Sessions** | `[Replace Device]` | Open Replace Terminal Modal | `MASTER`, `OWNER` | `POST /api/v1/cafe-ops/admin/devices/:id/replace` | Old device marked `REPLACED`, new enrollment token created | `DEVICE_LIFECYCLE_EVENT (REPLACED)` |
| **Devices & Sessions** | `[Decommission]` | Open Retire Device Modal | `MASTER`, `OWNER` | `POST /api/v1/cafe-ops/admin/devices/:id/retire` | Device permanently `RETIRED`, sessions terminated | `DEVICE_LIFECYCLE_EVENT (RETIRED)` |
| **Active Sessions Log**| `[Remote Terminate]`| Open Destructive Confirmation Modal | `MASTER`, `OWNER`, `CAFE_ADMIN` | `POST /api/v1/cafe-ops/admin/sessions/:id/end` | Session marked `ENDED` (`REMOTE_REVOKED`), next request denied | `SESSION_ENDED_REMOTELY` |
| **PIN Setup Tab** | `[Save & Activate PIN]`| Save 6-Digit Operator PIN | `MASTER`, `OWNER`, `CAFE_ADMIN` | `POST /api/v1/cafe-ops/admin/operator-access` or PIN service | Cost 12 Bcrypt hash + lookup hash stored | `OPERATOR_PIN_CONFIGURED` |
| **Terminal Lock** | `[Enter PIN to Unlock]`| Verify PIN & Unlock | Same Operator | `POST /api/v1/cafe-ops/unlock` | Status `ACTIVE`, operational workspace restored | `SESSION_UNLOCKED` |
| **Terminal Lock** | `[Switch Operator]` | Switch to Different Operator | Incoming Operator | `POST /api/v1/cafe-ops/end` (forSwitch) + `POST /api/v1/cafe-ops/signin` | Session handover completed, new operator attributed | `SESSION_SWITCHED` |
