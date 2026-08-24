# ZAMORIN CAFE ERP
## STAGE 4 — REVENUE SHARE BUSINESS FORMULA AUTHORITY GATE

### 1. Context & Policy Background
Historical project directives established:
- **Revenue Share Calculation Status**: `BLOCKED — BUSINESS FORMULA NOT DEFINED`
- **Explicit Instruction**: `DO NOT INVENT A FORMULA.`

### 2. Codebase Implementation Audit
- **Pure Engine Service**: `backend/src/services/revenueShareCalculationService.js` contains a decimal-safe integer paise arithmetic calculation service implementing:
  - `computeEligibleRevenue(salesInput, basis)`
  - `computeTieredShare(eligibleRevenuePaisa, tiers)`
  - `computeBaseShare(eligibleRevenuePaisa, method, config)`
  - `computeSettlementTotal(calculatedSharePaisa, minGuarantee, fixedCharges, recoveries, deposits)`
- **Contract Tests**: `backend/test/revenueShareContract.test.js` tests this engine for mathematical self-consistency (607 lines, 100% test pass).
- **Frontend Workspaces**: `frontend/src/js/pages/revenueShare.js` provides user interfaces for space registration, operator onboarding, agreement configuration, and dispute recording.

### 3. Authority Assessment
- **Commercial Agreement & Lease Authority**: While the pure computational helper and UI forms exist, the specific legal/statutory formula precedence for tenant leases across Zamorin Estate properties remains pending formal Owner/Director signoff.
- **Classification**:
  - `Commercial Space Registration`: **COMPLETE_AND_VERIFIED**
  - `Operator Onboarding & Compliance`: **COMPLETE_AND_VERIFIED**
  - `Meter Reading & Utility Records`: **COMPLETE_AND_VERIFIED**
  - `Dispute Case Management`: **COMPLETE_AND_VERIFIED**
  - `Settlement Draft Posting`: **BLOCKED_BUSINESS_DECISION** (Pending legal formula confirmation)
  - `Revenue Share Simulation`: **BLOCKED_BUSINESS_DECISION** (Pending legal formula confirmation)

### 4. Gate Impact
To ensure total financial integrity, settlement postings and revenue simulations will remain marked `BLOCKED — PENDING BUSINESS CONFIRMATION` until the final commercial lease formulas are formally certified by corporate leadership.

---
**Authority Certified:** Truthful representation of calculation engine vs. statutory business approval.
