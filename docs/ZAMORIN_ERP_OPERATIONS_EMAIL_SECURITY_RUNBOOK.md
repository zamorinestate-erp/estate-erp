# ZAMORIN CAFE ERP — OPERATIONS EMAIL SECURITY RUNBOOK
**Document ID**: `ZAM-RUN-SECURITY-010`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`

---

## 1. Zero Personal Use Enforcement
The mailbox `zamorinestatepvtltd.erp@gmail.com` is strictly an automated business communication instrument.
- **Forbidden**: Personal shopping, banking, subscriptions, streaming, social media, personal photos, personal letters.
- **Allowed**: Automated ERP alerts, system digests, vendor quotes, UAT bug reports, machine health status.

## 2. Forbidden Business Actions via Email
No financial or authoritative action may be executed by email reply:
- `"APPROVE"` in email does NOT approve expenses.
- `"PAY"` in email does NOT execute payouts.
- Inbound invoices do NOT generate payable disbursements without authenticated ERP review.
- Email replies cannot modify Personal Ledger, payroll, user roles, or device trust.
- All executive decisions require authenticated ERP login by MASTER.
