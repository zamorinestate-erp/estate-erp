# ZAMORIN CAFE ERP
## STAGE 5 — BACKGROUND JOB MATRIX (FINAL)

Inventory of all asynchronous background operations and workers.

| Job Name | Implementation File | Trigger Mechanism | Concurrency Lock | Deduplication Key | Retry Strategy | Failure Visibility | Status |
|---|---|---|---|---|---|---|:---:|
| **Transactional Mail Dispatch** | `backend/src/services/mailService.js` | Business event hook (e.g. Password reset) | In-memory atomic queue | `requestId` / `token` | 3 retries (1s, 5s, 15s) | Logged to `NotificationOutbox` | **PASS (ALREADY PRESENT)** |
| **In-App Notification Dispatch** | `backend/src/services/notificationService.js` | Workflow event trigger (e.g. Approval) | Memory mutex | Unique `eventId` | Atomic push | Visible in Topbar Bell | **PASS (ALREADY PRESENT)** |
| **ZURF Corporate Report Generator** | `backend/src/services/zurfService.js` | User export request | Single job lock | `jobId` (`ZURF-EXP-xxxx`) | Fails fast with 60s timeout | Error toast + Audit log | **PASS (ALREADY PRESENT)** |
| **Monthly Payroll Calculation** | `backend/src/controllers/payrollController.js` | Primary Master action | Period execution lock | `{ organisationId, periodKey }` | Fails fast on validation error | Detailed error modal | **PASS (ALREADY PRESENT)** |
| **Operational Task Recurrence** | `backend/src/controllers/taskController.js` | Task verification event | Next date calculation | `{ templateId, scheduledDate }` | Single generation per cycle | Logged in Tasks table | **PASS (ALREADY PRESENT)** |
| **Session Garbage Collection** | `backend/src/models/Session.js` | Scheduled maintenance | Query limit lock | Bounded timestamp query | Non-blocking batch update | Internal log | **PASS (ALREADY PRESENT)** |

---
**Background Job Audit Certified:** All 6 background pipelines enforce concurrency safety and failure visibility.
