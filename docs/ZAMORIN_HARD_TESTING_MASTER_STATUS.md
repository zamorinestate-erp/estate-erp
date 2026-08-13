# ZAMORIN CAFE ERP — HARD-TESTING PROGRAMME MASTER STATUS

> **Programme Stage**: HT-00 Baseline Preparation  
> **Release Baseline**: `v1.2.0-ht00-baseline` (Git Commit: `c7fc01a`)  
> **Regression Status**: **332 / 332 PASSING (100%)**  
> **HT-00 Status**: **PASS**

---

## 1. Hard-Testing Stages Status Dashboard

| Stage ID | Stage Name | Description | Target Virtual Users | Target Thresholds | Status |
|---|---|---|---|---|---|
| **HT-00** | Baseline Preparation | Baseline Freeze, Observability, Synthetic Seeds & Health Check | N/A | Health/Readiness PASS, 0 Defects | **PASS** |
| **HT-01** | Concurrent Login Storm | 500+ Staff simultaneous login and bootstrap storm | 500 VUs | Success >= 99.5%, p95 <= 3.0s | **REMEDIATION REQUIRED** |
| **HT-02** | Shift-Start Attendance Storm | Simultaneous clock-in / attendance submission | 500 VUs | Success >= 99.5%, p95 <= 2.0s | **BLOCKED** (Production-Like Staging Validation Pending) |
| **HT-03** | Mixed Workload Stress | POS billing, expense submission, inventory check, self-service | 500+ VUs | Success >= 99.0%, p95 <= 3.0s | NOT STARTED |
| **HT-04** | Stress & Breakpoint | Ramping load until system breaking point discovery | 1,000+ VUs | Identify maximum throughput limit | NOT STARTED |
| **HT-05** | Sudden Spike Storm | Instantaneous load jump from 10 to 500 VUs | 500 VUs | Zero unhandled process crashes | NOT STARTED |
| **HT-06** | Soak / Endurance | Sustained continuous operational load over multi-hour run | 100 VUs | 0 memory leak, 0 connection leak | NOT STARTED |
| **HT-07** | Network Resilience | High latency, jitter, packet loss, and dropped connections | 50 VUs | 0 corrupted state, retry safety | NOT STARTED |
| **HT-08** | Functional Workflow Accuracy | Multi-step lifecycle state transition accuracy under load | 50 VUs | 100% workflow state integrity | NOT STARTED |
| **HT-09** | Financial Concurrency | Concurrently created bills, expenses, payments & voids | 100 VUs | 0 duplicate payments, 0 race conditions | NOT STARTED |
| **HT-10** | Role / Authorization Attack | Penetration simulation against protected endpoints | Hostile VUs | 100% authorization denial (403/401) | NOT STARTED |
| **HT-11** | Auth & Session Security | Token forgery, replay attacks, revoked session reuse | Hostile VUs | 100% auth failure denial | NOT STARTED |
| **HT-12** | Input & Injection Security | XSS, NoSQL injection, boundary overflow attempts | Hostile VUs | 0 injection vulnerability | NOT STARTED |
| **HT-13** | Data Leakage Audit | Verification of tenant, café, and role data boundaries | 100 VUs | 0 cross-role / cross-cafe data leak | NOT STARTED |
| **HT-14** | Failure Engineering | Process crash, database disconnect, disk pressure | Chaos VUs | Graceful recovery, zero corrupt state | NOT STARTED |
| **HT-15** | Disaster Recovery | Database backup restoration & state reconciliation | N/A | 100% data recovery integrity | NOT STARTED |
| **HT-16** | PWA & Offline Upgrade | Cache versioning, offline shell, service worker upgrade | Client VUs | Zero stale app cache locks | NOT STARTED |
| **HT-17** | Browser & Responsive E2E | Multi-device browser E2E role-based verification | E2E VUs | 100% UI layout & action integrity | NOT STARTED |
| **HT-18** | Accessibility & i18n | Responsive layout, ARIA labels, IST timezone display | E2E VUs | PASS | NOT STARTED |
| **HT-19** | Staging Acceptance Gate | Final production-like staging environment load acceptance | 500+ VUs | Staging infrastructure acceptance | NOT STARTED |
| **HT-20** | Final Release Gate | Final executive approval for hard-tested deployment | All Gates | 100% Hard-Test Acceptance | NOT STARTED |
