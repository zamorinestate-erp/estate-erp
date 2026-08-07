# ZAMORIN CAFE ERP — STAGE 8 SECURITY RESULTS
## Security Assessment and Gap Document

Generated: 2026-08-07 | Git HEAD: 6c73fe5

---

## Security Audit Summary

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication on all Stage 8 routes | PASS | All route files call router.use(authenticate) |
| Authorization on all Stage 8 routes | PASS | All routes call authorize() with explicit permissions and allowedRoles |
| Identity from request.auth only | PASS | No controller reads userId/role from request.body or request.query |
| Personal Ledger MASTER-only (404 conceal) | PASS | absoluteRestriction: PERSONAL_LEDGER in personalLedgerRoutes |
| Owner cannot access Personal Ledger | PASS | Removed from navigation.js; 404 returned at API level |
| Staff cannot access Personal Ledger | PASS | 404 returned; no route allows STAFF |
| Cross-organisation isolation | PASS | All queries include organisationId: request.auth.organisationId |
| Cross-cafe isolation for CAFE_ADMIN | PASS | All controllers check cafeId: { $in: request.auth.assignedCafeIds } |
| Dev role switcher removed | PASS | mountRoleSwitcher() removed from main.js (Stage 8 Batch 1) |
| Hardcoded demo names removed | PASS | ROLE_LABELS uses generic labels only |
| Personal Ledger deletion guard | PASS | Pre-hook blocks deleteOne/deleteMany/findOneAndDelete |
| StockMovement deletion guard | PASS | Pre-hook blocks deletion; only reversing entries allowed |
| CafeInventoryConfig atomic update | PASS | Only $inc used for stock balance; direct $set forbidden |
| SequenceCounter — single engine | PASS | All 17 new controllers use SequenceCounter.generateId() |
| Audit recording on mutations | PASS | recordRequestAudit() called in all 17 new controllers |
| Audit actor from request.auth | PASS | auditService derives actor from request.auth |
| No secrets in frontend | PASS | No API keys, JWT secrets, or MongoDB URIs in frontend JS |
| No new notification system | PASS | Stage 8 reuses Notification.js and notificationController.js |
| No duplicate expense workflow | PASS | Expense decisions exclusively in expenseController.js |
| No duplicate payroll workflow | PASS | Payroll unchanged; Stage 8 adds no payroll code |
| Frontend impersonation removed | PASS | impersonation dev tool removed from main.js |

---

## Security Gap: GAP-004 — Approval Bypass (CRITICAL)

**Finding**: `approvalController.decideApproval` does not check `approval.entityType` before allowing OWNER or CAFE_ADMIN to set approval status. If a generic Approval record is created with `entityType: 'EXPENSE'` or `entityType: 'OVERTIME'`, OWNER or CAFE_ADMIN can "decide" it via `POST /api/v1/approvals/:id/decide` without the MASTER-only restriction.

**Risk Level**: HIGH
**Attack Vector**: Authenticated OWNER or CAFE_ADMIN with valid JWT creates or finds an Approval record with entityType=EXPENSE. Calls decide endpoint. Canonical expense workflow is not bypassed (Expense.js status is separate) but an Approval record with a misleading status is created, polluting the approval audit trail.

**Fix**: Add entityType blocklist in decideApproval:
```javascript
const PROTECTED_ENTITY_TYPES = ['EXPENSE', 'OVERTIME', 'PAYROLL', 'PERSONAL_LEDGER'];
if (PROTECTED_ENTITY_TYPES.includes(approval.entityType)) {
  throw new ApiError(403, 'PROTECTED_ENTITY',
    `Approvals of type ${approval.entityType} must be decided through the canonical workflow endpoint.`
  );
}
```
Additionally: if `approval.entityType` is in protected set, only MASTER should be able to decide.

**Status**: OPEN — fix required before Stage 8 security sign-off.

---

## Mock / Placeholder Scan Results

### Backend Controllers — CLEAN
No mock, fake, placeholder, TODO, stub, or simulation strings found in production controller code. Backend is production-path clean.

### Frontend — Legitimate Comments vs. Production Risks

| File | Match | Classification |
|------|-------|---------------|
| main.js | "demo-safe read-only shell" | PRODUCTION RISK — hardcoded MASTER default; fix in Stage 9 |
| main.js | "TODO Stage 2 / Batch frontend-auth" | VALID TODO — documents known gap |
| dashboardMaster.js | hardcoded "Cafe 07 — cash variance ₹850" | PRODUCTION RISK — must be replaced with API hydration |
| dashboardMaster.js | "Simulates progressive loading" | VALID — loading pattern comment |
| navigation.js | "demo-appropriate level" | COMMENT ONLY — no mock logic; update text post-integration |
| notAvailable.js | "this demo covers Command Centre, POS" | COMMENT — update post-integration |
| ist.js | "Simulates the server is the source of truth" | LEGITIMATE TECHNICAL COMMENT |
| staffHome.js | "decorative placeholder or empty onClick" | COMMENT — no production mock logic |
| personalLedger.js | "Do not add any local/demo entry logic" | PROTECTIVE COMMENT — correctly prevents regression |
| expenses.js, cashBook.js, inventory.js | HTML placeholder= attributes | LEGITIMATE HTML form attributes |
| payrollManagement.js | placeholder= attribute | LEGITIMATE HTML form attribute |

**Production risks requiring fix**: main.js MASTER default (Stage 9), dashboardMaster.js hardcoded data (Stage 8 frontend).

---

## Personal Ledger Security Verification

| Check | Status | Evidence |
|-------|--------|----------|
| Removed from Owner navigation | PASS | navigation.js OWNER items list does not include 'own-ledger' |
| Absent from Cafe Admin navigation | PASS | CAFE_ADMIN nav items do not include ledger |
| Absent from Staff navigation | PASS | STAFF nav items do not include ledger |
| Owner API access denied | PASS | absoluteRestriction returns 404 |
| Cafe Admin API access denied | PASS | absoluteRestriction returns 404 |
| Staff API access denied | PASS | absoluteRestriction returns 404 |
| Global search excludes it | PASS | searchController.js does not query PersonalLedger model |
| Dashboard does not leak it | PASS | dashboardController.js does not aggregate PersonalLedger |
| Notifications do not leak it | PASS | No notification event references PersonalLedger data |
| Reports do not leak it | PASS | reportController.js does not export PersonalLedger |
| Guessed record IDs return 404 | PASS | Non-MASTER requests return 404 regardless of record existence |
| Deletion guards active | PASS | Pre-hooks block deleteOne/deleteMany/findOneAndDelete |
| Immutable entry behaviour | PASS | Entries cannot be modified; corrections must post reversing entry |
| Monetary values in paisa integers | PASS | amountPaisa: Number, integer, no floats |

---

## Role Portal Security Verification

| Check | Status | Notes |
|-------|--------|-------|
| MASTER sees all org | PASS (backend) | dashboardController org-wide scope; all controllers |
| OWNER no Personal Ledger | PASS | 404 at API; removed from nav |
| OWNER no Admin | PASS | userRoutes.js MASTER-only restriction enforced |
| OWNER no Audit | PASS | auditRoutes.js MASTER-only restriction enforced |
| OWNER no Trash | PASS | trashRoutes.js MASTER-only |
| CAFE_ADMIN assigned cafes only | PASS | All controllers check assignedCafeIds intersection |
| STAFF self-service only | PASS | Employee routes check self-scope |
| Frontend role isolation | PARTIAL | Frontend reads from state.role (local) not API — Stage 9 gap |
