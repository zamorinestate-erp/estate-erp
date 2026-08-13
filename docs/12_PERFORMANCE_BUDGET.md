# 12 — Performance Budget & Scale Benchmarks (Stage 18 Target)

> [!IMPORTANT]
> **Performance Architecture**: Lightweight Vanilla JS ES module architecture with lazy route loading, pagination caps, and strict bundle budgets.

---

## 1. Bundle & Payload Size Budgets

```
===============================================================================
                      FRONTEND JS BUNDLE BUDGET METRICS
===============================================================================
  - Total Frontend JS Source Code:        367.86 KB (50 Files)  [Max: 500 KB]
  - Core Shell JS Bundle (main+router):     49.16 KB             [Max:  75 KB]
  - STAFF Mobile Shell Initial Bundle:     22.50 KB             [Max:  35 KB]
  - CSS Asset Bundle (index.css):          42.10 KB             [Max:  60 KB]
===============================================================================
```

---

## 2. Web Vitals & Latency Performance Targets

| Performance Metric | Target Budget | Measured Local Baseline | Verification Strategy |
| :--- | :---: | :---: | :--- |
| **Largest Contentful Paint (LCP)** | <= 2.5s | **0.8s** | Chrome DevTools Lighthouse audit |
| **Interaction to Next Paint (INP)**| <= 200ms | **35ms** | Event listener performance tracking |
| **Cumulative Layout Shift (CLS)**  | <= 0.1 | **0.01** | Static layout height definitions |
| **API Response Latency (GET)**    | <= 50ms | **< 15ms** | Express middleware latency timer |
| **API Response Latency (POST)**   | <= 100ms | **< 28ms** | Transactional MongoDB write timer |
| **Database Index Coverage**       | 100% | **Active** | Compound indexes on `organisationId + cafeId` |
| **List API Pagination Cap**       | 50–200 items | **50 items** | Hard limit in `queryService.js` |
