# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## STAGE 6 — TOTP ONE-USE & REPLAY RESISTANCE CERTIFICATION

---

### 1. Specification

Zamorin Café ERP implements RFC 6238 Time-Based One-Time Password (TOTP) algorithm for multi-factor authentication:

- **Algorithm**: HMAC-SHA1
- **Digits**: 6 numeric digits
- **Time Step ($T_0$)**: 30 seconds
- **Verification Window**: $\pm 1$ window ($\pm 30$ seconds to account for client clock drift)
- **Replay Resistance**: Server-side atomic counter tracking (`lastMfaCounter`)

---

### 2. Replay Prevention Mechanism

Under RFC 6238, a 6-digit TOTP code remains mathematically valid for the duration of its 30-second window. Without counter tracking, an attacker intercepting the code could replay it before window expiry.

Zamorin prevents this through server-side state tracking:

1. `verifyTotpCode` returns `{ valid: true, counter }` where `counter = Math.floor(timestamp / 30000) + step`.
2. When evaluating MFA tokens, the server compares the incoming `counter` against `user.lastMfaCounter`.
3. If `counter <= user.lastMfaCounter`, the request is rejected with `400 MFA_CODE_REUSED` ("This MFA code has already been used.").
4. On successful verification, `user.lastMfaCounter` is atomically updated to the accepted `counter`.

---

### 3. Verification Scenarios & Edge Cases

| Test Case | Scenario | Expected Behavior | Certified Result |
|---|---|---|---|
| **Same OTP First Use** | Valid code submitted at $T=0$. | Accepted; `lastMfaCounter` set to current timestep. | **PASS** |
| **Same OTP Second Use** | Same code resubmitted at $T=5s$ within same 30s window. | Rejected (`MFA_CODE_REUSED`); counter was already recorded. | **PASS** |
| **Adjacent Window Drift** | Code generated in window $T-1$ submitted after a valid $T$ code was accepted. | Rejected (`MFA_CODE_REUSED`); $T-1 < T$. | **PASS** |
| **Concurrent Race** | Two requests submit the same valid OTP concurrently. | Exactly one request succeeds; second is rejected atomically. | **PASS** |
| **MFA Rate Limiting** | > 5 incorrect attempts in 15 minutes. | IP / account throttled (`429 TOO_MANY_REQUESTS`). | **PASS** |
