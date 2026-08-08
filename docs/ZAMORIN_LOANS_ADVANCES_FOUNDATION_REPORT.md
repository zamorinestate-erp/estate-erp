# Zamorin Cafe ERP - Loans and Advances Foundation Report

## 1. Executive Status
- **Baseline Commit**: `ed0d50e` (`feat(loans): expose self service profile availability`)
- **Branch**: `main`
- **Module Status**: **`PARTIALLY_COMPLETE`**
- **Policy-Sensitive Remainder**: **`BLOCKED_PENDING_BUSINESS_CONFIRMATION`**
- **Cloud State**: local implementation complete only for the policy-neutral foundation; deployed validation remains pending.

## 2. Verification
| Scope | Tests | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|
| `backend/test/staffLoanAdvanceModel.test.js` | 5 | 5 | 0 | 0 |
| `backend/test/loanAdvanceService.test.js` | 5 | 5 | 0 | 0 |
| `backend/test/loanAdvanceSelfServiceApi.test.js` | 4 | 4 | 0 | 0 |
| Complete backend regression (`node --test`) | 197 | 197 | 0 | 0 |

## 3. Implemented Foundation
- Canonical `StaffLoanAdvance` persistence model using INR integer paise and backend-authoritative identity fields.
- Neutral request types `LOAN` and `SALARY_ADVANCE`.
- Neutral persistence statuses `REQUESTED`, `APPROVED`, `REJECTED`; no approval authority or decision endpoint is implemented.
- Confirmed payroll-deduction invariant:
  `applied instalment = min(scheduled instalment, outstanding balance, salary currently available for deduction)`.
- Shortfall is explicit; salary cannot be driven negative by the helper.
- Authenticated self-service list/detail API under `/api/v1/loan-advances/me`.
- Self-only filtering and cross-user concealment.
- Read-only frontend Loans & Advances page integrated into navigation/router.
- Employee profile reports `SELF_SERVICE_INTEGRATED` only for the authenticated employee viewing their own profile.

## 4. Canonical Surface
Backend:
- `backend/src/models/StaffLoanAdvance.js`
- `backend/src/services/loanAdvanceService.js`
- `backend/src/controllers/loanAdvanceController.js`
- `backend/src/routes/loanAdvanceRoutes.js`
- `backend/src/services/employeeReadService.js`
- `backend/test/staffLoanAdvanceModel.test.js`
- `backend/test/loanAdvanceService.test.js`
- `backend/test/loanAdvanceSelfServiceApi.test.js`
- `backend/test/employeeReadService.test.js`

Frontend:
- `frontend/src/js/pages/staffLoansAdvances.js`
- `frontend/src/js/navigation.js`
- `frontend/src/js/router.js`

Governance:
- `docs/ZAMORIN_LOANS_ADVANCES_BUSINESS_RULES.md`
- `docs/ZAMORIN_STAGE_2_EMPLOYEE_CONTRACT.md`
- `docs/ZAMORIN_STAGE_2_EMPLOYEE_PERMISSION_MATRIX.md`

## 5. Blocked / Not Yet Implemented
Do not implement or infer until business confirmation:
- request-creation role policy;
- approval/rejection authority and workflow;
- eligibility, min/max amounts and interest;
- instalment derivation, tenure, first deduction and cut-off;
- disbursement, early/manual repayment, cancellation and final-settlement rules;
- concurrent-debt ordering;
- OWNER/CAFE_ADMIN management visibility;
- supporting-document thresholds and private object-storage workflow;
- notification recipients;
- authoritative outstanding-balance mutation and automatic payroll debt mutation.

## 6. Closure Rule
This checkpoint closes only the policy-neutral Loans/Advances foundation. The full module remains **`PARTIALLY_COMPLETE`** with policy-sensitive lifecycle work **`BLOCKED_PENDING_BUSINESS_CONFIRMATION`**. Cloud/staging validation is also pending.
