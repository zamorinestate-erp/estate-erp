# ZAMORIN CAFE ERP — INCIDENT EMAIL AUTOMATION & ALERT GROUPING
**Document ID**: `ZAM-SPEC-INCIDENT-006`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`

---

## 1. Smart Alert Grouping Engine
To prevent email flooding during cascading outages (e.g. 500 database reconnection errors), the `IncidentService` aggregates repeated occurrences under a common `deduplicationKey`.

### Aggregation Mechanism:
- **First Error**: Generates `INC-YYYYMMDD-XXXX`, sets status to `OPEN`, and dispatches initial `[ZAMORIN][SYSTEM][P0/P1]` alert.
- **Subsequent Errors**: Increments `eventCount` on existing active Incident, updates `lastEventAt`, and suppresses duplicate emails within suppression window.
- **State Change / Major Escalation**: Dispatches update if severity or affected services escalate.
- **Resolution**: Generates draft postmortem and sends `[ZAMORIN][SYSTEM][RECOVERED]` verification email.

## 2. SLA Timers & Escalation Targets
- **P0**: Acknowledge within 5 minutes → Escalates to Primary Master (`MU-0001` / `pradeeshk331@gmail.com`).
- **P1**: Acknowledge within 15 minutes.
- **P2**: Review within 4 hours.
- **P3**: Scheduled operational review.
