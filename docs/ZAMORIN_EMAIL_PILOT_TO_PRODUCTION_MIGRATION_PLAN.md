# ZAMORIN CAFE ERP — PILOT TO PRODUCTION MIGRATION PLAN
**Document ID**: `ZAM-PLAN-MIGRATION-011`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`

---

## 1. Pilot Phase (Current)
- Mailbox: `zamorinestatepvtltd.erp@gmail.com`
- Provider: `GMAIL_API` (OAuth 2.0 with minimal required scopes)
- Sending Limit: 500 emails/day
- Focus: Pilot testing, system notifications, vendor RFQ workflows, UAT issue reporting, and operations health telemetry.

## 2. Production Domain Transition Phase
When authorized, the system seamlessly transitions to corporate domain addresses:
- `notifications@<company-domain>`: System alerts & transactional notices
- `security@<company-domain>`: Device revocations, MFA, security audits
- `support@<company-domain>`: Customer & staff issue triage
- `procurement@<company-domain>`: Vendor RFQs, POs, and invoicing
- `receipts@<company-domain>`: Customer billing receipts

The current mailbox `zamorinestatepvtltd.erp@gmail.com` will be permanently retained as the **Emergency Operations & Disaster Recovery Out-of-Band Channel**.
