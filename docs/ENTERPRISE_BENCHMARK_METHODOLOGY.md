# ZAMORIN CAFÉ ERP — ENTERPRISE BENCHMARK METHODOLOGY

> **Standard**: Deterministic Data Generation, Repeatable Load Vectors & Negative Controls  
> **Confidence Status**: **VERIFIED_LOCAL**  

---

## 1. Deterministic Seeding Pipeline (`scripts/generate_scalability_fixture.mjs`)

- **Café Outlets**: 1,000 outlets deterministically distributed across 10 major Indian cities and 5 outlet archetypes (Flagship, Standard, Express, Kiosk, Drive-thru).
- **Workforce Directory**: 50,000 employee records deterministically seeded with realistic names, permanent employee IDs (`EMP-00001` through `EMP-50000`), role distribution (5 Master, 45 Owner, 1,000 Cafe Admins, 48,950 Staff).
- **Device Fleet**: 100,000 device records categorized across POS terminals, KDS screens, attendance kiosks, manager tablets, and staff smartphones.
- **80/20 Hotspot Modeling**: 20% Flagship cafés generate 80% of transaction load.

---

## 2. Safety Guards & Execution Controls

To guarantee that scalability fixtures cannot accidentally corrupt production databases:
1. `ALLOW_SCALABILITY_FIXTURE=true` or `NODE_ENV=test` environment flag is strictly required.
2. The generator inspects `MONGODB_URI` and throws an immediate fatal error if URI contains `production` or `prod-live` without explicit `test`/`fixture` tags.

---

## 3. Negative Controls

Every scalability test suite incorporates a negative control (e.g. injecting missing indexes, un-coalesced raw writes, or intentional permission leaks) to prove that the test harness actively catches failures rather than giving false positives.
