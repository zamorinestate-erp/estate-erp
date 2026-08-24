# ZAMORIN CAFE ERP
## STAGE 4 — ROW ACTION MATRIX

Audit of all table and list row actions across the 18 Control Centres and dedicated subpages.

| Module / Hub | Subpage / Table | Row Action Button | Handler / Trigger | Authorization Check | Confirmation Required | Post-Action Refresh | Status |
|---|---|---|---|:---:|:---:|:---:|:---:|
| **Assets** | Equipment Register | View Details | `openAssetDetailModal` | Org Scope | NO | Modal Open | **PASS** |
| Assets | Equipment Register | Create Work Order | `openCreateWorkOrderModal` | Cafe Scope | NO | Modal Open | **PASS** |
| Assets | Work Orders | Mark In-Progress / Close | `apiPatch('/api/v1/assets/work-orders/:id')` | Cafe Scope | YES | Live Refetch | **PASS** |
| **Inventory** | Stock Register | View SKU Detail | `openSkuDetailModal` | Cafe Scope | NO | Modal Open | **PASS** |
| Inventory | Stock Movements | View Audit Trail | `openMovementAuditModal` | Cafe Scope | NO | Modal Open | **PASS** |
| **Customers** | Customer Directory | Customer 360° | `openCustomer360Modal` | Org Scope | NO | Modal Open | **PASS** |
| Customers | Customer Directory | Adjust Pts | `openAdjustPointsModal` | Master / Owner | YES | Live Refetch | **PASS** |
| **Suppliers** | Supplier Directory | Supplier 360° | `openSupplier360Modal` | Org Scope | NO | Modal Open | **PASS** |
| Suppliers | Supplier Holds | Release Hold | `openReleaseHoldModal` | Master Only | YES (Reason required) | Live Refetch | **PASS** |
| **Revenue Share** | Commercial Spaces | View Occupancy | `openSpaceDetailModal` | Org Scope | NO | Modal Open | **PASS** |
| Revenue Share | Settlements | Review Calculation | `openSettlementReviewModal`| Master / Owner | NO | Modal Open | **PASS** |
| **Administration**| Café Master | View Café Profile | `openCafeDetailModal` | Org Scope | NO | Modal Open | **PASS** |
| Administration | Café Master | Edit Details | `openEditCafeModal` | Master Only | YES | Live Refetch | **PASS** |
| **Devices** | Sessions Log | Terminate Session | `apiDelete('/api/v1/settings/sessions/:id')`| Self / Admin | YES | Live Refetch | **PASS** |
| **Expenses** | Expense Vouchers | Approve / Reject | `openExpenseDecisionModal` | Role Policy | YES | Live Refetch | **PASS** |
| **Bills** | Bill Register | View Tax Receipt | `openBillReceiptModal` | Cafe Scope | NO | Modal Open | **PASS** |
| Bills | Bill Register | Process Refund / Void | `openBillVoidModal` | Cafe Scope | YES (Audited) | Live Refetch | **PASS** |
| **Tasks** | Tasks & Oversight | Decision / Verify | `openTaskVerificationModal`| Role Policy | YES | Live Refetch | **PASS** |

---
**Row Actions Certified:** Zero handler-less row actions. 100% of interactive row triggers invoke authoritative modals or audited mutations.
