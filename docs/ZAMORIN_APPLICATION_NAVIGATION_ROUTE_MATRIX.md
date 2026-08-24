# ZAMORIN CAFE ERP
## APPLICATION-WIDE NAVIGATION & ROUTE MATRIX

---

### Profile 1: PRIMARY MASTER (`role = MASTER`, `isPrimaryMaster = true`)

| # | Group | Menu Label | Expected Route | Screen Marker / Root Heading | Component | Visible? | Accessible? | Status |
| :- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| 1 | COMMAND | Command Centre | `dashboard` | Global Command Centre | `renderMasterDashboard` | YES | YES | **PASS** |
| 2 | OPERATIONS | POS & Billing | `pos` | Point of Sale Terminal | `renderPOS` | YES | YES | **PASS** |
| 3 | OPERATIONS | Attendance & Shifts | `attendance` | Attendance & Shifts Nerve Centre | `renderAttendance` | YES | YES | **PASS** |
| 4 | OPERATIONS | Department Orders | `dept-orders` | Department Orders Control Centre | `renderDepartmentOrders` | YES | YES | **PASS** |
| 5 | OPERATIONS | Inventory | `inventory` | Inventory & Stock Control Centre | `renderInventory` | YES | YES | **PASS** |
| 6 | OPERATIONS | Procurement | `procurement` | Procurement Control Centre | `renderProcurement` | YES | YES | **PASS** |
| 7 | OPERATIONS | Assets & Maintenance | `assets` | Asset Management & Preventative Maintenance | `renderAssets` | YES | YES | **PASS** |
| 8 | OPERATIONS | Quality & Compliance | `quality` | Quality Control & Compliance Audit Centre | `renderQuality` | YES | YES | **PASS** |
| 9 | PEOPLE | Employees | `employees` | Employee Directory & Workforce Management | `renderEmployees` | YES | YES | **PASS** |
| 10 | PEOPLE | Payroll & Payslips | `payroll` | Universal Payroll & Compensation Centre | `renderPayrollManagement` | YES | YES | **PASS** |
| 11 | FINANCE | Bills & Receipts | `bills` | Sales Bills & Tax Receipts | `renderOwnerBills` | YES | YES | **PASS** |
| 12 | FINANCE | Expenses | `expenses` | Expenses & Claims Reimbursement | `renderExpenses` | YES | YES | **PASS** |
| 13 | FINANCE | Finance & Accounts | `finance` | Finance & Accounts (Authoritative GL) | `renderFinance` | YES | YES | **PASS** |
| 14 | FINANCE | Personal Ledger & Owner Account | `ledger` | Personal Ledger & Owner Account | `renderLedger` | YES | YES | **PASS** |
| 15 | COMMERCIAL | Customers & Loyalty | `customers` | CRM, Customer Profiles & Loyalty | `renderCustomers` | YES | YES | **PASS** |
| 16 | COMMERCIAL | Menu Management | `menu` | Menu Management Control Centre | `renderMenuManagement` | YES | YES | **PASS** |
| 17 | COMMERCIAL | Vendors | `vendors` | Supplier & Vendor Control Centre | `renderVendors` | YES | YES | **PASS** |
| 18 | COMMERCIAL | Revenue Share & Outlets | `revenue-share` | Revenue Share & Leased Outlets | `renderRevenueShare` | YES | YES | **PASS** |
| 19 | INSIGHTS | Reports & Analytics | `reports` | Reports & Analytics Control Centre | `renderReports` | YES | YES | **PASS** |
| 20 | ADMINISTRATION | Administration | `admin` | Administration & Governance Work Queue | `renderAdmin` | YES | YES | **PASS** |
| 21 | ADMINISTRATION | MailOps Command Centre | `mailops` | MailOps Command Centre | `renderMailOpsCommandCentre` | YES | YES | **PASS** |
| 22 | SYSTEM | Settings | `settings` | Settings, Account & Preferences | `renderSettingsShared` | YES | YES | **PASS** |

---

### Profile 2: NORMAL MASTER (`role = MASTER`, `isPrimaryMaster = false`)

| # | Group | Menu Label | Expected Route | Screen Marker / Root Heading | Component | Visible? | Accessible? | Status |
| :- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| 1 | COMMAND | Command Centre | `dashboard` | Global Command Centre | `renderMasterDashboard` | YES | YES | **PASS** |
| 2 | OPERATIONS | POS & Billing | `pos` | Point of Sale Terminal | `renderPOS` | YES | YES | **PASS** |
| 3 | OPERATIONS | Attendance & Shifts | `attendance` | Attendance & Shifts Nerve Centre | `renderAttendance` | YES | YES | **PASS** |
| 4 | OPERATIONS | Department Orders | `dept-orders` | Department Orders Control Centre | `renderDepartmentOrders` | YES | YES | **PASS** |
| 5 | OPERATIONS | Inventory | `inventory` | Inventory & Stock Control Centre | `renderInventory` | YES | YES | **PASS** |
| 6 | OPERATIONS | Procurement | `procurement` | Procurement Control Centre | `renderProcurement` | YES | YES | **PASS** |
| 7 | OPERATIONS | Assets & Maintenance | `assets` | Asset Management & Preventative Maintenance | `renderAssets` | YES | YES | **PASS** |
| 8 | OPERATIONS | Quality & Compliance | `quality` | Quality Control & Compliance Audit Centre | `renderQuality` | YES | YES | **PASS** |
| 9 | PEOPLE | Employees | `employees` | Employee Directory & Workforce Management | `renderEmployees` | YES | YES | **PASS** |
| 10 | PEOPLE | *Payroll & Payslips* | `payroll` | *OMITTED FOR NORMAL MASTER* | — | **NO** | **DENIED** | **PASS** |
| 11 | FINANCE | Bills & Receipts | `bills` | Sales Bills & Tax Receipts | `renderOwnerBills` | YES | YES | **PASS** |
| 12 | FINANCE | Expenses | `expenses` | Expenses & Claims Reimbursement | `renderExpenses` | YES | YES | **PASS** |
| 13 | FINANCE | Finance & Accounts | `finance` | Finance & Accounts (Authoritative GL) | `renderFinance` | YES | YES | **PASS** |
| 14 | FINANCE | *Personal Ledger* | `ledger` | *OMITTED FOR NORMAL MASTER* | — | **NO** | **DENIED** | **PASS** |
| 15 | COMMERCIAL | Customers & Loyalty | `customers` | CRM, Customer Profiles & Loyalty | `renderCustomers` | YES | YES | **PASS** |
| 16 | COMMERCIAL | Menu Management | `menu` | Menu Management Control Centre | `renderMenuManagement` | YES | YES | **PASS** |
| 17 | COMMERCIAL | Vendors | `vendors` | Supplier & Vendor Control Centre | `renderVendors` | YES | YES | **PASS** |
| 18 | COMMERCIAL | *Revenue Share* | `revenue-share` | *OMITTED FOR NORMAL MASTER* | — | **NO** | **DENIED** | **PASS** |
| 19 | INSIGHTS | Reports & Analytics | `reports` | Reports & Analytics Control Centre | `renderReports` | YES | YES | **PASS** |
| 20 | ADMINISTRATION | Administration | `admin` | Administration & Governance | `renderAdmin` | YES | YES | **PASS** |
| 21 | ADMINISTRATION | MailOps Command Centre | `mailops` | MailOps Command Centre | `renderMailOpsCommandCentre` | YES | YES | **PASS** |
| 22 | SYSTEM | Settings | `settings` | Settings, Account & Preferences | `renderSettingsShared` | YES | YES | **PASS** |

---

### Profile 3: OWNER (`role = OWNER`)

| # | Group | Menu Label | Expected Route | Screen Marker / Root Heading | Component | Visible? | Accessible? | Status |
| :- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| 1 | COMMAND | Overview | `dashboard` | Zamorin Command Centre (OWNER) | `renderOwnerDashboard` | YES | YES | **PASS** |
| 2 | OPERATIONS | Tasks & Oversight | `approvals` | Operational Task Oversight (OWNER) | `renderTasks` | YES | YES | **PASS** |
| 3 | FINANCE | Bills & Receipts | `bills` | Sales Bills & Tax Receipts (OWNER PORTAL) | `renderOwnerBills` | YES | YES | **PASS** |
| 4 | INSIGHTS | Café Performance | `performance` | Multi-Café Performance Analytics | `renderPerformance` | YES | YES | **PASS** |
| 5 | PEOPLE | Employees | `employees` | Employee Directory (Read Overview) | `renderEmployees` | YES | YES | **PASS** |
| 6 | FINANCE | Finance Summary | `finance` | Finance & Accounts (OWNER GOVERNANCE) | `renderFinance` | YES | YES | **PASS** |
| 7 | FINANCE | Personal Ledger & Owner Account | `ledger` | Personal Ledger & Owner Account | `renderLedger` | YES | YES | **PASS** |
| 8 | PEOPLE | Payroll & Payslips | `payroll` | Payroll & Compensation (Governance View) | `renderPayrollManagement` | YES | YES | **PASS** |
| 9 | COMMERCIAL | Revenue Share & Outlets | `revenue-share` | Revenue Share & Leased Outlets | `renderRevenueShare` | YES | YES | **PASS** |
| 10 | INSIGHTS | Reports | `reports` | Strategic & Executive Reports | `renderReports` | YES | YES | **PASS** |
| 11 | SYSTEM | Settings | `settings` | Settings, Account & Preferences | `renderSettingsShared` | YES | YES | **PASS** |

---

### Profile 4: CAFE ADMIN (`role = CAFE_ADMIN`)

| # | Group | Menu Label | Expected Route | Screen Marker / Root Heading | Component | Visible? | Accessible? | Status |
| :- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| 1 | COMMAND | Command Centre | `dashboard` | Café Admin Command Centre | `renderAdminDashboard` | YES | YES | **PASS** |
| 2 | OPERATIONS | POS & Billing | `pos` | Point of Sale Terminal | `renderPOS` | YES | YES | **PASS** |
| 3 | OPERATIONS | Attendance & Shifts | `attendance` | Attendance & Shift Roster | `renderAttendance` | YES | YES | **PASS** |
| 4 | OPERATIONS | Department Orders | `dept-orders` | Department Orders Control Centre | `renderDepartmentOrders` | YES | YES | **PASS** |
| 5 | OPERATIONS | Inventory | `inventory` | Inventory & Stock Movements | `renderInventory` | YES | YES | **PASS** |
| 6 | OPERATIONS | Procurement | `procurement` | Procurement Receipts & POs | `renderProcurement` | YES | YES | **PASS** |
| 7 | OPERATIONS | Assets & Maintenance | `assets` | Asset Management & Tickets | `renderAssets` | YES | YES | **PASS** |
| 8 | OPERATIONS | Quality & Compliance | `quality` | Quality Checklists & Audits | `renderQuality` | YES | YES | **PASS** |
| 9 | FINANCE | Expenses | `expenses` | Expense Claims & Reimbursements | `renderExpenses` | YES | YES | **PASS** |
| 10 | FINANCE | Sales & Cash | `sales-cash` | Cash Book & Till Reconciliation | `renderCashBook` | YES | YES | **PASS** |
| 11 | COMMERCIAL | Customers & Loyalty | `customers` | Customer Directory & Loyalty | `renderCustomers` | YES | YES | **PASS** |
| 12 | INSIGHTS | Reports (this café) | `reports` | Single-Café Reports | `renderReports` | YES | YES | **PASS** |
| 13 | INSIGHTS | Tasks & Approvals | `tasks` | Assigned Tasks & Queue | `renderTasks` | YES | YES | **PASS** |
| 14 | SYSTEM | Settings | `settings` | User Account & Preferences | `renderSettingsShared` | YES | YES | **PASS** |
| — | *FINANCE* | *Personal Ledger* | `ledger` | *OMITTED FOR CAFE ADMIN* | — | **NO** | **DENIED** | **PASS** |

---

### Profile 5: STAFF / EMPLOYEE (`role = STAFF`)

| # | Group | Menu Label | Expected Route | Screen Marker / Root Heading | Component | Visible? | Accessible? | Status |
| :- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| 1 | COMMAND | Home | `staff-home` | Staff Self-Service Home | `renderStaffHome` | YES | YES | **PASS** |
| 2 | COMMAND | Announcements | `announcements` | Staff Announcements & Notices | `renderAnnouncements` | YES | YES | **PASS** |
| 3 | SELF | My Attendance | `staff-attendance` | My Shifts & Attendance Punch Ledger | `renderStaffAttendance` | YES | YES | **PASS** |
| 4 | SELF | My Leave | `staff-leave` | Leave Requests & Balances | `renderStaffLeave` | YES | YES | **PASS** |
| 5 | SYSTEM | Settings | `staff-settings` | Profile & My Employment (Payslips/Loans) | `renderStaffSettings` | YES | YES | **PASS** |
| — | *FINANCE* | *Personal Ledger* | `ledger` | *OMITTED FOR STAFF* | — | **NO** | **DENIED** | **PASS** |
| — | *ADMIN* | *Administration* | `admin` | *OMITTED FOR STAFF* | — | **NO** | **DENIED** | **PASS** |
