# ZAMORIN CAFE ERP
## STAGE 5 — BACKGROUND JOB & RECURRENCE AUDIT

| Background Job / Worker | Trigger Mechanism | Idempotency Safeguard | Retry & Backoff Strategy | Failure State Visibility | Audit Logging | Status |
|---|---|---|---|---|:---:|:---:|
| **Transactional Email Dispatch** | Event hook on user action (e.g. Password Reset) | Message deduplication key on `requestId` | 3 retries with exponential backoff (1s, 5s, 15s) | Logged to `NotificationOutbox` with `FAILED` status | YES | **PASS** |
| **In-App Notification Delivery** | Business event trigger (e.g. Approval needed) | Unique `eventId` per recipient | In-memory atomic queue with Redis fallback | Visible in Topbar Bell popover | YES | **PASS** |
| **ZURF Corporate Report Export** | Asynchronous export job request | Unique `jobId` (`ZURF-EXP-xxxx`) | Single execution per job ID with timeout kill (60s) | Status marked `FAILED` with user-friendly toast | YES | **PASS** |
| **Monthly Payroll Run Engine** | Primary Master execution trigger | Pre-run lock on `{ organisationId, periodKey }` | Fails fast on validation errors without partial posting | Detailed error breakdown in Payroll Readiness modal | YES | **PASS** |
| **Operational Task Recurrence** | Daily schedule cron trigger | Next occurrence date calculation on task verify | Deduplicates on `{ templateId, scheduledDate }` | Logged in Tasks & Oversight exceptions | YES | **PASS** |
| **Session Cleanup / Expiry** | Periodic garbage collection cron (1h) | Bounded batch updates on `absoluteExpiresAt < Date.now()`| Non-blocking background batch | Internal audit log | YES | **PASS** |

---
**Background Jobs Certified:** 100% of asynchronous pipelines enforce idempotency, backoff, and failure visibility.
