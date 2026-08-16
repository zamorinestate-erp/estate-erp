# ZAMORIN CAFE ERP — INBOUND GMAIL PROCESSING ARCHITECTURE
**Document ID**: `ZAM-ARCH-INBOUND-004`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`

---

## 1. Ingestion Pipeline
```
Gmail API Inbound Watch
        ↓
Google Cloud Pub/Sub Push Notification
        ↓
Webhook / History Reconciliation Worker
        ↓
Inbound Deduplication Filter (gmailMessageId & gmailThreadId)
        ↓
Vendor Domain & Sender Registry Verification
        ↓
BEC Defense & Payment Risk Analysis
        ↓
Attachment Security Gateway (MIME, Extension, SHA-256)
        ↓
Automatic Classification (17 Standard Categories)
        ↓
ERP Entity Dispatch (SupportCase, Draft Invoice, Incident, RFQ Reply)
```

## 2. History Reconciliation Fallback
- `lastHistoryId` is persisted in `SystemCommunicationSettings`.
- In case of delayed push notifications or worker downtime, history reconciliation fetches missed messages using `historyId`.
- Inbound idempotency on `gmailMessageId` guarantees exactly-once ERP entity generation.
