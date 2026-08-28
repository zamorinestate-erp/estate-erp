# Zamorin Café ERP — Login Integration Programme
# Stage 3 Device Enrollment Security Report

## 1. Enrollment Protocol

1. **Token Generation**: Governance administrator creates an enrollment code via `/admin/devices/enrollment-tokens`. Code is formatted as an 8-character Crockford Base32 string (eliminating visual ambiguity between `O`/`0` and `I`/`1`/`l`).
2. **Hash-at-Rest**: Only the SHA-256 hash of the enrollment code is persisted in `CafeOpsDeviceEnrollmentToken`.
3. **Single-Use Enforcement**: Upon successful exchange via `/devices/enroll`, status transitions to `CONSUMED`. Subsequent attempts return `400 Bad Request`.
4. **Time-To-Live (TTL)**: Tokens expire after 15 minutes.
5. **Fixed Cafe Binding**: The enrollment token carries the authoritative `cafeId` set by the administrator. The enrolling physical device cannot override or re-bind to a different cafe during enrollment.
