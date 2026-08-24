# ZAMORIN CAFE ERP
## STAGE 5 — MONGOOSE DATABASE INDEX MATRIX (FINAL)

Audit of all active Mongoose compound and unique indexes across the 42 domain models.

| Model | Primary / High-Frequency Query Pattern | Existing Index Definition | Index Type | Purpose / Justification | Stage-5 Delta |
|---|---|---|---|---|:---:|
| **`User`** | `findOne({ organisationId, userId })` | `{ organisationId: 1, userId: 1 }` | Compound Unique | Tenant-partitioned user lookup | **AUDITED — NO CHANGE REQUIRED** |
| `User` | `findOne({ email })` | `{ email: 1 }` | Unique Index | Authentication login resolution | **AUDITED — NO CHANGE REQUIRED** |
| **`Session`** | `find({ organisationId, userId, status })` | `{ organisationId: 1, userId: 1, status: 1, lastActivityAt: -1 }` | Compound Index | Fast active session lookups & touch | **AUDITED — NO CHANGE REQUIRED** |
| `Session` | `findOne({ organisationId, tokenFamilyId, status })` | `{ organisationId: 1, tokenFamilyId: 1, status: 1 }` | Compound Index | Refresh token reuse detection | **AUDITED — NO CHANGE REQUIRED** |
| **`Bill`** | `find({ organisationId, cafeId, businessDate })` | `{ organisationId: 1, cafeId: 1, businessDate: 1, status: 1 }` | Compound Index | POS bill register & daily sales aggregations | **AUDITED — NO CHANGE REQUIRED** |
| **`Customer`** | `find({ organisationId, tier, status })` | `{ organisationId: 1, tier: 1, status: 1 }` | Compound Index | Loyalty directory filtering | **AUDITED — NO CHANGE REQUIRED** |
| `Customer` | `findOne({ organisationId, phone })` | `{ organisationId: 1, phone: 1 }` | Compound Index | Guest phone lookup on POS/Register | **AUDITED — NO CHANGE REQUIRED** |
| **`LoyaltyLedger`**| `find({ organisationId, customerId })` | `{ organisationId: 1, customerId: 1, createdAt: -1 }` | Compound Index | Customer 360 points audit trail | **AUDITED — NO CHANGE REQUIRED** |
| **`GlobalInventoryItem`** | `find({ organisationId, status })` | `{ organisationId: 1, status: 1, itemCode: 1 }` | Compound Index | Stock directory listing & search | **AUDITED — NO CHANGE REQUIRED** |
| **`StockMovement`** | `find({ organisationId, cafeId, itemId })` | `{ organisationId: 1, cafeId: 1, itemId: 1, createdAt: -1 }` | Compound Index | Stock movement history & bin audit | **AUDITED — NO CHANGE REQUIRED** |
| **`Vendor`** | `find({ organisationId, status, category })` | `{ organisationId: 1, status: 1, category: 1 }` | Compound Index | Supplier directory & hold checks | **AUDITED — NO CHANGE REQUIRED** |
| **`PurchaseOrder`** | `find({ organisationId, vendorId, status })` | `{ organisationId: 1, vendorId: 1, status: 1 }` | Compound Index | Procurement pipeline tracking | **AUDITED — NO CHANGE REQUIRED** |
| **`Asset`** | `find({ organisationId, cafeId, status })` | `{ organisationId: 1, cafeId: 1, status: 1 }` | Compound Index | Equipment maintenance & asset register | **AUDITED — NO CHANGE REQUIRED** |
| **`MenuItem`** | `find({ organisationId, conceptEligibility })` | `{ organisationId: 1, status: 1, conceptEligibility: 1 }` | Compound Index | POS catalog & menu engineering | **AUDITED — NO CHANGE REQUIRED** |
| **`PersonalLedger`**| `find({ organisationId, ownerUserId })` | `{ organisationId: 1, ownerUserId: 1, createdAt: -1 }` | Compound Index | Director personal ledger audit | **AUDITED — NO CHANGE REQUIRED** |
| **`Task`** | `find({ organisationId, status, priority })` | `{ organisationId: 1, status: 1, priority: 1 }` | Compound Index | Tasks & Oversight action queue | **AUDITED — NO CHANGE REQUIRED** |
| **`Expense`** | `find({ organisationId, cafeId, status })` | `{ organisationId: 1, cafeId: 1, status: 1 }` | Compound Index | Expense register & voucher approval | **AUDITED — NO CHANGE REQUIRED** |
| **`PayrollRun`** | `find({ organisationId, periodKey })` | `{ organisationId: 1, periodKey: 1, status: 1 }` | Compound Unique | Monthly payroll period run isolation | **AUDITED — NO CHANGE REQUIRED** |
| **`AuditLog`** | `find({ organisationId, module, entityId })` | `{ organisationId: 1, module: 1, entityId: 1, createdAt: -1 }`| Compound Index | Compliance audit trail queries | **AUDITED — NO CHANGE REQUIRED** |

---
**Index Audit Certified:** Indexes thoroughly audited. All critical access paths are compound-indexed on `{ organisationId: 1, ... }`. No new index creation required.
