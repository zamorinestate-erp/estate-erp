# Zamorin Café ERP — Login Integration Programme
# Stage 4 Session Lifecycle Matrix

## 1. Session Operations Matrix

| Operation | Starting State | Ending State | Server Action | Client UX Action | Audit Event | Authorization Required |
|---|---|---|---|---|---|---|
| **`CREATE`** | `NONE` | `ACTIVE` | Mint session token hash, tie to `device.cafeId`, terminate prior session on device | Receive session token, show operator dashboard | `OPERATOR_SIGNIN_SUCCESS` or `MASTER_SIGNIN_SUCCESS` | Valid PIN + Grant or Master Pass + MFA |
| **`ACTIVE`** | `ACTIVE` | `ACTIVE` | Record `lastActivityAt` timestamp upon protected request | Keep UI responsive, reset client timer | None (or request log) | Valid `x-cafe-ops-session-token` |
| **`LOCK`** | `ACTIVE` | `LOCKED` | Update session `status: 'LOCKED'`, record `lockedAt` | Clear sensitive DOM, display PIN unlock screen | `SESSION_LOCKED` | Terminal user or idle timeout |
| **`UNLOCK`** | `LOCKED` | `ACTIVE` | Verify PIN (or Master reauth), update `status: 'ACTIVE'`, touch `lastActivityAt` | Restore terminal operational workspace | `SESSION_UNLOCKED` | Same operator PIN or Master reauth |
| **`SWITCH`** | `ACTIVE` / `LOCKED` | `ENDED` (Old) → `ACTIVE` (New) | Atomically end Old with reason `SWITCH_OPERATOR`, create New session | Prompt for Operator B credentials, transition workspace | `SESSION_SWITCHED` + `OPERATOR_SIGNIN_SUCCESS` | Valid Operator B credentials + Grant |
| **`MASTER_ELEVATE`** | `ACTIVE (Operator)` | `ENDED` (Operator) → `ACTIVE` (Master) | End Operator session, authenticate Master via Password + MFA, create Master session | Present Master governance controls with cafe-scoped authority | `MASTER_SIGNIN_SUCCESS` | Canonical Master password + TOTP |
| **`MASTER_RETURN`** | `ACTIVE (Master)` | `ENDED` (Master) → `NONE` / `OPERATOR` | End Master session, remove elevated permissions | Return to PIN welcome or prompt for Operator PIN | `SESSION_ENDED` | Explicit lock/logout action |
| **`IDLE_EXPIRE`** | `ACTIVE` | `LOCKED` | After 5 min without activity, `evaluateSessionLiveness` flags `shouldLock: true` | Lock screen displayed, sensitive data purged | `SESSION_LOCKED` | Server inactivity timeout |
| **`ABSOLUTE_EXPIRE`**| `ACTIVE` / `LOCKED` | `ENDED` | After 12 hours from `startedAt`, server marks session expired (`OVERALL_EXPIRY`) | Redirect to terminal sign-in hub | `SESSION_EXPIRED_EVENT` | Server absolute shift boundary |
| **`REMOTE_TERMINATE`**| `ACTIVE` / `LOCKED`| `ENDED` | Governance API sets `status: 'ENDED'`, reason `REMOTE_REVOKED` | Invalidate UI, reject subsequent requests | `SESSION_ENDED_REMOTELY` | `requireGovernanceRole` (`MASTER`/`OWNER`/`CAFE_ADMIN`) |
| **`DEVICE_REVOKE`** | `ACTIVE` / `LOCKED`| `ENDED` | Device revocation hook calls `endAllActiveSessionsForDevice` | Terminal shows Device Revoked screen | `DEVICE_LIFECYCLE_EVENT (REVOKED)` | `requireGovernanceRole` (`MASTER`/`OWNER`) |
| **`DEVICE_REASSIGN`**| `ACTIVE` / `LOCKED`| `ENDED` | Reassignment hook ends sessions before updating `cafeId` | Terminal shows Welcome screen for new store | `DEVICE_REASSIGNED_EVENT` | `requireGovernanceRole` (`MASTER`/`OWNER`) |
| **`OPERATOR_REVOKE`**| `ACTIVE` / `LOCKED`| `ENDED` | Access grant revocation denies subsequent requests | Session ends, return to sign-in | `SESSION_ENDED (ACCESS_REVOKED)` | Admin revoke operator access |
| **`END`** | `ACTIVE` / `LOCKED`| `ENDED` | Explicit operator sign-out with optional handover note | Return to Attendance Kiosk / Welcome | `SESSION_ENDED` | Active session holder |
