# ZAMORIN CAFE ERP — MAILOPS COMMAND CENTRE SPECIFICATION
**Document ID**: `ZAM-SPEC-COMMAND-CENTRE-005`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`

---

## 1. User Interface Specification
The MailOps Command Centre is accessible at `#mailops` for users with `MASTER` role and authorized operators.

### Telemetry Dashboard Tiles:
1. **Provider Health**: Displays live Gmail API connectivity status (`HEALTHY`, `DEGRADED`, `OUTAGE`).
2. **Daily Quota Budget**: Visual gauge showing sent messages today vs 500 daily limit, reserved critical margins, and migration warning status.
3. **Outbound Queue**: Real-time counter of `QUEUED`, `PROCESSING`, `RETRY`, and `FAILED` notification outbox items with one-click manual retry.
4. **Inbound Review & Quarantine**: Count of pending inbound messages, quarantined attachments, and high-risk BEC flags.

### Real-Time Queues:
- **Outbound Notification Outbox Stream**: Shows recipient, event type, attempt count, last safe error code, and retry buttons.
- **Inbound Review & Quarantine Stream**: Displays sender, subject, risk score, quarantine reasons, and BEC warnings.
