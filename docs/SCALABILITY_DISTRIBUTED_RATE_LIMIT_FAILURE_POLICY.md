# ZAMORIN CAFÉ ERP — DISTRIBUTED RATE LIMITER FAILURE & PARTITION POLICY
**Document ID**: `ZAM-SCAL-RL-001`  
**Programme**: `feature/enterprise-scalability`  
**Status**: `ACTIVE & VERIFIED`

---

## 1. Security Architecture Problem Statement

In a multi-instance, load-balanced cluster (e.g. 8 to 16 API nodes behind an Application Load Balancer), if the shared distributed limiter (Redis) experiences a partition or network outage:
- **Flawed Policy (Silent Local Memory Degradation)**: Each node falls back to its local memory counter. An attacker making requests to 16 instances can attempt $16 \times 5 = 80$ brute-force guesses before hitting a local threshold. This destroys cluster-wide authentication guarantees.
- **Zamorin Enterprise Policy**: Strict separation between **Security-Critical Scopes** and **General Traffic Scopes**.

---

## 2. Policy Definitions

### Policy A: `SECURITY_LIMITER_POLICY` (`FAIL_CLOSED`)
Applies to all security-sensitive authentication and credential verification endpoints:
- `LOGIN` (Master & Owner Password Authentication)
- `MFA` (TOTP & Recovery Code Verification)
- `PASSWORD_RECOVERY` (Password Reset Request & Token Consumption)
- `PIN` (Operator Terminal PIN Verification)
- `MASTER` (Master Elevation on Café POS)
- `DEVICE_ENROLLMENT` (Terminal Enrollment Token Exchange)
- `SECURITY_ACTION` (Role Changes, Device Revocation, Cash Journal Edits)

**Outage Action**:
If Redis becomes unavailable, requests to security-critical scopes are strictly rejected with HTTP 429 (`DISTRIBUTED_SECURITY_LIMITER_UNAVAILABLE`). No per-process counter multiplication is permitted.

### Policy B: `GENERAL_TRAFFIC_LIMITER_POLICY` (`DEGRADE_LOCAL_BOUNDED`)
Applies to low-risk, read-heavy public APIs:
- `SEARCH` (Typeahead & Item Lookup)
- `HEARTBEAT` (Device Ping Rate Limiting)
- `PUBLIC_CATALOG` (Menu & Category Read)

**Outage Action**:
Degrades to bounded local in-memory sliding window counters with telemetry warnings logged for SRE observation.

---

## 3. Empirical Multi-Process Verification Evidence

Executed via `scripts/audit_real_process_rate_limiter.mjs` across two independent Node.js processes (PID 19148, Port 54134 and PID 12484, Port 54135):

1. **Redis Partition Simulation**:
   - Both nodes marked in degraded partition state.
   - Request to `/api/auth/login` on Node A returned `HTTP 429 (DISTRIBUTED_SECURITY_LIMITER_UNAVAILABLE)`.
   - Request to `/api/auth/login` on Node B returned `HTTP 429 (DISTRIBUTED_SECURITY_LIMITER_UNAVAILABLE)`.
   - **Result**: `PASS (FAIL_CLOSED Enforced)`.

2. **Negative Control (Forced Local Degradation Defect)**:
   - Forced security limiter to per-process counters.
   - Dispatched 4 attempts to Node A and 4 attempts to Node B.
   - Aggregate attempts permitted reached 8 (exceeding global max of 5).
   - Audit flagged vulnerability non-zero, then reverted to `FAIL_CLOSED`.
   - **Result**: `PASS (Vulnerability Detected & Remediated)`.
