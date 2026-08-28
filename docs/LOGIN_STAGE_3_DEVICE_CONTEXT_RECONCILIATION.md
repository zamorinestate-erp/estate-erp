# Zamorin Café ERP — Login Integration Programme
# Stage 3 Device Context & Trust Reconciliation

## 1. Device Context Comparison

| Attribute | Canonical Zamorin Device Trust (`middleware/deviceContext.js`) | Cafe Operations Device Context (`cafe-operations/middleware/deviceContext.js`) |
|---|---|---|
| **Input Header** | `x-device-id`, `x-device-fingerprint` | `x-cafeops-device-token` or `Authorization: Bearer <deviceToken>` |
| **Identity Resolution** | Resolves registered browser/client device | Cryptographic lookup via SHA-256 hash of high-entropy 256-bit token |
| **Cafe Binding** | Extracted from device document `assignedCafeId` | Extracted from `CafeOpsDevice.cafeId` and pinned to `req.cafeOpsDevice` |
| **Trust Evaluation** | Checks `DeviceRegistration.status === 'ACTIVE'` | Checks `CafeOpsDevice.lifecycleStatus === 'ACTIVE'` |
| **Revocation Behavior** | Denies request with 403 `DEVICE_NOT_AUTHORIZED` | Denies request immediately with 403 `DEVICE_REVOKED` / `DEVICE_LOST` |
| **Spoof Defense** | Verified server-side via signature/token | Client-supplied `deviceId` or `cafeId` in body/query is completely ignored |

---

## 2. No Duplicate Device Authority

The Cafe Operations device layer is **domain-specific to physical cafe terminals** (POS registers, KDS screens, counter tablets). It enforces physical hardware presence via high-entropy pre-shared tokens issued during governed enrollment.

### Verification of Spoof Resistance
- Tested: Client sending `cafeId: 'BOGUS_CAFE_999'` in JSON body.
- Result: Server sets `effectiveCafeId = req.cafeOpsDevice.cafeId` directly. Spoofed body field is discarded.
