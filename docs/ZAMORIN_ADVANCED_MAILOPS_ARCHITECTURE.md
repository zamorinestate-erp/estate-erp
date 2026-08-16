# ZAMORIN CAFE ERP — ADVANCED MAILOPS ARCHITECTURE
**Document ID**: `ZAM-ARCH-MAILOPS-002`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`

---

## 1. Overview
The MailOps Command Centre transforms the operations mailbox into an automated communications nerve centre for system monitoring, vendor interactions, support triage, and incident lifecycle management.

## 2. Functional Domains
1. **Outbound Operations**:
   - System alert broadcasts (`[ZAMORIN][SECURITY][CRITICAL]`, `[ZAMORIN][SYSTEM]`)
   - Cafe Opening Readiness & Closing Control digests
   - Executive Exception reports to Primary Master (`MU-0001`)
   - Vendor RFQ dispatches & Purchase Order transmissions
2. **Inbound Automation**:
   - Real-time ingestion via Gmail API Watch & Pub/Sub webhook
   - History reconciliation fallback (`lastHistoryId`) to catch delayed events
   - Automatic classification across 17 standard operational categories
   - Business Email Compromise (BEC) defense (bank/IFSC updates flagged `CRITICAL`)
   - Unknown sender quarantine & risk scoring (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
   - Attachment Security Gateway (extension blocking, SHA-256 deduplication)
   - Inbound email threading to `SupportCase` objects
3. **Observability & Quota Governance**:
   - MailOps Command Centre UI at `/mailops`
   - Quota budget monitoring (500 daily limit management with critical reservations)
   - Provider migration warning automation (`SAFE`, `APPROACHING_LIMIT`, `MIGRATION_RECOMMENDED`, `MIGRATION_REQUIRED`)
