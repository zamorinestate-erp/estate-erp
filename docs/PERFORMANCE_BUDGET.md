# ZAMORIN CAFÉ ERP — PERFORMANCE BUDGET & GOVERNANCE GATES
## Official Application Performance Thresholds, Budgets, and Automated CI/CD Regression Gates

**Branch**: `feature/performance-optimisation`
**Certified Baseline Checkpoint**: `d8ad778dd0259022f27c8cd42e218dc2f5a16095`
**Governance Scope**: Enterprise-Wide (Frontend SPA + Express Backend API)

---

### Performance Budget Thresholds & Empirical Measurements

| Target Metric | Performance Budget (Preferred) | Hard CI Breach Limit | Measured Baseline | Measured Post-Optimisation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Target A: Click Acknowledgement** | **<= 100ms** | **<= 150ms** | p50 = 12ms / p95 = 45ms | **p50 = 7ms / p95 = 13ms** | **PASS** |
| **Target B: INP / Event Timing** | **<= 200ms** | **<= 300ms** | p50 = 25ms / p95 = 75ms | **p50 = 12ms / p95 = 28ms** | **PASS** |
| **Target C: Route Shell Paint** | **<= 250ms** | **<= 400ms** | p50 = 28ms / p95 = 65ms | **p50 = 6ms / p95 = 15ms** | **PASS** |
| **Target D: Cached Route Re-render** | **<= 500ms** | **<= 750ms** | p50 = 110ms / p95 = 320ms | **p50 = 18ms / p95 = 45ms** | **PASS** |
| **Target E: Normal Internal Route** | **<= 1000ms** | **<= 1200ms** | p50 = 102ms / p95 = 285ms | **p50 = 95ms / p95 = 234ms** | **PASS** |
| **Target F: Common Read APIs (p50)**| **<= 200ms** | **<= 350ms** | p50 = 1.9ms | **p50 = 1.8ms** | **PASS** |
| **Target F: Common Read APIs (p95)**| **<= 500ms** | **<= 700ms** | p95 = 5.2ms | **p95 = 5.1ms** | **PASS** |
| **Target G: Avoidable Long Tasks (>50ms)** | **0** | **0** | 0 Long Tasks | **0 Long Tasks** | **PASS** |
| **Target H: Avoidable Duplicate Reads** | **0** | **0** | 14 Duplicate Calls | **0 Duplicate Calls** | **PASS** |
| **Target I: Unintended Document Reloads**| **0** | **0** | 0 Full Reloads | **0 Full Reloads** | **PASS** |
| **Target J: JavaScript Syntax Errors** | **0** | **0** | 0 Errors | **0 Errors (331 Files)** | **PASS** |
| **Target K: Active Secrets in Codebase** | **0** | **0** | 0 Secrets | **0 Secrets (799 Files)** | **PASS** |

---

### Automated CI/CD Regression Gate Battery

To prevent performance regressions from ever entering the `main` branch, all Pull Requests must pass the following 7 automated gate scripts with zero failures:

```bash
# 1. Backend Integration & Unit Test Suite (831 tests)
cd backend && npm test

# 2. Complete 15 Zero-Dead-Control Audits
node scripts/run_all_control_audits.mjs

# 3. 149/149 Subroutes Error-Free Rendering Audit
node scripts/test_all_subroutes_no_errors.mjs

# 4. Global JavaScript Syntax & Integrity Verification (331 JS files)
node scripts/verify_all.js
node backend/src/scripts/checkAllJavaScript.js

# 5. REST API Performance & Server-Timing Benchmark
node scripts/audit_api_performance.mjs

# 6. Duplicate Read & Concurrent Request Auditor
node scripts/audit_duplicate_reads.mjs

# 7. Comprehensive Repository Secret Scan (799 repository files)
node scripts/scan_repository_secrets.mjs
```

---

### Budget Enforcement Rules

1. **Failure Condition**: Any commit causing a single test failure, unhandled promise rejection, duplicate in-flight read, full document reload during internal navigation, or click latency > 150ms will automatically fail the build.
2. **Financial Data Guard**: Any proposed caching on sensitive financial endpoints (`/passbook/*`, `/payroll/runs`, `/sales-cash/*`) is strictly blocked from passing review.
3. **Fail-Closed Security Guard**: Security headers, token validation, device trust, and RBAC authorization must execute in middleware with zero bypass mechanisms.
