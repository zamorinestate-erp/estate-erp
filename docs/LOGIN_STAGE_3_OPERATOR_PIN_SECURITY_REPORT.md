# Zamorin Café ERP — Login Integration Programme
# Stage 3 Operator PIN Security Report

## 1. Cryptographic Storage & Verification

- **Storage Architecture**: PINs are never stored plaintext.
  - **Bcrypt (Cost 12)**: Authoritative, computationally expensive slow verification.
  - **HMAC-SHA256 (Peppered Lookup Hash)**: Fast O(1) candidate lookup keyed organisation-wide.
- **Timing Attack Defense**: When no candidate lookup hash matches, a dummy bcrypt comparison (`bcrypt.compare(pin, DUMMY_HASH)`) executes automatically, ensuring uniform latency regardless of candidate existence.
- **Weak PIN Blocklist**: Automatically rejects 6-digit ascending sequences (`123456`), descending sequences (`654321`), repeated digits (`111111`), and known weak PINs (`000000`, `121212`).

---

## 2. Brute-Force Rate Limiting

- **Device Throttling**: 5 consecutive failed PIN attempts trigger a 15-minute device-level lockout (`429 Too Many Requests`).
- **Independent Scopes**: Rate limiting for `PIN` and `MASTER` paths on the same physical terminal operate on independent keys (`${deviceId}:PIN` vs `${deviceId}:MASTER`), preventing PIN guessing from locking out Master emergency administration.
