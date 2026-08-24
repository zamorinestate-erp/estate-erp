# ZAMORIN CAFE ERP
# STAGE 4 — IMPLEMENTATION & EXECUTION PLAN
## Deep Functional Workflow Recovery & End-to-End Action Certification

### Target Scope & Context:
- **Workspaces**: Primary Master, Normal Master, Owner, Cafe Operations.
- **Frozen**: Employee / Staff Workspace (Feature frozen, non-destructive regression smoke test only).
- **Settings**: Preserved as rebuilt in Stage 3 pending user review (no structural reorganization).
- **MailOps**: Preserved as retired from user navigation; background messaging intact.

---

### Implementation Phases:

1. **Master Action Inventory (`docs/STAGE_4_MASTER_ACTION_INVENTORY.md`)**:
   - Audit and catalog every interactive control, button, modal, form, submit, row action, and workflow across all 18 Control Centres and 133 routes.
   - Map 1:1 to frontend handler, API route, backend controller, model, RBAC scope, idempotency requirement, and current state.

2. **Stage-3 Deferred Defect Register Handover (`docs/STAGE_4_FUNCTIONAL_DEFECT_REGISTER.md`)**:
   - Import all 7 registered defects (DEF-STG3-001 through DEF-STG3-007) without losing identifiers.
   - Fix P1 Defect DEF-STG3-003: Lost Device Invalidation & Real-Time Push Revocation.
   - Fix P2 Defects (Asset registration, customer registration & 360, adjust points, menu item creation, supplier onboarding & 360, revenue share workflows, administration café actions, expense vouchers, etc.).

3. **Core Domain Workflow Rebuilds & Verification**:
   - **Assets**: Register New Asset complete workflow, auto-ID generation, validation, location assignment, audit.
   - **Inventory**: Add New Item quick action, stock receipt, adjustments, counts, duplicate SKU rejection.
   - **Customers**: Register New Guest, Customer 360 detailed workspace, audited Adjust Points ledger, Tier/Café filters, safe Merge Duplicates.
   - **Menu**: Add Menu Item multi-section arrangement, classifications, pricing, variants, recipes.
   - **Suppliers**: Onboard New Supplier wizard, duplicate GSTIN/PAN detection, Supplier 360 workspace, edits, scoped holds.
   - **Revenue Share**: Commercial space registration, operator onboarding, sales report submission, settlement draft generator with calculation breakdown, simulation mode.
   - **Administration**: Add New Café, Café 360 view, edit, action menus, authoritative filtering.
   - **Devices & Sessions**: Trusted terminal enrollment, registered device count consistency, operator sessions log, operator PIN setup with zero secret exposure.
   - **Expenses & Bills**: Expense voucher builder, spend request, CSV/PDF/XLSX export validation, POS charge flow verification in test environment.
   - **Finance & Personal Ledger**: Transaction journal filters/actions, personal ledger privacy and balance settlement.
   - **Procurement & Quality**: Requisitions, POs, 3-way matching invariants, quality checks, CAPA, governed holds.
   - **Management HRIS & Payroll**: Workforce directory, positions, onboarding, payroll run lifecycle, structured confirmation modals.
   - **Reports & Operational Tasks**: Certified Report Library, ZURF Corporate export, task verification workflows.

4. **Security, Parity & Integrity Verification**:
   - Four-profile parity testing (Primary Master, Normal Master, Owner, Cafe Operations).
   - Global mutation standard enforcement: client validation, authoritative backend validation, duplicate-submission idempotency, audit trail recording, authoritative data refresh.
   - 100% Laptop & Zoom responsive matrix reflow.
   - 4-theme visual contrast verification.
   - Backend automated test suite execution (npm test) and Stage 1-4 audit scripts.

5. **Stage-3 Evidence Housekeeping**:
   - Ensure Cafe Operations dashboard screenshot reference is cleanly associated.
