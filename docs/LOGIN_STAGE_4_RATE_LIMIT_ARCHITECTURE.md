# Zamorin Café ERP — Login Integration Programme
# Stage 4 Rate Limit Architecture Specification

## 1. Rate Limiting Implementation Details

| Parameter | Specification |
|---|---|
| **Storage Engine** | In-Memory / Process-Local (`rateLimitService.js`) |
| **Multi-Instance Capability** | `MULTI_INSTANCE_PRODUCTION_LIMITATION = YES` |
| **Limiter Key** | Combined Key: `${deviceId}:${scope}` (where `scope = 'PIN' \| 'MASTER'`) |
| **Scope Isolation** | Independent tracking: 5 failed PIN attempts lock the PIN path for 15 minutes, but leave the Master password/TOTP path fully accessible on the same device. |
| **Threshold** | **5 consecutive failed attempts** |
| **Window Duration** | **15 minutes** sliding window / cooldown |
| **Success Policy** | Successful authentication (`recordSuccess`) immediately clears failure counter and resets lock status. |
| **Persistence Across Navigation** | Maintained server-side across route navigation and page reloads. |

---

## 2. Production Distributed Deployment Note

In a multi-instance / clustered production deployment behind a load balancer, `rateLimitService.js` must be configured with a distributed backing store (e.g. Redis / MongoDB-backed atomic rate limiter) to ensure failed attempts across different worker processes aggregate against the same `${deviceId}:${scope}` key.
