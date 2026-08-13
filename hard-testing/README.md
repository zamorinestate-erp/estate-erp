# ZAMORIN CAFE ERP — HARD-TESTING PROGRAMME FRAMEWORK

This directory contains the destructive testing, resilience testing, security testing, and failure-engineering infrastructure for **Zamorin Cafe ERP**.

## Directory Structure

- `load/` — k6 and Node load generation scripts for concurrency, spike, and soak testing.
- `network/` — Chaos engineering scripts for latency, packet loss, and connection drops.
- `security/` — Penetration testing, IDOR, auth bypass, and rate-limiting audit scripts.
- `resilience/` — Database failover, process crash, and memory leak stress harnesses.
- `recovery/` — Disaster recovery, backup restoration, and state reconciliation tests.
- `e2e/` — Full role-based user workflow E2E test scenarios.
- `results/` — Immutable test run reports and metric summaries.
- `logs/` — Redacted diagnostic logs from stress test runs.
- `metrics/` — Raw latency, throughput, and system resource metrics.
- `scripts/` — Idempotent synthetic load-test data generator and cleanup reset utilities.

## Environment Protection

All destructive scripts require `LOAD_TEST_ENV=true` or `NODE_ENV=test` to execute, preventing accidental execution against production databases.
