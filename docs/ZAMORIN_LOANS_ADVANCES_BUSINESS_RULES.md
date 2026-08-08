# Zamorin Cafe ERP - Loans and Advances Business Rules

## Status

**Module status:** `BLOCKED_PENDING_BUSINESS_CONFIRMATION` for approval and financial-policy decisions.

Implementation may proceed only for rules explicitly confirmed below. Unknown business policy must not be invented in code.

## Confirmed Requirements

- Staff must be able to view only their own loans and salary advances.
- The module requires a staff request workflow.
- The module requires approval status.
- The module requires an instalment schedule.
- The module requires outstanding-balance visibility.
- Payroll deduction linkage is required.
- Payroll deduction visibility is required on staff-facing payroll/payslip surfaces.
- Audit events are required.
- Notifications are required.
- Supporting documents are required but must follow the future private-file/object-storage security architecture rather than public URLs.
- Monetary values must use integer paise and INR.
- IDs must be backend-generated through the canonical SequenceCounter service.
- Organisation and employee identity must come from authenticated/backend-authoritative data, not client-controlled organisation or actor fields.

## Confirmed Payroll-Deduction Safety Invariant

The immutable reference implementation establishes the following safe deduction rule:

`applied instalment = min(scheduled instalment, outstanding balance, salary currently available for deduction)`.

A salary shortfall must be recorded explicitly. Payroll must never be pushed negative merely to satisfy a loan/advance instalment, and outstanding balance must decrease only by the amount actually applied.

This invariant may be ported to the canonical backend. The old browser implementation and its sample payroll/statutory data are not authoritative production persistence logic.

## Business Decisions Still Required

The repository and immutable reference do not define these rules. Each remains **BLOCKED pending business confirmation**:

1. **Approval authority** — MASTER only, MASTER + OWNER, or another explicitly approved role matrix.
2. **Who may create requests** — STAFF only or all employee roles for their own loan/advance.
3. **Loan versus salary-advance eligibility** and whether the workflows differ.
4. **Minimum and maximum request amounts**.
5. **Interest policy** — interest-free, fixed interest, reducing balance, or another approved formula.
6. **Instalment derivation** — manually approved amount, number-of-instalments formula, fixed monthly amount, or another rule.
7. **First deduction period** and payroll cut-off behavior.
8. **Early repayment / manual repayment** rules.
9. **Cancellation / withdrawal** rules before and after approval.
10. **Settlement on resignation, termination or final payroll**.
11. **Multiple concurrent loans/advances** and priority ordering when salary is insufficient.
12. **Whether CAFE_ADMIN or OWNER may view employee loan financial data** beyond explicitly approved management scope.
13. **Supporting-document requirement thresholds** and document types.
14. **Notification recipients** for request, approval/rejection, deduction shortfall, completion and overdue states.

## Implementation Boundary Until Decisions Are Confirmed

Do not implement an endpoint that approves, rejects, disburses, calculates interest, generates an instalment schedule from an invented formula, or automatically changes employee debt based on an unconfirmed policy.

Safe foundation work may include the canonical model shape, self-only read/request security, backend identifiers, immutable audit fields, generic request-state validation, and the confirmed payroll-deduction safety invariant, provided those changes do not encode any of the blocked business decisions above.
