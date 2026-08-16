# ZAMORIN CAFE ERP — EMAIL EVENT MATRIX
**Document ID**: `ZAM-GOV-EVENT-MATRIX-003`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`

---

## Complete Event Matrix

| Event Code | Module | Trigger | Severity | Priority | Sender | Recipient Resolver | PM Escalation | Auto/Draft | Channels | SLA |
|---|---|---|---|---|---|---|---|---|---|---|
| `DEVICE_REVOKED` | SECURITY | Device trust revoked or tampering detected | CRITICAL | CRITICAL | zamorinestatepvtltd.erp@gmail.com | Assigned Cafe Admin + Master | YES (Instant) | AUTO | IN_APP, EMAIL | < 5m |
| `MFA_CHANGE` | AUTH | MFA enabled, disabled, or recovery rotated | HIGH | HIGH | zamorinestatepvtltd.erp@gmail.com | Target User | NO | AUTO | IN_APP, EMAIL | < 15m |
| `PASSWORD_RESET` | AUTH | Password reset link requested | HIGH | HIGH | zamorinestatepvtltd.erp@gmail.com | Target User | NO | AUTO | EMAIL | < 2m |
| `INCIDENT_OPENED` | SYSTEM | High-frequency errors / outage detected | P0 / P1 / P2 | CRITICAL / HIGH | zamorinestatepvtltd.erp@gmail.com | MASTER | YES for P0/P1 | AUTO | IN_APP, EMAIL | <= 5m (P0) |
| `INCIDENT_RECOVERED` | SYSTEM | Incident resolved & verified | INFO | NORMAL | zamorinestatepvtltd.erp@gmail.com | MASTER | YES for P0/P1 | AUTO | IN_APP, EMAIL | Immediate |
| `CAFE_OPENING_READINESS` | OPERATIONS | Pre-opening device & float verification | INFO / WARN | NORMAL | zamorinestatepvtltd.erp@gmail.com | CAFE_ADMIN, MASTER | NO | AUTO | EMAIL | Pre-Open |
| `CAFE_CLOSING_CONTROL` | OPERATIONS | Post-close reconciliation | INFO / WARN | NORMAL | zamorinestatepvtltd.erp@gmail.com | CAFE_ADMIN, MASTER | NO | AUTO | EMAIL | Post-Close |
| `EXECUTIVE_EXCEPTION_DIGEST` | EXECUTIVE | Daily control exceptions summary | INFO / WARN | NORMAL / HIGH | zamorinestatepvtltd.erp@gmail.com | Primary Master (`MU-0001`) | YES | AUTO | EMAIL | Daily 21:00 |
| `RFQ_DISPATCH` | PROCUREMENT | RFQ-XXXX created for tender | NOTICE | NORMAL | zamorinestatepvtltd.erp@gmail.com | Approved Vendors | NO | AUTO | EMAIL | Target Date |
| `INVOICE_INTAKE` | PROCUREMENT | Inbound tax invoice received | NOTICE | NORMAL | zamorinestatepvtltd.erp@gmail.com | Accounts, Master | NO | DRAFT_FIRST | IN_APP, EMAIL | 24h |
| `BEC_ALERT` | SECURITY | Bank / IFSC change attempt detected | CRITICAL | CRITICAL | zamorinestatepvtltd.erp@gmail.com | Primary Master (`MU-0001`) | YES | AUTO | IN_APP, EMAIL | < 5m |
| `SUPPORT_CASE_CREATED` | SUPPORT | Inbound UAT / bug report email | NORMAL | NORMAL | zamorinestatepvtltd.erp@gmail.com | Support Assignee, Master | NO | AUTO | IN_APP, EMAIL | 4h |
