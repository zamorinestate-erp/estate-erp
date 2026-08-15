# ZAMORIN CAFE ERP — PILOT / UAT EXECUTION & CONTROL REPORT

**DOCUMENT CLASSIFICATION**: CONTROLLED PILOT / USER ACCEPTANCE TESTING OPERATIONAL PLAN  
**CURRENT STATUS**: **PRODUCTION DEPLOYED — PILOT/UAT READY (PREPARATION COMPLETE)**  
**TARGET PILOT BRANCH**: `ZC-0001` (Flagship Beach Road Cafe)  
**RELEASE CANDIDATE**: `v1.2.0-ht20-release-candidate` (`2185069`)  
**DATE**: 2026-08-15  

---

## 1. Controlled Human Pilot Group

To ensure zero operational risk, the pilot will commence with a tightly scoped, authorized real-user cohort:

| Pilot User Persona | Target User ID | Canonical Application Role | Cafe Scope | Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Master / Founder** | `MU-0001` | `MASTER` | Organisation-Wide | Overall governance, Personal Ledger audit, Expense approvals |
| **Managing Owner** | `OW-0001` | `OWNER` | Organisation-Wide | Strategic dashboards, P&L review, Personal Ledger denial validation |
| **Cafe General Manager** | `AD-0001` | `CAFE_ADMIN` | `ZC-0001` | Shift scheduling, inventory intake, daily cash reconciliation, expense logging |
| **Head Cashier** | `AD-0002` | `CAFE_ADMIN` | `ZC-0001` | POS counter billing, receipt printing, payment processing |
| **Lead Barista** | `ST-0101` | `STAFF` | `ZC-0001` | Shift check-in/out, personal profile, salary advance request |
| **Service Staff** | `ST-0102` | `STAFF` | `ZC-0001` | Shift check-in/out, mobile PWA usage |

---

## 2. Role-by-Role Human UAT Execution Checklists

### 2.1 MASTER Role UAT Checklist
- [ ] **1. Authentication**: Login via web portal, complete TOTP MFA challenge, verify session issuance.
- [ ] **2. Global Governance Dashboard**: View multi-cafe overview, active counters, and real-time staff counts.
- [ ] **3. Personal Ledger Audit**: Access `/api/v1/personal-ledger/my-balance`, verify ledger balance and transaction ledger.
- [ ] **4. Expense Decisioning**: Review submitted cafe expenses, approve/reject with reason, check ledger adjustment.
- [ ] **5. Overtime Decisions**: Review overtime requests submitted by Cafe Admin, execute final approval.
- [ ] **6. Executive Reports**: Generate consolidated revenue, attendance, and expense reports across cafes.
- [ ] **7. User Administration**: Verify role impact preview (`/:userId/role-impact`), update cafe assignment safely.
- [ ] **8. Secure Logout**: Terminate session, confirm token revocation in database.

### 2.2 OWNER Role UAT Checklist
- [ ] **1. Authentication**: Login with credentials, verify active session.
- [ ] **2. Strategic Dashboard**: Review high-level sales trends, gross profit margins, and labor cost ratios.
- [ ] **3. Personal Ledger Denial**: Attempt accessing Personal Ledger -> Verify hard 403 Forbidden rejection.
- [ ] **4. Operational Restriction**: Verify inability to mutate operational stock movements or staff punch records.
- [ ] **5. Executive Report Export**: Export monthly financial and tax summary reports.
- [ ] **6. Secure Logout**: Terminate session.

### 2.3 CAFE_ADMIN Role UAT Checklist
- [ ] **1. Authentication**: Login via desktop POS and mobile browser.
- [ ] **2. Assigned Cafe Operations**: Verify access to `ZC-0001` data; verify access to other cafes is blocked (403).
- [ ] **3. POS Billing & Receipting**: Place dine-in and takeaway orders, calculate 5% GST, complete cash transactions.
- [ ] **4. Cash Drawer Reconciliation**: Perform shift closing count, reconcile Bills vs CashBook (₹0.00 variance).
- [ ] **5. Expense Submission**: Submit petty cash expense with vendor receipt, verify status `SUBMITTED`.
- [ ] **6. Inventory Stock Intake**: Record batch intake of coffee beans and dairy (`/api/v1/inventory/stock/movement`).
- [ ] **7. Shift Attendance Audit**: Monitor live staff clock-ins and clock-outs.
- [ ] **8. Secure Logout**: End cashier session.

### 2.4 STAFF Role UAT Checklist
- [ ] **1. Mobile PWA Authentication**: Login from mobile phone / PWA client.
- [ ] **2. Shift Attendance Clock-In**: Perform shift check-in; verify timestamp and geo-location match.
- [ ] **3. Duplicate Punch Guard**: Attempt second clock-in -> Verify 409 Conflict rejection.
- [ ] **4. My Profile & Pay Details**: View own employee profile and salary slip.
- [ ] **5. Salary Advance Request**: Submit salary advance request for ₹5,000; verify pending status.
- [ ] **6. Other-User & ERP Isolation**: Attempt accessing other staff records or POS billing -> Verify 403 rejection.
- [ ] **7. Shift Attendance Clock-Out**: Perform shift check-out at end of shift; verify duration calculation.
- [ ] **8. Secure Logout**: Logout from mobile device.

---

## 3. Mobile, PWA & Network Transition Pilot Procedures

1. **Mobile Browser & PWA Installation**:
   - Install Zamorin Cafe PWA to Android and iOS home screens.
   - Verify splash screen, theme color (`#0f172a`), offline service worker cache.
2. **Network Resilience Validation**:
   - Clock in on local Cafe Wi-Fi.
   - Transition to Cellular 4G/5G mobile data during session.
   - Verify uninterrupted session token renewal without session invalidation.
3. **23 Language & Urdu RTL Testing**:
   - Switch language to Malayalam (`ml`), Hindi (`hi`), Tamil (`ta`), Bengali (`bn`).
   - Switch language to Urdu (`ur`) -> Verify full right-to-left layout mirroring (`dir="rtl"`).

---

## 4. Daily Operational Reconciliation Protocol

At the end of each pilot operating day:

$$\text{Reconciliation Variance} = \sum \text{Paid POS Bills} - \sum \text{Confirmed Cash Book Transactions} = ₹0.00$$

$$\text{Attendance Discrepancies} = \text{Missing Punches} + \text{Unmatched Clock-Outs} = 0$$

$$\text{Cross-Role / Cross-Cafe Security Leaks} = 0$$

---

## 5. Formal Pilot Sign-Off Criteria (Gate to Full Go-Live)

- [ ] All 14 workflow areas completed by human pilot users.
- [ ] P0 Defects = **0**, P1 Defects = **0**.
- [ ] Daily financial reconciliation variance = **₹0.00**.
- [ ] Zero unhandled application exceptions or data corruptions.
- [ ] Backup verified on MongoDB Atlas.
- [ ] Business Owner & Founder sign-off obtained.
