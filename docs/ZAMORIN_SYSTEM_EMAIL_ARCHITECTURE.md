# ZAMORIN CAFE ERP — SYSTEM EMAIL ARCHITECTURE
**Document ID**: `ZAM-ARCH-EMAIL-001`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`  
**Operations Mailbox**: `zamorinestatepvtltd.erp@gmail.com`  
**Primary Master Contact**: `pradeeshk331@gmail.com` (`MU-0001`)

---

## 1. Executive Summary & Identity Separation
The Zamorin Cafe ERP system utilizes `zamorinestatepvtltd.erp@gmail.com` as its machine-connected System & Operations Communication Hub.

### Fundamental Identity Rules:
1. **Primary Master Human Identity**: `MU-0001` (`pradeeshk331@gmail.com`, `isPrimaryMaster: true`, role: `MASTER`).
2. **Operations Communication Identity**: `zamorinestatepvtltd.erp@gmail.com` (`identityType: 'SYSTEM_OPERATIONS_MAILBOX'`, `applicationRole: 'NONE'`, `canLoginToERP: false`).
3. **No Fake User Record**: The mailbox is configured in `SystemCommunicationSettings` and is never represented as a user in the `User` collection.
4. **Strictly 4 ERP Roles**: `MASTER`, `OWNER`, `CAFE_ADMIN`, `STAFF`.

---

## 2. Notification Pipeline Architecture
```
BUSINESS EVENT
      ↓
NotificationService (publishNotification)
      ↓
Server-Side Recipient Resolver (Scoping & Isolation)
      ↓
Channel Policy & Multilingual Template Engine (23 Languages)
      ↓
Durable Notification Outbox (State: QUEUED → PROCESSING → SENT/RETRY/FAILED)
      ↓
Email Provider Adapter (GmailEmailProvider / ConsoleTestEmailProvider)
      ↓
Delivery Audit & Fingerprint Logging
```

---

## 3. Resilience & Failure Isolation
Under no circumstances shall a transient or permanent outage of the external email provider (Gmail API / Google Cloud) prevent or delay core business transactions:
- **POS Billing & Orders**: Pass
- **Staff Attendance & Shifts**: Pass
- **Expense Submissions**: Pass
- **Inventory & Stock Movements**: Pass
- **Payroll Calculations & Runs**: Pass
- **Device Authorizations**: Pass

When delivery fails, the outbox record enters exponential backoff with jitter and retry scheduling without raising unhandled errors to calling controllers.
