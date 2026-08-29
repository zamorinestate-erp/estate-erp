# ZAMORIN CAFÉ ERP — AUTHENTICATION & KDF SCALE ARCHITECTURE

> **Standard**: Memory-Hard Scrypt Protection with Bounded Concurrency & Queue Backpressure  
> **Confidence Status**: **VERIFIED_LOCAL & ARCHITECTURAL_TARGET**  

---

## 1. The Password KDF Concurrency Bottleneck

Zamorin Café ERP utilizes canonical memory-hard scrypt ($N=32768, r=8, p=1$, maxmem 64MB) to protect credentials against GPU dictionary cracking.

Under a burst login storm (e.g. 500 simultaneous logins at 08:30 IST):
- 500 concurrent scrypt operations would consume $500 \times 64\text{ MB} = 32\text{ GB RAM}$ and saturate all CPU threads, starving the Node event loop and causing HTTP request timeouts.

---

## 2. Bounded Concurrency Worker Pool (`src/services/authConcurrencyService.js`)

```
Login Requests (Burst) ───► [ FIFO Bounded Queue (Max Depth: 500) ]
                                            │
                                (Workers Available <= CPU Cores?)
                                            ▼
                           [ Bounded KDF Workers (2-8 Parallel) ]
                                            │
                                            ▼
                               [ scryptAsync Derivation ]
                                            │
                                            ▼
                              [ Constant-Time Safe Equal ]
```

### Backpressure Guarantees
- If queue depth reaches `maxQueueDepth` (500), requests are rejected immediately with `HTTP 429` (`AUTH_KDF_QUEUE_SATURATED`), protecting server health.
- If a request sits in the queue longer than `timeoutMs` (15s), it is rejected with `HTTP 504`.
- Device reconnects and API token validations **bypass password KDF entirely** using constant-time hash lookups.
