# Zamorin Café ERP — Login Integration Stage 2
# Performance & Interaction Latency Report

## 1. Interaction Metrics

Automated CDP benchmarks recorded via `scripts/audit_application_performance.mjs`:

- **First Visual Click Feedback**: p50 = **5 ms**, p95 = **11 ms** (Target: <= 100 ms)
- **Route Usability & DOM Mount**: p50 = **134 ms**, p95 = **1303 ms** (Target: <= 1000 ms normal, <= 500 ms warm)
- **Document Reloads During Navigation**: **0 reloads** (100% Single Page Application transitions)
- **Duplicate In-Flight Requests**: **0 duplicate reads**

---

## 2. Main-Thread Integrity

- **Long Tasks (> 50 ms)**: 0 long tasks during terminal screen renders.
- **Memory Footprint**: Transient UI states (error messages, MFA tokens) automatically cleared on route exit.
- **CSS Painting**: Hardware-accelerated transitions via `transform` and `opacity`.
