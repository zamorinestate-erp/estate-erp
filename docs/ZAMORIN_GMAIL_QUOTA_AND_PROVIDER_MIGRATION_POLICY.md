# ZAMORIN CAFE ERP — GMAIL QUOTA & PROVIDER MIGRATION POLICY
**Document ID**: `ZAM-POL-QUOTA-MIGRATION-009`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`

---

## 1. Consumer Pilot Daily Quota Budget
Consumer Google accounts (`@gmail.com`) have a standard sending limit of 500 recipients per rolling 24-hour window.

### Quota Allocation:
- **Total Limit**: 500 emails/day
- **Reserved Critical**: 100 emails (strictly for P0/P1 incidents and security alerts)
- **Reserved Security**: 100 emails (device revocations, MFA changes, password resets)
- **Normal Operations Budget**: 250 emails (digests, RFQs, invoices, general updates)
- **Optional / Deferred Budget**: 50 emails (low-priority reports)

## 2. Migration Triggers
The Command Centre automatically monitors daily volume and displays provider migration status:
- **SAFE**: < 50% usage
- **APPROACHING_LIMIT**: 50% – 74% usage
- **MIGRATION_RECOMMENDED**: 75% – 89% usage
- **MIGRATION_REQUIRED**: >= 90% usage or > 5 cafes in production fleet

When migration is required, the system transitions to dedicated corporate domains (e.g. `notifications@zamorinestate.com`, `security@zamorinestate.com`) via `TransactionalEmailProvider`.
