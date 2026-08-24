# ZAMORIN CAFE ERP
## STAGE 4 — FOUR-PROFILE FUNCTIONAL PARITY MATRIX

Parity verification for all shared management actions across the 4 profiles.

| Common Action / Workflow | PRIMARY MASTER | NORMAL MASTER | OWNER | CAFE OPERATIONS | Notes / Policy Scope |
|---|:---:|:---:|:---:|:---:|---|
| **Register New Asset** | **PASS** | **PASS** | **PASS** | **PASS** | Shared wizard with role-specific café assignment scope |
| **Add New Inventory Item** | **PASS** | **PASS** | `N/A — POLICY` | **PASS** | Owner is read-only governance for stock master |
| **Register New Guest** | **PASS** | **PASS** | **PASS** | **PASS** | Shared guest creation across all 4 management workspaces |
| **Customer 360 Workspace** | **PASS** | **PASS** | **PASS** | **PASS** | Full profile view, loyalty stats, and purchase history |
| **Adjust Loyalty Points** | **PASS** | `N/A — POLICY` | **PASS** | `N/A — POLICY` | Restricted to Master & Owner governance |
| **Merge Customer Duplicates**| **PASS** | `N/A — POLICY` | `N/A — POLICY` | `N/A — POLICY` | High-risk identity merge restricted to Primary Master |
| **Add Menu Item** | **PASS** | `N/A — POLICY` | `N/A — POLICY` | `N/A — POLICY` | Primary Master central menu governance |
| **Simulate POS Cart Pricing**| **PASS** | **PASS** | **PASS** | **PASS** | Multi-modifier pricing simulation without accounting posting |
| **Onboard New Supplier** | **PASS** | **PASS** | **PASS** | `N/A — POLICY` | Supplier master governance restricted to HQ management |
| **Supplier 360 Workspace** | **PASS** | **PASS** | **PASS** | **PASS** | Banking details masked according to role permissions |
| **Place / Release Supplier Hold**| **PASS** | `N/A — POLICY` | **PASS** | `N/A — POLICY` | Maker-checker hold placement |
| **Register Commercial Space** | **PASS** | `N/A — POLICY` | **PASS** | `N/A — POLICY` | Outlet leasing and revenue share master governance |
| **Generate Settlement Draft**| **PASS** | `N/A — POLICY` | **PASS** | `N/A — POLICY` | Draft generation with formulaic calculations |
| **Add New Café** | **PASS** | `N/A — POLICY` | `N/A — POLICY` | `N/A — POLICY` | Organisation creation restricted to Primary Master |
| **Enroll Trusted Terminal** | **PASS** | `N/A — POLICY` | `N/A — POLICY` | `N/A — POLICY` | Hardware attestation restricted to Master Administrator |
| **Operator PIN Setup** | **PASS** | **PASS** | **PASS** | **PASS** | PIN setup with zero plain-text logging |
| **Submit Expense Voucher** | **PASS** | **PASS** | **PASS** | **PASS** | Shared multi-section voucher creation |
| **Settle Personal Ledger** | `N/A — POLICY` | `N/A — POLICY` | **PASS** | `N/A — POLICY` | Owner-specific Director capital & loan settlement |
| **Generate ZURF Report Export**| **PASS** | **PASS** | **PASS** | **PASS** | Certified export generator with watermark & classification |
| **Task Decision / Verification**| **PASS** | **PASS** | **PASS** | **PASS** | Role-scoped task queue with audited verification |

---
**Parity Certified:** 100% functional parity achieved across applicable management scopes with zero unauthorized privilege escalation.
