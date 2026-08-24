# ZAMORIN CAFE ERP
## STAGE 4 — REAL MASTER ACTION INVENTORY

Audited from actual interactive DOM controls, submit triggers, modal invocations, and API handlers.

| Action ID | Profile(s) | Module | Page | Label | Type | Handler | API Endpoint | Backend Controller | Service / Engine | Model(s) | Permission Scope | Test Coverage | Current Status |
|---|---|---|---|---|:---:|---|---|---|---|---|---|---|:---:|
| ACT-001 | MASTER, OWNER, ADMIN | Assets | `#assets` | `+ Register New Asset` | CREATE | `openRegisterAssetWizard` | `POST /api/v1/assets` | `assetController.createAsset` | — | `Asset`, `SequenceCounter` | Cafe Scope | `assetManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-002 | MASTER, OWNER, ADMIN | Assets | `#assets/maintenance` | `+ Create Work Order` | CREATE | `openCreateWorkOrderModal` | `POST /api/v1/assets/work-orders` | `assetController.createWorkOrder` | — | `WorkOrder` | Cafe Scope | `assetManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-003 | ALL 4 PROFILES | Assets | `#assets/register` | `View Asset Detail` | READ | `openAssetDetailModal` | `GET /api/v1/assets/:id` | `assetController.getAsset` | — | `Asset` | Org Scope | `assetManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-004 | MASTER, ADMIN | Inventory | `#inventory` | `+ Add New Item` | CREATE | `openAddInventoryItemModal` | `POST /api/v1/inventory/items` | `inventoryController.createItem` | — | `GlobalInventoryItem` | Org Scope | `inventoryStockManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-005 | MASTER, ADMIN | Inventory | `#inventory/receive` | `Receive Stock (GRN)` | WORKFLOW | `openStockReceiptModal` | `POST /api/v1/inventory/movements/receive` | `inventoryController.receiveStock` | — | `StockMovement` | Cafe Scope | `inventoryStockManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-006 | MASTER, ADMIN | Inventory | `#inventory/adjust` | `Adjust Stock` | UPDATE | `openStockAdjustmentModal` | `POST /api/v1/inventory/movements/adjust` | `inventoryController.adjustStock` | — | `StockMovement` | Cafe Scope | `inventoryStockManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-007 | ALL 4 PROFILES | Customers | `#customers` | `+ Register New Guest` | CREATE | `openRegisterCustomerModal` | `POST /api/v1/customers` | `customerController.createCustomer` | — | `Customer` | Org Scope | `customerLoyaltyManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-008 | ALL 4 PROFILES | Customers | `#customers/directory` | `Customer 360` | READ | `openCustomer360Modal` | `GET /api/v1/customers/:id` | `customerController.getCustomer` | — | `Customer`, `LoyaltyLedger` | Org Scope | `customerLoyaltyManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-009 | MASTER, OWNER | Customers | `#customers/directory` | `Adjust Pts` | UPDATE | `openAdjustPointsModal` | `POST /api/v1/customers/:id/loyalty/adjust` | `customerController.adjustCustomerPoints` | — | `Customer`, `LoyaltyLedger` | Master / Owner | `customerLoyaltyManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-010 | MASTER | Customers | `#customers/directory` | `Merge Duplicate Profiles` | WORKFLOW | `openMergeModal` | `POST /api/v1/customers/merge` | `customerController.mergeCustomers` | — | `Customer`, `LoyaltyLedger` | Master Only | `customerLoyaltyManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-011 | PRIMARY_MASTER | Menu | `#menu` | `+ Add Menu Item` | CREATE | `openAddMenuItemModal` | `POST /api/v1/menu/items` | `menuController.createMenuItem` | `MenuService` | `MenuItem` | Primary Master | `menuRecipeManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-012 | ALL 4 PROFILES | Menu | `#menu/simulator` | `Simulate POS Cart` | READ | `runCartSimulation` | `POST /api/v1/menu/simulate-order` | `menuController.simulateOrder` | `MenuService` | `MenuItem`, `Recipe` | Org Scope | `menuRecipeManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-013 | MASTER, OWNER | Suppliers | `#suppliers` | `+ Onboard Supplier` | CREATE | `openOnboardSupplierWizard` | `POST /api/v1/vendors` | `vendorController.createVendor` | — | `Vendor` | Master Governance | `vendorLifecycleContract.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-014 | ALL 4 PROFILES | Suppliers | `#suppliers/directory` | `Supplier 360°` | READ | `openSupplier360Modal` | `GET /api/v1/vendors/:id` | `vendorController.getVendor` | — | `Vendor`, `PurchaseOrder` | Org Scope | `vendorLifecycleContract.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-015 | MASTER, OWNER | Suppliers | `#suppliers/holds` | `Place Supplier Hold` | WORKFLOW | `openSupplierHoldModal` | `POST /api/v1/vendors/:id/holds` | `vendorController.placeVendorHold` | — | `Vendor` | Master Governance | `vendorLifecycleContract.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-016 | MASTER, OWNER | Revenue Share | `#revenue-share` | `+ Commercial Space` | CREATE | `openRegisterSpaceModal` | `POST /api/v1/revenue-share/spaces` | `revenueShareController.createSpace` | — | `CommercialSpace` | Master Governance | `revenueShareContract.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-017 | MASTER, OWNER | Revenue Share | `#revenue-share/settlement`| `Generate Draft` | WORKFLOW | `openGenerateSettlementModal`| `POST /api/v1/revenue-share/settlement/draft` | `revenueShareController.generateDraft`| `revenueShareCalculationService` | `RevenueShareSettlement` | Master Governance | `revenueShareContract.test.js` | **BLOCKED_BUSINESS_DECISION** |
| ACT-018 | ALL 4 PROFILES | Revenue Share | `#revenue-share/simulation`| `Run Simulation` | READ | `runRevenueSimulation` | `POST /api/v1/revenue-share/simulate` | `revenueShareController.simulate` | `revenueShareCalculationService` | `CommercialSpace` | Org Scope | `revenueShareContract.test.js` | **BLOCKED_BUSINESS_DECISION** |
| ACT-019 | PRIMARY_MASTER | Administration | `#admin/cafes` | `+ Add New Café` | CREATE | `openAddCafeModal` | `POST /api/v1/admin/cafes` | `adminController.createCafe` | — | `Cafe` | Primary Master | `adminGovernance.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-020 | ALL 4 PROFILES | Administration | `#admin/cafes` | `View Café Detail` | READ | `openCafeDetailModal` | `GET /api/v1/admin/cafes/:id` | `adminController.getCafe` | — | `Cafe` | Org Scope | `adminGovernance.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-021 | MASTER | Devices | `#devices/enroll` | `Enroll Terminal` | CREATE | `openEnrollTerminalModal` | `POST /api/v1/devices/enroll` | `deviceController.enrollDevice` | `deviceTrustService` | `DeviceRegistration` | Master Only | `posBillingTerminal.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-022 | ALL 4 PROFILES | Devices | `#devices/operator-pin` | `Operator PIN Setup` | UPDATE | `openOperatorPinModal` | `POST /api/v1/devices/operator-pin` | `deviceController.setOperatorPin` | — | `User` | Self / Admin | `cafeOperationsFoundation.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-023 | ALL 4 PROFILES | Expenses | `#expenses` | `+ New Expense Voucher`| CREATE | `openNewExpenseVoucherModal`| `POST /api/v1/expenses/vouchers` | `expenseController.createVoucher` | — | `Expense` | Cafe Scope | `expenseManagement.test.js` | **COMPLETE_AND_VERIFIED** |
| ACT-024 | MASTER, OWNER | Finance | `#finance/personal-ledger` | `Settle Balance` | WORKFLOW | `openSettleBalanceModal` | `POST /api/v1/ledger/personal/settle` | `personalLedgerController.settlePersonalLedger`| — | `PersonalLedger` | Owner Scope | `personalLedgerMasterControl.test.js`| **COMPLETE_AND_VERIFIED** |
| ACT-025 | ALL 4 PROFILES | Reports | `#reports/zurf-exports`| `Generate ZURF Export`| EXPORT | `openZurfExportModal` | `POST /api/v1/reports/zurf/export` | `reportController.generateZurfExport` | `zurfService` | `ReportJob` | Org Scope | `reportsAnalyticsMasterControl.test.js`| **COMPLETE_AND_VERIFIED** |
| ACT-026 | ALL 4 PROFILES | Tasks | `#tasks` | `Verify & Complete` | APPROVAL | `openTaskVerificationModal` | `POST /api/v1/tasks/:id/verify` | `taskController.verifyTask` | — | `Task` | Role Policy | `ownerTaskOversight.test.js` | **COMPLETE_AND_VERIFIED** |

### Real Action Count Summary:
- **Total Discrete Interactive Business Actions**: `26`
- **Navigation Route Submodules**: `133` (Representing the 18 Control Centre pages)
- **Completed & Verified**: `24`
- **Blocked Pending Business Formula Confirmation**: `2` (Revenue Share Settlement Draft & Simulation)
- **Broken / Unsupported**: `0`

---
**Inventory Certified:** Accurate mapping of true interactive action triggers vs. navigation routes.
